// 🔥 POLYFILL: Gives HTTP devices the ability to generate secure IDs
if (!window.crypto) window.crypto = {};
if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };
}

if (!window.api) {
    console.log("🌐 Web Browser Detected: Initializing Full-Stack Network RPC Bridge...");

    const fetchRpc = async (channel, ...args) => {
        try {
            const res = await fetch('/api/rpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel, args })
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            return json.data;
        } catch (error) {
            console.error(`Network RPC Error [${channel}]:`, error);
            return { success: false, error: error.message };
        }
    };

    // --- WEB FILE SYSTEM POLYFILLS ---
    const webPickFile = (accept = "*") => {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return resolve(null);
                const reader = new FileReader();
                reader.onload = evt => resolve({ name: file.name, base64: evt.target.result.split(',')[1] });
                reader.readAsDataURL(file);
            };
            input.click();
        });
    };

    const webSaveFile = (base64Data, fileName) => {
        const byteStr = atob(base64Data);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    };

    window.api = {
        db: {
            // --- AUTH & SETTINGS ---
            verifyEmployeeLogin: (un, pw) => fetchRpc('db:verify-login', un, pw),
            getSettings: (key) => fetchRpc('db:get-settings', key),
            saveSettings: (key, val) => fetchRpc('db:save-settings', key, val),

            // --- MASTER DATA ---
            getRegions: () => fetchRpc('db:get-regions'),
            createRegion: (name) => fetchRpc('db:create-region', name),
            deleteRegion: (id, name) => fetchRpc('db:delete-region', id, name),
            getResources: () => fetchRpc('db:get-resources'),
            createResource: (data) => fetchRpc('db:create-resource', data),
            updateResource: (id, f, v) => fetchRpc('db:update-resource', id, f, v),
            deleteResource: (id) => fetchRpc('db:delete-resource', id),
            getMasterBoqs: () => fetchRpc('db:get-master-boqs'),
            saveMasterBoq: (p, id, n) => fetchRpc('db:save-master-boq', p, id, n),
            deleteMasterBoq: (id) => fetchRpc('db:delete-master-boq', id),

            // --- PROJECTS & WORKSPACE ---
            getProjects: () => fetchRpc('db:get-projects'),
            getProject: (id) => fetchRpc('db:get-project', id),
            addProject: (data) => fetchRpc('db:add-project', data),
            updateProject: (id, data) => fetchRpc('db:update-project', id, data),
            deleteProject: (id) => fetchRpc('db:delete-project', id),
            purgeProjects: () => fetchRpc('db:purge-projects'),
            getProjectBoqs: (pid) => fetchRpc('db:get-project-boqs', pid),
            addProjectBoq: (data) => fetchRpc('db:add-project-boq', data),
            updateProjectBoq: (id, data) => fetchRpc('db:update-project-boq', id, data),
            deleteProjectBoq: (id) => fetchRpc('db:delete-project-boq', id),
            bulkPutProjectBoqs: (arr) => fetchRpc('db:bulk-put-project-boqs', arr),

            // --- GALLERY & DOCUMENTS ---
            getProjectDocuments: (pid) => fetchRpc('db:get-project-documents', pid),
            saveProjectDocument: (data) => fetchRpc('db:save-project-document', data),
            deleteProjectDocument: (id) => fetchRpc('db:delete-project-document', id),

            // --- DIRECTORY & LOGS ---
            getCrmContacts: () => fetchRpc('db:get-crm-contacts'),
            saveCrmContact: (data) => fetchRpc('db:save-crm-contact', data),
            deleteCrmContact: (id) => fetchRpc('db:delete-crm-contact', id),
            getOrgStaff: () => fetchRpc('db:get-org-staff'),
            saveOrgStaff: (data) => fetchRpc('db:save-org-staff', data),
            deleteOrgStaff: (id) => fetchRpc('db:delete-org-staff', id),
            
            getWorkLogs: () => fetchRpc('db:get-work-logs'),
            saveWorkLog: (data) => fetchRpc('db:save-work-log', data),
            updateWorkLog: (id, data) => fetchRpc('db:update-work-log', id, data),
            deleteWorkLog: (id) => fetchRpc('db:delete-work-log', id),

            // --- COMMLINK (MESSAGING) ---
            getMessages: (pid) => fetchRpc('db:get-messages', pid),
            saveMessage: (data) => fetchRpc('db:save-message', data),
            deleteMessage: (id) => fetchRpc('db:delete-message', id), 

            getPrivateMessages: (u1, u2) => fetchRpc('db:get-private-messages', u1, u2),
            savePrivateMessage: (data) => fetchRpc('db:save-private-message', data),
            deletePrivateMessage: (id) => fetchRpc('db:delete-private-message', id), 
            
            checkNotifications: (id, lc) => fetchRpc('db:check-notifications', id, lc),
            getKanbanTasks: () => fetchRpc('db:get-kanban-tasks'),

            // 🔥 UNLOCKED DESKTOP OPERATIONS FOR WEB CLIENTS 🔥
            
            // 1. Database Backups
            backupDatabase: async () => {
                const res = await fetchRpc('db:backup-database');
                if (res && res.fileData) { webSaveFile(res.fileData, res.fileName); return { success: true }; }
                return { success: false, error: res?.error || "Backup failed." };
            },
            restoreDatabase: async (mode) => {
                const file = await webPickFile(".sqlite,.db");
                if (!file) return { success: false, canceled: true };
                return await fetchRpc('db:restore-database', mode, file.base64);
            },
            purgeDatabase: () => fetchRpc('db:purge-database'),

            // 2. Project Archives
            exportAllProjectsSqlite: async () => {
                const res = await fetchRpc('db:export-all-projects-sqlite');
                if (res && res.fileData) { webSaveFile(res.fileData, res.fileName); return { success: true }; }
                return { success: false, error: "Export failed." };
            },
            selectArchiveFile: async () => {
                const file = await webPickFile(".sqlite,.db");
                if (!file) return { success: false, canceled: true };
                return { success: true, filePath: file.base64, projects: [] }; // Pass base64 downstream
            },
            importProjectsSqlite: (base64Str, mode) => fetchRpc('db:import-projects-sqlite', base64Str, mode),

            // 3. Project Syncing
            exportProjectSqlite: async (id, options) => {
                const res = await fetchRpc('db:export-project-sqlite', id, options);
                if (res && res.fileData) { webSaveFile(res.fileData, res.fileName); return { success: true }; }
                return { success: false, error: "Sync export failed." };
            },
            selectSyncFile: async () => {
                const file = await webPickFile(".sqlite,.db");
                if (!file) return { success: false, canceled: true };
                return { success: true, filePath: file.base64 };
            },
            executeProjectSync: (targetId, base64Str, mode) => fetchRpc('db:execute-project-sync', targetId, base64Str, mode)
        },
        os: {
            pickFile: () => webPickFile(),
            
            // Browsers cannot open host directories, so we ask the user for the absolute string path
            pickDirectory: async () => {
                const path = prompt("Host Server Path Mapping:\nBecause you are on a remote web browser, please type the absolute path ON THE HOST SERVER where projects should be scaffolded (e.g., C:/OpenPrix/Projects or /var/www/openprix):");
                return path || null;
            },
            
            scaffoldProject: (data) => fetchRpc('os:scaffold-project', data),
            renameProjectFolder: (data) => fetchRpc('os:rename-project-folder', data),
            uploadFileWeb: (fileName, base64Data, projectId) => fetchRpc('os:upload-file-web', fileName, base64Data, projectId),
            
            openFile: (filePath) => {
                const downloadUrl = `/api/download?path=${encodeURIComponent(filePath)}`;
                window.open(downloadUrl, '_blank');
            },
            
            getBase64: async (filePath) => {
                try {
                    const res = await fetch(`/api/download?path=${encodeURIComponent(filePath)}`);
                    const blob = await res.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                } catch { return null; }
            }
        },
        server: {
            start: () => alert("You cannot start the Host Server remotely from a Web Client."),
            stop: () => alert("You cannot stop the Host Server remotely from a Web Client."),
            getIp: async () => window.location.hostname
        }
    };
}