#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Deploy the Raw1 Custom Cast Receiver to Firebase Hosting
#
# USAGE
#   bash cast-receiver/deploy.sh
#
# PREREQUISITES
#   1. Firebase CLI installed:   npm install -g firebase-tools
#   2. Logged in:                firebase login
#   3. Project configured:       firebase use wazy-6c4a9   (your Firebase project ID)
#
# WHAT THIS DOES
#   - Copies cast-receiver/index.html → public/cast-receiver/index.html
#   - Runs: firebase deploy --only hosting
#   - After deploy, the receiver is live at:
#       https://<project-id>.web.app/cast-receiver/index.html
#
# AFTER DEPLOY
#   1. Go to https://cast.google.com/publish
#   2. Add Application → Custom Receiver
#   3. Enter URL: https://<project-id>.web.app/cast-receiver/index.html
#   4. Copy the issued App ID (looks like: ABCD1234)
#   5. Set in .env.local:  EXPO_PUBLIC_CAST_APP_ID=ABCD1234
#   6. Set in .env.local:  EXPO_PUBLIC_CAST_RECEIVER_URL=https://<project-id>.web.app/cast-receiver/
#   7. Register your Chromecast's serial number as a test device (required
#      while the app is unpublished in the Cast console)
#   8. Rebuild the mobile app:   eas build --profile development --platform all
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC="$SCRIPT_DIR/index.html"
DEST_DIR="$PROJECT_ROOT/public/cast-receiver"
DEST="$DEST_DIR/index.html"

echo "▶ Raw1 Cast Receiver deploy"
echo "  Source : $SRC"
echo "  Target : $DEST"
echo ""

# Validate source exists
if [[ ! -f "$SRC" ]]; then
  echo "✗ cast-receiver/index.html not found. Run from the project root." >&2
  exit 1
fi

# Ensure public/cast-receiver/ directory exists
mkdir -p "$DEST_DIR"

# Copy the receiver page
cp "$SRC" "$DEST"
echo "✓ Copied index.html → public/cast-receiver/"

# Check firebase CLI
if ! command -v firebase &> /dev/null; then
  echo "✗ firebase CLI not found. Install with: npm install -g firebase-tools" >&2
  exit 1
fi

# Deploy only hosting (does not redeploy Firestore rules or Cloud Functions)
echo ""
echo "▶ Deploying to Firebase Hosting…"
cd "$PROJECT_ROOT"
firebase deploy --only hosting

echo ""
echo "✓ Deploy complete!"
echo ""
echo "Next steps:"
echo "  1. Note the Hosting URL printed above (e.g. https://wazy-6c4a9.web.app)"
echo "  2. The receiver is at: <Hosting URL>/cast-receiver/index.html"
echo "  3. Register at: https://cast.google.com/publish"
echo "  4. Copy the App ID → set EXPO_PUBLIC_CAST_APP_ID in .env.local"
echo "  5. Set EXPO_PUBLIC_CAST_RECEIVER_URL=<Hosting URL>/cast-receiver/"
echo "  6. Rebuild: eas build --profile development --platform all"
