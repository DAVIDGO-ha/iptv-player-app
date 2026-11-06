package com.iptvplayer.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VlcPlayerPlugin.class); // "Pro player": plays every audio/video format (AC3, E-AC3, DTS, HEVC…)
        super.onCreate(savedInstanceState);
    }
}
