import { Tray, Menu, app, nativeImage, Notification } from 'electron';
import fs from 'fs';
import path from 'path';

let tray = null;

export function initTray(mainWindow, db) {
    // Create an empty icon (Replace with a real icon path in production)
    // e.g., const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    const icon = nativeImage.createEmpty();

    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'OpenPrix Nexus (Background Sync)', enabled: false },
        { type: 'separator' },
        {
            label: 'Force Cloud Sync Now',
            click: () => executeSync(db)
        },
        {
            label: 'Configure Server Address',
            click: () => {
                mainWindow.show();
                // Tell the React frontend to open the settings modal
                mainWindow.webContents.send('open-sync-settings');
            }
        },
        { type: 'separator' },
        {
            label: 'Show Dashboard',
            click: () => mainWindow.show()
        },
        {
            label: 'Quit Completely',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('OpenPrix Sync Engine');
    tray.setContextMenu(contextMenu);

    // 🔥 THE MAGIC: Prevent the app from dying when the window is closed!
    mainWindow.on('close', function (event) {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide(); // Hide instead of closing
            new Notification({
                title: "OpenPrix Nexus",
                body: "App is minimized to the system tray for background syncing."
            }).show();
        }
        return false;
    });

    // Optional: Auto-sync every 30 minutes in the background
    setInterval(() => executeSync(db), 30 * 60 * 1000);
}

// 🔥 THE SYNC LOGIC
async function executeSync(db) {
    try {
        // 1. Grab the URL from the SQLite settings table
        const row = db.prepare("SELECT value FROM app_settings WHERE key = 'sync_server_url'").get();
        if (!row || !row.value) {
            new Notification({ title: "Sync Skipped", body: "No server address configured." }).show();
            return;
        }

        const serverUrl = row.value;
        const dbPath = path.join(app.getPath('userData'), 'database', 'openprix_v2.sqlite');

        // 2. Read the entire database file as a buffer
        const dbBuffer = fs.readFileSync(dbPath);

        // 3. Push it to the cloud server
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: dbBuffer
        });

        if (response.ok) {
            new Notification({ title: "Sync Successful", body: "Database backed up to the cloud." }).show();
        } else {
            new Notification({ title: "Sync Failed", body: `Server responded with Error ${response.status}` }).show();
        }
    } catch (error) {
        new Notification({ title: "Sync Error", body: error.message }).show();
    }
}