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
        width: 1280, height: 800,
        title: "//OPENPRIX_WORKSTATION",
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    // The React app handles the SERVER_URL via sessionStorage 
    // It will default to 127.0.0.1 if not set.
    if (isDev) {
        mainWindow.loadURL('http://127.0.0.1:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

function registerHardwareBridge() {
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

    ipcMain.handle('os:scaffold-project', async (e, { root, subPath, folders }) => {
        try {
            const fullPath = path.join(root, subPath);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                const folderList = folders ? folders.split(',').map(f => f.trim()) : [];
                for (const f of folderList) { if (f) fs.mkdirSync(path.join(fullPath, f), { recursive: true }); }
                return { success: true, path: fullPath, exists: false };
            }
            return { success: true, path: fullPath, exists: true };
        } catch (err) { return { success: false, error: err.message }; }
    });

    ipcMain.handle('os:rename-project-folder', async (e, { root, oldPath, newSubPath }) => {
        try {
            const newPath = path.join(root, newSubPath);
            if (oldPath !== newPath && fs.existsSync(oldPath)) {
                fs.mkdirSync(path.dirname(newPath), { recursive: true });
                fs.renameSync(oldPath, newPath);
                return { success: true, newPath: newPath };
            }
            return { success: false, error: "Path unchanged." };
        } catch (err) { return { success: false, error: err.message }; }
    });
}

app.whenReady().then(() => {
    registerHardwareBridge();
    createWindow();
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (mainWindow === null) createWindow(); });