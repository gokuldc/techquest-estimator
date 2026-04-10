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

        // --- MASTER BOQ ---
        saveMasterBoq: (payload, id, isNew) => ipcRenderer.invoke('db:save-master-boq', payload, id, isNew),
        deleteMasterBoq: (id) => ipcRenderer.invoke('db:delete-master-boq', id),

        // --- MASS OPERATIONS ---
        importExcel: (regionName) => ipcRenderer.invoke('db:import-excel', regionName),
        restoreDatabase: (data, mode) => ipcRenderer.invoke('db:restore-database', data, mode),
        purgeDatabase: () => ipcRenderer.invoke('db:purge-database'),

        // ==========================================
        // 🔥 MISSING PROJECT WORKSPACE HANDLERS 🔥
        // ==========================================
        getProject: (id) => ipcRenderer.invoke('db:get-project', id),
        updateProject: (id, data) => ipcRenderer.invoke('db:update-project', id, data),

        getProjectBoqs: (projectId) => ipcRenderer.invoke('db:get-project-boqs', projectId),
        addProjectBoq: (data) => ipcRenderer.invoke('db:add-project-boq', data),
        updateProjectBoq: (id, data) => ipcRenderer.invoke('db:update-project-boq', id, data),
        deleteProjectBoq: (id) => ipcRenderer.invoke('db:delete-project-boq', id),
        bulkPutProjectBoqs: (dataArray) => ipcRenderer.invoke('db:bulk-put-project-boqs', dataArray),

        // --- STUBS ---
        getKanbanTasks: (projectId) => ipcRenderer.invoke('db:get-kanban-tasks', projectId),
        getCrmContacts: () => ipcRenderer.invoke('db:get-crm-contacts'),
        getOrgStaff: () => ipcRenderer.invoke('db:get-org-staff'),
        syncProjectData: (projectId, data) => ipcRenderer.invoke('db:sync-project-data', projectId, data),
        getProjects: () => ipcRenderer.invoke('db:get-projects'),
        addProject: (data) => ipcRenderer.invoke('db:add-project', data),
        deleteProject: (id) => ipcRenderer.invoke('db:delete-project', id),
        purgeProjects: () => ipcRenderer.invoke('db:purge-projects'),
        importProjects: (projectsArray, mode) => ipcRenderer.invoke('db:import-projects', projectsArray, mode),
    }
});