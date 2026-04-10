import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import * as xlsx from 'xlsx';

// ✅ HARD GPU FIX (must be BEFORE app ready)
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('use-gl', 'swiftshader');
// 🔥 KEY FIX

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let db; // Global SQLite database instance

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
    `;
    db.exec(initSql);

    // 🔥 THE AUTOMATED FIX 🔥
    // This forces SQLite to add the missing column to your existing file
    try {
        db.exec("ALTER TABLE projects ADD COLUMN createdAt INTEGER;");
        console.log("✅ Successfully patched existing database: Added 'createdAt' column.");
    } catch (err) {
        // It's perfectly safe to ignore this error. 
        // It just means the column was already successfully added!
    }
}

// ==========================================
// WINDOW CREATION
// ==========================================
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "//OPENPRIX",
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            // 🔥 REQUIRED: The bridge between React and SQLite
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://127.0.0.1:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    initDatabase();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// ==========================================
// IPC HANDLERS (The Bridge to React)
// ==========================================

// Fetch existing regions
ipcMain.handle('db:get-regions', () => {
    try {
        return db.prepare('SELECT * FROM regions ORDER BY name ASC').all();
    } catch (err) {
        console.error('Database Error:', err);
        throw err;
    }
});

// Create a new region natively
ipcMain.handle('db:create-region', (event, regionName) => {
    try {
        const id = crypto.randomUUID();
        const stmt = db.prepare('INSERT INTO regions (id, name) VALUES (?, ?)');
        stmt.run(id, regionName);
        return { success: true, id };
    } catch (error) {
        // Handle UNIQUE constraint failure gracefully
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return { success: false, error: 'Region already exists.' };
        }
        return { success: false, error: error.message };
    }
});

// Excel Importer Engine
ipcMain.handle('db:import-excel', async (event, regionName) => {
    if (!regionName) return { success: false, message: 'No region selected.' };

    const result = await dialog.showOpenDialog(mainWindow, {
        title: `Select Rate Sheet for ${regionName}`,
        filters: [{ name: 'Excel/CSV Files', extensions: ['xlsx', 'xls', 'csv'] }],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: 'User cancelled' };
    }

    try {
        // 🔥 THE FIX: Use Node's native 'fs' to read the file safely into a buffer
        const fileBuffer = fs.readFileSync(result.filePaths[0]);

        // Then use xlsx.read() instead of xlsx.readFile()
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert Excel to JSON array, skipping the first row if it's a title block
        const rawData = xlsx.utils.sheet_to_json(worksheet, { range: 1, defval: "" });

        const runImport = db.transaction(() => {
            const getResourceStmt = db.prepare('SELECT id, rates FROM resources WHERE code = ?');
            const updateResourceStmt = db.prepare('UPDATE resources SET description = ?, unit = ?, rates = ? WHERE id = ?');
            const insertResourceStmt = db.prepare('INSERT INTO resources (id, code, description, unit, rates) VALUES (?, ?, ?, ?, ?)');

            let count = 0;

            for (const row of rawData) {
                if (!row['Code']) continue; // Skip empty rows

                const code = String(row['Code']).trim();
                const desc = row['Description'] || '';
                const unit = row['Unit'] || '';
                const newRate = parseFloat(row['Lmr Rate (₹)']) || 0;

                const existingResource = getResourceStmt.get(code);

                if (existingResource) {
                    // Resource exists -> Update JSON rates
                    const rates = JSON.parse(existingResource.rates || '{}');
                    rates[regionName] = newRate;

                    updateResourceStmt.run(desc, unit, JSON.stringify(rates), existingResource.id);
                } else {
                    // Resource doesn't exist -> Insert new
                    const newId = crypto.randomUUID();
                    const initialRates = { [regionName]: newRate };

                    insertResourceStmt.run(newId, code, desc, unit, JSON.stringify(initialRates));
                }
                count++;
            }
            return count;
        });

        const totalImported = runImport();
        return { success: true, message: `Successfully updated ${totalImported} rates for ${regionName}.` };

    } catch (error) {
        console.error('Excel Import failed:', error);
        return { success: false, error: error.message };
    }
});
// Fetch all resources and parse the nested rates JSON
ipcMain.handle('db:get-resources', () => {
    try {
        const records = db.prepare('SELECT * FROM resources ORDER BY code ASC').all();

        // Convert the stringified JSON back into a usable object for React
        return records.map(record => ({
            ...record,
            rates: record.rates ? JSON.parse(record.rates) : {}
        }));
    } catch (err) {
        console.error('Database Error (Resources):', err);
        throw err;
    }
});
ipcMain.handle('db:get-master-boqs', () => {
    return db.prepare('SELECT * FROM master_boq').all().map(b => ({
        ...b, components: JSON.parse(b.components || '[]')
    }));
});

ipcMain.handle('db:delete-region', (event, id, name) => {
    const runDelete = db.transaction(() => {
        db.prepare('DELETE FROM regions WHERE id = ?').run(id);

        // Cascade delete rates from resources
        const resources = db.prepare('SELECT id, rates FROM resources').all();
        const updateStmt = db.prepare('UPDATE resources SET rates = ? WHERE id = ?');

        for (const res of resources) {
            const rates = JSON.parse(res.rates || '{}');
            if (rates[name] !== undefined) {
                delete rates[name];
                updateStmt.run(JSON.stringify(rates), res.id);
            }
        }
    });
    runDelete();
});

ipcMain.handle('db:create-resource', (event, data) => {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO resources (id, code, description, unit, rates) VALUES (?, ?, ?, ?, ?)').run(
        id, data.code, data.description, data.unit, '{}'
    );
});

ipcMain.handle('db:update-resource', (event, id, field, value) => {
    // If updating rates (which is an object), stringify it
    const val = typeof value === 'object' ? JSON.stringify(value) : value;
    db.prepare(`UPDATE resources SET ${field} = ? WHERE id = ?`).run(val, id);
});

ipcMain.handle('db:delete-resource', (event, id) => {
    db.prepare('DELETE FROM resources WHERE id = ?').run(id);
});

ipcMain.handle('db:save-master-boq', (event, payload, id, isNew) => {
    const compStr = JSON.stringify(payload.components);
    if (id && !isNew) {
        db.prepare('UPDATE master_boq SET itemCode=?, description=?, unit=?, overhead=?, profit=?, components=? WHERE id=?').run(
            payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr, id
        );
    } else {
        db.prepare('INSERT INTO master_boq (id, itemCode, description, unit, overhead, profit, components) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            crypto.randomUUID(), payload.itemCode, payload.description, payload.unit, payload.overhead, payload.profit, compStr
        );
    }
});

ipcMain.handle('db:delete-master-boq', (event, id) => {
    db.prepare('DELETE FROM master_boq WHERE id = ?').run(id);
});

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

ipcMain.handle('db:get-project', (e, id) => {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
});

ipcMain.handle('db:update-project', (e, id, data) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
    db.prepare(`UPDATE projects SET ${fields} WHERE id = ?`).run(...values, id);
});

ipcMain.handle('db:get-project-boqs', (e, projectId) => {
    return db.prepare('SELECT * FROM project_boq WHERE projectId = ?').all(projectId);
});

ipcMain.handle('db:add-project-boq', (e, data) => {
    const id = crypto.randomUUID();
    const cols = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
    db.prepare(`INSERT INTO project_boq (id, ${cols}) VALUES (?, ${placeholders})`).run(id, ...values);
});

ipcMain.handle('db:update-project-boq', (e, id, data) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
    db.prepare(`UPDATE project_boq SET ${fields} WHERE id = ?`).run(...values, id);
});

ipcMain.handle('db:delete-project-boq', (e, id) => {
    db.prepare('DELETE FROM project_boq WHERE id = ?').run(id);
});

ipcMain.handle('db:bulk-put-project-boqs', (e, dataArray) => {
    db.transaction(() => {
        const stmt = db.prepare(`UPDATE project_boq SET lockedRate = ? WHERE id = ?`);
        for (const item of dataArray) { stmt.run(item.lockedRate, item.id); }
    })();
});

// Stubs for currently unused but required tables
ipcMain.handle('db:get-kanban-tasks', () => []);
ipcMain.handle('db:get-crm-contacts', () => []);
ipcMain.handle('db:get-org-staff', () => []);
ipcMain.handle('db:sync-project-data', () => { /* Add your JSON sync logic here later */ });
ipcMain.handle('db:get-projects', () => {
    return db.prepare('SELECT * FROM projects').all();
});

ipcMain.handle('db:add-project', (e, data) => {
    const cols = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
    db.prepare(`INSERT INTO projects (${cols}) VALUES (${placeholders})`).run(...values);
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
        if (mode === 'replace') {
            db.prepare('DELETE FROM projects').run();
            // Optional: You might want to delete ALL project_boqs here too if replacing completely
            // db.prepare('DELETE FROM project_boq').run(); 
        }

        for (const p of projectsArray) {
            const idToUse = mode === 'append' ? crypto.randomUUID() : p.id;
            const data = { ...p, id: idToUse };
            const cols = Object.keys(data).join(', ');
            const placeholders = Object.keys(data).map(() => '?').join(', ');
            const values = Object.values(data).map(v => typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'boolean' ? (v ? 1 : 0) : v));

            db.prepare(`INSERT OR REPLACE INTO projects (${cols}) VALUES (${placeholders})`).run(...values);
        }
    })();
});