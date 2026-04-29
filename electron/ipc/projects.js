import { ipcMain } from 'electron';
import crypto from 'crypto';

// 🔥 THE SANITIZERS FOR PROJECTS 🔥
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

export function registerProjectsIpc(db) {
    // --- SANITIZED PROJECT HANDLERS ---
    ipcMain.handle('db:get-projects', () => db.prepare('SELECT * FROM projects').all());
    ipcMain.handle('db:get-project', (e, id) => db.prepare('SELECT * FROM projects WHERE id = ?').get(id));

    ipcMain.handle('db:add-project', (e, data) => {
        const { cols, placeholders, values } = sanitizeInsert(db, 'projects', data);
        db.prepare(`INSERT INTO projects (${cols}) VALUES (${placeholders})`).run(...values);
    });

    ipcMain.handle('db:update-project', (e, id, data) => {
        const { fields, values } = sanitizeUpdate(db, 'projects', data);
        db.prepare(`UPDATE projects SET ${fields} WHERE id = ?`).run(...values, id);
    });

    ipcMain.handle('db:delete-project', (e, id) => {
        db.transaction(() => {
            db.prepare('DELETE FROM projects WHERE id = ?').run(id);
            db.prepare('DELETE FROM project_boq WHERE projectId = ?').run(id);
            db.prepare('DELETE FROM project_documents WHERE projectId = ?').run(id);
        })();
    });

    ipcMain.handle('db:purge-projects', () => {
        db.transaction(() => {
            db.prepare('DELETE FROM projects').run();
            db.prepare('DELETE FROM project_boq').run();
            db.prepare('DELETE FROM project_documents').run();
        })();
    });

    ipcMain.handle('db:import-projects', (e, projectsArray, mode) => {
        db.transaction(() => {
            if (mode === 'replace') db.prepare('DELETE FROM projects').run();
            for (const p of projectsArray) {
                const pId = mode === 'append' ? crypto.randomUUID() : p.id;
                const { cols, placeholders, values } = sanitizeInsert(db, 'projects', { ...p, id: pId });
                db.prepare(`INSERT OR REPLACE INTO projects (${cols}) VALUES (${placeholders})`).run(...values);
            }
        })();
    });

    // --- SANITIZED PROJECT BOQ HANDLERS ---
    ipcMain.handle('db:get-project-boqs', (e, projectId) => db.prepare('SELECT * FROM project_boq WHERE projectId = ?').all(projectId));

    ipcMain.handle('db:add-project-boq', (e, data) => {
        const { cols, placeholders, values } = sanitizeInsert(db, 'project_boq', data);
        db.prepare(`INSERT INTO project_boq (id, ${cols}) VALUES (?, ${placeholders})`).run(crypto.randomUUID(), ...values);
    });

    ipcMain.handle('db:update-project-boq', (e, id, data) => {
        const { fields, values } = sanitizeUpdate(db, 'project_boq', data);
        db.prepare(`UPDATE project_boq SET ${fields} WHERE id = ?`).run(...values, id);
    });

    ipcMain.handle('db:delete-project-boq', (e, id) => db.prepare('DELETE FROM project_boq WHERE id = ?').run(id));

    ipcMain.handle('db:bulk-put-project-boqs', (e, dataArray) => {
        db.transaction(() => {
            const stmt = db.prepare(`UPDATE project_boq SET lockedRate = ? WHERE id = ?`);
            for (const item of dataArray) { stmt.run(item.lockedRate, item.id); }
        })();
    });
}