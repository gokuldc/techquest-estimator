import { ipcMain, dialog } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import * as xlsx from 'xlsx';

// 🔥 THE SANITIZERS FOR MASTER DATA 🔥
const sanitizeInsert = (db, table, data) => {
    const validCols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    const clean = {}; for (const k in data) if (validCols.includes(k)) clean[k] = data[k];
    return {
        cols: Object.keys(clean).join(', '),
        placeholders: Object.keys(clean).map(() => '?').join(', '),
        values: Object.values(clean).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v))
    };
};

const sanitizeUpdate = (db, table, data) => {
    const validCols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    const clean = {}; for (const k in data) if (validCols.includes(k) && k !== 'id') clean[k] = data[k];
    return {
        fields: Object.keys(clean).map(k => `${k} = ?`).join(', '),
        values: Object.values(clean).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v))
    };
};

export function registerMasterDataIpc(db, mainWindow) {

    ipcMain.handle('db:verify-login', (event, username, password) => {
        try {
            const user = db.prepare(`SELECT id, username, name, role, designation, department, accessLevel FROM org_staff WHERE username = ? AND password = ? AND status = 'Active'`).get(username, password);
            return user ? { success: true, user: user } : { success: false, error: 'Invalid username or password.' };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('db:get-regions', () => db.prepare('SELECT * FROM regions ORDER BY name ASC').all());
    ipcMain.handle('db:create-region', (event, regionName) => {
        try {
            const id = crypto.randomUUID();
            db.prepare('INSERT INTO regions (id, name) VALUES (?, ?)').run(id, regionName);
            return { success: true, id };
        } catch (error) { return { success: false, error: error.message }; }
    });
    ipcMain.handle('db:delete-region', (event, id, name) => {
        db.transaction(() => {
            db.prepare('DELETE FROM regions WHERE id = ?').run(id);
            const resources = db.prepare('SELECT id, rates FROM resources').all();
            const updateStmt = db.prepare('UPDATE resources SET rates = ? WHERE id = ?');
            for (const res of resources) {
                const rates = JSON.parse(res.rates || '{}');
                if (rates[name] !== undefined) { delete rates[name]; updateStmt.run(JSON.stringify(rates), res.id); }
            }
        })();
    });

    ipcMain.handle('db:import-excel', async (event, regionName) => {
        if (!regionName) return { success: false, message: 'No region selected.' };
        const result = await dialog.showOpenDialog(mainWindow, { title: `Select Rate Sheet`, filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }], properties: ['openFile'] });
        if (result.canceled || result.filePaths.length === 0) return { success: false, message: 'User cancelled' };
        try {
            const fileBuffer = fs.readFileSync(result.filePaths[0]);
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = xlsx.utils.sheet_to_json(worksheet, { range: 1, defval: "" });

            const runImport = db.transaction(() => {
                const getRes = db.prepare('SELECT id, rates FROM resources WHERE code = ?');
                const updateRes = db.prepare('UPDATE resources SET description = ?, unit = ?, rates = ? WHERE id = ?');
                const insertRes = db.prepare('INSERT INTO resources (id, code, description, unit, rates) VALUES (?, ?, ?, ?, ?)');
                let count = 0;
                for (const row of rawData) {
                    if (!row['Code']) continue;
                    const code = String(row['Code']).trim();
                    const desc = row['Description'] || '';
                    const unit = row['Unit'] || '';
                    const newRate = parseFloat(row['Lmr Rate (₹)']) || 0;
                    const existing = getRes.get(code);

                    if (existing) {
                        const rates = JSON.parse(existing.rates || '{}'); rates[regionName] = newRate;
                        updateRes.run(desc, unit, JSON.stringify(rates), existing.id);
                    } else {
                        insertRes.run(crypto.randomUUID(), code, desc, unit, JSON.stringify({ [regionName]: newRate }));
                    }
                    count++;
                }
                return count;
            });
            return { success: true, message: `Successfully updated ${runImport()} rates.` };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('db:get-resources', () => db.prepare('SELECT * FROM resources ORDER BY code ASC').all().map(r => ({ ...r, rates: r.rates ? JSON.parse(r.rates) : {} })));
    ipcMain.handle('db:create-resource', (event, data) => db.prepare('INSERT INTO resources (id, code, description, unit, rates) VALUES (?, ?, ?, ?, ?)').run(data.id || crypto.randomUUID(), data.code, data.description, data.unit, '{}'));
    ipcMain.handle('db:update-resource', (event, id, field, value) => db.prepare(`UPDATE resources SET ${field} = ? WHERE id = ?`).run(typeof value === 'object' ? JSON.stringify(value) : value, id));
    ipcMain.handle('db:delete-resource', (event, id) => db.prepare('DELETE FROM resources WHERE id = ?').run(id));

    ipcMain.handle('db:get-master-boqs', () => db.prepare('SELECT * FROM master_boq').all().map(b => ({ ...b, components: JSON.parse(b.components || '[]') })));
    ipcMain.handle('db:save-master-boq', async (event, payload, id, isNew) => {
        const compStr = JSON.stringify(payload.components);
        if (id && !isNew) {
            db.prepare('UPDATE master_boq SET itemCode=?, description=?, unit=?, overhead=?, profit=?, components=? WHERE id=?').run(payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr, id);
        } else {
            const insertId = isNew ? crypto.randomUUID() : (id || crypto.randomUUID());
            try {
                db.prepare('INSERT INTO master_boq (id, itemCode, description, unit, overhead, profit, components) VALUES (?, ?, ?, ?, ?, ?, ?)').run(insertId, payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr);
                return insertId;
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error("That ITEM_CODE already exists.");
                throw error;
            }
        }
    });
    ipcMain.handle('db:delete-master-boq', (event, id) => db.prepare('DELETE FROM master_boq WHERE id = ?').run(id));
    ipcMain.handle('db:purge-database', () => db.transaction(() => { db.prepare('DELETE FROM regions').run(); db.prepare('DELETE FROM resources').run(); db.prepare('DELETE FROM master_boq').run(); })());

    // --- SANITIZED PROJECT DOCUMENTS ---
    ipcMain.handle('db:get-project-documents', (e, projectId) => db.prepare('SELECT * FROM project_documents WHERE projectId = ? ORDER BY addedAt DESC').all(projectId));
    ipcMain.handle('db:save-project-document', (e, data) => {
        const { cols, placeholders, values } = sanitizeInsert(db, 'project_documents', data);
        db.prepare(`INSERT OR REPLACE INTO project_documents (${cols}) VALUES (${placeholders})`).run(...values);
    });
    ipcMain.handle('db:delete-project-document', (e, id) => db.prepare('DELETE FROM project_documents WHERE id = ?').run(id));

    // --- SANITIZED DIRECTORY (CRM & STAFF) ---
    ipcMain.handle('db:get-crm-contacts', () => db.prepare('SELECT * FROM crm_contacts').all());
    ipcMain.handle('db:save-crm-contact', (e, data) => {
        const { cols, placeholders, values } = sanitizeInsert(db, 'crm_contacts', data);
        db.prepare(`INSERT OR REPLACE INTO crm_contacts (${cols}) VALUES (${placeholders})`).run(...values);
    });
    ipcMain.handle('db:delete-crm-contact', (e, id) => db.prepare('DELETE FROM crm_contacts WHERE id = ?').run(id));

    ipcMain.handle('db:get-org-staff', () => db.prepare('SELECT * FROM org_staff').all());
    ipcMain.handle('db:save-org-staff', (e, data) => {
        const level = data.accessLevel ? parseInt(data.accessLevel, 10) : 1;
        db.prepare(`INSERT OR REPLACE INTO org_staff (id, name, designation, department, status, email, phone, createdAt, username, password, role, accessLevel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            data.id, data.name || '', data.designation || '', data.department || 'Operations', data.status || 'Active', data.email || '', data.phone || '', data.createdAt || Date.now(), data.username || null, data.password || null, data.role || 'Staff', level
        );
    });
    ipcMain.handle('db:delete-org-staff', (e, id) => db.prepare('DELETE FROM org_staff WHERE id = ?').run(id));

    // --- SANITIZED WORK LOGS ---
    ipcMain.handle('db:get-work-logs', () => db.prepare('SELECT * FROM staff_work_logs ORDER BY date DESC, slNo DESC').all());
    ipcMain.handle('db:save-work-log', (e, data) => {
        const { cols, placeholders, values } = sanitizeInsert(db, 'staff_work_logs', data);
        db.prepare(`INSERT OR REPLACE INTO staff_work_logs (${cols}) VALUES (${placeholders})`).run(...values);
    });
    ipcMain.handle('db:update-work-log', (e, id, data) => {
        const { fields, values } = sanitizeUpdate(db, 'staff_work_logs', data);
        db.prepare(`UPDATE staff_work_logs SET ${fields} WHERE id = ?`).run(...values, id);
    });
    ipcMain.handle('db:delete-work-log', (e, id) => db.prepare('DELETE FROM staff_work_logs WHERE id = ?').run(id));
    ipcMain.handle('db:get-kanban-tasks', () => []);
}