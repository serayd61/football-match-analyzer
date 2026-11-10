package pro.footballanalytics;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Play Billing for the WebView bridge (versionCode 5, 2026-11-10).
 *
 * The page (src/lib/site/play-billing.ts) drives everything: it queries the
 * subscription products, launches the purchase sheet and sends the resulting
 * purchase token to the site's /api/play/verify. This class only wraps the
 * Billing Library; it never acknowledges purchases (the server does, after
 * verifying the token with the Play Developer API — unacknowledged purchases
 * are refunded by Play after 3 days, so a lost token heals via RTDN).
 *
 * Every answer goes back through {@link Emitter} as
 * window.__faPlayBillingResult(requestId, payload); payloads are
 * {ok:true, ...} or {ok:false, code:'cancelled'|'pending'|'error', message}.
 */
final class PlayBilling implements com.android.billingclient.api.PurchasesUpdatedListener {

    interface Emitter {
        void emit(int requestId, JSONObject payload);
        /** A purchase that arrived without a pending request (e.g. resubscribe from the Play Store). */
        void emitUnsolicited(JSONObject payload);
    }

    private final Activity activity;
    private final Emitter emitter;
    private BillingClient client;
    private volatile boolean ready;
    /** ProductDetails cache: launchBillingFlow needs the object, not just the id. */
    private final Map<String, ProductDetails> detailsCache = new HashMap<>();
    /** The requestId of the purchase flow currently on screen (-1 = none). */
    private int purchaseRequest = -1;

    PlayBilling(Activity activity, Emitter emitter) {
        this.activity = activity;
        this.emitter = emitter;
    }

