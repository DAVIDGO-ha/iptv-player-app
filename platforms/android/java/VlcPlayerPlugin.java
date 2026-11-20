package com.iptvplayer.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
@CapacitorPlugin(name = "VlcPlayer")
public class VlcPlayerPlugin extends Plugin {

    // Stable hardware ID (survives reinstall / clearing data) → same MAC Address and same free trial for this device
    @PluginMethod
    public void hwid(PluginCall call) {
        String id = null;
        try {
            id = android.provider.Settings.Secure.getString(getContext().getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        } catch (Exception ignored) {}
        com.getcapacitor.JSObject r = new com.getcapacitor.JSObject();
        r.put("id", id == null ? "" : id);
        call.resolve(r);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("No url");
            return;
        }
        embedRelease(); // the small player lets go of the stream first: the line has one connection
        // Settings › Video engine: VLC (default: every picture & sound format) or ExoPlayer
        boolean exo = "exo".equals(call.getString("engine", "vlc"));
        Intent i = new Intent(getContext(), exo ? ExoActivity.class : VlcActivity.class);
        i.putExtra("url", url);
        i.putExtra("title", call.getString("title", ""));
        i.putExtra("ua", call.getString("ua", "IPTVSmartersPlayer"));
        i.putExtra("live", call.getBoolean("live", false));
        // optional channel / episode list: Up/Down and CH+/CH– switch inside the player
        try {
            JSArray urls = call.getArray("urls");
            JSArray titles = call.getArray("titles");
            if (urls != null && urls.length() > 1) {
                String[] u = new String[urls.length()];
                String[] t = new String[urls.length()];
                for (int k = 0; k < u.length; k++) {
                    u[k] = urls.getString(k);
                    t[k] = titles != null && k < titles.length() ? titles.getString(k) : "";
                }
                i.putExtra("urls", u);
                i.putExtra("titles", t);
                i.putExtra("index", call.getInt("index", 0));
            }
        } catch (Exception ignored) {}
        Double start = call.getDouble("start", 0.0);
        i.putExtra("start", (long) ((start == null ? 0.0 : start) * 1000));
        try {
            startActivityForResult(call, i, "onResult");
        } catch (Exception e) {
            // e.g. a channel list too big for Android → the app falls back to the built-in player instead of closing
            call.reject("Pro player could not open: " + e.getMessage());
        }
    }

    // ——— Small player (libVLC) shown INSIDE the app screen, next to the channel list — like Hot Player / IBO Player.
    // The web page tells us where its preview box is; the VLC picture is placed exactly on top of that box.
    // One connection only: VLC keeps the same connection and reconnects by itself when a live stream drops. ———
    private org.videolan.libvlc.LibVLC eLib;
    private org.videolan.libvlc.MediaPlayer eMp;
    private org.videolan.libvlc.util.VLCVideoLayout eLayout;
    private android.widget.FrameLayout eBox;
    // ExoPlayer engine for the small player (Settings › Video engine › ExoPlayer)
    private androidx.media3.exoplayer.ExoPlayer xMp;
    private androidx.media3.ui.PlayerView xView;
    private boolean eExo = false;
    private String eUrl = null;
    private String eUa = "IPTVSmartersPlayer";
    private boolean eLive = true;
    private boolean eHw = true;
    private boolean eGotVideo = false;
    private boolean eEverPlayed = false;
    private boolean eWasPlaying = false; // stopped because the app went to the background → resume when it comes back
    private volatile String eState = "idle"; // idle | loading | playing | error
    private int eRetries = 0;
    private long eGoodAt = 0;
    private int eRe = 0;
    private int eGen = 0; // every new channel gets a number → late timers of an old channel do nothing
    private final android.os.Handler eH = new android.os.Handler(android.os.Looper.getMainLooper());

    private void ui(Runnable r) {
        android.app.Activity a = getActivity();
        if (a != null) a.runOnUiThread(r);
    }

