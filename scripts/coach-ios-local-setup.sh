#!/usr/bin/env bash
# Prepares a Mac to build this fork for a personal iPhone by cable.
# Creates only local, git-ignored placeholder files (the same dummies CI uses):
#   .env, ios/Config/Env.xcconfig, ios/GoogleService-Info.plist, ios/.xcode.env.local
# It never overwrites a file that already exists and needs no secret.
# Usage, from the repo root:  bash scripts/coach-ios-local-setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Aviso: esto es para el Mac. Aquí solo creo los archivos."
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node. Instala Node 22 (por ejemplo: brew install node@22) y repite." >&2
  exit 1
fi
node_major="$(node -p 'process.versions.node.split(".")[0]')"
node_minor="$(node -p 'process.versions.node.split(".")[1]')"
if (( node_major < 22 || (node_major == 22 && node_minor < 21) )); then
  echo "Node $(node -v) es antiguo: hace falta 22.21 o más." >&2
  exit 1
fi
echo "Node $(node -v): bien."

create() {
  local path="$1"
  if [[ -e "$path" ]]; then
    echo "Ya existe, no lo toco: $path"
    cat >/dev/null
  else
    cat >"$path"
    echo "Creado: $path"
  fi
}

create .env <<'EOF'
# Local placeholders for a personal build. Cloud features stay off.
FIREBASE_FUNCTIONS_URL=https://dummy-firebase-url.invalid
SUPABASE_URL=https://dummy-supabase-url.invalid
SUPABASE_ANON_KEY=dummy-anon-key
PALSHUB_API_BASE_URL=https://dummy-palshub-api.invalid
APP_URL=pocketpal://app
ENABLE_PALSHUB_INTEGRATION=false
ENABLE_AUTHENTICATION=false
ENABLE_OFFLINE_MODE=true
GOOGLE_IOS_CLIENT_ID=dummy-ios-client-id.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=dummy-web-client-id.apps.googleusercontent.com
EOF

create ios/Config/Env.xcconfig <<'EOF'
// Local placeholders (same values CI uses). Not committed.
GOOGLE_WEB_CLIENT_ID = dummy-web-client-id.apps.googleusercontent.com
REVERSED_GOOGLE_IOS_CLIENT_ID = com.googleusercontent.apps.dummy-ios-client-id
EOF

create ios/GoogleService-Info.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CLIENT_ID</key>
  <string>dummy-client-id.apps.googleusercontent.com</string>
  <key>REVERSED_CLIENT_ID</key>
  <string>com.googleusercontent.apps.dummy-client-id</string>
  <key>API_KEY</key>
  <string>dummy-api-key-for-local-builds</string>
  <key>GCM_SENDER_ID</key>
  <string>000000000000</string>
  <key>PLIST_VERSION</key>
  <string>1</string>
  <key>BUNDLE_ID</key>
  <string>ai.pocketpal</string>
  <key>PROJECT_ID</key>
  <string>dummy-project-local</string>
  <key>STORAGE_BUCKET</key>
  <string>dummy-project-local.appspot.com</string>
  <key>IS_ADS_ENABLED</key>
  <false/>
  <key>IS_ANALYTICS_ENABLED</key>
  <false/>
  <key>IS_APPINVITE_ENABLED</key>
  <false/>
  <key>IS_GCM_ENABLED</key>
  <true/>
  <key>IS_SIGNIN_ENABLED</key>
  <true/>
  <key>GOOGLE_APP_ID</key>
  <string>1:000000000000:ios:0000000000000000</string>
</dict>
</plist>
EOF

# Xcode does not load your shell profile: tell it where node lives.
create ios/.xcode.env.local <<EOF
export NODE_BINARY=$(command -v node)
EOF

echo
echo "Listo. Siguiente: yarn install, luego cd ios && pod install, y abre ios/PocketPal.xcworkspace."
