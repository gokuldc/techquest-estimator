import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './electron/db.js'; // Use your existing DB init!

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for documents/images

// 1. Boot the Database
const db = initDatabase();

// 2. The Universal API Endpoint (Replaces IPC)
// Instead of writing 50 different Express routes, we funnel everything through one RPC endpoint.
app.post('/api/rpc', (req, res) => {
    const { channel, args } = req.body;

    try {
        let result;

        // Map the IPC channels to direct database calls
        switch (channel) {
            case 'db:get-projects':
                result = db.prepare('SELECT * FROM projects').all();
                break;
            case 'db:get-org-staff':
                result = db.prepare('SELECT * FROM org_staff').all();
                break;
            case 'db:check-notifications':
                // args[0] = userId, args[1] = lastChecked
                const globalUnread = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE projectId IS NULL AND senderId != ? AND createdAt > ?`).get(args[0], args[1] || 0);
                const dmUnread = db.prepare(`SELECT COUNT(*) as count FROM private_messages WHERE receiverId = ? AND createdAt > ?`).get(args[0], args[1] || 0);
                result = (globalUnread ? globalUnread.count : 0) + (dmUnread ? dmUnread.count : 0);
                break;
            // ... Add the rest of your switch cases here mapping to your database queries ...

            default:
                return res.status(404).json({ error: 'Unknown Channel' });
        }
        res.json({ success: true, data: result });
    } catch (error) {
        console.error(`RPC Error [${channel}]:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Serve the React Frontend
// This serves the compiled Vite files from the 'dist' folder
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Catch-all to route browser navigation back to React's index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 OpenPrix Web Server running on http://localhost:${PORT}`);
    console.log(`Ready for Cloudflare Tunnel / Tailscale routing.`);
});