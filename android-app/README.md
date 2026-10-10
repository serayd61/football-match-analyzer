# Google Play build (Android WebView)

`pro.footballanalytics` — a plain Android WebView app that opens
`https://footballanalytics.pro/?src=twa` inside the app. It replaced the
Bubblewrap TWA (`../android-twa/`) on 2026-10-10 (versionCode 1 → 2): a TWA
hands the site to Chrome, so Play's closed-test engagement check saw nothing.

What the app adds on top of the site: splash screen, offline screen with Retry,
pull-to-refresh, proper back button, deep links for `footballanalytics.pro`,
external links open in the system browser. Inside the app the site hides
checkout / prices (`?src=twa` → `fa_twa` cookie, plus the `FootballAnalyticsPro/`
user-agent token) — see `src/lib/site/twa.ts`.

## Build

```bash
export JAVA_HOME=$HOME/.bubblewrap/jdk17/jdk-17.0.20.1+1/Contents/Home   # any JDK 17+
export ANDROID_HOME=$HOME/Library/Android/sdk
cd android-app
./gradlew bundleRelease assembleRelease      # unsigned AAB + APK
./sign-release.sh                            # asks for the upload-key password once
```

Output: `app/build/outputs/signed/footballanalytics-v<versionCode>.aab` (Play)
and `.apk` (sideload on a phone). The upload key is
`~/AndroidKeys/footballanalytics-upload.keystore`, alias `upload`; never commit
it or its password. Play App Signing re-signs the bundle with Google's key, so
`public/.well-known/assetlinks.json` lists both certificates.

## New release

1. Bump `versionCode` (+1) and `versionName` in `app/build.gradle.kts`.
2. Build + sign as above, test the APK on a phone (site loads, back button
   walks history, offline screen appears in airplane mode).
3. Play Console → Test and release → the track → Create new release → upload the
   `.aab`. Same package + same upload key = ordinary update, testers keep their
   opt-in and the 14-day clock keeps running.
