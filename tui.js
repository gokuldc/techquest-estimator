import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './electron/db.js';

const __filename = fileURLToPath(import.meta.url);
const baseDir = path.dirname(__filename);
const statusFile = path.join(baseDir, '.daemon_status.json');

// Get the correct Node executable for portability
const isWin = process.platform === 'win32';
const nodeBin = fs.existsSync(path.join(baseDir, isWin ? 'node.exe' : 'node')) 
    ? path.join(baseDir, isWin ? 'node.exe' : 'node') 
    : 'node';

let currentPort = 3000;
let refreshInterval;
let db = null;
let currentPage = null;

// --- 1. SCREEN SETUP ---
const screen = blessed.screen({
    smartCSR: true,
    title: '// OPENPRIX COMMAND CENTER',
    fullUnicode: true,
    cursor: { artificial: true, shape: 'block', blink: true }
});

// --- 2. NAVIGATION BAR ---
const menuBar = blessed.listbar({
   parent: screen,
    top: 0, left: 0, right: 0, height: 3,
    mouse: true, 
    keys: true, 
    autoCommandKeys: true, // 🔥 Let the library do the work!
    border: 'line', 
    vi: true,
    style: {
        item: { fg: 'white', hover: { bg: 'blue' } },
        selected: { fg: 'black', bg: 'cyan', bold: true }
    },
    commands: {
        // We just write the name. Blessed will automatically turn this into "1: DASHBOARD"
        'DASHBOARD': { keys: ['1'], callback: () => switchPage('dashboard') },
        'DATABASE': { keys: ['2'], callback: () => switchPage('database') },
        'LOGS': { keys: ['3'], callback: () => switchPage('logs') },
        'QUIT': { keys: ['q'], callback: () => shutdownConsole() }
    }
});

// --- 3. PAGE CONTAINERS ---
// We create boxes to act as pages. They take up the screen below the menu bar.
const pages = {
    dashboard: blessed.box({ parent: screen, top: 3, bottom: 0, width: '100%', hidden: false }),
    database: blessed.box({ parent: screen, top: 3, bottom: 0, width: '100%', hidden: true }),
    logs: blessed.box({ parent: screen, top: 3, bottom: 0, width: '100%', hidden: true })
};

// --- PAGE 1: DASHBOARD WIDGETS ---
const dashGrid = new contrib.grid({ rows: 12, cols: 12, screen: pages.dashboard });

const serverStats = dashGrid.set(0, 0, 8, 8, contrib.markdown, {
    label: ' DAEMON_STATUS ', border: { type: 'line', fg: 'magenta' }, tags: true,
});

const controlPanel = dashGrid.set(0, 8, 8, 4, contrib.markdown, {
    label: ' CONSOLE_COMMANDS ', border: { type: 'line', fg: 'yellow' }
});

const quickLog = dashGrid.set(8, 0, 4, 12, contrib.log, {
    fg: 'green', label: ' RECENT_ACTIVITY ', border: { type: 'line', fg: 'cyan' }, tags: true
});

// --- PAGE 2: DATABASE WIDGETS ---
const dbGrid = new contrib.grid({ rows: 12, cols: 12, screen: pages.database });

const projectTable = dbGrid.set(0, 0, 12, 9, contrib.table, {
    keys: true, fg: 'white', selectedFg: 'white', selectedBg: 'blue', interactive: true,
    label: ' ACTIVE_PROJECT_MATRIX ', width: '100%', height: '100%',
    border: { type: 'line', fg: 'cyan' }, tags: true, columnSpacing: 2, columnWidth: [14, 25, 12, 18]
});

const entityMetrics = dbGrid.set(0, 9, 7, 3, contrib.markdown, {
    label: ' DATABASE_RECORDS ', border: { type: 'line', fg: 'magenta' }, tags: true,
});

const storageHealth = dbGrid.set(7, 9, 5, 3, contrib.markdown, {
    label: ' ENGINE_HEALTH ', border: { type: 'line', fg: 'yellow' }, tags: true,
});

// --- PAGE 3: LOGS WIDGETS ---
const logsGrid = new contrib.grid({ rows: 12, cols: 12, screen: pages.logs });

const fullLog = logsGrid.set(0, 0, 12, 12, contrib.log, {
    fg: 'green', label: ' FULL_SYSTEM_LOGS ', border: { type: 'line', fg: 'cyan' }, tags: true,
    scrollable: true, keys: true, vi: true
});

// --- HELPER FUNCTIONS ---
function switchPage(pageName) {
    if (currentPage === pageName) return; 
    currentPage = pageName;

    Object.values(pages).forEach(p => p.hide());
    pages[pageName].show();
    
    menuBar.selectTab(Object.keys(pages).indexOf(pageName));
    screen.render();
}

function log(msg, color = 'cyan') {
    const time = new Date().toLocaleTimeString();
    const formatted = `{${color}-fg}[${time}] ${msg}{/${color}-fg}`;
    quickLog.log(formatted);
    fullLog.log(formatted);
    screen.render();
}

// --- DAEMON MANAGEMENT ---
function getDaemonStatus() {
    if (fs.existsSync(statusFile)) {
        try { return JSON.parse(fs.readFileSync(statusFile, 'utf8')); } 
        catch (e) { return null; }
    }
    return null;
}

