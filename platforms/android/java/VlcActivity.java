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
import android.widget.ProgressBar;
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
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hide = () -> { if (info != null) info.setVisibility(View.GONE); };

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
        root.setOnClickListener(v -> togglePause());
        setContentView(root);

        Intent i = getIntent();
        start = i.getLongExtra("start", 0);
        live = i.getBooleanExtra("live", false);
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
                    if (start > 0 && !live) { mp.setTime(start); start = 0; }
                    if (!checkPosted) { checkPosted = true; h.postDelayed(this::checkPicture, 6000); }
                    break;
                case MediaPlayer.Event.Vout:
                    if (e.getVoutCount() > 0) gotVideo = true;
                    break;
                case MediaPlayer.Event.Buffering:
                    spin.setVisibility(e.getBuffering() < 100f ? View.VISIBLE : View.GONE);
                    break;
                case MediaPlayer.Event.EndReached:
                    if (!live && urls != null && index < urls.length - 1) zap(1); // next episode
                    else finishWithPos();
                    break;
                case MediaPlayer.Event.EncounteredError:
                    show("This stream could not be played.");
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

    // Up/Down, CH+/CH–: next / previous channel (or episode)
    private void zap(int dir) {
        if (urls == null || urls.length < 2 || mp == null) return;
        index = (index + dir + urls.length) % urls.length;
        uri = Uri.parse(urls[index]);
        gotVideo = false;
        softMode = false;
        checkPosted = false;
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

    private void togglePause() {
        if (mp == null) return;
        if (mp.isPlaying()) { mp.pause(); show("Paused"); } else { mp.play(); show("Playing"); }
    }

    private void seek(long ms) {
        if (mp == null || live || !mp.isSeekable()) return;
        long t = Math.max(0, mp.getTime() + ms);
        mp.setTime(t);
        show(fmt(t) + " / " + fmt(mp.getLength()));
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
            case KeyEvent.KEYCODE_BACK:
                finishWithPos();
                return true;
        }
        return super.onKeyDown(k, e);
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
        mp.attachViews(layout, null, false, false);
        mp.play();
    }

    @Override
    protected void onStop() {
        super.onStop();
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
