# Google Play build — superseded (2026-10-10)

**The Play app is now the WebView project in [`../android-app/`](../android-app/README.md).**
This folder only keeps the old Bubblewrap `twa-manifest.json` for reference
(package id, colours, upload-key alias). Do not build or upload from here:
a TWA renders the site inside Chrome, so Google's closed-test engagement check
(12 testers / 14 days) saw no usage inside the app and tester services refuse TWAs.

---

# Google Play build (Trusted Web Activity)

The Play Store app is a Bubblewrap TWA that opens `https://footballanalytics.pro/?src=twa`.
Only `twa-manifest.json` is tracked; the Android project is regenerated from it.

```bash
npm i -g @bubblewrap/cli            # once; JDK + Android cmdline-tools via `bubblewrap doctor`
cd android-twa
bubblewrap update --skipVersionUpgrade   # regenerate the project from twa-manifest.json
BUBBLEWRAP_KEYSTORE_PASSWORD=… BUBBLEWRAP_KEY_PASSWORD=… bubblewrap build
```

* Upload key: `~/AndroidKeys/footballanalytics-upload.keystore` (alias `upload`, password next to it). Never commit it.
* New release: bump `appVersionCode` (+1) and `appVersionName`, then `bubblewrap update && bubblewrap build`, upload `app-release-bundle.aab`.
* `public/.well-known/assetlinks.json` must list the SHA-256 of the certificate the installed APK is signed with.
  With Play App Signing that is **Play's** certificate (Play Console → Test and release → App integrity), not the upload key — add it there after the first upload.
* Inside the app the site hides checkout, prices and "Unlock with Pro" (Play payments policy) — see `src/lib/site/twa.ts`.
