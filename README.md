🛸 OPENPRIX

The Operating System for Modern Engineering & Construction Firms.

OPENPRIX is a high-performance project management ecosystem built for engineering firms that need local speed with network flexibility. It bridges the gap between a robust Electron Desktop App and a Localized Web Server, allowing teams to sync tasks, logs, and communications across an office network without relying on slow, expensive cloud subscriptions.
💎 The Ghost Architecture

OPENPRIX is designed around a Local-First philosophy. Data lives in a high-speed SQLite engine on your host machine, while an integrated Express server provides real-time access to mobile devices and browsers on the same network.
🛠 Core Modules

    ⚡ Operations Interface: * Hot-Editable Logs: Excel-like efficiency. Edit daily work logs, serial numbers, and statuses directly in the grid with auto-save triggers.

        Intelligent Filtering: Instantly pivot data by month, staff, or project code.

    📋 Global Kanban Engine: * Aggregated Tasks: Automatically pulls ganttTasks from every active project into one master board.

        Native Drag & Drop: Move tasks across lanes (Backlog, Procurement, Progress, QC, Done) with instant database synchronization.

    💬 Commlink (Channels):

        Threaded Conversations: WhatsApp-style inline replies and nested threads using replyToId logic.

        Rich Mentions: Discord-style @username popups to notify specific personnel.

        File Infrastructure: Seamless attachment handling with automated local directory scaffolding.

    📊 Market Analytics (LMR): * Labor-Material-Resource Database: Manage regional price sheets with high-speed "Ghost" inputs.

        Inflation Tracking: Real-time trend visualization using Recharts to monitor price fluctuations over time.

        Excel Power-Import: Bulk-load thousands of resource items directly into the SQLite core.

🚀 Tech Stack

    Frontend: React 18, Vite, Material UI (MUI).

    Desktop Engine: Electron (with secure IPC Preload bridge).

    Backend: Node.js, Better-SQLite3.

    Network Layer: Express (REST API + Local RPC Bridge).

    Visualization: Recharts (D3-based high-performance graphing).

🛠 Installation & Setup
Prerequisites

    Node.js (LTS recommended)

    npm or yarn

Deployment

    Clone the Repository:
    Bash

    git clone https://github.com/gokuldc/openprix.git
    cd openprix

    Install Dependencies:
    Bash

    npm install

    Run in Development Mode:
    Bash

    npm run dev

    Build Production Executables:
    Bash

    npm run build

🌐 Network Server Mode

To allow other engineers on your local Wi-Fi/LAN to access the dashboard:

    Open the Server Manager inside the app.

    Assign a Port (Default: 3000).

    Click Start Server.

    Other users can navigate to http://[Your-IP]:3000 to access the Web Bridge.

🛡 Security

    Preload Isolation: Core database commands are never exposed to the frontend; they are mediated through a secure IPC bridge.

    Clearance Levels: Integrated RBAC (Role-Based Access Control) with five levels of administrative clearance.

📝 License

Built for internal use at engineering firms. Standard MIT license applies to the open-source core.

    Engineer's Note: "Data is the new concrete. Build it solid, or the project won't stand." 🏗️