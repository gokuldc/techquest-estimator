# 🛸 OPENPRIX
**The Operating System for Modern Engineering & Construction Firms.**
OPENPRIX is a high-performance project management ecosystem built for engineering firms that need local speed with network flexibility. It bridges the gap between a robust Electron Desktop App and a Localized Web Server, allowing teams to sync tasks, logs, and communications across an office network without relying on slow, expensive cloud subscriptions.
## 💎 The Ghost Architecture
OPENPRIX is designed around a **Local-First** philosophy. Data lives in a high-speed SQLite engine on your host machine, while an integrated Express server provides real-time access to mobile devices and browsers on the same network.
## 🛠 Core Modules
### 🏗️ Site & Project Operations
 * **Site Management:** Real-time oversight of field operations, progress tracking, and daily site diary integration.
 * **M-Book (Measurement Book):** Digitalized engineering measurement records for civil works, ensuring audit-ready compliance and accuracy.
 * **Kanban Task Engine:** Automated aggregation of ganttTasks into a visual flow (Backlog, Procurement, Progress, QC, Done).
 * **File Versioning:** Integrated document control system for blueprints and CAD files, preventing "outdated drawing" errors on-site.
### 💰 Financials & Procurement
 * **Estimation Engine:** High-speed calculation of project tenders and internal cost-to-complete projections.
 * **RA (Running Account) Billing:** Automated generation and tracking of progress-based invoices for clients and subcontractors.
 * **Supply Chain Management (SCM):** End-to-end procurement tracking from requisition to site delivery.
 * **One-Click Purchase Order (PO):** Convert approved estimations directly into vendor POs with a single trigger.
 * **Inventory Management:** Real-time stock tracking across multiple store locations with low-stock alerts.
### 👥 Resource & Org Management
 * **Resource Management:** Dynamic allocation of workforce and heavy machinery across active project sites.
 * **CRM:** Lead tracking and client relationship management tailored for engineering contract cycles.
 * **Organization Management:** Structural control of departments, and complex RBAC (Role-Based Access Control).
### 💬 Commlink (Unified Chat)
 * **Channels & Chat:** WhatsApp-style threaded conversations and Discord-style mentions.
## 🚀 Installation & Setup
### Prerequisites
 * Node.js (LTS recommended)
 * npm or yarn
### Deployment
 1. **Clone the Repository:**
   ```bash
   git clone https://github.com/gokuldc/openprix.git
   cd openprix
   
   ```
 2. **Install Dependencies:**
   ```bash
   npm install
   
   ```
 3. **Run in Development Mode:**
   ```bash
   npm run dev
   
   ```
 4. **Build Production Executables:**
   ```bash
   npm run build
   
   ```
### 🔑 Default Credentials
Upon first launch, use the following credentials to access the administrative dashboard:
> **Username:** admin
> **Password:** admin123
> 
*Note: For security, navigate to Organization Management to update your password immediately after first login.*
## 🛡 Security & Networking
 * **Preload Isolation:** Core database commands are mediated through a secure IPC bridge.
 * **Network Server Mode:** Enable the "Web Bridge" to allow local Wi-Fi/LAN devices to access the dashboard via http://[Your-IP]:3000.
 * **Clearance Levels:** Five levels of administrative clearance to protect sensitive financial and M-Book data.
## 📝 License & Copyright
Built for internal use at engineering firms. Standard MIT license applies to the open-source core.
**© 2026 gokuldc. All rights reserved.**
*Engineer's Note: "Data is the new concrete. Build it solid, or the project won't stand."* 🏗️
