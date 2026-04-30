#!/bin/bash
echo "Checking system requirements..."

# 1. Check for global Node.js
if command -v node >/dev/null 2>&1; then
    echo "[OK] Node.js detected on system."
    NODE_BIN="node"
# 2. Check for local portable Node.js
elif [ -f "./node" ]; then
    echo "[OK] Portable Node.js detected."
    NODE_BIN="./node"
# 3. Download Portable Node.js if missing
else
    echo "[!] Node.js not found."
    echo "[*] Downloading Portable Node Engine..."
    curl -L -o node.tar.xz "https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz"
    tar -xf node.tar.xz --strip-components=2 node-v22.14.0-linux-x64/bin/node
    rm node.tar.xz
    NODE_BIN="./node"
fi

echo "[*] Booting OpenPrix Core..."
$NODE_BIN tui.js