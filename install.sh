#!/bin/sh
set -e

REPO="https://github.com/medioteq/vikingclaw"
SITE="https://vikingclaw.com"
VERSION="1.0.0"

echo ""
echo "⚔️  VikingClaw Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Detect OS
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  armv7*) ARCH="arm" ;;
  *) echo "❌ Unsupported CPU: $ARCH"; exit 1 ;;
esac

INSTALL_DIR="$HOME/.vikingclaw/bin"
mkdir -p "$INSTALL_DIR"
CONFIG_DIR="$HOME/.vikingclaw/config"
mkdir -p "$CONFIG_DIR"
WORKSPACE_DIR="$HOME/.vikingclaw/workspace"
mkdir -p "$WORKSPACE_DIR"

echo "📋 System: $OS/$ARCH"
echo "📁 Install dir: $INSTALL_DIR"
echo ""

# Try to download release binary
BINARY_URL="$SITE/releases/vikingclaw-$OS-$ARCH"
echo "⬇️  Downloading VikingClaw..."

if curl -fsSL --max-time 30 "$BINARY_URL" -o "$INSTALL_DIR/vikingclaw" 2>/dev/null; then
  chmod +x "$INSTALL_DIR/vikingclaw"
  echo "✅ Downloaded binary"
elif command -v go >/dev/null 2>&1; then
  echo "🔨 No pre-built binary found — building from source..."
  TMP=$(mktemp -d)
  if git clone --depth=1 "$REPO" "$TMP" 2>/dev/null; then
    cd "$TMP"
    go build -o "$INSTALL_DIR/vikingclaw" . 2>&1
    cd -
    rm -rf "$TMP"
    echo "✅ Built from source"
  else
    echo "❌ Could not clone repo. Check internet connection."
    exit 1
  fi
else
  echo "❌ No pre-built binary for $OS/$ARCH and Go not installed."
  echo "   Install Go: https://go.dev/dl/"
  exit 1
fi

# Add to PATH
add_to_path() {
  local rc="$1"
  if [ -f "$rc" ] && ! grep -q ".vikingclaw/bin" "$rc"; then
    echo '' >> "$rc"
    echo '# VikingClaw' >> "$rc"
    echo 'export PATH="$HOME/.vikingclaw/bin:$PATH"' >> "$rc"
    echo "✅ Added to $rc"
  fi
}

add_to_path "$HOME/.bashrc"
add_to_path "$HOME/.zshrc"
add_to_path "$HOME/.profile"

export PATH="$HOME/.vikingclaw/bin:$PATH"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VikingClaw installed!"
echo ""
echo "  Get started:"
echo "  $ vikingclaw onboard"
echo ""
echo "  Dashboard: http://localhost:7070"
echo "  Docs: https://vikingclaw.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