function startDaemon() {
    const status = getDaemonStatus();
    if (status && status.status === 'online') return log("Daemon is already running.", "yellow");

    log(`Spawning invisible Daemon on port ${currentPort}...`, "cyan");
    const daemon = spawn(nodeBin, ['daemon.js', currentPort.toString()], {
        detached: true, stdio: 'ignore' 
    });
    daemon.unref(); 
    log("Daemon successfully detached to background.", "green");
}

function stopDaemon() {
    const status = getDaemonStatus();
    if (!status || !status.pid) return log("No running daemon found.", "yellow");

    log(`Sending termination signal to Daemon (PID: ${status.pid})...`, "yellow");
    try {
        process.kill(status.pid, 'SIGINT'); 
        log("Daemon terminated.", "red");
        if (fs.existsSync(statusFile)) fs.unlinkSync(statusFile);
    } catch (e) {
        log(`Failed to kill process: ${e.message}`, "red");
        if (fs.existsSync(statusFile)) fs.unlinkSync(statusFile);
    }
}

// --- UI UPDATERS ---
function updateDashboards() {
    const status = getDaemonStatus();

    // 1. Update Dashboard
    if (status) {
        serverStats.setMarkdown(`
# 🌐 SYSTEM ONLINE
**Status:** {green-fg}${status.status.toUpperCase()}{/green-fg},
**Port:** ${status.port}
**URL:** ${status.url || 'Booting...'}
**Process ID:** ${status.pid}

*You can safely close this console window. The server will keep running.*
        `);
    } else {
        serverStats.setMarkdown(`
# 🛑 SYSTEM OFFLINE
**Target Port:** ${currentPort}

*No background process detected. Press 'S' to ignite Daemon.*
        `);
    }

    controlPanel.setMarkdown(`
### Global Shortcuts
**[ S ]** - Start Background Daemon
**[ X ]** - Kill Background Daemon
**[ P ]** - Change Target Port
**[ 1-3 ]** - Switch Pages
    `);

    // 2. Update Database Page (Only if DB is accessible)
    try {
       if (!db) db = initDatabase();
        
        // Fetch Projects
        const projects = db.prepare('SELECT code, name, status, clientName FROM projects').all();
        const tableData = projects.map(p => [
            (p.code || 'NO-CODE').substring(0, 14), 
            (p.name || 'Untitled').substring(0, 25), 
            (p.status || 'Draft').substring(0, 12), 
            (p.clientName || 'N/A').substring(0, 18)
        ]);
        projectTable.setData({ headers: ['CODE', 'PROJECT NAME', 'STATUS', 'CLIENT'], data: tableData });

        // 🔥 CALCULATE EXACT METRICS
        const activeProjects = projects.filter(p => p.status && p.status.toLowerCase() === 'active').length;
        
        // Fetch Staff Stats
        const staffCount = db.prepare('SELECT COUNT(*) as c FROM org_staff').get().c || 0;
        const crmCount = db.prepare('SELECT COUNT(*) as c FROM crm_contacts').get().c || 0;
        
        // Update the Records Panel
        entityMetrics.setMarkdown(`
**Global Projects:** ${projects.length}
 ├ Active: {green-fg}${activeProjects}{/green-fg}
 └ Other: ${projects.length - activeProjects}

**Identities:** ${staffCount + crmCount}
 ├ Internal Staff: {cyan-fg}${staffCount}{/cyan-fg}
 └ CRM Contacts: {magenta-fg}${crmCount}{/magenta-fg}
        `);

        // Fetch System Memory & Health
        const mem = process.memoryUsage();
        const memMb = Math.round(mem.rss / 1024 / 1024);
        
        // Update the Health Panel
        storageHealth.setMarkdown(`
**Memory:** ${memMb} MB
**Daemon:** ${status ? '{green-fg}LINKED{/green-fg}' : '{red-fg}OFFLINE{/red-fg}'}
**TUI Mode:** Read-Only
        `);

    } catch (err) {
        // Suppress DB read errors if the DB file is temporarily locked by the Daemon
    }

    screen.render();
}

// --- GLOBAL KEYBINDINGS ---
screen.key(['s', 'S'], () => startDaemon());
screen.key(['x', 'X'], () => stopDaemon());

screen.key(['p', 'P'], () => {
    const status = getDaemonStatus();
    if (status && status.status === 'online') {
        return log("Must kill daemon before changing ports.", "yellow");
    }

    const prompt = blessed.prompt({
        parent: screen, border: 'line', height: 'shrink', width: 'half', top: 'center', left: 'center', label: ' {blue-fg}Change Port{/blue-fg} ', tags: true
    });
    prompt.input('Enter new port (1024-65535):', currentPort.toString(), (err, value) => {
        if (value) {
            const p = parseInt(value, 10);
            if (p >= 1024 && p <= 65535) { 
                currentPort = p; 
                log(`Target port changed to ${currentPort}`, "green"); 
                updateDashboards(); 
            } else { 
                log("Invalid port number.", "red"); 
            }
        }
    });
});

function shutdownConsole() {
    clearInterval(refreshInterval);
    process.exit(0);
}

// --- BOOT SEQUENCE ---
log("Booting OpenPrix Control Console...");
switchPage('dashboard'); // Init UI on Page 1
updateDashboards();

// Heartbeat
refreshInterval = setInterval(updateDashboards, 1500);