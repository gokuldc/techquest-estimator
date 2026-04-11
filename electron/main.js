import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import * as xlsx from 'xlsx';

// ✅ HARD GPU FIX (Removed to fix invisible cursor bug)
app.disableHardwareAcceleration();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let db; 

// ==========================================
// DATABASE INITIALIZATION
// ==========================================
function initDatabase() {
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'database');

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'openprix_v2.sqlite');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    console.log(`Database initialized at: ${dbPath}`);

    const initSql = `
        CREATE TABLE IF NOT EXISTS regions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS resources (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE,
            description TEXT,
            unit TEXT,
            rates TEXT 
        );
        CREATE TABLE IF NOT EXISTS master_boq (
            id TEXT PRIMARY KEY,
            itemCode TEXT UNIQUE,
            description TEXT,
            unit TEXT,
            overhead REAL,
            profit REAL,
            components TEXT
        );
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT, code TEXT, clientName TEXT, status TEXT, region TEXT, 
            projectLead TEXT, siteSupervisor TEXT, pmc TEXT, architect TEXT, 
            structuralEngineer TEXT, isPriceLocked INTEGER DEFAULT 0,
            dailyLogs TEXT, actualResources TEXT, ganttTasks TEXT, 
            subcontractors TEXT, phaseAssignments TEXT,
            createdAt INTEGER
        );
        CREATE TABLE IF NOT EXISTS project_boq (
            id TEXT PRIMARY KEY,
            projectId TEXT,
            masterBoqId TEXT,
            slNo INTEGER,
            isCustom INTEGER DEFAULT 0,
            itemCode TEXT, description TEXT, unit TEXT,
            rate REAL, formulaStr TEXT, qty REAL,
            measurements TEXT, phase TEXT, lockedRate REAL
        );
        CREATE TABLE IF NOT EXISTS crm_contacts (
            id TEXT PRIMARY KEY,
            name TEXT, company TEXT, type TEXT, status TEXT, email TEXT, phone TEXT, createdAt INTEGER
        );
        CREATE TABLE IF NOT EXISTS org_staff (
            id TEXT PRIMARY KEY,
            name TEXT, designation TEXT, department TEXT, status TEXT, email TEXT, phone TEXT, createdAt INTEGER
        );
    `;
    db.exec(initSql);

    // 🔥 AUTOMATED FIX: Safely patches database with missing columns
    try { db.exec("ALTER TABLE projects ADD COLUMN createdAt INTEGER;"); } catch (err) {}
    try { db.exec("ALTER TABLE projects ADD COLUMN dailySchedules TEXT;"); } catch (err) {}
    try { db.exec("ALTER TABLE projects ADD COLUMN resourceTrackingMode TEXT DEFAULT 'manual';"); } catch (err) {}
}

// ==========================================
// WINDOW CREATION
// ==========================================
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 800, minWidth: 900, minHeight: 600,
        title: "//OPENPRIX", autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://127.0.0.1:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
    initDatabase();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});

// ==========================================
// IPC HANDLERS (The Bridge to React)
// ==========================================

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

