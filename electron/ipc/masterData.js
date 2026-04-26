import { ipcMain, dialog } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import * as xlsx from 'xlsx';

export function registerMasterDataIpc(db, mainWindow) {

    // 🔥 1. NATIVE AUTHENTICATION HANDLER 🔥
    ipcMain.handle('db:verify-login', (event, username, password) => {
        try {
            const user = db.prepare(`
                SELECT id, username, name, role, designation, department, accessLevel 
                FROM org_staff 
                WHERE username = ? AND password = ? AND status = 'Active'
            `).get(username, password);

            if (user) {
                // Formatting exactly as AuthContext expects!
                return { success: true, user: user };
            } else {
                return { success: false, error: 'Invalid username or password.' };
            }
        } catch (error) {
            console.error("Login verification error:", error);
            return { success: false, error: error.message };
        }
    });

    // --- EXISTING MASTER DATA ROUTES ---

    ipcMain.handle('db:get-regions', () => db.prepare('SELECT * FROM regions ORDER BY name ASC').all());

    ipcMain.handle('db:create-region', (event, regionName) => {
        try {
            const id = crypto.randomUUID();
            db.prepare('INSERT INTO regions (id, name) VALUES (?, ?)').run(id, regionName);
            return { success: true, id };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return { success: false, error: 'Region already exists.' };
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db:delete-region', (event, id, name) => {
        db.transaction(() => {
            db.prepare('DELETE FROM regions WHERE id = ?').run(id);
            const resources = db.prepare('SELECT id, rates FROM resources').all();
            const updateStmt = db.prepare('UPDATE resources SET rates = ? WHERE id = ?');
            for (const res of resources) {
                const rates = JSON.parse(res.rates || '{}');
                if (rates[name] !== undefined) {
                    delete rates[name];
                    updateStmt.run(JSON.stringify(rates), res.id);
                }
            }
        })();
    });

    ipcMain.handle('db:import-excel', async (event, regionName) => {
        if (!regionName) return { success: false, message: 'No region selected.' };
        const result = await dialog.showOpenDialog(mainWindow, { title: `Select Rate Sheet for ${regionName}`, filters: [{ name: 'Excel/CSV Files', extensions: ['xlsx', 'xls', 'csv'] }], properties: ['openFile'] });
        if (result.canceled || result.filePaths.length === 0) return { success: false, message: 'User cancelled' };

        try {
            const fileBuffer = fs.readFileSync(result.filePaths[0]);
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = xlsx.utils.sheet_to_json(worksheet, { range: 1, defval: "" });

            const runImport = db.transaction(() => {
                const getResourceStmt = db.prepare('SELECT id, rates FROM resources WHERE code = ?');
                const updateResourceStmt = db.prepare('UPDATE resources SET description = ?, unit = ?, rates = ? WHERE id = ?');
                const insertResourceStmt = db.prepare('INSERT INTO resources (id, code, description, unit, rates) VALUES (?, ?, ?, ?, ?)');
                let count = 0;
                for (const row of rawData) {
                    if (!row['Code']) continue;
                    const code = String(row['Code']).trim();
                    const desc = row['Description'] || '';
                    const unit = row['Unit'] || '';
                    const newRate = parseFloat(row['Lmr Rate (₹)']) || 0;
                    const existingResource = getResourceStmt.get(code);

                    if (existingResource) {
                        const rates = JSON.parse(existingResource.rates || '{}');
                        rates[regionName] = newRate;
                        updateResourceStmt.run(desc, unit, JSON.stringify(rates), existingResource.id);
                    } else {
                        const newId = crypto.randomUUID();
                        insertResourceStmt.run(newId, code, desc, unit, JSON.stringify({ [regionName]: newRate }));
                    }
                    count++;
                }
                return count;
            });
            return { success: true, message: `Successfully updated ${runImport()} rates for ${regionName}.` };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('db:get-resources', () => {
        return db.prepare('SELECT * FROM resources ORDER BY code ASC').all().map(record => ({
            ...record, rates: record.rates ? JSON.parse(record.rates) : {}
        }));
    });

    ipcMain.handle('db:create-resource', (event, data) => {
        db.prepare('INSERT INTO resources (id, code, description, unit, rates) VALUES (?, ?, ?, ?, ?)').run(
            data.id || crypto.randomUUID(), data.code, data.description, data.unit, '{}'
        );
    });

    ipcMain.handle('db:update-resource', (event, id, field, value) => {
        const val = typeof value === 'object' ? JSON.stringify(value) : value;
        db.prepare(`UPDATE resources SET ${field} = ? WHERE id = ?`).run(val, id);
    });

    ipcMain.handle('db:delete-resource', (event, id) => db.prepare('DELETE FROM resources WHERE id = ?').run(id));

    ipcMain.handle('db:get-master-boqs', () => {
        return db.prepare('SELECT * FROM master_boq').all().map(b => ({
            ...b, components: JSON.parse(b.components || '[]')
        }));
    });

    ipcMain.handle('db:save-master-boq', async (event, payload, id, isNew) => {
        const compStr = JSON.stringify(payload.components);
        if (id && !isNew) {
            db.prepare('UPDATE master_boq SET itemCode=?, description=?, unit=?, overhead=?, profit=?, components=? WHERE id=?').run(
                payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr, id
            );
        } else {
            const insertId = isNew ? crypto.randomUUID() : (id || crypto.randomUUID());
            try {
                db.prepare('INSERT INTO master_boq (id, itemCode, description, unit, overhead, profit, components) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                    insertId, payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr
                );
                return insertId;
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error("That ITEM_CODE already exists. Please change the code before saving as new.");
                throw error;
            }
        }
    });

    ipcMain.handle('db:delete-master-boq', (event, id) => db.prepare('DELETE FROM master_boq WHERE id = ?').run(id));

    ipcMain.handle('db:purge-database', () => {
        db.transaction(() => {
            db.prepare('DELETE FROM regions').run();
            db.prepare('DELETE FROM resources').run();
            db.prepare('DELETE FROM master_boq').run();
        })();
    });
}