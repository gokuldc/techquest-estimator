import { ipcMain, dialog } from 'electron';
import Database from 'better-sqlite3';
import crypto from 'crypto';

export function registerSyncAndBackupIpc(db, mainWindow) {
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

            const pData = { ...currentProject };
            if (!options.dailyLogs) { pData.dailyLogs = "[]"; pData.actualResources = "{}"; pData.dailySchedules = "[]"; }
            if (!options.gantt) { pData.ganttTasks = "[]"; }
            if (!options.subcontractors) { pData.subcontractors = "[]"; }
            if (!options.details) {
                const minimal = { id: pData.id, name: pData.name, code: pData.code };
                Object.keys(pData).forEach(key => { if (!minimal[key]) pData[key] = null; });
            }

            const pCols = Object.keys(pData);
            syncDb.prepare(`INSERT INTO projects (${pCols.join(',')}) VALUES (${pCols.map(() => '?').join(',')})`).run(...Object.values(pData));

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
        } catch (error) { return { success: false, error: error.message }; }
    });

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

            for (const p of projects) {
                const cols = Object.keys(p).join(', ');
                const placeholders = Object.keys(p).map(() => '?').join(', ');
                syncDb.prepare(`INSERT OR REPLACE INTO projects (${cols}) VALUES (${placeholders})`).run(...Object.values(p));

                const boqs = db.prepare('SELECT * FROM project_boq WHERE projectId = ?').all(p.id);
                for (const b of boqs) {
                    const bCols = Object.keys(b).join(', ');
                    const bPlaceholders = Object.keys(b).map(() => '?').join(', ');
                    syncDb.prepare(`INSERT OR REPLACE INTO project_boq (${bCols}) VALUES (${bPlaceholders})`).run(...Object.values(b));
                }
            }

            syncDb.close();
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('db:import-projects-sqlite', async (e, filePath, mode) => {
        try {
            const importDb = new Database(filePath);
            const tables = importDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            if (!tables.map(t => t.name).includes('projects')) { importDb.close(); return { success: false, error: 'Invalid archive: no projects table found' }; }

            const importedProjects = importDb.prepare('SELECT * FROM projects').all();
            if (importedProjects.length === 0) { importDb.close(); return { success: false, error: 'No projects found' }; }

            db.transaction(() => {
                if (mode === 'replace') { db.prepare('DELETE FROM project_boq').run(); db.prepare('DELETE FROM projects').run(); }

                for (const p of importedProjects) {
                    const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(p.id);

                    if (mode === 'merge' && existing) {
                        const cols = Object.keys(p).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
                        const values = Object.values(p).filter((_, i) => Object.keys(p)[i] !== 'id');
                        db.prepare(`UPDATE projects SET ${cols} WHERE id = ?`).run(...values, p.id);
                    } else if (mode === 'append' || (mode === 'merge' && !existing)) {
                        const newId = mode === 'append' ? crypto.randomUUID() : p.id;
                        const cols = Object.keys(p).join(', ');
                        const placeholders = Object.keys(p).map(() => '?').join(', ');
                        const values = Object.values(p).map((v, i) => Object.keys(p)[i] === 'id' ? newId : v);
                        db.prepare(`INSERT OR REPLACE INTO projects (${cols}) VALUES (${placeholders})`).run(...values);

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

                if (mode === 'merge') {
                    const importedBoqs = importDb.prepare(`SELECT b.* FROM project_boq b LEFT JOIN projects p ON b.projectId = p.id WHERE p.id IS NULL`).all();
                    for (const b of importedBoqs) {
                        const targetProject = importedProjects.find(p => p.id === b.projectId);
                        if (targetProject && db.prepare('SELECT id FROM projects WHERE id = ?').get(targetProject.id)) {
                            db.prepare(`INSERT INTO project_boq (id, projectId, masterBoqId, slNo, isCustom, itemCode, description, unit, rate, formulaStr, qty, measurements, phase, lockedRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                                crypto.randomUUID(), targetProject.id, b.masterBoqId, b.slNo, b.isCustom, b.itemCode, b.description, b.unit, b.rate, b.formulaStr, b.qty, b.measurements, b.phase, b.lockedRate
                            );
                        }
                    }
                }
            })();

            importDb.close();
            return { success: true, count: importedProjects.length };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('db:select-sync-file', async () => {
        const src = await dialog.showOpenDialog(mainWindow, { title: 'Select Project Sync File', filters: [{ name: 'SQLite Sync File', extensions: ['sqlite', 'db'] }], properties: ['openFile'] });
        if (src.canceled || src.filePaths.length === 0) return { success: false, canceled: true };
        try {
            const syncDb = new Database(src.filePaths[0], { readonly: true });
            const project = syncDb.prepare('SELECT id, name, code FROM projects LIMIT 1').get();
            syncDb.close();
            return { success: true, filePath: src.filePaths[0], projectName: project?.name, projectCode: project?.code };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('db:select-archive-file', async () => {
        const src = await dialog.showOpenDialog(mainWindow, { title: 'Select Project Archive File', filters: [{ name: 'SQLite Archive', extensions: ['sqlite', 'db'] }], properties: ['openFile'] });
        if (src.canceled || src.filePaths.length === 0) return { success: false, canceled: true };
        try {
            const importDb = new Database(src.filePaths[0], { readonly: true });
            const projects = importDb.prepare('SELECT id, name, code FROM projects').all();
            importDb.close();
            return { success: true, filePath: src.filePaths[0], projects };
        } catch (error) { return { success: false, error: error.message }; }
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
                projectBoq: incomingBoqs.map(b => ({ ...b, isCustom: b.isCustom === 1, measurements: parseSafe(b.measurements) }))
            };

            db.transaction(() => {
                const currentProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(targetProjectId);
                if (!currentProject) throw new Error("Target Project not found");

                const mergeArrays = (currentArr, incomingArr) => {
                    const map = new Map();
                    currentArr.forEach(item => { if (item && item.id) map.set(item.id, item); });
                    incomingArr.forEach(item => { if (item && item.id) map.set(item.id, item); });
                    return Array.from(map.values());
                };

                const appendArrays = (currentArr, incomingArr) => {
                    const existingIds = new Set(currentArr.filter(i => i && i.id).map(i => i.id));
                    const purelyNewItems = incomingArr.filter(i => i && i.id && !existingIds.has(i.id));
                    return [...currentArr, ...purelyNewItems];
                };

                const pd = syncData.projectDetails;
                const detailsToUpdate = {
                    name: pd.name || currentProject.name, code: pd.code || currentProject.code, clientName: pd.clientName || currentProject.clientName,
                    status: pd.status || currentProject.status, region: pd.region || currentProject.region, projectLead: pd.projectLead || currentProject.projectLead,
                    siteSupervisor: pd.siteSupervisor || currentProject.siteSupervisor, isPriceLocked: pd.isPriceLocked !== undefined ? pd.isPriceLocked : currentProject.isPriceLocked,
                    pmc: pd.pmc || currentProject.pmc, architect: pd.architect || currentProject.architect, structuralEngineer: pd.structuralEngineer || currentProject.structuralEngineer,
                };

                let finalLogs = parseSafe(currentProject.dailyLogs); let finalSchedules = parseSafe(currentProject.dailySchedules); let finalTasks = parseSafe(currentProject.ganttTasks);
                let finalSubs = parseSafe(currentProject.subcontractors); let finalActuals = parseSafeObj(currentProject.actualResources);

                if (mode === 'replace') {
                    finalLogs = pd.dailyLogs; finalSchedules = pd.dailySchedules; finalTasks = pd.ganttTasks; finalSubs = pd.subcontractors; finalActuals = pd.actualResources;
                } else if (mode === 'merge') {
                    finalLogs = mergeArrays(finalLogs, pd.dailyLogs); finalSchedules = mergeArrays(finalSchedules, pd.dailySchedules); finalTasks = mergeArrays(finalTasks, pd.ganttTasks); finalSubs = mergeArrays(finalSubs, pd.subcontractors); finalActuals = { ...finalActuals, ...pd.actualResources };
                } else if (mode === 'append') {
                    finalLogs = appendArrays(finalLogs, pd.dailyLogs); finalSchedules = appendArrays(finalSchedules, pd.dailySchedules); finalTasks = appendArrays(finalTasks, pd.ganttTasks); finalSubs = appendArrays(finalSubs, pd.subcontractors);
                    for (const [key, qty] of Object.entries(pd.actualResources)) { finalActuals[key] = (finalActuals[key] || 0) + Number(qty); }
                }

                detailsToUpdate.dailyLogs = JSON.stringify(finalLogs); detailsToUpdate.dailySchedules = JSON.stringify(finalSchedules); detailsToUpdate.ganttTasks = JSON.stringify(finalTasks);
                detailsToUpdate.subcontractors = JSON.stringify(finalSubs); detailsToUpdate.actualResources = JSON.stringify(finalActuals); detailsToUpdate.phaseAssignments = JSON.stringify(pd.phaseAssignments || parseSafeObj(currentProject.phaseAssignments));

                const fields = Object.keys(detailsToUpdate).map(k => `${k} = ?`).join(', ');
                db.prepare(`UPDATE projects SET ${fields} WHERE id = ?`).run(...Object.values(detailsToUpdate), targetProjectId);

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
                        insertOrReplaceStmt.run(boq.id, targetProjectId, boq.masterBoqId || null, currentMaxSlNo, boq.isCustom ? 1 : 0, boq.itemCode || null, boq.description || null, boq.unit || null, boq.rate || 0, boq.formulaStr || String(boq.qty), boq.qty || 0, measurementsStr, boq.phase || "General", boq.lockedRate || null);
                    } else {
                        insertOrReplaceStmt.run(boq.id || crypto.randomUUID(), targetProjectId, boq.masterBoqId || null, boq.slNo, boq.isCustom ? 1 : 0, boq.itemCode || null, boq.description || null, boq.unit || null, boq.rate || 0, boq.formulaStr || String(boq.qty), boq.qty || 0, measurementsStr, boq.phase || "General", boq.lockedRate || null);
                    }
                }
            })();
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('db:backup-database', async () => {
        try {
            const dest = await dialog.showSaveDialog(mainWindow, { title: 'Save Database Backup', defaultPath: `OpenPrix_Backup_${new Date().toISOString().split('T')[0]}.sqlite`, filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }] });
            if (dest.canceled) return { success: false, canceled: true };
            await db.backup(dest.filePath);
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('db:restore-database', async (e, mode) => {
        try {
            const src = await dialog.showOpenDialog(mainWindow, { title: 'Select Master Database Backup', filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }], properties: ['openFile'] });
            if (src.canceled || src.filePaths.length === 0) return { success: false, canceled: true };

            const backupDb = new Database(src.filePaths[0], { readonly: true });
            const bRegions = backupDb.prepare('SELECT * FROM regions').all();
            const bResources = backupDb.prepare('SELECT * FROM resources').all();
            const bBoqs = backupDb.prepare('SELECT * FROM master_boq').all();

            let bCrm = [], bStaff = [];
            try { bCrm = backupDb.prepare('SELECT * FROM crm_contacts').all(); } catch (e) { }
            try { bStaff = backupDb.prepare('SELECT * FROM org_staff').all(); } catch (e) { }
            backupDb.close();

            db.transaction(() => {
                if (mode === 'replace') {
                    db.prepare('DELETE FROM regions').run(); db.prepare('DELETE FROM resources').run(); db.prepare('DELETE FROM master_boq').run();
                    db.prepare('DELETE FROM crm_contacts').run(); db.prepare('DELETE FROM org_staff').run();
                }

                const runTransfer = (table, rows, cols) => {
                    if (!rows || rows.length === 0) return;
                    const placeholders = cols.map(() => '?').join(', ');
                    const colNames = cols.join(', ');
                    const insertNew = db.prepare(`INSERT OR IGNORE INTO ${table} (${colNames}) VALUES (${placeholders})`);
                    const insertReplace = db.prepare(`INSERT OR REPLACE INTO ${table} (${colNames}) VALUES (${placeholders})`);

                    for (const row of rows) {
                        const vals = cols.map(c => row[c]);
                        if (mode === 'append') insertNew.run(...vals); else insertReplace.run(...vals);
                    }
                };

                runTransfer('regions', bRegions, ['id', 'name']); runTransfer('resources', bResources, ['id', 'code', 'description', 'unit', 'rates']); runTransfer('master_boq', bBoqs, ['id', 'itemCode', 'description', 'unit', 'overhead', 'profit', 'components']);
                runTransfer('crm_contacts', bCrm, ['id', 'name', 'company', 'type', 'status', 'email', 'phone', 'createdAt']); runTransfer('org_staff', bStaff, ['id', 'name', 'designation', 'department', 'status', 'email', 'phone', 'createdAt']);
            })();
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    });
}