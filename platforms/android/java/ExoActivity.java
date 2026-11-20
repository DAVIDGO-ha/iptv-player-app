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
import android.widget.TextView;
import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;

// Full-screen player with the ExoPlayer engine (Android's own player, Settings › Video engine › ExoPlayer).
// Same behaviour as the VLC player: one connection, a live channel reconnects by itself, Up/Down change channel.
@OptIn(markerClass = UnstableApi.class)
public class ExoActivity extends Activity {
    private ExoPlayer player;
    private PlayerView view;
    private TextView info;
    private boolean live;
    private String ua;
    private String[] urls;
    private String[] titles;
    private int index = 0;
    private String url;
    private int retries = 0;
    private int reGen = 0;
    private long goodAt = 0;
    private boolean stopped = false;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable hide = () -> { if (info != null) info.setVisibility(View.GONE); };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        Intent i = getIntent();
        long start = i.getLongExtra("start", 0);
        live = i.getBooleanExtra("live", false);
        url = i.getStringExtra("url");
        ua = i.getStringExtra("ua");
        if (ua == null || ua.isEmpty()) ua = "IPTVSmartersPlayer";
        urls = i.getStringArrayExtra("urls");
        titles = i.getStringArrayExtra("titles");
        index = i.getIntExtra("index", 0);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        view = new PlayerView(this);
        view.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        view.setKeepScreenOn(true);
        if (live) { // a live channel has nothing to seek
            view.setShowFastForwardButton(false);
            view.setShowRewindButton(false);
            view.setShowNextButton(false);
            view.setShowPreviousButton(false);
        }
        root.addView(view, new FrameLayout.LayoutParams(-1, -1));
        info = new TextView(this);
        info.setTextColor(Color.WHITE);
        info.setTextSize(18);
        info.setPadding(36, 24, 36, 24);
        info.setBackgroundColor(0x99000000);
        root.addView(info, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        setContentView(root);
        show(i.getStringExtra("title"));

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent(ua)
            .setAllowCrossProtocolRedirects(true) // a proxy may send http → https (or back) to the real server
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(20000);
        DefaultRenderersFactory rf = new DefaultRenderersFactory(this).setEnableDecoderFallback(true);
        player = new ExoPlayer.Builder(this, rf)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(http))
            .setSeekBackIncrementMs(10000)
            .setSeekForwardIncrementMs(10000)
            .build();
        view.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) goodAt = System.currentTimeMillis();
                if (state == Player.STATE_ENDED) {
                    if (live) reconnect(); // a live channel never really ends: the server closed the stream
                    else if (urls != null && index < urls.length - 1) zap(1); // next episode
                    else finishWithPos();
                }
            }

            @Override
            public void onPlayerError(PlaybackException e) {
                reconnect();
            }
        });
        load(start);
    }

    private void load(long startMs) {
        MediaItem.Builder mb = new MediaItem.Builder().setUri(Uri.parse(url));
        String path = url.split("\\?")[0].toLowerCase();
        if (path.endsWith(".m3u8") || path.contains("/hls/")) mb.setMimeType(MimeTypes.APPLICATION_M3U8);
        if (startMs > 0 && !live) player.setMediaItem(mb.build(), startMs);
        else player.setMediaItem(mb.build());
        player.prepare();
        player.setPlayWhenReady(true);
    }

    // Stream dropped → wait a little (the server frees the line's connection), then the same link again.
    // A movie carries on from where it stopped.
    private void reconnect() {
        if (player == null) return;
        if (goodAt > 0 && System.currentTimeMillis() - goodAt > 60000) retries = 0; // it played well for a minute → fresh retries
        goodAt = 0;
        if (++retries > (live ? 6 : 3)) {
            show(live ? "The stream stopped. Check your internet, then try again." : "This video could not be played with ExoPlayer. Choose VLC in Settings › Video engine.");
            return;
        }
        final int gen = ++reGen;
        h.postDelayed(() -> {
            if (player == null || gen != reGen || isFinishing()) return;
            if (live) player.seekToDefaultPosition();
            player.prepare();
            player.setPlayWhenReady(true);
        }, Math.min(3000L * retries, 10000L));
    }

    // Up/Down, CH+/CH–: next / previous channel (or episode)
    private void zap(int dir) {
        if (urls == null || urls.length < 2 || player == null) return;
        index = (index + dir + urls.length) % urls.length;
        url = urls[index];
        retries = 0;
        goodAt = 0;
        reGen++;
        show(titles != null && index < titles.length ? titles[index] : "");
        player.stop();
        load(0);
    }

    private void show(String t) {
        if (t == null || t.isEmpty()) return;
        info.setText(t);
        info.setVisibility(View.VISIBLE);
        h.removeCallbacks(hide);
        h.postDelayed(hide, 4000);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() == KeyEvent.ACTION_DOWN) {
            int k = e.getKeyCode();
            boolean list = urls != null && urls.length > 1;
            boolean bar = view.isControllerFullyVisible();
            switch (k) {
                case KeyEvent.KEYCODE_BACK:
                    if (bar) view.hideController();
                    else finishWithPos();
                    return true;
                case KeyEvent.KEYCODE_CHANNEL_UP:
                case KeyEvent.KEYCODE_PAGE_UP:
                case KeyEvent.KEYCODE_MEDIA_NEXT:
                    if (list) { zap(1); return true; }
                    break;
                case KeyEvent.KEYCODE_CHANNEL_DOWN:
                case KeyEvent.KEYCODE_PAGE_DOWN:
                case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                    if (list) { zap(-1); return true; }
                    break;
                case KeyEvent.KEYCODE_DPAD_UP:
                    if (live && list && !bar) { zap(1); return true; }
                    break;
                case KeyEvent.KEYCODE_DPAD_DOWN:
                    if (live && list && !bar) { zap(-1); return true; }
                    break;
                case KeyEvent.KEYCODE_DPAD_RIGHT:
                    if (!live && !bar) { player.seekForward(); return true; }
                    break;
                case KeyEvent.KEYCODE_DPAD_LEFT:
                    if (!live && !bar) { player.seekBack(); return true; }
                    break;
            }
        }
        return view.dispatchKeyEvent(e) || super.dispatchKeyEvent(e);
    }

    private void finishWithPos() {
        Intent r = new Intent();
        if (player != null) {
            long d = player.getDuration();
            r.putExtra("pos", Math.max(0, player.getCurrentPosition()));
            r.putExtra("dur", d == C.TIME_UNSET ? 0 : Math.max(0, d));
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
        if (stopped && player != null) { // back from the background → carry on
            stopped = false;
            if (live) player.seekToDefaultPosition();
            player.prepare();
            player.setPlayWhenReady(true);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        reGen++; // no reconnect while the player is closed / in the background
        if (player != null) {
            player.stop(); // frees the line's connection (the position is kept)
            stopped = true;
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        h.removeCallbacksAndMessages(null);
        if (player != null) player.release();
        player = null;
    }
}
