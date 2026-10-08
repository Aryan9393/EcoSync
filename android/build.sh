#!/usr/bin/env bash
# Builds EcoSync.apk from this folder.  Usage:  APP_URL=https://your-app.onrender.com ./android/build.sh
# Needs Java 11+, apktool 2.x (APKTOOL=path/to/apktool.jar) and either apksigner (Android SDK) or jarsigner.
set -euo pipefail
cd "$(dirname "$0")"
APP_URL="${APP_URL:-https://ecosync-29iu.onrender.com}"
APKTOOL="${APKTOOL:-apktool.jar}"
OUT="${OUT:-../public/downloads/EcoSync.apk}"
WORK=$(mktemp -d)
cp -r AndroidManifest.xml apktool.yml res smali assets "$WORK/"
sed -i "s#__APP_URL__#${APP_URL}#" "$WORK/assets/www/launch.html"
java -jar "$APKTOOL" b "$WORK" -o "$WORK/unsigned.apk"
KS="${KEYSTORE:-ecosync.keystore}"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias ecosync -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "${KS_PASS:-ecosync123}" -keypass "${KS_PASS:-ecosync123}" -dname "CN=EcoSync, O=EcoSync, C=IN"
fi
mkdir -p "$(dirname "$OUT")"
if command -v zipalign >/dev/null && command -v apksigner >/dev/null; then
  zipalign -f -p 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"
  apksigner sign --ks "$KS" --ks-key-alias ecosync --ks-pass "pass:${KS_PASS:-ecosync123}" --out "$OUT" "$WORK/aligned.apk"
  apksigner verify --verbose "$OUT"
else
  cp "$WORK/unsigned.apk" "$OUT"
  jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore "$KS" -storepass "${KS_PASS:-ecosync123}" "$OUT" ecosync
fi
echo "Built $OUT for $APP_URL"
