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
