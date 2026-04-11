import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDatabase } from './db.js';
import { registerMasterDataIpc } from './ipc/masterData.js';
import { registerProjectsIpc } from './ipc/projects.js';
import { registerSyncAndBackupIpc } from './ipc/syncAndBackup.js';

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

app.whenReady().then(() => {
    // 1. Boot up the SQLite database
    db = initDatabase();

    // 2. Create the Electron Window
    createWindow();

    // 3. Register our modularized IPC channels
    registerMasterDataIpc(db, mainWindow);
    registerProjectsIpc(db);
    registerSyncAndBackupIpc(db, mainWindow);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});