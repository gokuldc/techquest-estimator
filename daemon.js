import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './electron/db.js';
import { startWebServer, stopWebServer } from './electron/webServer.js';

const __filename = fileURLToPath(import.meta.url);
const baseDir = path.dirname(__filename);
const statusFile = path.join(baseDir, '.daemon_status.json');

let db = null;
let currentPort = 3000;

// Read config if passed via args
const args = process.argv.slice(2);
if (args[0]) currentPort = parseInt(args[0], 10) || 3000;

function updateStatus(status, url = null, error = null) {
    fs.writeFileSync(statusFile, JSON.stringify({
        status, port: currentPort, url, error, pid: process.pid
    }));
}

async function boot() {
    updateStatus('booting');
    try {
        db = initDatabase();
        const res = await startWebServer(currentPort, db);
        
        if (res.success) {
            updateStatus('online', res.url);
        } else {
            updateStatus('error', null, res.error);
            process.exit(1);
        }
    } catch (err) {
        updateStatus('error', null, err.message);
        process.exit(1);
    }
}

// Listen for commands from the TUI
process.on('message', async (msg) => {
    if (msg === 'shutdown') {
        updateStatus('shutting_down');
        await stopWebServer();
        if (fs.existsSync(statusFile)) fs.unlinkSync(statusFile);
        process.exit(0);
    }
});

// Clean up if killed forcefully
process.on('SIGINT', () => {
    if (fs.existsSync(statusFile)) fs.unlinkSync(statusFile);
    process.exit(0);
});

boot();