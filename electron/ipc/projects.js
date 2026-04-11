import { ipcMain } from 'electron';
import crypto from 'crypto';

export function registerProjectsIpc(db) {
    ipcMain.handle('db:get-projects', () => db.prepare('SELECT * FROM projects').all());
    ipcMain.handle('db:get-project', (e, id) => db.prepare('SELECT * FROM projects WHERE id = ?').get(id));

    ipcMain.handle('db:add-project', (e, data) => {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
        db.prepare(`INSERT INTO projects (${cols}) VALUES (${placeholders})`).run(...values);
    });

    ipcMain.handle('db:update-project', (e, id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
        db.prepare(`UPDATE projects SET ${fields} WHERE id = ?`).run(...values, id);
    });

    ipcMain.handle('db:delete-project', (e, id) => {
        db.transaction(() => {
            db.prepare('DELETE FROM projects WHERE id = ?').run(id);
            db.prepare('DELETE FROM project_boq WHERE projectId = ?').run(id);
        })();
    });

    ipcMain.handle('db:purge-projects', () => {
        db.transaction(() => {
            db.prepare('DELETE FROM projects').run();
            db.prepare('DELETE FROM project_boq').run();
        })();
    });

    ipcMain.handle('db:import-projects', (e, projectsArray, mode) => {
        db.transaction(() => {
            if (mode === 'replace') db.prepare('DELETE FROM projects').run();
            for (const p of projectsArray) {
                const data = { ...p, id: mode === 'append' ? crypto.randomUUID() : p.id };
                const cols = Object.keys(data).join(', ');
                const placeholders = Object.keys(data).map(() => '?').join(', ');
                const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
                db.prepare(`INSERT OR REPLACE INTO projects (${cols}) VALUES (${placeholders})`).run(...values);
            }
        })();
    });

    ipcMain.handle('db:get-project-boqs', (e, projectId) => db.prepare('SELECT * FROM project_boq WHERE projectId = ?').all(projectId));

    ipcMain.handle('db:add-project-boq', (e, data) => {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
        db.prepare(`INSERT INTO project_boq (id, ${cols}) VALUES (?, ${placeholders})`).run(crypto.randomUUID(), ...values);
    });

    ipcMain.handle('db:update-project-boq', (e, id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
        db.prepare(`UPDATE project_boq SET ${fields} WHERE id = ?`).run(...values, id);
    });

    ipcMain.handle('db:delete-project-boq', (e, id) => db.prepare('DELETE FROM project_boq WHERE id = ?').run(id));

    ipcMain.handle('db:bulk-put-project-boqs', (e, dataArray) => {
        db.transaction(() => {
            const stmt = db.prepare(`UPDATE project_boq SET lockedRate = ? WHERE id = ?`);
            for (const item of dataArray) { stmt.run(item.lockedRate, item.id); }
        })();
    });

    ipcMain.handle('db:get-crm-contacts', () => db.prepare('SELECT * FROM crm_contacts').all());
    ipcMain.handle('db:save-crm-contact', (e, data) => {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        db.prepare(`INSERT OR REPLACE INTO crm_contacts (${cols}) VALUES (${placeholders})`).run(...Object.values(data));
    });
    ipcMain.handle('db:delete-crm-contact', (e, id) => db.prepare('DELETE FROM crm_contacts WHERE id = ?').run(id));

    ipcMain.handle('db:get-org-staff', () => db.prepare('SELECT * FROM org_staff').all());
    ipcMain.handle('db:save-org-staff', (e, data) => {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        db.prepare(`INSERT OR REPLACE INTO org_staff (${cols}) VALUES (${placeholders})`).run(...Object.values(data));
    });
    ipcMain.handle('db:delete-org-staff', (e, id) => db.prepare('DELETE FROM org_staff WHERE id = ?').run(id));

    ipcMain.handle('db:get-kanban-tasks', () => []);
}