import { ipcMain } from 'electron';

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
}