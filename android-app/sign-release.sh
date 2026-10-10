#!/usr/bin/env bash
# Signs the unsigned release AAB (Play upload) and APK (phone test) with the
# upload keystore. The password is read from the terminal and only ever lives
# in this process's environment; it is never printed or written to disk.
#
#   ./sign-release.sh
#
# Output: app/build/outputs/signed/footballanalytics-v<versionCode>.aab and .apk
set -euo pipefail
cd "$(dirname "$0")"

KEYSTORE="${KEYSTORE:-$HOME/AndroidKeys/footballanalytics-upload.keystore}"
ALIAS="${KEY_ALIAS:-upload}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
JDK="${JAVA_HOME:-$HOME/.bubblewrap/jdk17/jdk-17.0.20.1+1/Contents/Home}"
BUILD_TOOLS="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"

AAB_IN=app/build/outputs/bundle/release/app-release.aab
APK_IN=app/build/outputs/apk/release/app-release-unsigned.apk
[ -f "$AAB_IN" ] || { echo "missing $AAB_IN — run ./gradlew bundleRelease assembleRelease first"; exit 1; }
[ -f "$APK_IN" ] || { echo "missing $APK_IN — run ./gradlew bundleRelease assembleRelease first"; exit 1; }
[ -f "$KEYSTORE" ] || { echo "keystore not found: $KEYSTORE"; exit 1; }

VC="$(grep -E '^\s*versionCode' app/build.gradle.kts | grep -oE '[0-9]+')"
OUT=app/build/outputs/signed
mkdir -p "$OUT"

read -r -s -p "Keystore password for $ALIAS: " KS_PASS; echo
export KS_PASS

# AAB: jarsigner is what Play expects for bundles.
"$JDK/bin/jarsigner" -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore "$KEYSTORE" -storepass:env KS_PASS -keypass:env KS_PASS \
  -signedjar "$OUT/footballanalytics-v$VC.aab" "$AAB_IN" "$ALIAS" >/dev/null
"$JDK/bin/jarsigner" -verify "$OUT/footballanalytics-v$VC.aab" >/dev/null && echo "AAB signed: $OUT/footballanalytics-v$VC.aab"

# APK: zipalign + apksigner (v1+v2+v3) so it installs on a phone.
"$BUILD_TOOLS/zipalign" -f -p 4 "$APK_IN" "$OUT/aligned.apk"
"$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" \
  --ks-pass env:KS_PASS --key-pass env:KS_PASS \
  --out "$OUT/footballanalytics-v$VC.apk" "$OUT/aligned.apk"
rm -f "$OUT/aligned.apk" "$OUT/footballanalytics-v$VC.apk.idsig"
"$BUILD_TOOLS/apksigner" verify "$OUT/footballanalytics-v$VC.apk" && echo "APK signed: $OUT/footballanalytics-v$VC.apk"

unset KS_PASS
echo
echo "Upload key SHA-256 (must match the 'Yükleme anahtarı' in Play Console):"
"$JDK/bin/keytool" -printcert -jarfile "$OUT/footballanalytics-v$VC.apk" | grep -m1 SHA256
