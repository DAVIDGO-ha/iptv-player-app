package com.iptvplayer.app;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Google Play version only: the one-time "lifetime" licence, paid with Google Play Billing.
 * Create the product in Play Console › Monetize › In-app products with the id "lifetime"
 * (£15 United Kingdom · €15 Euro countries · $15 every other country).
 */
@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {
    static final String PRODUCT = "lifetime";

    private BillingClient client;
    private ProductDetails details;
    private PluginCall buyCall;
    private boolean connecting = false;
    private final List<Object[]> waiting = new ArrayList<>(); // {Runnable, PluginCall}

    private interface Job { void run(); }

    /** Connects to Google Play once, then runs the job (or rejects the call if Google Play is unavailable). */
    private void ready(PluginCall call, Job job) {
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        if (client.isReady()) {
            job.run();
            return;
        }
        synchronized (waiting) {
            waiting.add(new Object[] { job, call });
            if (connecting) return;
            connecting = true;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult res) {
                List<Object[]> list;
                synchronized (waiting) {
                    connecting = false;
                    list = new ArrayList<>(waiting);
                    waiting.clear();
                }
                boolean ok = res.getResponseCode() == BillingClient.BillingResponseCode.OK;
                for (Object[] w : list) {
                    if (ok) ((Job) w[0]).run();
                    else ((PluginCall) w[1]).reject("Google Play is not available (" + res.getResponseCode() + ")");
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                synchronized (waiting) { connecting = false; }
            }
        });
    }

    private interface DetailsCb { void done(ProductDetails d); }

    private void loadDetails(PluginCall call, DetailsCb cb) {
        if (details != null) {
            cb.done(details);
            return;
        }
        QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build()))
            .build();
        client.queryProductDetailsAsync(p, (res, result) -> {
            List<ProductDetails> l = result != null ? result.getProductDetailsList() : null;
            if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && l != null && !l.isEmpty()) {
                details = l.get(0);
                cb.done(details);
            } else {
                call.reject("The lifetime licence is not available on Google Play yet (" + res.getResponseCode() + ")");
            }
        });
    }

    /** Local price, e.g. "£15.00". */
    @PluginMethod
    public void info(PluginCall call) {
        ready(call, () -> loadDetails(call, d -> {
            JSObject o = new JSObject();
            ProductDetails.OneTimePurchaseOfferDetails off = d.getOneTimePurchaseOfferDetails();
            o.put("price", off != null ? off.getFormattedPrice() : "");
            o.put("currency", off != null ? off.getPriceCurrencyCode() : "");
            call.resolve(o);
        }));
    }

    /** Opens the Google Play payment sheet. */
    @PluginMethod
    public void buy(PluginCall call) {
        ready(call, () -> loadDetails(call, d -> {
            if (getActivity() == null) {
                call.reject("No screen");
                return;
            }
            if (buyCall != null) buyCall.resolve(result(false, false));
            buyCall = call;
            BillingFlowParams fp = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build()))
                .build();
            getActivity().runOnUiThread(() -> {
                BillingResult r = client.launchBillingFlow(getActivity(), fp);
                if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                    restoreInto(call);
                    buyCall = null;
                } else if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    PluginCall c = buyCall;
                    buyCall = null;
                    if (c != null) c.reject("Google Play payment could not start (" + r.getResponseCode() + ")");
                }
            });
        }));
    }

    /** Is the lifetime licence owned by this Google account? (reinstall, new device, refund) */
    @PluginMethod
    public void restore(PluginCall call) {
        ready(call, () -> restoreInto(call));
    }

    private void restoreInto(PluginCall call) {
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (res, purchases) -> {
                if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Google Play error (" + res.getResponseCode() + ")");
                    return;
                }
                boolean owned = false, pending = false;
                for (Purchase p : purchases) {
                    if (!p.getProducts().contains(PRODUCT)) continue;
                    if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        owned = true;
                        acknowledge(p);
                    } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
                }
                JSObject o = result(owned, pending);
                o.put("ok", true);
                call.resolve(o);
            });
    }

    @Override
    public void onPurchasesUpdated(BillingResult res, List<Purchase> purchases) {
        PluginCall c = buyCall;
        buyCall = null;
        boolean owned = false, pending = false;
        if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) {
                if (!p.getProducts().contains(PRODUCT)) continue;
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    owned = true;
                    acknowledge(p);
                } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
            }
        } else if (res.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED && c != null) {
            restoreInto(c);
            return;
        }
        if (c != null) c.resolve(result(owned, pending));
    }

    /** Google refunds purchases that are not acknowledged within 3 days. */
    private void acknowledge(Purchase p) {
        if (p.isAcknowledged()) return;
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> {});
    }

    private static JSObject result(boolean owned, boolean pending) {
        JSObject o = new JSObject();
        o.put("owned", owned);
        o.put("pending", pending);
        return o;
    }
}
