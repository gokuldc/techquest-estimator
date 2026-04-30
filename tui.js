import blessed from 'blessed';
import contrib from 'blessed-contrib';
import SysTrayModule from 'systray2';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './electron/db.js';
import { startWebServer, stopWebServer, getLocalIp } from './electron/webServer.js';


const isPackaged = typeof process.pkg !== 'undefined';

// process.cwd() works perfectly for local dev, and process.execPath handles the compiled .exe
const baseDir = isPackaged 
    ? path.dirname(process.execPath) 
    : process.cwd();

// --- GLOBAL STATE ---
let db = null;
let currentPort = 3000;
let isServerRunning = false;
let tray = null;
let globalProjects = [];

// --- TUI SCREEN SETUP ---
const screen = blessed.screen({
    smartCSR: true,
    title: '// OPENPRIX SERVER NEXUS',
    fullUnicode: true,
    cursor: { artificial: true, shape: 'block', blink: true }
});

const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

// --- WIDGETS ---
const projectTable = grid.set(0, 0, 7, 8, contrib.table, {
    keys: true, fg: 'white', selectedFg: 'white', selectedBg: 'blue', interactive: true,
    label: ' ACTIVE_PROJECT_MATRIX ', width: '100%', height: '100%',
    border: { type: 'line', fg: 'cyan' }, columnSpacing: 2, columnWidth: [14, 25, 12, 18]
});

const serverStats = grid.set(0, 8, 4, 4, contrib.markdown, {
    label: ' NETWORK_STATUS ', border: { type: 'line', fg: 'magenta' }, style: { fg: 'green' }
});

const controlPanel = grid.set(4, 8, 3, 4, contrib.markdown, {
    label: ' SERVER_CONTROLS ', border: { type: 'line', fg: 'yellow' }, style: { fg: 'yellow' }
});

const systemLog = grid.set(7, 0, 5, 12, contrib.log, {
    fg: 'green', selectedFg: 'green', label: ' SYSTEM_OPERATIONS_LOG ', border: { type: 'line', fg: 'cyan' }
});

// --- HELPER: LOGGING ---
function log(msg, color = 'cyan') {
    const time = new Date().toLocaleTimeString();
    systemLog.log(`{${color}-fg}[${time}] ${msg}{/${color}-fg}`);
    screen.render();
}

// --- NETWORK CONTROLS ---
async function startServer() {
    if (isServerRunning) return log("Server is already running.", "yellow");
    
    try {
        // 🔥 Ensure DB is initialized in the correct directory
        if (!db) db = initDatabase(); 
        
        log(`Attempting to boot server on port ${currentPort}...`, "cyan");
        
        const res = await startWebServer(currentPort, db);
        if (res.success) {
            isServerRunning = true;
            log(`Server ONLINE -> ${res.url}`, "green");
            updateDashboards();
            updateTrayMenu();
        } else {
            log(`FATAL: ${res.error}`, "red");
        }
    } catch (err) {
        log(`Server Boot Failed: ${err.message}`, "red");
    }
}

async function stopServer() {
    if (!isServerRunning) return log("Server is not running.", "yellow");
    log(`Shutting down server...`, "yellow");
    await stopWebServer();
    isServerRunning = false;
    log(`Server OFFLINE.`, "red");
    updateDashboards();
    updateTrayMenu();
}

// --- SYSTEM TRAY MANAGER ---
async function initSystemTray() {
    // 🔥 Resolve Icon Path relative to the EXE location
    const possibleIconPaths = [
        path.join(baseDir, 'public/icon.ico'),
        path.join(baseDir, 'icon.ico')
    ];

    const iconPath = possibleIconPaths.find(p => fs.existsSync(p));
    let iconData = "";
    if (iconPath) {
        iconData = fs.readFileSync(iconPath, { encoding: 'base64' });
    }

    try {
        tray = new SysTrayModule.default({
            menu: {
                icon: iconData,
                title: "OpenPrix Nexus",
                tooltip: "OpenPrix Server Console",
                items: [
                    { title: "Status: Booting...", enabled: false },
                    { title: "---", enabled: false },
                    { title: "Stop Server", enabled: true },
                    { title: "Start Server", enabled: true },
                    { title: "---", enabled: false },
                    { title: "Exit Terminal", enabled: true }
                ]
            },
            debug: false,
            copyDir: false, 
        });

        tray.onClick(action => {
            if (action.item.title === "Stop Server") stopServer();
            if (action.item.title === "Start Server") startServer();
            if (action.item.title === "Exit Terminal") shutdownSystem();
        });

        tray.start()
            .then(() => log("System Tray Handshake Successful.", "green"))
            .catch(() => {
                log("Tray failed to start (Permission/Binary error). TUI-only mode.", "yellow");
                tray = null;
            });
        
    } catch (e) {
        log("Tray initialization error.", "yellow");
        tray = null;
    }
}

