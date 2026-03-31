# 🏗️ TechQuest Construction Estimator

An advanced, offline-first desktop application designed for civil engineers and construction professionals. TechQuest Estimator bridges the gap between raw master databases, Local Market Rates (LMR), and project-specific Bill of Quantities (BOQ) with dynamic measurement books.

![Tech Stack](https://img.shields.io/badge/React-19-blue?logo=react)
![Tech Stack](https://img.shields.io/badge/Vite-6-purple?logo=vite)
![Tech Stack](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron)
![Tech Stack](https://img.shields.io/badge/MUI-Material%20Design-007FFF?logo=mui)

---

## ✨ Core Features

* **Master Database Management:** Create and manage construction resources (labor, materials) and build recursive Master BOQ assemblies (e.g., nesting concrete mixes inside foundation tasks).
* **LMR Excel Import:** Instantly update regional pricing by importing standard PWD Local Market Rate Excel sheets.
* **Project Workspaces:** Isolate client projects. Automatically pull rates based on the project's assigned region.
* **Measurement Books (MBook):** Track exact dimensions (Length, Breadth, Depth/Height) for specific locations. Quantities automatically sync with the BOQ.
* **One-Click Excel Export:** Generate production-ready Excel files containing the BOQ, Measurement Books, and detailed Rate Analysis (using SheetJS).
* **100% Offline & Secure:** All data is stored locally on the user's machine using IndexedDB (via Dexie.js).
* **Data Portability:** Export and import Master Templates or Client Projects as JSON files to share between machines or backup data safely.
* **Modern UI:** Built with Material UI (MUI) featuring a responsive Navy & Amber color scheme and native Dark/Light mode toggling.

---

## 🛠️ Technology Stack

* **Frontend Framework:** React 19 + Vite 6
* **Desktop Wrapper:** Electron & Electron-Builder
* **UI/Styling:** Material UI (MUI) v6 + Emotion
* **Local Database:** Dexie.js (IndexedDB wrapper)
* **Excel Engine:** SheetJS (XLSX)

---

## 🚀 Getting Started (Development)

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone the repository or copy the project folder.
2. Open your terminal in the project root directory.
3. Install all dependencies:
   ```bash
   npm install

Running the App

You can run the application in two different modes:

Mode 1: Pure Web Browser (Fast UI Development)
Starts the Vite dev server on http://127.0.0.1:5173.
Bash

npm run dev

Mode 2: Electron Desktop App (Full Desktop Testing)
Starts Vite in the background and automatically launches the standalone Windows desktop shell.
Bash

npm run dev:electron

📦 Building for Production

To package the application into a standalone Windows installer (.exe) that can be shared with clients or coworkers:
Bash

npm run build:electron

Once the build process completes, navigate to the newly created release/ folder to find your executable file (e.g., TechQuest Estimator Setup 1.0.0.exe).
📂 Project Structure
Plaintext

construction-estimator/
├── electron/
│   └── main.js                 # Electron process and window management
├── public/
│   ├── favicon.svg             # Application brand logo
│   └── icon.ico                # Windows executable icon
├── src/
│   ├── components/
│   │   ├── Home.jsx            # Project archive and main navigation
│   │   ├── DatabaseEditor.jsx  # Master DB, LMR imports, and region management
│   │   ├── ProjectWorkspace.jsx# Active BOQ builder and Measurement Books
│   │   └── About.jsx           # System information
│   ├── engines/
│   │   ├── calculationEngine.js# Recursive rate analysis logic
│   │   └── measurementEngine.js# Volume/Area L*B*D math logic
│   ├── utils/
│   │   └── exportExcel.js      # SheetJS formatting and multi-sheet export
│   ├── App.jsx                 # Global MUI Theme and routing logic
│   ├── db.js                   # Dexie IndexedDB schema definition
│   └── main.jsx                # React DOM entry point
├── index.html                  # HTML template
├── package.json                # Dependencies and build scripts
└── vite.config.js              # Vite configuration (handles absolute/relative paths)

🔒 Data Architecture & Privacy

This application operates entirely offline.

    Master Data (Regions, Resources, BOQs) and Project Data are strictly separated in the database to prevent accidental overwrites.

    No data is ever sent to an external server.

    Users must manually back up their data using the built-in JSON export tools.

Developed by Gokul DC for TechQuest Innovations Pvt. Ltd.
