import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initDatabase } from './db.js';
import { registerMasterDataIpc } from './ipc/masterData.js';
import { registerProjectsIpc } from './ipc/projects.js';
import { registerSyncAndBackupIpc } from './ipc/syncAndBackup.js';
import { registerSettingsIpc } from './ipc/settings.js';

app.disableHardwareAcceleration();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let db;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 800, minWidth: 900, minHeight: 600,
        title: "//OPENPRIX", autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://127.0.0.1:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

// --- NATIVE OS HANDLERS ---
function registerOsHandlers() {
    // 1. Trigger the System File Picker
    ipcMain.handle('os:pick-file', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Construction Document',
            properties: ['openFile'],
            filters: [
                { name: 'Drawings & Docs', extensions: ['pdf', 'dwg', 'dxf', 'jpg', 'png', 'xlsx', 'docx'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled) return null;
        return result.filePaths[0]; // Returns absolute path
    });

    // 2. Launch file in default System Viewer (CAD, PDF reader, etc.)
    ipcMain.handle('os:open-file', async (event, filePath) => {
        if (!filePath) return { success: false, error: 'No path provided' };
        const error = await shell.openPath(filePath);
        if (error) return { success: false, error };
        return { success: true };
    });

    // 🔥 3. Convert Local File to Base64 (Fixes the Logo Upload Error)
    ipcMain.handle('os:get-base64', async (event, filePath) => {
        try {
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase().replace('.', '');

            // Map extension to MIME type
            let mimeType = `image/${ext}`;
            if (ext === 'svg') mimeType = 'image/svg+xml';
            if (ext === 'jpg') mimeType = 'image/jpeg';

            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch (error) {
            console.error("Base64 Conversion Error:", error);
            return null;
        }
    });
}

app.whenReady().then(() => {
    // 1. Boot up the SQLite database
    db = initDatabase();

    // 2. Create the Electron Window
    createWindow();

    // 3. Register our modularized IPC channels
    registerMasterDataIpc(db, mainWindow);
    registerProjectsIpc(db);
    registerSyncAndBackupIpc(db, mainWindow);
    registerSettingsIpc(db);

    // 4. Register Native OS Utilities
    registerOsHandlers();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});