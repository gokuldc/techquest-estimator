import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const releaseDir = path.join(rootDir, 'release');
const deployDir = path.join(releaseDir, 'OpenPrix_Deployment');
const serverDir = path.join(deployDir, 'Server_Runtime');

console.log("🧹 1. Cleaning up previous builds...");
if (fs.existsSync(deployDir)) fs.rmSync(deployDir, { recursive: true, force: true });
fs.mkdirSync(path.join(serverDir, 'electron'), { recursive: true });

console.log("📦 2. Forcing Standard Node Database Build...");
// This is the magic bullet: forces better-sqlite3 to compile for Standard Node, destroying the cached Electron version
execSync('npm rebuild better-sqlite3', { stdio: 'inherit' });

console.log("🔨 3. Building React Frontend...");
execSync('npm run build', { stdio: 'inherit' });

console.log("📂 4. Staging Server Payload...");
fs.cpSync(path.join(rootDir, 'dist'), path.join(serverDir, 'dist'), { recursive: true });
fs.cpSync(path.join(rootDir, 'public'), path.join(serverDir, 'public'), { recursive: true });
fs.cpSync(path.join(rootDir, 'node_modules'), path.join(serverDir, 'node_modules'), { recursive: true });

// Copy backend logic
const filesToCopy = ['tui.js', 'daemon.js', 'electron/db.js', 'electron/webServer.js'];
filesToCopy.forEach(file => {
    if (fs.existsSync(path.join(rootDir, file))) {
        fs.copyFileSync(path.join(rootDir, file), path.join(serverDir, file));
    }
});

console.log("🚀 5. Injecting Portable Node.js Engine...");
// Grab the exact Node binary running this script and bundle it!
const nodeBinary = process.execPath;
const isWin = process.platform === 'win32';
const nodeDestName = isWin ? 'node.exe' : 'node';
fs.copyFileSync(nodeBinary, path.join(serverDir, nodeDestName));
if (!isWin) fs.chmodSync(path.join(serverDir, nodeDestName), 0o755);

// Auto-generate the launchers to use the portable engine
fs.writeFileSync(path.join(serverDir, 'start-server.bat'), `@echo off\ncd /d "%~dp0"\n.\\node.exe tui.js\npause`);
const shScript = `#!/bin/bash\ncd "$(dirname "$0")"\n./node tui.js`;
fs.writeFileSync(path.join(serverDir, 'start-server.sh'), shScript);
fs.writeFileSync(path.join(serverDir, 'start-server.command'), shScript);

if (!isWin) {
    fs.chmodSync(path.join(serverDir, 'start-server.sh'), 0o755);
    fs.chmodSync(path.join(serverDir, 'start-server.command'), 0o755);
}

console.log("🖥️ 6. Compiling Electron Installer...");
// electron-builder will automatically recompile node_modules in the root directory for Electron!
execSync('npx electron-builder', { stdio: 'inherit' });

console.log("📦 7. Moving Installer to Deployment Folder...");
const files = fs.readdirSync(releaseDir);
const exe = files.find(f => f.endsWith('.exe') && !f.includes('unpacked'));
if (exe) fs.copyFileSync(path.join(releaseDir, exe), path.join(deployDir, exe));

console.log("🗜️ 8. Creating ZIP Archive...");
execSync(`tar -a -c -f OpenPrix_Deployment.zip OpenPrix_Deployment`, { cwd: releaseDir });

console.log("\n✅ DONE! OpenPrix_Deployment.zip is ready.");