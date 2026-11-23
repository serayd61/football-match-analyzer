package pro.footballanalytics;

import android.app.Activity;
import android.content.Context;
import android.content.IntentSender;
import android.content.SharedPreferences;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * Play In-App Updates, flexible flow (versionCode 7, 2026-11-23).
 *
 * Play's own auto-update mostly runs on Wi-Fi while charging, so members on
 * mobile data stayed on an old build for days (1.2.0 has no billing bridge and
 * cannot sell Pro). On launch this asks Play whether a newer version exists
 * and, if so, shows Play's "update available" dialog. The download runs in the
 * background while the app stays usable; the install happens when the app
 * next goes to the background, so nothing restarts under the user's hands.
 *
 * The dialog is offered at most once a day. Every failure is silent: outside
 * a Play install (sideload, emulator without Play) the calls simply fail.
 */
final class AppUpdate {

    private static final int REQUEST_CODE = 7301;
    private static final String PREFS = "app_update";
    private static final String KEY_ASKED_AT = "asked_at";
    private static final long ASK_EVERY_MS = 24L * 60 * 60 * 1000;

    private final Activity activity;
    private final AppUpdateManager manager;
    private volatile boolean downloaded;
    private final InstallStateUpdatedListener listener =
            state -> downloaded = state.installStatus() == InstallStatus.DOWNLOADED;

    AppUpdate(Activity activity) {
        this.activity = activity;
        this.manager = AppUpdateManagerFactory.create(activity);
    }

    /** Call from onCreate. */
    void check() {
        manager.registerListener(listener);
        manager.getAppUpdateInfo().addOnSuccessListener(this::onInfo);
    }

    private void onInfo(AppUpdateInfo info) {
        if (info.installStatus() == InstallStatus.DOWNLOADED) {
            // Downloaded in an earlier session; install on the next onStop.
            downloaded = true;
            return;
        }
        if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE
                || !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
            return;
        }
        SharedPreferences prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (now - prefs.getLong(KEY_ASKED_AT, 0) < ASK_EVERY_MS) return;
        if (activity.isFinishing() || activity.isDestroyed()) return;
        try {
            manager.startUpdateFlowForResult(info, activity,
                    AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(), REQUEST_CODE);
            prefs.edit().putLong(KEY_ASKED_AT, now).apply();
        } catch (IntentSender.SendIntentException ignored) {
            // Play could not show the dialog; try again on the next launch.
        }
    }

    /** Call from onStop: a finished download is installed while the app is in the background. */
    void installIfDownloaded() {
        if (!downloaded) return;
        downloaded = false;
        manager.completeUpdate();
    }

    /** Call from onDestroy. */
    void end() {
        manager.unregisterListener(listener);
    }
}
