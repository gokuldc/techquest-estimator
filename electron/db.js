import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import crypto from 'crypto'; // 🔥 ADDED MISSING IMPORT

export function initDatabase() {
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'database');

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'openprix_v2.sqlite');
    const db = new Database(dbPath);
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
            rates TEXT,
            rateHistory TEXT 
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
            createdAt INTEGER,
            raBills TEXT,
            purchaseOrders TEXT,
            materialRequests TEXT,
            grns TEXT
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
            name TEXT, 
            designation TEXT, 
            department TEXT, 
            status TEXT, 
            email TEXT, 
            phone TEXT, 
            createdAt INTEGER,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'Staff',
            accessLevel INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS project_documents (
            id TEXT PRIMARY KEY,
            projectId TEXT,
            name TEXT,
            category TEXT,
            filePath TEXT,
            fileType TEXT,
            addedAt INTEGER,
            FOREIGN KEY(projectId) REFERENCES projects(id)
        );
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `;
    db.exec(initSql);

    // Automated patches
    try { db.exec("ALTER TABLE projects ADD COLUMN createdAt INTEGER;"); } catch (err) { }
    try { db.exec("ALTER TABLE projects ADD COLUMN dailySchedules TEXT;"); } catch (err) { }
    try { db.exec("ALTER TABLE projects ADD COLUMN resourceTrackingMode TEXT DEFAULT 'manual';"); } catch (err) { }
    try { db.exec("ALTER TABLE projects ADD COLUMN raBills TEXT;"); } catch (err) { }
    try { db.exec("ALTER TABLE projects ADD COLUMN purchaseOrders TEXT;"); } catch (err) { }
    try { db.exec("ALTER TABLE projects ADD COLUMN materialRequests TEXT;"); } catch (err) { }
    try { db.exec("ALTER TABLE projects ADD COLUMN grns TEXT;"); } catch (err) { }
    try { db.exec("ALTER TABLE resources ADD COLUMN rateHistory TEXT;"); } catch (e) { }
    try { db.exec("ALTER TABLE org_staff ADD COLUMN accessLevel INTEGER DEFAULT 1;"); } catch (err) { }

    // 🔥 FIXED: Synchronous logic moved safely INSIDE the initDatabase function 🔥
    try {
        const row = db.prepare("SELECT COUNT(*) as count FROM org_staff").get();
        if (row && row.count === 0) {
            db.prepare(`
                INSERT INTO org_staff (id, name, designation, department, status, username, password, role, createdAt, accessLevel)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                crypto.randomUUID(),
                'System Administrator',
                'Chief Technical Officer',
                'Management',
                'Active',
                'admin',         // Default Username
                'admin123',      // Default Password
                'SuperAdmin',    // God-mode Role
                Date.now(),
                5                // 🔥 ADDED: Explicitly grant Level 5 Clearance
            );
            console.log("Default admin account injected into org_staff.");
        }
    } catch (err) {
        console.error("Failed to inject default admin:", err);
    }

    try { db.prepare("UPDATE org_staff SET accessLevel = 5 WHERE role = 'SuperAdmin'").run(); } catch (e) { }

    return db;
}