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
        Intent i = new Intent(getContext(), VlcActivity.class);
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
        startActivityForResult(call, i, "onResult");
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
