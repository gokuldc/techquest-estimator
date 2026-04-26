import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { startWebServer, stopWebServer, getLocalIp } from '../webServer.js';

export function registerSettingsIpc(db) {
    ipcMain.handle('db:get-settings', (e, key) => {
        // Ensure the table exists just in case
        db.exec(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)`);
        const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
        return row ? JSON.parse(row.value) : null;
    });

    ipcMain.handle('db:save-settings', (e, key, value) => {
        db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
        return { success: true };
    });

    // --- SERVER MANAGER HANDLERS ---
    ipcMain.handle('server:start', async (e, port) => {
        return await startWebServer(port, db);
    });

    ipcMain.handle('server:stop', async () => {
        return await stopWebServer();
    });

    ipcMain.handle('server:get-ip', () => {
        return getLocalIp();
    });

    // --- 🔥 NEW: OS & FILE SYSTEM HANDLERS 🔥 ---
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
                for (const f of folderList) {
                    if (f) fs.mkdirSync(path.join(fullPath, f), { recursive: true });
                }
                return { success: true, path: fullPath, exists: false };
            }
            return { success: true, path: fullPath, exists: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('os:rename-project-folder', async (e, { root, oldPath, newSubPath }) => {
        try {
            const newPath = path.join(root, newSubPath);
            // If the name actually changed and the old folder exists
            if (oldPath !== newPath && fs.existsSync(oldPath)) {
                // Ensure parent directory of newPath exists before renaming
                fs.mkdirSync(path.dirname(newPath), { recursive: true });
                fs.renameSync(oldPath, newPath);
                return { success: true, newPath: newPath };
            }
            return { success: false, error: "Old directory not found or path unchanged." };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
    ipcMain.handle('os:upload-file-web', async (e, fileName, base64Data, projectId) => {
        try {
            const base64String = base64Data.split(';base64,').pop();
            const buffer = Buffer.from(base64String, 'base64');
            
            const uploadDir = path.join(os.homedir(), '.openprix', 'uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            
            const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
            const filePath = path.join(uploadDir, safeName);
            
            fs.writeFileSync(filePath, buffer);
            return { success: true, path: filePath };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
}