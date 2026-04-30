import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import os from 'os';

export function initDatabase() {
    // 1. Establish the path to the physical home directory
    // This bypasses the 'snapshot' virtual filesystem used by pkg
    const userHome = os.homedir();
    const dbDir = path.join(userHome, '.openprix', 'database');

    // 2. Ensure the directory exists on the actual hard drive
    if (!fs.existsSync(dbDir)) {
        try {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log(`[SYSTEM] Created persistent data directory at: ${dbDir}`);
        } catch (err) {
            console.error(`[FATAL] Failed to create data directory: ${err.message}`);
            process.exit(1);
        }
    }

    // 3. Define the absolute path to the SQLite file
    const dbPath = path.join(dbDir, 'openprix_v2.sqlite');
    
    // 4. Initialize Database
    // better-sqlite3 will create the file if it doesn't exist at this physical path
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    console.log(`[DATABASE] Core Nexus active at: ${dbPath}`);

    // --- SCHEMA INITIALIZATION ---
    const initSql = `
        CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, code TEXT, clientName TEXT, status TEXT, region TEXT, projectLead TEXT, siteSupervisor TEXT, pmc TEXT, architect TEXT, structuralEngineer TEXT, isPriceLocked INTEGER DEFAULT 0, dailyLogs TEXT, actualResources TEXT, ganttTasks TEXT, subcontractors TEXT, phaseAssignments TEXT, createdAt INTEGER, raBills TEXT, purchaseOrders TEXT, materialRequests TEXT, grns TEXT);
        CREATE TABLE IF NOT EXISTS regions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, code TEXT UNIQUE, description TEXT, unit TEXT, rates TEXT, rateHistory TEXT);
        CREATE TABLE IF NOT EXISTS master_boq (id TEXT PRIMARY KEY, itemCode TEXT UNIQUE, description TEXT, unit TEXT, overhead REAL, profit REAL, components TEXT);
        CREATE TABLE IF NOT EXISTS crm_contacts (id TEXT PRIMARY KEY, name TEXT, company TEXT, type TEXT, status TEXT, email TEXT, phone TEXT, createdAt INTEGER);
        CREATE TABLE IF NOT EXISTS org_staff (id TEXT PRIMARY KEY, name TEXT, designation TEXT, department TEXT, status TEXT, email TEXT, phone TEXT, createdAt INTEGER, username TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'Staff', accessLevel INTEGER DEFAULT 1);
        CREATE TABLE IF NOT EXISTS project_documents (id TEXT PRIMARY KEY, projectId TEXT, name TEXT, category TEXT, filePath TEXT, fileType TEXT, addedAt INTEGER, FOREIGN KEY(projectId) REFERENCES projects(id));
        CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, projectId TEXT, senderId TEXT, content TEXT, createdAt INTEGER, replyToId TEXT);
        CREATE TABLE IF NOT EXISTS private_messages (id TEXT PRIMARY KEY, senderId TEXT, receiverId TEXT, content TEXT, createdAt INTEGER, replyToId TEXT);
        CREATE TABLE IF NOT EXISTS staff_work_logs (id TEXT PRIMARY KEY, date TEXT, staffId TEXT, slNo INTEGER, projectId TEXT, details TEXT, remarks TEXT, status TEXT, createdAt INTEGER);
    `;
    
    try {
        db.exec(initSql);
    } catch (err) {
        console.error(`[DATABASE] Schema init error: ${err.message}`);
    }

    // --- PATCHES / MIGRATIONS ---
    // Wrapped in try/catch to ignore "duplicate column" errors on subsequent runs
    const runPatch = (sql) => { try { db.exec(sql); } catch (e) { } };

    runPatch("ALTER TABLE projects ADD COLUMN createdAt INTEGER;");
    runPatch("ALTER TABLE projects ADD COLUMN dailySchedules TEXT;");
    runPatch("ALTER TABLE projects ADD COLUMN resourceTrackingMode TEXT DEFAULT 'manual';");
    runPatch("ALTER TABLE projects ADD COLUMN raBills TEXT;");
    runPatch("ALTER TABLE projects ADD COLUMN purchaseOrders TEXT;");
    runPatch("ALTER TABLE projects ADD COLUMN materialRequests TEXT;");
    runPatch("ALTER TABLE projects ADD COLUMN grns TEXT;");
    runPatch("ALTER TABLE resources ADD COLUMN rateHistory TEXT;");
    runPatch("ALTER TABLE projects ADD COLUMN assignedStaff TEXT DEFAULT '[]';");
    runPatch("CREATE INDEX IF NOT EXISTS idx_docs_project ON project_documents(projectId);");
    runPatch("CREATE INDEX IF NOT EXISTS idx_docs_category ON project_documents(category);");
    runPatch("ALTER TABLE org_staff ADD COLUMN username TEXT;");
    runPatch("ALTER TABLE org_staff ADD COLUMN password TEXT;");
    runPatch("ALTER TABLE org_staff ADD COLUMN role TEXT DEFAULT 'Staff';");
    runPatch("ALTER TABLE org_staff ADD COLUMN accessLevel INTEGER DEFAULT 1;");
    runPatch("ALTER TABLE projects ADD COLUMN type TEXT;");
    runPatch("ALTER TABLE projects ADD COLUMN location TEXT;");
    runPatch("ALTER TABLE projects ADD COLUMN isScaffolded INTEGER DEFAULT 0;");
    runPatch("ALTER TABLE projects ADD COLUMN scaffoldPath TEXT;");
    runPatch("ALTER TABLE projects ADD COLUMN isManuallyLinked INTEGER DEFAULT 0;");

    // --- SEED DEFAULT ADMIN ---
    try {
        const row = db.prepare("SELECT COUNT(*) as count FROM org_staff WHERE username = 'admin'").get();
        if (row && row.count === 0) {
            db.prepare(`
                INSERT INTO org_staff (id, name, designation, department, status, username, password, role, createdAt, accessLevel) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                crypto.randomUUID(), 'System Administrator', 'CTO', 'Management', 'Active', 'admin', 'admin123', 'SuperAdmin', Date.now(), 5
            );
            console.log("[DATABASE] Default admin account created (admin/admin123)");
        }
    } catch (err) {
        console.error(`[DATABASE] Admin seeding failed: ${err.message}`);
    }

    return db;
}