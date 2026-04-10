import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';

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
let db; // Global database instance

function initDatabase() {
    // Store DB in the safe, persistent userData folder
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'database');
    
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'openprix_v2.sqlite');
    
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // Significantly improves write performance

    console.log(`Database initialized at: ${dbPath}`);

    // Create initial schema (You will expand this based on your Dexie models)
    const initSql = `
        CREATE TABLE IF NOT EXISTS regions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE
        );
        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT,
            rate REAL
        );
    `;
    db.exec(initSql);
}

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
            // 🔥 NEW: Required to bridge React and SQLite securely
            preload: path.join(__dirname, 'preload.js') 
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

// Example: Fetch all regions
ipcMain.handle('db:get-regions', () => {
    try {
        const stmt = db.prepare('SELECT * FROM regions');
        return stmt.all();
    } catch (err) {
        console.error('Database Error:', err);
        throw err;
    }
});