function updateTrayMenu() {
    if (!tray || typeof tray.sendAction !== 'function') return;

    const ip = getLocalIp();
    const url = `http://${ip}:${currentPort}`;
    
    try {
        tray.sendAction({
            type: 'update-menu',
            menu: {
                items: [
                    { title: `Status: ${isServerRunning ? 'ONLINE' : 'OFFLINE'}`, enabled: false },
                    { title: isServerRunning ? url : "---", enabled: false },
                    { title: "---", enabled: false },
                    { title: "Stop Server", enabled: isServerRunning },
                    { title: "Start Server", enabled: !isServerRunning },
                    { title: "---", enabled: false },
                    { title: "Exit Terminal", enabled: true }
                ]
            }
        });
    } catch (err) {
        tray = null;
    }
}

// --- UI UPDATERS ---
function updateDashboards() {
    const ip = getLocalIp();
    serverStats.setMarkdown(`
**STATUS:** ${isServerRunning ? '{green-fg}ONLINE{/green-fg}' : '{red-fg}OFFLINE{/red-fg}'}
**PORT:** ${currentPort}
**HOST IP:** ${ip}

**URL:** ${isServerRunning ? `http://${ip}:${currentPort}` : 'N/A'}
    `);

    controlPanel.setMarkdown(`
**[ S ]** - Start Server
**[ X ]** - Stop Server
**[ P ]** - Change Port
**[ Q ]** - Quit System
    `);

    if (isServerRunning && db) {
        try {
            globalProjects = db.prepare('SELECT code, name, status, clientName FROM projects').all();
            const tableData = globalProjects.map(p => [
                (p.code || 'NO-CODE').substring(0, 14), 
                (p.name || 'Untitled').substring(0, 25), 
                (p.status || 'Draft').substring(0, 12), 
                (p.clientName || 'N/A').substring(0, 18)
            ]);
            projectTable.setData({ headers: ['CODE', 'PROJECT NAME', 'STATUS', 'CLIENT'], data: tableData });
        } catch(e) { 
            log("DB Read Error", "red"); 
        }
    } else {
        projectTable.setData({ headers: ['CODE', 'PROJECT NAME', 'STATUS', 'CLIENT'], data: [] });
    }
    
    screen.render();
}

// --- KEYBINDINGS ---
screen.key(['s', 'S'], () => startServer());
screen.key(['x', 'X'], () => stopServer());

screen.key(['p', 'P'], () => {
    if (isServerRunning) return log("Must stop server before changing ports.", "yellow");
    const prompt = blessed.prompt({
        parent: screen, border: 'line', height: 'shrink', width: 'half', top: 'center', left: 'center', label: ' {blue-fg}Change Port{/blue-fg} ', tags: true, keys: true, vi: true
    });
    prompt.input('Enter new port (1024-65535):', currentPort.toString(), (err, value) => {
        if (value) {
            const p = parseInt(value, 10);
            if (p >= 1024 && p <= 65535) { 
                currentPort = p; 
                log(`Port changed to ${currentPort}`, "green"); 
                updateDashboards(); 
            } else { 
                log("Invalid port number.", "red"); 
            }
        }
    });
});

async function shutdownSystem() {
    log("Terminating session...", "yellow");
    if (isServerRunning) await stopServer();
    if (tray) tray.kill();
    setTimeout(() => process.exit(0), 500);
}

screen.key(['escape', 'q', 'C-c'], () => shutdownSystem());

// --- BOOT SEQUENCE ---
log("Booting OpenPrix Server Nexus...");
initSystemTray();
updateDashboards();
startServer();