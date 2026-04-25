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

    // 🔥 SMART PATH RESOLUTION
    // This checks both the Dev environment and the Production packaged environment
    let iconPath = path.join(__dirname, '../public/icon.ico');
    if (!fs.existsSync(iconPath)) {
        // Fallback for compiled production build
        iconPath = path.join(process.resourcesPath, 'public/icon.ico');
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

        console.log("✅ System Tray Icon successfully pinned.");

    } catch (err) {
        console.error("❌ Failed to create tray icon. Is the icon.ico file missing?", err);
    }
}