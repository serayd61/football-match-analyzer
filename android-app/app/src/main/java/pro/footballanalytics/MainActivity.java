package pro.footballanalytics;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

/**
 * Football Analytics Pro — Google Play build.
 *
 * One full-screen WebView that runs footballanalytics.pro inside the app
 * (not inside Chrome, as the earlier Trusted Web Activity did). The start URL
 * carries {@code ?src=twa}: the site's middleware turns that into the
 * {@code fa_twa} cookie, and every later render hides checkout, prices and
 * "Unlock with Pro" (Google Play payments policy — see src/lib/site/twa.ts).
 */
public class MainActivity extends AppCompatActivity {

    static final String HOST = "footballanalytics.pro";
    static final String HOME_URL = "https://" + HOST + "/?src=twa";
    static final String UA_SUFFIX = " FootballAnalyticsPro/" + BuildConfig.VERSION_NAME + " (Android WebView)";

    private WebView web;
    private SwipeRefreshLayout swipe;
    private ProgressBar progress;
    private View offline;
    private boolean loadFailed;
    private boolean firstPageShown;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        // Keep the system splash on screen until the first page has rendered
        // (or failed), instead of flashing a blank white WebView.
        splash.setKeepOnScreenCondition(() -> !firstPageShown);

        View root = findViewById(R.id.root);
        swipe = findViewById(R.id.swipe);
        web = findViewById(R.id.web);
        progress = findViewById(R.id.progress);
        offline = findViewById(R.id.offline);

        // Edge-to-edge is mandatory from targetSdk 35: keep content out from
        // under the status / navigation bars.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        configureWebView();

        swipe.setColorSchemeResources(R.color.brand);
        swipe.setOnRefreshListener(() -> {
            loadFailed = false;
            web.reload();
        });
        // Only let pull-to-refresh fire when the page itself is scrolled to the top.
        swipe.setOnChildScrollUpCallback((parent, child) -> web.getScrollY() > 0);

        findViewById(R.id.retry).setOnClickListener(v -> {
            loadFailed = false;
            showOffline(false);
            if (web.getUrl() == null) web.loadUrl(HOME_URL); else web.reload();
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (offline.getVisibility() != View.VISIBLE && web.canGoBack()) {
                    web.goBack();
                } else {
                    finish();
                }
            }
        });

        if (savedInstanceState != null && web.restoreState(savedInstanceState) != null) {
            return;
        }
        web.loadUrl(startUrlFrom(getIntent()));
    }

    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Uri data = intent.getData();
        if (data != null) web.loadUrl(startUrlFrom(intent));
    }

    /** Deep link (https://footballanalytics.pro/…) or the home URL; always carries src=twa. */
    private static String startUrlFrom(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        if (data == null || !isOwnHost(data.getHost())) return HOME_URL;
        if (data.getQueryParameter("src") != null) return data.toString();
        return data.buildUpon().appendQueryParameter("src", "twa").build().toString();
    }

    private static boolean isOwnHost(String host) {
        return host != null && (host.equalsIgnoreCase(HOST) || host.toLowerCase().endsWith("." + HOST));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + UA_SUFFIX);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                if (("https".equals(scheme) || "http".equals(scheme)) && isOwnHost(url.getHost())) {
                    return false; // our own pages stay inside the app
                }
                // Anything else (other sites, mailto:, tel:, intent:) goes to the system.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                    // no handler installed; swallow rather than crash
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                loadFailed = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                swipe.setRefreshing(false);
                firstPageShown = true;
                if (!loadFailed) showOffline(false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return; // a failed image/script is not "offline"
                loadFailed = true;
                firstPageShown = true;
                swipe.setRefreshing(false);
                showOffline(true);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The WebView renderer died (OOM or crash). Rebuild the activity
                // instead of leaving a dead view on screen.
                recreate();
                return true;
            }
        });
    }

    private void showOffline(boolean show) {
        offline.setVisibility(show ? View.VISIBLE : View.GONE);
        swipe.setVisibility(show ? View.INVISIBLE : View.VISIBLE);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