    void connect() {
        if (client != null) return;
        client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                ready = result.getResponseCode() == BillingClient.BillingResponseCode.OK
                        && client.isFeatureSupported(BillingClient.FeatureType.SUBSCRIPTIONS).getResponseCode()
                        == BillingClient.BillingResponseCode.OK;
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Next bridge call sees ready == false; the page falls back to
                // the no-price body. A fresh connection is attempted on restart.
                ready = false;
            }
        });
    }

    void end() {
        if (client != null) {
            client.endConnection();
            client = null;
        }
        ready = false;
    }

    boolean isReady() {
        return ready;
    }

    /** Query subscription ProductDetails; answer: {ok:true, offers:[{productId, basePlanId, offerToken, formattedPrice, billingPeriod}]}. */
    void queryProducts(String idsJson, int requestId) {
        if (!ready) {
            emitter.emit(requestId, error("error", "billing not ready"));
            return;
        }
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        try {
            JSONArray ids = new JSONArray(idsJson);
            for (int i = 0; i < ids.length(); i++) {
                products.add(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(ids.getString(i))
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build());
            }
        } catch (JSONException e) {
            emitter.emit(requestId, error("error", "bad product ids"));
            return;
        }
        if (products.isEmpty()) {
            emitter.emit(requestId, error("error", "no product ids"));
            return;
        }
        client.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(products).build(),
                (result, detailsList) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        emitter.emit(requestId, error("error", "query failed: " + result.getDebugMessage()));
                        return;
                    }
                    JSONArray offers = new JSONArray();
                    for (ProductDetails pd : detailsList) {
                        detailsCache.put(pd.getProductId(), pd);
                        List<ProductDetails.SubscriptionOfferDetails> offerList = pd.getSubscriptionOfferDetails();
                        if (offerList == null) continue;
                        for (ProductDetails.SubscriptionOfferDetails offer : offerList) {
                            List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                            if (phases.isEmpty()) continue;
                            // The last phase is the recurring base price (earlier
                            // phases are intro offers).
                            ProductDetails.PricingPhase base = phases.get(phases.size() - 1);
                            try {
                                offers.put(new JSONObject()
                                        .put("productId", pd.getProductId())
                                        .put("basePlanId", offer.getBasePlanId())
                                        .put("offerToken", offer.getOfferToken())
                                        .put("formattedPrice", base.getFormattedPrice())
                                        .put("billingPeriod", base.getBillingPeriod()));
                            } catch (JSONException ignored) {
                            }
                        }
                    }
                    emitter.emit(requestId, ok().set("offers", offers));
                });
    }

    /** Launch the Play purchase sheet; the answer arrives via onPurchasesUpdated. */
    void purchase(String productId, String offerToken, String accountId, int requestId) {
        if (!ready) {
            emitter.emit(requestId, error("error", "billing not ready"));
            return;
        }
        ProductDetails pd = detailsCache.get(productId);
        if (pd == null || offerToken == null || offerToken.isEmpty()) {
            emitter.emit(requestId, error("error", "unknown product (query first)"));
            return;
        }
        if (purchaseRequest != -1) {
            emitter.emit(requestId, error("error", "purchase already in progress"));
            return;
        }
        List<BillingFlowParams.ProductDetailsParams> params = new ArrayList<>();
        params.add(BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(pd)
                .setOfferToken(offerToken)
                .build());
        BillingFlowParams.Builder flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(params);
        if (accountId != null && !accountId.isEmpty()) {
            // Lets the server attribute an unverified purchase to the app user
            // (externalAccountIdentifiers.obfuscatedExternalAccountId).
            flow.setObfuscatedAccountId(accountId);
        }
        purchaseRequest = requestId;
        BillingResult launched = client.launchBillingFlow(activity, flow.build());
        if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            purchaseRequest = -1;
            emitter.emit(requestId, error("error", "launch failed: " + launched.getDebugMessage()));
        }
    }

    /** Owned subscription purchases (restore); answer: {ok:true, purchases:[{purchaseToken, productIds, acknowledged}]}. */
    void queryPurchases(int requestId) {
        if (!ready) {
            emitter.emit(requestId, error("error", "billing not ready"));
            return;
        }
        client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        emitter.emit(requestId, error("error", "query failed: " + result.getDebugMessage()));
                        return;
                    }
                    JSONArray arr = new JSONArray();
                    for (Purchase p : purchases) {
                        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                        arr.put(purchaseJson(p));
                    }
                    emitter.emit(requestId, ok().set("purchases", arr));
                });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, List<Purchase> purchases) {
        int requestId = purchaseRequest;
        purchaseRequest = -1;

        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            if (requestId != -1) emitter.emit(requestId, error("cancelled", null));
            return;
        }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            if (requestId != -1) emitter.emit(requestId, error("error", result.getDebugMessage()));
            return;
        }
        for (Purchase p : purchases) {
            JSONObject payload;
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                payload = ok().set("purchaseToken", p.getPurchaseToken())
                        .set("productId", p.getProducts().isEmpty() ? "" : p.getProducts().get(0));
            } else {
                payload = error("pending", "purchase pending");
            }
            if (requestId != -1) {
                emitter.emit(requestId, payload);
                requestId = -1; // only the first purchase answers the request
            } else {
                emitter.emitUnsolicited(purchaseJson(p));
            }
        }
    }

    // ------------------------------------------------------------------ util

    private static JSONObject purchaseJson(Purchase p) {
        JSONObject o = new JSONObject();
        try {
            o.put("purchaseToken", p.getPurchaseToken());
            o.put("productIds", new JSONArray(p.getProducts()));
            o.put("acknowledged", p.isAcknowledged());
        } catch (JSONException ignored) {
        }
        return o;
    }

    private static Json ok() {
        return new Json().set("ok", true);
    }

    private static JSONObject error(String code, String message) {
        return new Json().set("ok", false).set("code", code)
                .set("message", message == null ? "" : message);
    }

    /** JSONObject with a put that never throws (keys are our own constants). */
    private static final class Json extends JSONObject {
        Json set(String key, Object value) {
            try {
                put(key, value);
            } catch (JSONException ignored) {
            }
            return this;
        }
    }
}