ipcMain.handle('db:get-master-boqs', () => {
    return db.prepare('SELECT * FROM master_boq').all().map(b => ({
        ...b, components: JSON.parse(b.components || '[]')
    }));
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

ipcMain.handle('db:save-master-boq', async (event, payload, id, isNew) => {
    const compStr = JSON.stringify(payload.components);
    
    if (id && !isNew) {
        // UPDATE EXISTING ITEM
        db.prepare('UPDATE master_boq SET itemCode=?, description=?, unit=?, overhead=?, profit=?, components=? WHERE id=?').run(
            payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr, id
        );
    } else {
        // 🔥 THE FIX: If isNew is true, forcefully generate a fresh UUID and ignore the old ID!
        const insertId = isNew ? crypto.randomUUID() : (id || crypto.randomUUID());
        
        try {
            db.prepare('INSERT INTO master_boq (id, itemCode, description, unit, overhead, profit, components) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                insertId, payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr
            );
            return insertId;
        } catch (error) {
            // Friendly error if the user forgets to change the Item Code when saving as new
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error("That ITEM_CODE already exists. Please change the code before saving as new.");
            }
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

// ==========================================
// PROJECT WORKSPACE IPC HANDLERS
// ==========================================
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

// ==========================================
// DIRECTORY & SYNC IPC HANDLERS
// ==========================================
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
// ==========================================
// NATIVE SQLITE PROJECT SYNC ENGINE
// ==========================================
ipcMain.handle('db:export-project-sqlite', async (e, projectId, options) => {
    const currentProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!currentProject) return { success: false, error: 'Project not found' };

    const dest = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Project Sync File (Customized)',
        defaultPath: `OpenPrix_Sync_${currentProject.code || 'Project'}.sqlite`,
        filters: [{ name: 'SQLite Sync File', extensions: ['sqlite', 'db'] }]
    });

    if (dest.canceled) return { success: false, canceled: true };

    try {
        const syncDb = new Database(dest.filePath);
        
        // 1. Conditionally Create Tables
        syncDb.exec(`
            CREATE TABLE projects (
                id TEXT PRIMARY KEY, name TEXT, code TEXT, clientName TEXT, status TEXT, region TEXT, 
                projectLead TEXT, siteSupervisor TEXT, pmc TEXT, architect TEXT, 
                structuralEngineer TEXT, isPriceLocked INTEGER DEFAULT 0,
                dailyLogs TEXT, actualResources TEXT, ganttTasks TEXT, 
                subcontractors TEXT, phaseAssignments TEXT, dailySchedules TEXT, resourceTrackingMode TEXT DEFAULT 'manual', createdAt INTEGER
            );
        `);

        if (options.boq) {
            syncDb.exec(`
                CREATE TABLE project_boq (
                    id TEXT PRIMARY KEY, projectId TEXT, masterBoqId TEXT, slNo INTEGER, isCustom INTEGER DEFAULT 0,
                    itemCode TEXT, description TEXT, unit TEXT, rate REAL, formulaStr TEXT, qty REAL,
                    measurements TEXT, phase TEXT, lockedRate REAL
                );
            `);
        }

        // 2. Prepare Project Data based on filters
        const pData = { ...currentProject };
        if (!options.dailyLogs) { pData.dailyLogs = "[]"; pData.actualResources = "{}"; pData.dailySchedules = "[]"; }
        if (!options.gantt) { pData.ganttTasks = "[]"; }
        if (!options.subcontractors) { pData.subcontractors = "[]"; }
        if (!options.details) {
            // If details are unchecked, we only keep enough to identify the project
            const minimal = { id: pData.id, name: pData.name, code: pData.code };
            Object.keys(pData).forEach(key => { if(!minimal[key]) pData[key] = null; });
        }

        // Insert Project
        const pCols = Object.keys(pData);
        syncDb.prepare(`INSERT INTO projects (${pCols.join(',')}) VALUES (${pCols.map(() => '?').join(',')})`).run(...Object.values(pData));

        // 3. Conditionally Insert BOQ
        if (options.boq) {
            const boqs = db.prepare('SELECT * FROM project_boq WHERE projectId = ?').all(projectId);
            if (boqs.length > 0) {
                const bCols = Object.keys(boqs[0]);
                const insertBoq = syncDb.prepare(`INSERT INTO project_boq (${bCols.join(',')}) VALUES (${bCols.map(() => '?').join(',')})`);
                for (const b of boqs) { insertBoq.run(...Object.values(b)); }
            }
        }

        syncDb.close();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ==========================================
// FULL PROJECT ARCHIVE EXPORT/IMPORT (SQLite)
// ==========================================
ipcMain.handle('db:export-all-projects-sqlite', async () => {
    const projects = db.prepare('SELECT * FROM projects').all();
    if (projects.length === 0) return { success: false, error: 'No projects to export' };

    const dest = await dialog.showSaveDialog(mainWindow, {
        title: 'Export All Projects Archive',
        defaultPath: `OpenPrix_Archive_${new Date().toISOString().slice(0, 10)}.sqlite`,
        filters: [{ name: 'SQLite Archive', extensions: ['sqlite', 'db'] }]
    });

    if (dest.canceled) return { success: false, canceled: true };

    try {
        const syncDb = new Database(dest.filePath);
        
        // Create tables
        syncDb.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY, name TEXT, code TEXT, clientName TEXT, status TEXT, region TEXT, 
                projectLead TEXT, siteSupervisor TEXT, pmc TEXT, architect TEXT, 
                structuralEngineer TEXT, isPriceLocked INTEGER DEFAULT 0,
                dailyLogs TEXT, actualResources TEXT, ganttTasks TEXT, 
                subcontractors TEXT, phaseAssignments TEXT, dailySchedules TEXT, resourceTrackingMode TEXT DEFAULT 'manual', createdAt INTEGER
            );
            CREATE TABLE IF NOT EXISTS project_boq (
                id TEXT PRIMARY KEY, projectId TEXT, masterBoqId TEXT, slNo INTEGER, isCustom INTEGER DEFAULT 0,
                itemCode TEXT, description TEXT, unit TEXT, rate REAL, formulaStr TEXT, qty REAL,
                measurements TEXT, phase TEXT, lockedRate REAL
            );
        `);

        // Export all projects
        for (const p of projects) {
            const cols = Object.keys(p).join(', ');
            const placeholders = Object.keys(p).map(() => '?').join(', ');
            syncDb.prepare(`INSERT OR REPLACE INTO projects (${cols}) VALUES (${placeholders})`).run(...Object.values(p));

            // Export BOQ items for this project
            const boqs = db.prepare('SELECT * FROM project_boq WHERE projectId = ?').all(p.id);
            for (const b of boqs) {
                const bCols = Object.keys(b).join(', ');
                const bPlaceholders = Object.keys(b).map(() => '?').join(', ');
                syncDb.prepare(`INSERT OR REPLACE INTO project_boq (${bCols}) VALUES (${bPlaceholders})`).run(...Object.values(b));
            }
        }

        syncDb.close();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:import-projects-sqlite', async (e, filePath, mode) => {
    try {
        const importDb = new Database(filePath);
        
        // Check if it's a valid archive
        const tables = importDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const tableNames = tables.map(t => t.name);
        if (!tableNames.includes('projects')) {
            importDb.close();
            return { success: false, error: 'Invalid archive: no projects table found' };
        }

        const importedProjects = importDb.prepare('SELECT * FROM projects').all();
        if (importedProjects.length === 0) {
            importDb.close();
            return { success: false, error: 'No projects found in archive' };
        }

        db.transaction(() => {
            if (mode === 'replace') {
                db.prepare('DELETE FROM project_boq').run();
                db.prepare('DELETE FROM projects').run();
            }

            for (const p of importedProjects) {
                const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(p.id);
                
                if (mode === 'merge' && existing) {
                    // Update existing project
                    const cols = Object.keys(p).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
                    const values = Object.values(p).filter((_, i) => Object.keys(p)[i] !== 'id');
                    db.prepare(`UPDATE projects SET ${cols} WHERE id = ?`).run(...values, p.id);
                } else if (mode === 'append' || (mode === 'merge' && !existing)) {
                    // New ID for append, or insert if merging non-existing
                    const newId = mode === 'append' ? crypto.randomUUID() : p.id;
                    const cols = Object.keys(p).join(', ');
                    const placeholders = Object.keys(p).map(() => '?').join(', ');
                    const values = Object.values(p).map((v, i) => Object.keys(p)[i] === 'id' ? newId : v);
                    db.prepare(`INSERT OR REPLACE INTO projects (${cols}) VALUES (${placeholders})`).run(...values);
                    
                    // Also import BOQ with new project ID mapping
                    if (mode === 'append') {
                        const oldBoqs = importDb.prepare('SELECT * FROM project_boq WHERE projectId = ?').all(p.id);
                        for (const b of oldBoqs) {
                            const bCols = Object.keys(b).map(k => k === 'projectId' ? 'projectId = ?' : `${k} = ?`).join(', ');
                            const bValues = Object.values(b).map((v, i) => Object.keys(b)[i] === 'projectId' ? newId : v);
                            db.prepare(`INSERT INTO project_boq (id, projectId, masterBoqId, slNo, isCustom, itemCode, description, unit, rate, formulaStr, qty, measurements, phase, lockedRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                                crypto.randomUUID(), newId, b.masterBoqId, b.slNo, b.isCustom, b.itemCode, b.description, b.unit, b.rate, b.formulaStr, b.qty, b.measurements, b.phase, b.lockedRate
                            );
                        }
                    }
                }
            }

            // Import BOQ items for non-conflicting projects
            if (mode === 'merge') {
                const importedBoqs = importDb.prepare(`
                    SELECT b.* FROM project_boq b
                    LEFT JOIN projects p ON b.projectId = p.id
                    WHERE p.id IS NULL
                `).all();
                for (const b of importedBoqs) {
                    const targetProject = importedProjects.find(p => p.id === b.projectId);
                    if (targetProject) {
                        const newProjectId = db.prepare('SELECT id FROM projects WHERE id = ?').get(targetProject.id) ? targetProject.id : null;
                        if (newProjectId) {
                            db.prepare(`INSERT INTO project_boq (id, projectId, masterBoqId, slNo, isCustom, itemCode, description, unit, rate, formulaStr, qty, measurements, phase, lockedRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                                crypto.randomUUID(), newProjectId, b.masterBoqId, b.slNo, b.isCustom, b.itemCode, b.description, b.unit, b.rate, b.formulaStr, b.qty, b.measurements, b.phase, b.lockedRate
                            );
                        }
                    }
                }
            }
        })();

        importDb.close();
        return { success: true, count: importedProjects.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:select-sync-file', async () => {
    const src = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Project Sync File',
        filters: [{ name: 'SQLite Sync File', extensions: ['sqlite', 'db'] }],
        properties: ['openFile']
    });

    if (src.canceled || src.filePaths.length === 0) return { success: false, canceled: true };

    try {
        const syncDb = new Database(src.filePaths[0], { readonly: true });
        const project = syncDb.prepare('SELECT id, name, code FROM projects LIMIT 1').get();
        syncDb.close();
        
        return { success: true, filePath: src.filePaths[0], projectName: project?.name, projectCode: project?.code };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:select-archive-file', async () => {
    const src = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Project Archive File',
        filters: [{ name: 'SQLite Archive', extensions: ['sqlite', 'db'] }],
        properties: ['openFile']
    });

    if (src.canceled || src.filePaths.length === 0) return { success: false, canceled: true };

    try {
        const importDb = new Database(src.filePaths[0], { readonly: true });
        const projects = importDb.prepare('SELECT id, name, code FROM projects').all();
        importDb.close();
        
        return { success: true, filePath: src.filePaths[0], projects };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:execute-project-sync', async (e, targetProjectId, filePath, mode) => {
    try {
        const syncDb = new Database(filePath, { readonly: true });
        const incomingProject = syncDb.prepare('SELECT * FROM projects LIMIT 1').get();
        const incomingBoqs = syncDb.prepare('SELECT * FROM project_boq').all();
        syncDb.close();

        if (!incomingProject) throw new Error("Sync File Empty.");

        const parseSafe = (str) => { try { const parsed = JSON.parse(str); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
        const parseSafeObj = (str) => { try { const parsed = JSON.parse(str); return parsed || {}; } catch { return {}; } };

        const syncData = {
            projectDetails: {
                ...incomingProject,
                dailyLogs: parseSafe(incomingProject.dailyLogs),
                actualResources: parseSafeObj(incomingProject.actualResources),
                ganttTasks: parseSafe(incomingProject.ganttTasks),
                subcontractors: parseSafe(incomingProject.subcontractors),
                dailySchedules: parseSafe(incomingProject.dailySchedules),
                phaseAssignments: parseSafeObj(incomingProject.phaseAssignments),
            },
            projectBoq: incomingBoqs.map(b => ({
                ...b, isCustom: b.isCustom === 1, measurements: parseSafe(b.measurements)
            }))
        };

        db.transaction(() => {
            const currentProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(targetProjectId);
            if (!currentProject) throw new Error("Target Project not found");

            const mergeArrays = (currentArr, incomingArr) => {
                const map = new Map();
                currentArr.forEach(item => { if(item && item.id) map.set(item.id, item); });
                incomingArr.forEach(item => { if(item && item.id) map.set(item.id, item); });
                return Array.from(map.values());
            };

            const appendArrays = (currentArr, incomingArr) => {
                const existingIds = new Set(currentArr.filter(i => i && i.id).map(i => i.id));
                const purelyNewItems = incomingArr.filter(i => i && i.id && !existingIds.has(i.id));
                return [...currentArr, ...purelyNewItems];
            };

            const pd = syncData.projectDetails;
            const detailsToUpdate = {
                name: pd.name || currentProject.name,
                code: pd.code || currentProject.code,
                clientName: pd.clientName || currentProject.clientName,
                status: pd.status || currentProject.status,
                region: pd.region || currentProject.region,
                projectLead: pd.projectLead || currentProject.projectLead,
                siteSupervisor: pd.siteSupervisor || currentProject.siteSupervisor,
                isPriceLocked: pd.isPriceLocked !== undefined ? pd.isPriceLocked : currentProject.isPriceLocked,
                pmc: pd.pmc || currentProject.pmc,
                architect: pd.architect || currentProject.architect,
                structuralEngineer: pd.structuralEngineer || currentProject.structuralEngineer,
            };

            let finalLogs = parseSafe(currentProject.dailyLogs);
            let finalSchedules = parseSafe(currentProject.dailySchedules);
            let finalTasks = parseSafe(currentProject.ganttTasks);
            let finalSubs = parseSafe(currentProject.subcontractors);
            let finalActuals = parseSafeObj(currentProject.actualResources);

            if (mode === 'replace') {
                finalLogs = pd.dailyLogs; finalSchedules = pd.dailySchedules; finalTasks = pd.ganttTasks; finalSubs = pd.subcontractors; finalActuals = pd.actualResources;
            } else if (mode === 'merge') {
                finalLogs = mergeArrays(finalLogs, pd.dailyLogs); finalSchedules = mergeArrays(finalSchedules, pd.dailySchedules); finalTasks = mergeArrays(finalTasks, pd.ganttTasks); finalSubs = mergeArrays(finalSubs, pd.subcontractors); finalActuals = { ...finalActuals, ...pd.actualResources }; 
            } else if (mode === 'append') {
                finalLogs = appendArrays(finalLogs, pd.dailyLogs); finalSchedules = appendArrays(finalSchedules, pd.dailySchedules); finalTasks = appendArrays(finalTasks, pd.ganttTasks); finalSubs = appendArrays(finalSubs, pd.subcontractors); 
                for (const [key, qty] of Object.entries(pd.actualResources)) { finalActuals[key] = (finalActuals[key] || 0) + Number(qty); }
            }

            detailsToUpdate.dailyLogs = JSON.stringify(finalLogs);
            detailsToUpdate.dailySchedules = JSON.stringify(finalSchedules);
            detailsToUpdate.ganttTasks = JSON.stringify(finalTasks);
            detailsToUpdate.subcontractors = JSON.stringify(finalSubs);
            detailsToUpdate.actualResources = JSON.stringify(finalActuals);
            detailsToUpdate.phaseAssignments = JSON.stringify(pd.phaseAssignments || parseSafeObj(currentProject.phaseAssignments));

            const fields = Object.keys(detailsToUpdate).map(k => `${k} = ?`).join(', ');
            const values = Object.values(detailsToUpdate);
            db.prepare(`UPDATE projects SET ${fields} WHERE id = ?`).run(...values, targetProjectId);

            if (mode === 'replace') db.prepare('DELETE FROM project_boq WHERE projectId = ?').run(targetProjectId);

            const insertOrReplaceStmt = db.prepare(`INSERT OR REPLACE INTO project_boq (id, projectId, masterBoqId, slNo, isCustom, itemCode, description, unit, rate, formulaStr, qty, measurements, phase, lockedRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            const existingBoqs = db.prepare('SELECT id, slNo FROM project_boq WHERE projectId = ?').all(targetProjectId);
            const existingBoqIds = new Set(existingBoqs.map(b => b.id));
            let currentMaxSlNo = existingBoqs.length > 0 ? Math.max(...existingBoqs.map(b => b.slNo || 0)) : 0;

            for (const boq of syncData.projectBoq) {
                const measurementsStr = JSON.stringify(boq.measurements || []);
                if (mode === 'append') {
                    if (existingBoqIds.has(boq.id)) continue; 
                    currentMaxSlNo++;
                    insertOrReplaceStmt.run(
                        boq.id, targetProjectId, boq.masterBoqId || null, currentMaxSlNo, 
                        boq.isCustom ? 1 : 0, boq.itemCode || null, boq.description || null, boq.unit || null,
                        boq.rate || 0, boq.formulaStr || String(boq.qty), boq.qty || 0,
                        measurementsStr, boq.phase || "General", boq.lockedRate || null
                    );
                } else {
                    insertOrReplaceStmt.run(
                        boq.id || crypto.randomUUID(), targetProjectId, boq.masterBoqId || null, boq.slNo,
                        boq.isCustom ? 1 : 0, boq.itemCode || null, boq.description || null, boq.unit || null,
                        boq.rate || 0, boq.formulaStr || String(boq.qty), boq.qty || 0,
                        measurementsStr, boq.phase || "General", boq.lockedRate || null
                    );
                }
            }
        })();
        return { success: true };
    } catch (error) {
        console.error("Execute Sync Error:", error);
        return { success: false, error: error.message };
    }
});
ipcMain.handle('db:backup-database', async () => {
    try {
        const dest = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Database Backup',
            defaultPath: `OpenPrix_Backup_${new Date().toISOString().split('T')[0]}.sqlite`,
            filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
        });

        if (dest.canceled) return { success: false, canceled: true };

        // better-sqlite3 has a built-in safe backup API!
        await db.backup(dest.filePath);
        return { success: true };
    } catch (error) {
        console.error("Backup Error:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:restore-database', async (e, mode) => {
    try {
        const src = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Master Database Backup',
            filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
            properties: ['openFile']
        });

        if (src.canceled || src.filePaths.length === 0) return { success: false, canceled: true };

        // 1. Open the backup file in read-only mode
        const backupDb = new Database(src.filePaths[0], { readonly: true });
        
        // 2. Extract Master Data
        const bRegions = backupDb.prepare('SELECT * FROM regions').all();
        const bResources = backupDb.prepare('SELECT * FROM resources').all();
        const bBoqs = backupDb.prepare('SELECT * FROM master_boq').all();
        
        // Safely try to extract CRM/Staff (in case it's an older backup format)
        let bCrm = [], bStaff = [];
        try { bCrm = backupDb.prepare('SELECT * FROM crm_contacts').all(); } catch(e){}
        try { bStaff = backupDb.prepare('SELECT * FROM org_staff').all(); } catch(e){}
        
        backupDb.close();

        // 3. Smart Transfer Transaction
        db.transaction(() => {
            if (mode === 'replace') {
                db.prepare('DELETE FROM regions').run();
                db.prepare('DELETE FROM resources').run();
                db.prepare('DELETE FROM master_boq').run();
                db.prepare('DELETE FROM crm_contacts').run();
                db.prepare('DELETE FROM org_staff').run();
            }

            const runTransfer = (table, rows, cols) => {
                if (!rows || rows.length === 0) return;
                const placeholders = cols.map(() => '?').join(', ');
                const colNames = cols.join(', ');
                
                // OR IGNORE prevents duplicates on Append. OR REPLACE updates existing items on Merge/Replace.
                const insertNew = db.prepare(`INSERT OR IGNORE INTO ${table} (${colNames}) VALUES (${placeholders})`);
                const insertReplace = db.prepare(`INSERT OR REPLACE INTO ${table} (${colNames}) VALUES (${placeholders})`);
                
                for (const row of rows) {
                    const vals = cols.map(c => row[c]);
                    if (mode === 'append') insertNew.run(...vals);
                    else insertReplace.run(...vals);
                }
            };

            runTransfer('regions', bRegions, ['id', 'name']);
            runTransfer('resources', bResources, ['id', 'code', 'description', 'unit', 'rates']);
            runTransfer('master_boq', bBoqs, ['id', 'itemCode', 'description', 'unit', 'overhead', 'profit', 'components']);
            runTransfer('crm_contacts', bCrm, ['id', 'name', 'company', 'type', 'status', 'email', 'phone', 'createdAt']);
            runTransfer('org_staff', bStaff, ['id', 'name', 'designation', 'department', 'status', 'email', 'phone', 'createdAt']);
        })();

        return { success: true };
    } catch (error) {
        console.error("Restore Error:", error);
        return { success: false, error: error.message };
    }
});