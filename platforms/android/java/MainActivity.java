package com.iptvplayer.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    @SuppressWarnings("unchecked")
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VlcPlayerPlugin.class); // "Pro player": plays every audio/video format (AC3, E-AC3, DTS, HEVC…)
        // Google Play version only: Google Play Billing (the file is added by the Google Play build)
        try {
            registerPlugin((Class<? extends Plugin>) Class.forName("com.iptvplayer.app.BillingPlugin"));
        } catch (Throwable ignored) {}
        super.onCreate(savedInstanceState);
    }
}