    private void embedEnsure() {
        if (eBox == null) {
            eBox = new android.widget.FrameLayout(getContext());
            eBox.setBackgroundColor(android.graphics.Color.BLACK);
            eBox.setClickable(false);
            eBox.setFocusable(false);
            eBox.setDescendantFocusability(android.view.ViewGroup.FOCUS_BLOCK_DESCENDANTS); // the remote stays on the list
            eLayout = new org.videolan.libvlc.util.VLCVideoLayout(getContext());
            eLayout.setFocusable(false);
            eBox.addView(eLayout, new android.widget.FrameLayout.LayoutParams(-1, -1));
            eBox.setVisibility(android.view.View.INVISIBLE);
            getActivity().addContentView(eBox, new android.widget.FrameLayout.LayoutParams(16, 9));
        }
        if (eExo) {
            embedEnsureExo();
            return;
        }
        if (xView != null) xView.setVisibility(android.view.View.GONE);
        eLayout.setVisibility(android.view.View.VISIBLE);
        if (eMp == null) {
            java.util.ArrayList<String> opts = new java.util.ArrayList<>();
            opts.add("--network-caching=2000");
            opts.add("--http-reconnect");
            opts.add("--audio-time-stretch");
            eLib = new org.videolan.libvlc.LibVLC(getContext(), opts);
            eMp = new org.videolan.libvlc.MediaPlayer(eLib);
            eMp.setEventListener(e -> {
                switch (e.type) {
                    case org.videolan.libvlc.MediaPlayer.Event.Playing:
                        eState = "playing";
                        eEverPlayed = true;
                        eGoodAt = System.currentTimeMillis();
                        break;
                    case org.videolan.libvlc.MediaPlayer.Event.Vout:
                        if (e.getVoutCount() > 0) eGotVideo = true;
                        break;
                    case org.videolan.libvlc.MediaPlayer.Event.EndReached:
                    case org.videolan.libvlc.MediaPlayer.Event.EncounteredError:
                        embedRetry();
                        break;
                }
            });
            eMp.attachViews(eLayout, null, false, false);
        }
    }

    private void embedEnsureExo() {
        eLayout.setVisibility(android.view.View.GONE);
        if (xView == null) {
            xView = new androidx.media3.ui.PlayerView(getContext());
            xView.setUseController(false);
            xView.setFocusable(false);
            xView.setClickable(false);
            eBox.addView(xView, new android.widget.FrameLayout.LayoutParams(-1, -1));
        }
        xView.setVisibility(android.view.View.VISIBLE);
        if (xMp == null) {
            androidx.media3.datasource.DefaultHttpDataSource.Factory http = new androidx.media3.datasource.DefaultHttpDataSource.Factory()
                .setUserAgent(eUa)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(20000);
            xMp = new androidx.media3.exoplayer.ExoPlayer.Builder(getContext(), new androidx.media3.exoplayer.DefaultRenderersFactory(getContext()).setEnableDecoderFallback(true))
                .setMediaSourceFactory(new androidx.media3.exoplayer.source.DefaultMediaSourceFactory(getContext()).setDataSourceFactory(http))
                .build();
            xMp.addListener(new androidx.media3.common.Player.Listener() {
                @Override
                public void onPlaybackStateChanged(int st) {
                    if (st == androidx.media3.common.Player.STATE_READY) {
                        eState = "playing";
                        eEverPlayed = true;
                        eGoodAt = System.currentTimeMillis();
                    }
                    if (st == androidx.media3.common.Player.STATE_ENDED) embedRetry();
                }

                @Override
                public void onRenderedFirstFrame() {
                    eGotVideo = true;
                }

                @Override
                public void onPlayerError(androidx.media3.common.PlaybackException e) {
                    embedRetry();
                }
            });
            xView.setPlayer(xMp);
        }
    }

    // (Re)start the current link on the chosen engine
    private void embedStart() {
        if (eExo) {
            androidx.media3.common.MediaItem.Builder mb = new androidx.media3.common.MediaItem.Builder().setUri(android.net.Uri.parse(eUrl));
            String path = eUrl.split("\\?")[0].toLowerCase();
            if (path.endsWith(".m3u8") || path.contains("/hls/")) mb.setMimeType(androidx.media3.common.MimeTypes.APPLICATION_M3U8);
            xMp.stop();
            xMp.setMediaItem(mb.build());
            xMp.prepare();
            xMp.setPlayWhenReady(true);
        } else {
            eMp.stop();
            embedLoad();
            eMp.play();
        }
    }

    private void embedStopPlayers() {
        try { if (eMp != null) eMp.stop(); } catch (Throwable ignored) {}
        try { if (xMp != null) xMp.stop(); } catch (Throwable ignored) {}
    }

    // Live stream closed by the server / network blip → same link again after a short wait (never two connections at once)
    private void embedRetry() {
        if (eUrl == null) return;
        if (eGoodAt > 0 && System.currentTimeMillis() - eGoodAt > 60000) eRetries = 0; // it played well for a minute → fresh retries
        eGoodAt = 0;
        if (!eLive || ++eRetries > (eEverPlayed ? 6 : 2)) { // never played at all → give up sooner
            eState = "error";
            return;
        }
        eState = "loading";
        final int gen = eGen;
        final int re = ++eRe; // "ended" and "error" can both arrive for one drop → only one reconnect
        eH.postDelayed(() -> {
            if (gen != eGen || re != eRe || eUrl == null) return;
            try {
                embedStart();
            } catch (Throwable ex) {
                eState = "error";
            }
        }, Math.min(3000L * eRetries, 10000L));
    }

