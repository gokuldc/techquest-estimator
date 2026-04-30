#!/bin/bash
# MacOS requires us to explicitly navigate to the directory where this script lives
cd "$(dirname "$0")"

echo "Checking system requirements..."

# 1. Check for global Node.js
if command -v node >/dev/null 2>&1; then
    echo "[OK] Node.js detected on system."
    NODE_BIN="node"
# 2. Check for local portable Node.js
elif [ -f "./node" ]; then
    echo "[OK] Portable Node.js detected."
    NODE_BIN="./node"
# 3. Download Portable Node.js for Mac if missing
else
    echo "[!] Node.js not found."
    echo "[*] Downloading Portable Node Engine for macOS..."
    # Downloads the macOS-specific binary
    curl -L -o node.tar.gz "https://nodejs.org/dist/v22.14.0/node-v22.14.0-darwin-x64.tar.gz"
    tar -xf node.tar.gz --strip-components=2 node-v22.14.0-darwin-x64/bin/node
    rm node.tar.gz
    NODE_BIN="./node"
fi

echo "[*] Booting OpenPrix Core..."
$NODE_BIN tui.js