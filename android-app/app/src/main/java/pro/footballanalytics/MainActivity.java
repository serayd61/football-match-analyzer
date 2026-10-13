package pro.footballanalytics;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

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
    private TextView offlineTitle;
    private TextView offlineBody;
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
        offlineTitle = findViewById(R.id.offline_title);
        offlineBody = findViewById(R.id.offline_body);

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
            showError(false, false);
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
        applyDarkMode(s);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        // Downloads (CSV exports, PDFs) cannot be handled by the WebView itself;
        // hand them to the browser instead of failing silently.
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> openExternal(Uri.parse(url)));

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
                openExternal(url);
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
                if (!loadFailed) showError(false, false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return; // a failed image/script is not "offline"
                fail(true);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                // Only a server failure on the page itself (5xx) gets the error
                // screen; 4xx pages (e.g. a 404) render the site's own page.
                if (!request.isForMainFrame() || response.getStatusCode() < 500) return;
                fail(false);
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

    /**
     * Dark mode: on Android 13+ the WebView follows the app theme by itself. On
     * Android 10–12 it has to be told, otherwise the site renders light inside
     * a dark app. The site ships its own dark palette (prefers-color-scheme),
     * so only web-theme darkening is requested, never algorithmic inversion.
     */
    @SuppressWarnings("deprecation")
    private void applyDarkMode(WebSettings s) {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) return;
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) return;
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        WebSettingsCompat.setForceDark(s, night ? WebSettingsCompat.FORCE_DARK_ON : WebSettingsCompat.FORCE_DARK_OFF);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK_STRATEGY)) {
            WebSettingsCompat.setForceDarkStrategy(s, WebSettingsCompat.DARK_STRATEGY_WEB_THEME_DARKENING_ONLY);
        }
    }

    /** Other sites open in a Chrome Custom Tab (falls back to any browser); mailto:/tel:/intent: go to the system. */
    private void openExternal(Uri url) {
        String scheme = url.getScheme();
        if ("https".equals(scheme) || "http".equals(scheme)) {
            try {
                CustomTabColorSchemeParams colors = new CustomTabColorSchemeParams.Builder()
                        .setToolbarColor(getColor(R.color.brand)).build();
                new CustomTabsIntent.Builder().setDefaultColorSchemeParams(colors).setShowTitle(true)
                        .build().launchUrl(this, url);
                return;
            } catch (ActivityNotFoundException ignored) {
                // no browser that supports Custom Tabs; fall through
            }
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException ignored) {
            // no handler installed; swallow rather than crash
        }
    }

    private void fail(boolean offlineLikely) {
        loadFailed = true;
        firstPageShown = true;
        swipe.setRefreshing(false);
        showError(true, offlineLikely);
    }

    private void showError(boolean show, boolean offlineLikely) {
        if (show) {
            offlineTitle.setText(offlineLikely ? R.string.offline_title : R.string.error_title);
            offlineBody.setText(offlineLikely ? R.string.offline_body : R.string.error_body);
        }
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