    private void embedLoad() {
        org.videolan.libvlc.Media m = new org.videolan.libvlc.Media(eLib, android.net.Uri.parse(eUrl));
        m.setHWDecoderEnabled(eHw, false);
        if (!eHw) m.addOption(":codec=avcodec,all");
        if (eUa != null) m.addOption(":http-user-agent=" + eUa);
        eMp.setMedia(m);
        m.release();
    }

    // x, y, w, h = the preview box as fractions (0–1) of the web page
    private void embedPlace(PluginCall call) {
        if (eBox == null) return;
        Double fx = call.getDouble("x", 0.0), fy = call.getDouble("y", 0.0), fw = call.getDouble("w", 0.0), fh = call.getDouble("h", 0.0);
        android.view.View wv = getBridge().getWebView();
        android.view.View content = getActivity().findViewById(android.R.id.content);
        int W = wv.getWidth(), H = wv.getHeight();
        int w = (int) Math.round((fw == null ? 0 : fw) * W), h = (int) Math.round((fh == null ? 0 : fh) * H);
        if (w < 8 || h < 8 || W == 0 || H == 0) { // hidden (a window is open on top, or the box is off the screen)
            eBox.setVisibility(android.view.View.INVISIBLE);
            return;
        }
        int[] a = new int[2], b = new int[2];
        wv.getLocationInWindow(a);
        if (content != null) content.getLocationInWindow(b);
        android.view.ViewGroup.LayoutParams lp = eBox.getLayoutParams();
        if (lp.width != w || lp.height != h) {
            lp.width = w;
            lp.height = h;
            eBox.setLayoutParams(lp);
        }
        eBox.setX(a[0] - b[0] + Math.round((fx == null ? 0 : fx) * W));
        eBox.setY(a[1] - b[1] + Math.round((fy == null ? 0 : fy) * H));
        eBox.setVisibility(android.view.View.VISIBLE);
    }

