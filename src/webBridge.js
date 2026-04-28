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
    console.log("🌐 Web Browser Detected: Consolidating Network API Bridge...");

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
            return null;
        }
    };

    const desktopOnly = () => {
        alert("This feature (File System / Native Dialogs) is only available on the Desktop App.");
        return { success: false, error: "Desktop only", canceled: true };
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
            
            // 🔥 WORK LOGS SYNCED FOR BROWSER 🔥
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

            // --- DESKTOP ONLY ---
            importExcel: desktopOnly,
            exportAllProjectsSqlite: desktopOnly,
            exportProjectSqlite: desktopOnly,
            importProjectsSqlite: desktopOnly,
            selectSyncFile: desktopOnly,
            selectArchiveFile: desktopOnly,
            executeProjectSync: desktopOnly,
            backupDatabase: desktopOnly,
            restoreDatabase: desktopOnly,
            purgeDatabase: desktopOnly
        },
        server: {
            start: desktopOnly,
            stop: desktopOnly,
            getIp: async () => '127.0.0.1'
        },
        os: {
            pickFile: desktopOnly,
            pickDirectory: desktopOnly,
            scaffoldProject: desktopOnly,
            renameProjectFolder: desktopOnly,
            uploadFileWeb: (fileName, base64Data, projectId) => fetchRpc('os:upload-file-web', fileName, base64Data, projectId),
            openFile: (filePath) => {
                const downloadUrl = `/api/download?path=${encodeURIComponent(filePath)}`;
                window.open(downloadUrl, '_blank');
            },
            getBase64: desktopOnly
        }
    };
}