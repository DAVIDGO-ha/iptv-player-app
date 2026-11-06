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
                    break;
                case MediaPlayer.Event.Buffering:
                    spin.setVisibility(e.getBuffering() < 100f ? View.VISIBLE : View.GONE);
                    break;
                case MediaPlayer.Event.EndReached:
                    finishWithPos();
                    break;
                case MediaPlayer.Event.EncounteredError:
                    show("This stream could not be played.");
                    break;
            }
        });
        Media m = new Media(lib, Uri.parse(i.getStringExtra("url")));
        m.setHWDecoderEnabled(true, false);
        String ua = i.getStringExtra("ua");
        if (ua != null) m.addOption(":http-user-agent=" + ua);
        mp.setMedia(m);
        m.release();
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
