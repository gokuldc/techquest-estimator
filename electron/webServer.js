import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverInstance = null;

export function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '127.0.0.1';
}

const mapInsert = (data) => {
    const cols = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
    return { cols, placeholders, values };
};

const mapUpdate = (data) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
    return { fields, values };
};

export function startWebServer(port, db) {
    if (serverInstance) return { success: false, error: "Server is already running." };

    try {
        const app = express();
        app.use(cors());
        app.use(express.json({ limit: '50mb' }));

        // 🔥 FILE STREAMING ROUTE
        app.get('/api/download', (req, res) => {
            try {
                // Ensure the path is absolute and properly decoded
                const filePath = path.resolve(decodeURIComponent(req.query.path));

                if (!filePath || !fs.existsSync(filePath)) {
                    return res.status(404).send("File not found on Host computer.");
                }

                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    return res.status(400).send("Target is a directory, not a file.");
                }

                const fileName = path.basename(filePath);

                // Force the browser to download the file instead of trying to render it
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
                res.setHeader('Content-Length', stat.size);
                res.setHeader('Content-Type', 'application/octet-stream');

                // Pipe the file directly to the network request
                const readStream = fs.createReadStream(filePath);

                readStream.on('error', (err) => {
                    console.error("Read Stream Error:", err);
                    if (!res.headersSent) res.status(500).send("Error reading file.");
                });

                readStream.pipe(res);

            } catch (err) {
                console.error("Download endpoint crashed:", err);
                if (!res.headersSent) res.status(500).send("Internal Server Error");
            }
        });

        app.post('/api/rpc', (req, res) => {
            const { channel, args } = req.body;
            try {
                let result;

                // --- AUTH & SETTINGS ---
                if (channel === 'db:verify-login') {
                    const [un, pw] = args;
                    const user = db.prepare(`SELECT * FROM org_staff WHERE LOWER(username) = LOWER(?) AND password = ? AND status = 'Active'`).get(un, pw);
                    result = user ? { success: true, user } : { success: false, error: 'Invalid Credentials' };
                }
                else if (channel === 'db:get-settings') {
                    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(args[0]);
                    result = row ? JSON.parse(row.value) : null;
                }
                else if (channel === 'db:save-settings') {
                    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(args[0], JSON.stringify(args[1]));
                    result = { success: true };
                }

                // --- MASTER DATA (REGIONS/RESOURCES/BOQ) ---
                else if (channel === 'db:get-regions') {
                    result = db.prepare('SELECT * FROM regions ORDER BY name ASC').all();
                }
                else if (channel === 'db:create-region') {
                    const id = crypto.randomUUID();
                    db.prepare('INSERT INTO regions (id, name) VALUES (?, ?)').run(id, args[0]);
                    result = { success: true, id };
                }
                else if (channel === 'db:delete-region') {
                    db.transaction(() => {
                        db.prepare('DELETE FROM regions WHERE id = ?').run(args[0]);
                        const resources = db.prepare('SELECT id, rates FROM resources').all();
                        const updateStmt = db.prepare('UPDATE resources SET rates = ? WHERE id = ?');
                        for (const res of resources) {
                            const rates = JSON.parse(res.rates || '{}');
                            if (rates[args[1]] !== undefined) {
                                delete rates[args[1]];
                                updateStmt.run(JSON.stringify(rates), res.id);
                            }
                        }
                    })();
                    result = { success: true };
                }
                else if (channel === 'db:get-resources') {
                    result = db.prepare('SELECT * FROM resources ORDER BY code ASC').all().map(r => ({ ...r, rates: JSON.parse(r.rates || '{}') }));
                }
                else if (channel === 'db:create-resource') {
                    const d = args[0];
                    db.prepare('INSERT INTO resources (id, code, description, unit, rates) VALUES (?, ?, ?, ?, ?)').run(d.id || crypto.randomUUID(), d.code, d.description, d.unit, '{}');
                    result = { success: true };
                }
                else if (channel === 'db:update-resource') {
                    const val = typeof args[2] === 'object' ? JSON.stringify(args[2]) : args[2];
                    db.prepare(`UPDATE resources SET ${args[1]} = ? WHERE id = ?`).run(val, args[0]);
                    result = { success: true };
                }
                else if (channel === 'db:delete-resource') {
                    db.prepare('DELETE FROM resources WHERE id = ?').run(args[0]);
                    result = { success: true };
                }
                else if (channel === 'db:get-master-boqs') {
                    result = db.prepare('SELECT * FROM master_boq').all().map(b => ({ ...b, components: JSON.parse(b.components || '[]') }));
                }
                else if (channel === 'db:save-master-boq') {
                    const [payload, id, isNew] = args;
                    const compStr = JSON.stringify(payload.components);
                    if (id && !isNew) {
                        db.prepare('UPDATE master_boq SET itemCode=?, description=?, unit=?, overhead=?, profit=?, components=? WHERE id=?').run(payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr, id);
                        result = id;
                    } else {
                        const insertId = isNew ? crypto.randomUUID() : (id || crypto.randomUUID());
                        db.prepare('INSERT INTO master_boq (id, itemCode, description, unit, overhead, profit, components) VALUES (?, ?, ?, ?, ?, ?, ?)').run(insertId, payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr);
                        result = insertId;
                    }
                }
                else if (channel === 'db:delete-master-boq') {
                    db.prepare('DELETE FROM master_boq WHERE id = ?').run(args[0]);
                    result = { success: true };
                }

                // --- PROJECTS & WORKSPACE (FULLY UPDATED) ---
                else if (channel === 'db:get-projects') {
                    result = db.prepare('SELECT * FROM projects').all();
                }
                else if (channel === 'db:get-project') {
                    result = db.prepare('SELECT * FROM projects WHERE id = ?').get(args[0]);
                }
                else if (channel === 'db:add-project') {
                    const { cols, placeholders, values } = mapInsert(args[0]);
                    db.prepare(`INSERT INTO projects (${cols}) VALUES (${placeholders})`).run(...values);
                    result = { success: true };
                }
                else if (channel === 'db:update-project') {
                    const { fields, values } = mapUpdate(args[1]);
                    db.prepare(`UPDATE projects SET ${fields} WHERE id = ?`).run(...values, args[0]);
                    result = { success: true };
                }
                else if (channel === 'db:delete-project') {
                    db.transaction(() => {
                        db.prepare('DELETE FROM projects WHERE id = ?').run(args[0]);
                        db.prepare('DELETE FROM project_boq WHERE projectId = ?').run(args[0]);
                        db.prepare('DELETE FROM project_documents WHERE projectId = ?').run(args[0]);
                    })();
                    result = { success: true };
                }
                else if (channel === 'db:purge-projects') {
                    db.transaction(() => {
                        db.prepare('DELETE FROM projects').run();
                        db.prepare('DELETE FROM project_boq').run();
                        db.prepare('DELETE FROM project_documents').run();
                    })();
                    result = { success: true };
                }

                // --- PROJECT BOQS ---
                else if (channel === 'db:get-project-boqs') {
                    result = db.prepare('SELECT * FROM project_boq WHERE projectId = ?').all(args[0]);
                }
                else if (channel === 'db:add-project-boq') {
                    const { cols, placeholders, values } = mapInsert(args[0]);
                    db.prepare(`INSERT INTO project_boq (id, ${cols}) VALUES (?, ${placeholders})`).run(crypto.randomUUID(), ...values);
                    result = { success: true };
                }
                else if (channel === 'db:update-project-boq') {
                    const { fields, values } = mapUpdate(args[1]);
                    db.prepare(`UPDATE project_boq SET ${fields} WHERE id = ?`).run(...values, args[0]);
                    result = { success: true };
                }
                else if (channel === 'db:delete-project-boq') {
                    db.prepare('DELETE FROM project_boq WHERE id = ?').run(args[0]);
                    result = { success: true };
                }
                else if (channel === 'db:bulk-put-project-boqs') {
                    db.transaction(() => {
                        const stmt = db.prepare(`UPDATE project_boq SET lockedRate = ? WHERE id = ?`);
                        for (const item of args[0]) { stmt.run(item.lockedRate, item.id); }
                    })();
                    result = { success: true };
                }

                // --- SITE GALLERY & DOCUMENTS ---
                else if (channel === 'db:get-project-documents') {
                    result = db.prepare('SELECT * FROM project_documents WHERE projectId = ? ORDER BY addedAt DESC').all(args[0]);
                }
                else if (channel === 'db:save-project-document') {
                    const { cols, placeholders, values } = mapInsert(args[0]);
                    db.prepare(`INSERT OR REPLACE INTO project_documents (${cols}) VALUES (${placeholders})`).run(...values);
                    result = { success: true };
                }
                else if (channel === 'db:delete-project-document') {
                    db.prepare('DELETE FROM project_documents WHERE id = ?').run(args[0]);
                    result = { success: true };
                }

                // --- DIRECTORY & LOGS ---
                else if (channel === 'db:get-org-staff') result = db.prepare('SELECT * FROM org_staff').all();
                else if (channel === 'db:get-crm-contacts') result = db.prepare('SELECT * FROM crm_contacts').all();
                else if (channel === 'db:get-work-logs') result = db.prepare('SELECT * FROM staff_work_logs ORDER BY date DESC').all();

                // --- COMMLINK (MESSAGING) ---
                else if (channel === 'db:get-messages') {
                    result = args[0] ? db.prepare('SELECT * FROM messages WHERE projectId = ? ORDER BY createdAt ASC').all(args[0]) : db.prepare('SELECT * FROM messages WHERE projectId IS NULL ORDER BY createdAt ASC').all();
                }
                else if (channel === 'db:save-message') {
                    const d = args[0];
                    db.prepare(`INSERT INTO messages (id, projectId, senderId, content, replyToId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(d.id, d.projectId || null, d.senderId, d.content, d.replyToId || null, d.createdAt);
                    result = { success: true };
                }
                // DELETE HANDLER
                else if (channel === 'db:delete-message') {
                    db.prepare('DELETE FROM messages WHERE id = ?').run(args[0]);
                    result = { success: true };
                }
                // UNIFIED FILE UPLOADER FOR WEB SESSIONS
                else if (channel === 'os:upload-file-web') {
                    const [fileName, base64Data, projectId] = args;
                    const base64String = base64Data.split(';base64,').pop();
                    const buffer = Buffer.from(base64String, 'base64');

                    // Save to a universal uploads directory on the Host
                    const uploadDir = path.join(os.homedir(), '.openprix', 'uploads');
                    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

                    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
                    const filePath = path.join(uploadDir, safeName);

                    fs.writeFileSync(filePath, buffer);
                    result = { success: true, path: filePath };
                }

                // --- DIRECT MESSAGES ---
                else if (channel === 'db:get-private-messages') {
                    result = db.prepare(`SELECT * FROM private_messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY createdAt ASC`).all(args[0], args[1], args[1], args[0]);
                }
                else if (channel === 'db:save-private-message') {
                    const d = args[0];
                    db.prepare(`INSERT INTO private_messages (id, senderId, receiverId, content, replyToId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(d.id, d.senderId, d.receiverId, d.content, d.replyToId || null, d.createdAt);
                    result = { success: true };
                }
                // 🔥 ADDED DELETE HANDLER
                else if (channel === 'db:delete-private-message') {
                    db.prepare('DELETE FROM private_messages WHERE id = ?').run(args[0]);
                    result = { success: true };
                }

                // 🔥 ADDED NOTIFICATION ENGINE FOR NETWORK USERS
                else if (channel === 'db:check-notifications') {
                    const userId = args[0];
                    const lastChecked = args[1] || 0;

                    const globalUnread = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE projectId IS NULL AND senderId != ? AND createdAt > ?`).get(userId, lastChecked);
                    const dmUnread = db.prepare(`SELECT COUNT(*) as count FROM private_messages WHERE receiverId = ? AND createdAt > ?`).get(userId, lastChecked);

                    result = (globalUnread ? globalUnread.count : 0) + (dmUnread ? dmUnread.count : 0);
                }

                else { return res.status(404).json({ error: 'Unknown Channel: ' + channel }); }

                res.json({ success: true, data: result });
            } catch (err) { res.status(500).json({ success: false, error: err.message }); }
        });

        const distPath = path.join(__dirname, '../dist');
        app.use(express.static(distPath));
        app.use((req, res) => res.sendFile(path.join(distPath, 'index.html')));

        return new Promise((resolve) => {
            serverInstance = app.listen(port, '0.0.0.0', () => {
                const ip = getLocalIp();
                resolve({ success: true, url: `http://${ip}:${port}` });
            });
        });
    } catch (err) { return { success: false, error: err.message }; }
}

export function stopWebServer() {
    if (!serverInstance) return { success: false, error: "Server is not running." };
    return new Promise((resolve) => {
        serverInstance.close(() => { serverInstance = null; resolve({ success: true }); });
    });
}