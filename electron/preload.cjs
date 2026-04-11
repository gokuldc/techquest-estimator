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

        // --- PROJECT BOQ & MEASUREMENTS ---
        getProjectBoqs: (projectId) => ipcRenderer.invoke('db:get-project-boqs', projectId),
        addProjectBoq: (data) => ipcRenderer.invoke('db:add-project-boq', data),
        updateProjectBoq: (id, data) => ipcRenderer.invoke('db:update-project-boq', id, data),
        deleteProjectBoq: (id) => ipcRenderer.invoke('db:delete-project-boq', id),
        bulkPutProjectBoqs: (dataArray) => ipcRenderer.invoke('db:bulk-put-project-boqs', dataArray),

        // --- DIRECTORY (CRM & STAFF) ---
        getCrmContacts: () => ipcRenderer.invoke('db:get-crm-contacts'),
        saveCrmContact: (data) => ipcRenderer.invoke('db:save-crm-contact', data),
        deleteCrmContact: (id) => ipcRenderer.invoke('db:delete-crm-contact', id),
        getOrgStaff: () => ipcRenderer.invoke('db:get-org-staff'),
        saveOrgStaff: (data) => ipcRenderer.invoke('db:save-org-staff', data),
        deleteOrgStaff: (id) => ipcRenderer.invoke('db:delete-org-staff', id),

        // --- KANBAN ---
        getKanbanTasks: (projectId) => ipcRenderer.invoke('db:get-kanban-tasks', projectId),

        // 🔥 NATIVE BACKUP & RESTORE (Master Database Management)
        backupDatabase: () => ipcRenderer.invoke('db:backup-database'),
        restoreDatabase: (mode) => ipcRenderer.invoke('db:restore-database', mode),

        // 🔥 NATIVE PROJECT SYNC (Workspace Management)
        exportProjectSqlite: (id, options) => ipcRenderer.invoke('db:export-project-sqlite', id, options),
        selectSyncFile: () => ipcRenderer.invoke('db:select-sync-file'),
        executeProjectSync: (targetId, filePath, mode) => ipcRenderer.invoke('db:execute-project-sync', targetId, filePath, mode),

        // 🔥 FULL PROJECT ARCHIVE (SQLite)
        exportAllProjectsSqlite: () => ipcRenderer.invoke('db:export-all-projects-sqlite'),
        importProjectsSqlite: (filePath, mode) => ipcRenderer.invoke('db:import-projects-sqlite', filePath, mode),
        selectArchiveFile: () => ipcRenderer.invoke('db:select-archive-file'),
    }
});