    @PluginMethod
    public void embedPlay(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("No url");
            return;
        }
        ui(() -> {
            try {
                eUa = call.getString("ua", "IPTVSmartersPlayer");
                eExo = "exo".equals(call.getString("engine", "vlc"));
                embedStopPlayers(); // the other engine (if the setting was changed) lets go of the stream first
                embedEnsure();
                eGen++;
                eH.removeCallbacksAndMessages(null);
                eUrl = url;
                eLive = call.getBoolean("live", true);
                eHw = true;
                eGotVideo = false;
                eEverPlayed = false;
                eRetries = 0;
                eGoodAt = 0;
                eState = "loading";
                embedPlace(call);
                embedStart();
                // Sound but no picture after a while (old devices: hardware decoder can't show this video) → software decoding
                final int gen = eGen;
                eH.postDelayed(() -> {
                    if (gen != eGen || eExo || eMp == null || eGotVideo || !eHw || eMp.getVideoTracksCount() <= 0) return;
                    eHw = false;
                    eMp.stop();
                    embedLoad();
                    eMp.play();
                }, 8000);
                call.resolve();
            } catch (Throwable t) {
                eState = "error";
                call.reject("Small player could not start: " + t.getMessage());
            }
        });
    }

    @PluginMethod
    public void embedRect(PluginCall call) {
        ui(() -> {
            try { embedPlace(call); } catch (Throwable ignored) {}
            call.resolve();
        });
    }

    @PluginMethod
    public void embedState(PluginCall call) {
        JSObject o = new JSObject();
        o.put("state", eState);
        o.put("video", eGotVideo);
        call.resolve(o);
    }

    @PluginMethod
    public void embedStop(PluginCall call) {
        ui(() -> {
            embedHalt();
            call.resolve();
        });
    }

    // Stop the stream and hide the picture (the player itself is kept for the next channel: faster zapping)
    private void embedHalt() {
        eGen++;
        eH.removeCallbacksAndMessages(null);
        eUrl = null;
        eWasPlaying = false;
        eState = "idle";
        embedStopPlayers();
        if (eBox != null) eBox.setVisibility(android.view.View.INVISIBLE);
    }

    private void embedRelease() {
        ui(this::embedHalt);
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        // App in the background (or the full-screen player on top): free the line's connection
        if (eUrl != null) {
            eWasPlaying = true;
            eGen++;
            eH.removeCallbacksAndMessages(null);
            embedStopPlayers();
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (eWasPlaying && eUrl != null) {
            eWasPlaying = false;
            eState = "loading";
            eRetries = 0;
            try {
                embedStart();
            } catch (Throwable ignored) {}
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            eH.removeCallbacksAndMessages(null);
            if (eMp != null) { eMp.stop(); eMp.detachViews(); eMp.release(); }
            if (eLib != null) eLib.release();
            if (xMp != null) xMp.release();
        } catch (Throwable ignored) {}
        xMp = null;
        eMp = null;
        eLib = null;
        super.handleOnDestroy();
    }

    // ——— Recording: saves a live channel to the app's Movies folder (keeps going while you watch something else) ———
    private static final java.util.Map<String, Rec> RECS = new java.util.concurrent.ConcurrentHashMap<>();

    private static class Rec {
        volatile boolean stop = false;
        volatile java.net.HttpURLConnection conn;
        java.io.File file;
    }

    private java.io.File recDir() {
        java.io.File base = getContext().getExternalFilesDir(android.os.Environment.DIRECTORY_MOVIES);
        if (base == null) base = new java.io.File(getContext().getFilesDir(), "Movies");
        java.io.File d = new java.io.File(base, "IPTV PLAYER");
        d.mkdirs();
        return d;
    }

    @PluginMethod
    public void recStart(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.matches("(?i)^https?://.*")) {
            call.reject("No url");
            return;
        }
        final boolean live = call.getBoolean("live", true);
        final String ua = call.getString("ua", "IPTVSmartersPlayer");
        String name = call.getString("name", "Recording").replaceAll("[\\\\/:*?\"<>|]+", " ").trim();
        if (name.isEmpty()) name = "Recording";
        if (name.length() > 90) name = name.substring(0, 90);
        final String id = String.valueOf(System.currentTimeMillis());
        final Rec r = new Rec();
        r.file = new java.io.File(recDir(), name + ".ts");
        RECS.put(id, r);
        new Thread(() -> {
            int fails = 0;
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(r.file, true)) {
                byte[] buf = new byte[65536];
                while (!r.stop && fails < 30) {
                    boolean ended = false;
                    try {
                        String u = url;
                        java.net.HttpURLConnection c = null;
                        for (int hop = 0; hop < 5; hop++) { // follow redirects (also http → https)
                            c = (java.net.HttpURLConnection) new java.net.URL(u).openConnection();
                            c.setInstanceFollowRedirects(false);
                            c.setRequestProperty("User-Agent", ua);
                            c.setRequestProperty("X-Recorder", "1");
                            c.setConnectTimeout(15000);
                            c.setReadTimeout(30000);
                            int code = c.getResponseCode();
                            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                                u = new java.net.URL(new java.net.URL(u), c.getHeaderField("Location")).toString();
                                c.disconnect();
                                continue;
                            }
                            break;
                        }
                        r.conn = c;
                        java.io.InputStream in = c.getInputStream();
                        int n;
                        while (!r.stop && (n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                            fails = 0;
                        }
                        ended = true;
                    } catch (Exception e) {
                        fails++;
                    } finally {
                        if (r.conn != null) r.conn.disconnect();
                    }
                    if (r.stop || (ended && !live)) break; // a catch-up / movie file is finished
                    try { Thread.sleep(fails > 0 ? 3000 : 800); } catch (InterruptedException e) { break; }
                }
            } catch (Exception ignored) {}
            RECS.remove(id);
        }).start();
        JSObject o = new JSObject();
        o.put("id", id);
        o.put("file", r.file.getAbsolutePath());
        call.resolve(o);
    }

    @PluginMethod
    public void recStop(PluginCall call) {
        Rec r = RECS.remove(call.getString("id", ""));
        if (r != null) {
            r.stop = true;
            try { if (r.conn != null) r.conn.disconnect(); } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void recList(PluginCall call) {
        JSArray a = new JSArray();
        java.io.File[] fs = recDir().listFiles();
        if (fs != null) for (java.io.File f : fs) {
            if (!f.isFile()) continue;
            JSObject o = new JSObject();
            o.put("name", f.getName().replaceAll("\\.(ts|mp4|mkv)$", ""));
            o.put("file", f.getAbsolutePath());
            o.put("size", f.length());
            o.put("date", f.lastModified());
            a.put(o);
        }
        JSObject r = new JSObject();
        r.put("files", a);
        call.resolve(r);
    }

    @PluginMethod
    public void recDelete(PluginCall call) {
        try {
            java.io.File f = new java.io.File(call.getString("file", ""));
            if (f.getCanonicalPath().startsWith(recDir().getCanonicalPath() + java.io.File.separator)) f.delete();
        } catch (Exception ignored) {}
        call.resolve();
    }

    @ActivityCallback
    private void onResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject o = new JSObject();
        Intent d = result.getData();
        o.put("pos", d != null ? d.getLongExtra("pos", 0) / 1000.0 : 0);
        o.put("dur", d != null ? d.getLongExtra("dur", 0) / 1000.0 : 0);
        o.put("index", d != null ? d.getIntExtra("index", 0) : 0);
        call.resolve(o);
    }
}
