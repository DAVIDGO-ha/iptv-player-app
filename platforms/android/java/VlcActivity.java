package com.iptvplayer.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;
import java.util.ArrayList;
import org.videolan.libvlc.LibVLC;
import org.videolan.libvlc.Media;
import org.videolan.libvlc.MediaPlayer;
import org.videolan.libvlc.util.VLCVideoLayout;

// Full-screen "Pro player" (libVLC): decodes every audio format, so channels/movies with
// Dolby (AC3 / E-AC3) or DTS sound play WITH sound.
public class VlcActivity extends Activity {
    private LibVLC lib;
    private MediaPlayer mp;
    private VLCVideoLayout layout;
    private TextView info;
    private ProgressBar spin;
    private long start;
    private boolean live;
    private Uri uri;
    private String ua;
    private boolean gotVideo = false;
    private boolean softMode = false;
    private boolean checkPosted = false;
    private String[] urls;
    private String[] titles;
    private int index = 0;
    private int retries = 0;
    private int reGen = 0;
    private long goodAt = 0;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hide = () -> { if (info != null) info.setVisibility(View.GONE); };
    // Bottom bar: time + seek bar (movies / episodes) and the Sound / Subtitles buttons — touch and remote (MENU key)
    private LinearLayout bar;
    private SeekBar seekBar;
    private TextView tPos, tDur;
    private boolean dragging = false;
    private boolean okLong = false;
    private static final int SPU_NONE = Integer.MIN_VALUE;
    private int spuWant = SPU_NONE; // subtitle chosen by the viewer: put back after a reconnect / video-mode switch
    private final Runnable hideBar = () -> { if (bar != null && !dragging) bar.setVisibility(View.GONE); };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        layout = new VLCVideoLayout(this);
        root.addView(layout, new FrameLayout.LayoutParams(-1, -1));
        spin = new ProgressBar(this);
        root.addView(spin, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));
        info = new TextView(this);
        info.setTextColor(Color.WHITE);
        info.setTextSize(18);
        info.setPadding(36, 24, 36, 24);
        info.setBackgroundColor(0x99000000);
        root.addView(info, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        // first tap shows the bar, a tap while it is shown pauses / plays
        root.setOnClickListener(v -> { if (bar.getVisibility() == View.VISIBLE) togglePause(); showBar(); });
        // long tap / hold OK: Sound / Subtitles
        root.setOnLongClickListener(v -> { trackMenu(); return true; });

        Intent i = getIntent();
        start = i.getLongExtra("start", 0);
        live = i.getBooleanExtra("live", false);

        bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(0x99000000);
        bar.setPadding(28, 14, 28, 14);
        tPos = label("0:00");
        tDur = label("0:00");
        seekBar = new SeekBar(this);
        seekBar.setMax(1000);
        seekBar.setFocusable(false); // the remote seeks with Left / Right
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar sb, int p, boolean fromUser) {
                if (fromUser && mp != null) tPos.setText(fmt(mp.getLength() * p / 1000));
            }

            @Override
            public void onStartTrackingTouch(SeekBar sb) {
                dragging = true;
                h.removeCallbacks(hideBar);
            }

            @Override
            public void onStopTrackingTouch(SeekBar sb) {
                dragging = false;
                if (mp != null && mp.getLength() > 0) mp.setTime(mp.getLength() * sb.getProgress() / 1000);
                showBar();
            }
        });
        if (live) {
            View gap = new View(this);
            bar.addView(gap, new LinearLayout.LayoutParams(0, 1, 1f));
        } else {
            bar.addView(tPos);
            bar.addView(seekBar, new LinearLayout.LayoutParams(0, -2, 1f));
            bar.addView(tDur);
        }
        TextView bAudio = label("Sound");
        bAudio.setOnClickListener(v -> pickTrack(true));
        TextView bSubs = label("Subtitles");
        bSubs.setOnClickListener(v -> pickTrack(false));
        bar.addView(bAudio);
        bar.addView(bSubs);
        bar.setVisibility(View.GONE);
        root.addView(bar, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));
        setContentView(root);
        show(i.getStringExtra("title"));

        ArrayList<String> opts = new ArrayList<>();
        opts.add("--network-caching=2000");
        opts.add("--http-reconnect");
        opts.add("--audio-time-stretch");
        lib = new LibVLC(this, opts);
        mp = new MediaPlayer(lib);
        mp.setEventListener(e -> {
            switch (e.type) {
                case MediaPlayer.Event.Playing:
                    spin.setVisibility(View.GONE);
                    goodAt = System.currentTimeMillis();
                    if (start > 0 && !live) { mp.setTime(start); start = 0; }
                    if (!checkPosted) { checkPosted = true; h.postDelayed(this::checkPicture, 6000); }
                    if (spuWant != SPU_NONE) h.postDelayed(this::restoreSpu, 2500);
                    break;
                case MediaPlayer.Event.Vout:
                    if (e.getVoutCount() > 0) gotVideo = true;
                    break;
                case MediaPlayer.Event.TimeChanged:
                    if (!live && !dragging && bar.getVisibility() == View.VISIBLE) updateBar();
                    break;
                case MediaPlayer.Event.Buffering:
                    spin.setVisibility(e.getBuffering() < 100f ? View.VISIBLE : View.GONE);
                    break;
                case MediaPlayer.Event.EndReached:
                    if (live) reconnect(); // a live channel never really ends: the server closed the stream → same link again
                    else if (urls != null && index < urls.length - 1) zap(1); // next episode
                    else finishWithPos();
                    break;
                case MediaPlayer.Event.EncounteredError:
                    if (live) reconnect();
                    else show("This stream could not be played.");
                    break;
            }
        });
        uri = Uri.parse(i.getStringExtra("url"));
        ua = i.getStringExtra("ua");
        urls = i.getStringArrayExtra("urls");
        titles = i.getStringArrayExtra("titles");
        index = i.getIntExtra("index", 0);
        load(true);
    }

    // Live stream dropped → wait a little (the server frees the line's connection), then the same link again
    private void reconnect() {
        if (mp == null) return;
        if (goodAt > 0 && System.currentTimeMillis() - goodAt > 60000) retries = 0; // it played well for a minute → fresh retries
        goodAt = 0;
        if (++retries > 6) {
            spin.setVisibility(View.GONE);
            show("The stream stopped. Check your internet, then try again.");
            return;
        }
        spin.setVisibility(View.VISIBLE);
        final int gen = ++reGen;
        h.postDelayed(() -> {
            if (mp == null || gen != reGen || isFinishing()) return;
            mp.stop();
            load(!softMode);
            mp.play();
        }, Math.min(3000L * retries, 10000L));
    }

    // Up/Down, CH+/CH–: next / previous channel (or episode)
    private void zap(int dir) {
        if (urls == null || urls.length < 2 || mp == null) return;
        index = (index + dir + urls.length) % urls.length;
        uri = Uri.parse(urls[index]);
        retries = 0;
        goodAt = 0;
        reGen++;
        gotVideo = false;
        softMode = false;
        checkPosted = false;
        spuWant = SPU_NONE; // another channel / episode has its own subtitles
        start = 0;
        spin.setVisibility(View.VISIBLE);
        show(titles != null && index < titles.length ? titles[index] : "");
        mp.stop();
        load(true);
        mp.play();
    }

    private void load(boolean hw) {
        Media m = new Media(lib, uri);
        m.setHWDecoderEnabled(hw, false);
        if (!hw) m.addOption(":codec=avcodec,all");
        if (ua != null) m.addOption(":http-user-agent=" + ua);
        mp.setMedia(m);
        m.release();
    }

    // Sound but no picture (hardware decoder can't show this video on older devices) → software decoding
    private void checkPicture() {
        if (mp == null || gotVideo || softMode || mp.getVideoTracksCount() <= 0) return;
        softMode = true;
        long t = mp.getTime();
        show("Switching to compatible video mode…");
        mp.stop();
        load(false);
        start = live ? 0 : t;
        checkPosted = true;
        mp.play();
    }

    private void show(String t) {
        if (t == null || t.isEmpty()) return;
        info.setText(t);
        info.setVisibility(View.VISIBLE);
        h.removeCallbacks(hide);
        h.postDelayed(hide, 4000);
    }

    private TextView label(String t) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextColor(Color.WHITE);
        v.setTextSize(15);
        v.setPadding(22, 16, 22, 16);
        return v;
    }

    private void updateBar() {
        if (mp == null || live) return;
        long len = mp.getLength(), t = mp.getTime();
        tPos.setText(fmt(Math.max(0, t)));
        tDur.setText(fmt(Math.max(0, len)));
        if (len > 0) seekBar.setProgress((int) (t * 1000 / len));
    }

    private void showBar() {
        updateBar();
        bar.setVisibility(View.VISIBLE);
        h.removeCallbacks(hideBar);
        h.postDelayed(hideBar, 5000);
    }

    // Sound track / subtitles of this channel or video (films often carry several languages)
    private void pickTrack(boolean audio) {
        if (mp == null) return;
        final MediaPlayer.TrackDescription[] ts = audio ? mp.getAudioTracks() : mp.getSpuTracks();
        if (ts == null || ts.length == 0) {
            show(audio ? "No other sound track in this video." : "No subtitles in this video.");
            return;
        }
        String[] names = new String[ts.length];
        int cur = audio ? mp.getAudioTrack() : mp.getSpuTrack();
        int sel = -1;
        for (int k = 0; k < ts.length; k++) {
            names[k] = ts[k].name == null ? "Track " + (k + 1) : ts[k].name;
            if (ts[k].id == cur) sel = k;
        }
        h.removeCallbacks(hideBar);
        new android.app.AlertDialog.Builder(this)
            .setTitle(audio ? "Sound" : "Subtitles")
            .setSingleChoiceItems(names, sel, (d, w) -> {
                if (mp != null) {
                    if (audio) mp.setAudioTrack(ts[w].id);
                    else { spuWant = ts[w].id; mp.setSpuTrack(ts[w].id); }
                }
                d.dismiss();
            })
            .show();
    }

    // The stream was opened again (live reconnect, compatible video mode) → the chosen subtitle is selected again
    private void restoreSpu() {
        if (mp == null || spuWant == SPU_NONE || mp.getSpuTrack() == spuWant) return;
        MediaPlayer.TrackDescription[] ts = mp.getSpuTracks();
        if (ts == null) return;
        for (MediaPlayer.TrackDescription t : ts) {
            if (t.id == spuWant) { mp.setSpuTrack(spuWant); return; }
        }
    }

    private void togglePause() {
        if (mp == null) return;
        if (mp.isPlaying()) { mp.pause(); show("Paused  ·  hold OK for sound & subtitles"); } else { mp.play(); show("Playing"); }
    }

    private void seek(long ms) {
        if (mp == null || live || !mp.isSeekable()) return;
        long t = Math.max(0, mp.getTime() + ms);
        mp.setTime(t);
        show(fmt(t) + " / " + fmt(mp.getLength()));
        showBar();
    }

    private static String fmt(long ms) {
        long s = ms / 1000;
        return s >= 3600 ? String.format("%d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60) : String.format("%d:%02d", s / 60, s % 60);
    }

    @Override
    public boolean onKeyDown(int k, KeyEvent e) {
        switch (k) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
                // short press = pause / play (on key up), hold = Sound / Subtitles (most TV remotes have no MENU key)
                if (e.getRepeatCount() == 0) { okLong = false; e.startTracking(); }
                return true;
            case KeyEvent.KEYCODE_CAPTIONS:
                pickTrack(false);
                return true;
            case KeyEvent.KEYCODE_MEDIA_AUDIO_TRACK:
                pickTrack(true);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_SPACE:
                togglePause();
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                seek(10000);
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                seek(-10000);
                return true;
            case KeyEvent.KEYCODE_CHANNEL_UP:
            case KeyEvent.KEYCODE_PAGE_UP:
            case KeyEvent.KEYCODE_DPAD_UP:
                if (urls != null && urls.length > 1) { zap(1); return true; }
                break;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
            case KeyEvent.KEYCODE_PAGE_DOWN:
            case KeyEvent.KEYCODE_DPAD_DOWN:
                if (urls != null && urls.length > 1) { zap(-1); return true; }
                break;
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                zap(1);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                zap(-1);
                return true;
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_SETTINGS:
            case KeyEvent.KEYCODE_INFO:
                trackMenu();
                return true;
            case KeyEvent.KEYCODE_BACK:
                finishWithPos();
                return true;
        }
        return super.onKeyDown(k, e);
    }

    private static boolean isOk(int k) {
        return k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER || k == KeyEvent.KEYCODE_NUMPAD_ENTER;
    }

    @Override
    public boolean onKeyLongPress(int k, KeyEvent e) {
        if (isOk(k)) {
            okLong = true;
            trackMenu();
            return true;
        }
        return super.onKeyLongPress(k, e);
    }

    @Override
    public boolean onKeyUp(int k, KeyEvent e) {
        if (isOk(k)) {
            if (okLong) okLong = false;
            else if (!e.isCanceled()) togglePause();
            return true;
        }
        return super.onKeyUp(k, e);
    }

    // Sound / Subtitles menu: MENU key, or hold OK on remotes without a MENU key
    private void trackMenu() {
        h.removeCallbacks(hideBar);
        new android.app.AlertDialog.Builder(this)
            .setItems(new String[] { "Sound", "Subtitles" }, (d, w) -> pickTrack(w == 0))
            .show();
    }

    private void finishWithPos() {
        Intent r = new Intent();
        if (mp != null) {
            r.putExtra("pos", mp.getTime());
            r.putExtra("dur", mp.getLength());
        }
        r.putExtra("index", index);
        setResult(RESULT_OK, r);
        finish();
    }

    @Override
    public void onBackPressed() {
        finishWithPos();
    }

    @Override
    protected void onStart() {
        super.onStart();
        // 3rd value = subtitles layer ON. With it off, VLC lists the subtitles but never draws them
        // (hardware decoding puts the picture straight on the screen, so subtitles need their own layer).
        mp.attachViews(layout, null, true, false);
        mp.play();
    }

    @Override
    protected void onStop() {
        super.onStop();
        reGen++; // no reconnect while the player is closed / in the background
        if (mp != null) {
            mp.stop();
            mp.detachViews();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        h.removeCallbacksAndMessages(null);
        if (mp != null) mp.release();
        if (lib != null) lib.release();
        mp = null;
        lib = null;
    }
}
