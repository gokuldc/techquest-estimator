const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    db: {
        // --- MASTER DATA READS ---
        getRegions: () => ipcRenderer.invoke('db:get-regions'),
        getResources: () => ipcRenderer.invoke('db:get-resources'),
        getMasterBoqs: () => ipcRenderer.invoke('db:get-master-boqs'),

        // --- REGIONS ---
        createRegion: (name) => ipcRenderer.invoke('db:create-region', name),
        deleteRegion: (id, name) => ipcRenderer.invoke('db:delete-region', id, name),

        // --- RESOURCES ---
        createResource: (data) => ipcRenderer.invoke('db:create-resource', data),
        updateResource: (id, field, value) => ipcRenderer.invoke('db:update-resource', id, field, value),
        deleteResource: (id) => ipcRenderer.invoke('db:delete-resource', id),

        // --- MASTER BOQ (DATABOOK) ---
        saveMasterBoq: (payload, id, isNew) => ipcRenderer.invoke('db:save-master-boq', payload, id, isNew),
        deleteMasterBoq: (id) => ipcRenderer.invoke('db:delete-master-boq', id),

        // --- GLOBAL SETTINGS / MASS OPS ---
        importExcel: (regionName) => ipcRenderer.invoke('db:import-excel', regionName),
        purgeDatabase: () => ipcRenderer.invoke('db:purge-database'),

        // --- PROJECTS MANAGEMENT ---
        getProjects: () => ipcRenderer.invoke('db:get-projects'),
        getProject: (id) => ipcRenderer.invoke('db:get-project', id),
        addProject: (data) => ipcRenderer.invoke('db:add-project', data),
        updateProject: (id, data) => ipcRenderer.invoke('db:update-project', id, data),
        deleteProject: (id) => ipcRenderer.invoke('db:delete-project', id),
        purgeProjects: () => ipcRenderer.invoke('db:purge-projects'),
        importProjects: (projectsArray, mode) => ipcRenderer.invoke('db:import-projects', projectsArray, mode),

        // --- CHAT MESSAGES ---
        getMessages: (projectId) => ipcRenderer.invoke('db:get-messages', projectId),
        saveMessage: (data) => ipcRenderer.invoke('db:save-message', data),
        deleteMessage: (id) => ipcRenderer.invoke('db:delete-message', id), // 🔥 ADDED
        
        getPrivateMessages: (user1, user2) => ipcRenderer.invoke('db:get-private-messages', user1, user2),
        savePrivateMessage: (data) => ipcRenderer.invoke('db:save-private-message', data),
        deletePrivateMessage: (id) => ipcRenderer.invoke('db:delete-private-message', id), // 🔥 ADDED
        
        checkNotifications: (userId, lastChecked) => ipcRenderer.invoke('db:check-notifications', userId, lastChecked),

        // --- PROJECT BOQ & MEASUREMENTS ---
        getProjectBoqs: (projectId) => ipcRenderer.invoke('db:get-project-boqs', projectId),
        addProjectBoq: (data) => ipcRenderer.invoke('db:add-project-boq', data),
        updateProjectBoq: (id, data) => ipcRenderer.invoke('db:update-project-boq', id, data),
        deleteProjectBoq: (id) => ipcRenderer.invoke('db:delete-project-boq', id),
        bulkPutProjectBoqs: (dataArray) => ipcRenderer.invoke('db:bulk-put-project-boqs', dataArray),

        // --- NEW: PROJECT DOCUMENTS (DATABASE LINKS) ---
        getProjectDocuments: (projectId) => ipcRenderer.invoke('db:get-project-documents', projectId),
        saveProjectDocument: (data) => ipcRenderer.invoke('db:save-project-document', data),
        deleteProjectDocument: (id) => ipcRenderer.invoke('db:delete-project-document', id),

        // --- DIRECTORY (CRM & STAFF) ---
        getCrmContacts: () => ipcRenderer.invoke('db:get-crm-contacts'),
        saveCrmContact: (data) => ipcRenderer.invoke('db:save-crm-contact', data),
        deleteCrmContact: (id) => ipcRenderer.invoke('db:delete-crm-contact', id),
        getOrgStaff: () => ipcRenderer.invoke('db:get-org-staff'),
        saveOrgStaff: (data) => ipcRenderer.invoke('db:save-org-staff', data),
        deleteOrgStaff: (id) => ipcRenderer.invoke('db:delete-org-staff', id),

        // --- KANBAN ---
        getKanbanTasks: (projectId) => ipcRenderer.invoke('db:get-kanban-tasks', projectId),

        // 🔥 NATIVE BACKUP & RESTORE
        backupDatabase: () => ipcRenderer.invoke('db:backup-database'),
        restoreDatabase: (mode) => ipcRenderer.invoke('db:restore-database', mode),

        // 🔥 NATIVE PROJECT SYNC
        exportProjectSqlite: (id, options) => ipcRenderer.invoke('db:export-project-sqlite', id, options),
        selectSyncFile: () => ipcRenderer.invoke('db:select-sync-file'),
        executeProjectSync: (targetId, filePath, mode) => ipcRenderer.invoke('db:execute-project-sync', targetId, filePath, mode),

        // 🔥 FULL PROJECT ARCHIVE
        exportAllProjectsSqlite: () => ipcRenderer.invoke('db:export-all-projects-sqlite'),
        importProjectsSqlite: (filePath, mode) => ipcRenderer.invoke('db:import-projects-sqlite', filePath, mode),
        selectArchiveFile: () => ipcRenderer.invoke('db:select-archive-file'),

        getSettings: (key) => ipcRenderer.invoke('db:get-settings', key),
        saveSettings: (key, value) => ipcRenderer.invoke('db:save-settings', key, value),
        verifyEmployeeLogin: (username, password) => ipcRenderer.invoke('db:verify-login', username, password),

        getWorkLogs: () => ipcRenderer.invoke('db:get-work-logs'),
        saveWorkLog: (data) => ipcRenderer.invoke('db:save-work-log', data),
        deleteWorkLog: (id) => ipcRenderer.invoke('db:delete-work-log', id),
    },

    // --- OS NATIVE OPERATIONS (Files & Shell) ---
    os: {
        pickFile: () => ipcRenderer.invoke('os:pick-file'),
        openFile: (filePath) => ipcRenderer.invoke('os:open-file', filePath),
        getBase64: (filePath) => ipcRenderer.invoke('os:get-base64', filePath),

        //  DIRECTORY HANDLERS
        pickDirectory: () => ipcRenderer.invoke('os:pick-directory'),
        scaffoldProject: (data) => ipcRenderer.invoke('os:scaffold-project', data),
        renameProjectFolder: (data) => ipcRenderer.invoke('os:rename-project-folder', data),
        uploadFileWeb: (fileName, base64Data, projectId) => ipcRenderer.invoke('os:upload-file-web', fileName, base64Data, projectId)
    },

    server: {
        start: (port) => ipcRenderer.invoke('server:start', port),
        stop: () => ipcRenderer.invoke('server:stop'),
        getIp: () => ipcRenderer.invoke('server:get-ip')
    },

    // 🔥 ADDED: LISTENER FOR TRAY ICON SYNC SETTINGS 🔥
    onOpenSyncSettings: (callback) => ipcRenderer.on('open-sync-settings', () => callback())
});