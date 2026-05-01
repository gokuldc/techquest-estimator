import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 800, minWidth: 900, minHeight: 600,
        title: "//OPENPRIX_CLIENT", autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://127.0.0.1:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

function registerOsHandlers() {
    ipcMain.handle('os:pick-file', async () => {
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('os:open-file', async (event, filePath) => {
        if (!filePath) return { success: false };
        const error = await shell.openPath(filePath);
        return error ? { success: false, error } : { success: true };
    });

    ipcMain.handle('os:get-base64', async (event, filePath) => {
        try {
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase().replace('.', '');
            let mimeType = `image/${ext}`;
            if (ext === 'svg') mimeType = 'image/svg+xml';
            if (ext === 'jpg') mimeType = 'image/jpeg';
            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch (error) { return null; }
    });

    ipcMain.handle('os:pick-directory', async () => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });
}

app.whenReady().then(() => {
    registerOsHandlers();
    createWindow();
});

app.on('window-all-closed', (e) => { e.preventDefault(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); else mainWindow.show(); });