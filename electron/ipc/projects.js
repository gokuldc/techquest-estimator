import { ipcMain } from 'electron';
import crypto from 'crypto';

export function registerProjectsIpc(db) {
    // --- PROJECT HANDLERS ---
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
            db.prepare('DELETE FROM project_documents WHERE projectId = ?').run(id); // Cascade delete docs
        })();
    });

    ipcMain.handle('db:purge-projects', () => {
        db.transaction(() => {
            db.prepare('DELETE FROM projects').run();
            db.prepare('DELETE FROM project_boq').run();
            db.prepare('DELETE FROM project_documents').run(); // Clean all doc links
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

    // --- PROJECT BOQ HANDLERS ---
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

    // --- NEW: DOCUMENT MANAGEMENT HANDLERS ---
    ipcMain.handle('db:get-project-documents', (e, projectId) => {
        return db.prepare('SELECT * FROM project_documents WHERE projectId = ? ORDER BY addedAt DESC').all(projectId);
    });

    ipcMain.handle('db:save-project-document', (e, data) => {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        // Using INSERT OR REPLACE to handle potential updates to existing links
        db.prepare(`INSERT OR REPLACE INTO project_documents (${cols}) VALUES (${placeholders})`).run(...Object.values(data));
    });

    ipcMain.handle('db:delete-project-document', (e, id) => {
        db.prepare('DELETE FROM project_documents WHERE id = ?').run(id);
    });

    // --- CRM & STAFF HANDLERS ---
    ipcMain.handle('db:get-crm-contacts', () => db.prepare('SELECT * FROM crm_contacts').all());
    ipcMain.handle('db:save-crm-contact', (e, data) => {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        db.prepare(`INSERT OR REPLACE INTO crm_contacts (${cols}) VALUES (${placeholders})`).run(...Object.values(data));
    });
    ipcMain.handle('db:delete-crm-contact', (e, id) => db.prepare('DELETE FROM crm_contacts WHERE id = ?').run(id));

    ipcMain.handle('db:get-org-staff', () => db.prepare('SELECT * FROM org_staff').all());
    ipcMain.handle('db:save-org-staff', (e, data) => {
        const level = data.accessLevel ? parseInt(data.accessLevel, 10) : 1;

        db.prepare(`
            INSERT OR REPLACE INTO org_staff 
            (id, name, designation, department, status, email, phone, createdAt, username, password, role, accessLevel) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.id,
            data.name || '',
            data.designation || '',
            data.department || 'Operations',
            data.status || 'Active',
            data.email || '',
            data.phone || '',
            data.createdAt || Date.now(),
            data.username || null,
            data.password || null,
            data.role || 'Staff',
            level
        );
    });
    ipcMain.handle('db:delete-org-staff', (e, id) => db.prepare('DELETE FROM org_staff WHERE id = ?').run(id));

    ipcMain.handle('db:get-kanban-tasks', () => []);

    // --- CHAT & MESSAGING HANDLERS ---
    ipcMain.handle('db:get-messages', (e, projectId) => {
        if (projectId) {
            return db.prepare('SELECT * FROM messages WHERE projectId = ? ORDER BY createdAt ASC').all(projectId);
        } else {
            return db.prepare('SELECT * FROM messages WHERE projectId IS NULL ORDER BY createdAt ASC').all();
        }
    });

    ipcMain.handle('db:save-message', (e, data) => {
        db.prepare(`
            INSERT INTO messages (id, projectId, senderId, content, createdAt) 
            VALUES (?, ?, ?, ?, ?)
        `).run(data.id, data.projectId || null, data.senderId, data.content, data.createdAt);
    });

    // FETCH PRIVATE MESSAGES (Between User A and User B)
    ipcMain.handle('db:get-private-messages', (e, user1, user2) => {
        return db.prepare(`
            SELECT * FROM private_messages 
            WHERE (senderId = ? AND receiverId = ?) 
               OR (senderId = ? AND receiverId = ?)
            ORDER BY createdAt ASC
        `).all(user1, user2, user2, user1);
    });

    // SAVE PRIVATE MESSAGE
    ipcMain.handle('db:save-private-message', (e, data) => {
        db.prepare(`
            INSERT INTO private_messages (id, senderId, receiverId, content, createdAt) 
            VALUES (?, ?, ?, ?, ?)
        `).run(data.id, data.senderId, data.receiverId, data.content, data.createdAt);
    });

    // 🔥 NEW: UNREAD NOTIFICATION CHECKER
    ipcMain.handle('db:check-notifications', (e, userId, lastChecked) => {
        try {
            // Count global messages sent by OTHERS after the last checked time
            const globalUnread = db.prepare(`
                SELECT COUNT(*) as count FROM messages 
                WHERE projectId IS NULL AND senderId != ? AND createdAt > ?
            `).get(userId, lastChecked || 0);

            // Count Direct Messages sent to THIS user after the last checked time
            const dmUnread = db.prepare(`
                SELECT COUNT(*) as count FROM private_messages 
                WHERE receiverId = ? AND createdAt > ?
            `).get(userId, lastChecked || 0);

            return (globalUnread ? globalUnread.count : 0) + (dmUnread ? dmUnread.count : 0);
        } catch (err) {
            console.error("Notification check error:", err);
            return 0; // Failsafe
        }
    });
    // --- STAFF WORK LOGS HANDLERS ---
    ipcMain.handle('db:get-work-logs', () => {
        return db.prepare('SELECT * FROM staff_work_logs ORDER BY date DESC, slNo DESC').all();
    });

    ipcMain.handle('db:save-work-log', (e, data) => {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        db.prepare(`INSERT OR REPLACE INTO staff_work_logs (${cols}) VALUES (${placeholders})`).run(...Object.values(data));
    });

    ipcMain.handle('db:delete-work-log', (e, id) => {
        db.prepare('DELETE FROM staff_work_logs WHERE id = ?').run(id);
    });
}