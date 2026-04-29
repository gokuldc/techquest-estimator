import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔥 CRITICAL: This variable MUST be outside the function!
let tray = null;

export function initTray(mainWindow, db) {
    // Prevent creating multiple tray icons if the function runs twice
    if (tray) return;

    // 🔥 BULLETPROOF PATH RESOLUTION
    // Bundlers (like Vite or electron-builder) move static assets around during the build.
    // This array checks every possible location the icon might be hiding in Dev or Prod.
    const possiblePaths = [
        path.join(__dirname, '../public/icon.ico'),          // 1. Standard Dev environment
        path.join(__dirname, '../../public/icon.ico'),       // 2. Deep Dev environment
        path.join(__dirname, '../dist/icon.ico'),            // 3. Vite Packaged (Public gets moved to Dist)
        path.join(app.getAppPath(), 'dist/icon.ico'),        // 4. Root ASAR archive (Vite)
        path.join(app.getAppPath(), 'public/icon.ico'),      // 5. Root ASAR archive (Standard)
        path.join(process.resourcesPath, 'public/icon.ico'), // 6. electron-builder extraResources
        path.join(process.resourcesPath, 'icon.ico')         // 7. electron-builder flat extraResources
    ];

    // Find the first path that actually exists on the hard drive
    const iconPath = possiblePaths.find(p => fs.existsSync(p));

    if (!iconPath) {
        console.error("❌ CRITICAL TRAY ERROR: Could not locate icon.ico in any expected directory!");
        console.error("Current __dirname:", __dirname);
        return; // Abort tray creation rather than creating an invisible ghost icon
    }

    try {
        // Create the image native object
        const icon = nativeImage.createFromPath(iconPath);

        // Initialize the global tray
        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            { label: 'OPENPRIX_NEXUS', enabled: false },
            { type: 'separator' },
            {
                label: 'Show Dashboard',
                click: () => {
                    // 🔥 SAFETY CHECK: Only show if the window actually exists
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            {
                label: 'Force Cloud Sync',
                click: () => {
                    // Your manual sync trigger logic here
                    console.log("Manual sync triggered via Tray");
                }
            },
            { type: 'separator' },
            {
                label: 'Quit Completely',
                click: () => {
                    app.isQuiting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('OpenPrix Background Sync');
        tray.setContextMenu(contextMenu);

        // Double-clicking the icon restores the app
        tray.on('double-click', () => {
            // 🔥 SAFETY CHECK: Added here as well
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
            }
        });

        console.log(`✅ System Tray Icon successfully pinned using path: ${iconPath}`);

    } catch (err) {
        console.error("❌ Failed to create tray icon.", err);
    }
}