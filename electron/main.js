import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if we are running in dev mode via our custom script
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "TechQuest Estimator Pro",
        autoHideMenuBar: true, // Hides the default Windows menu bar
        webPreferences: {
            nodeIntegration: false, // Keep false for security
            contextIsolation: true,
            sandbox: false // Required for some native file dialogs in newer Electron
        }
    });

    if (isDev) {
        // In development, load the Vite dev server
        mainWindow.loadURL('http://127.0.0.1:5173');
        // Open DevTools automatically in dev mode
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the built static files
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Hardware acceleration fixes for older Windows machines
app.disableHardwareAcceleration();

app.whenReady().then(createWindow);

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