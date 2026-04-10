const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    db: {
        // Read
        getRegions: () => ipcRenderer.invoke('db:get-regions'),
        getResources: () => ipcRenderer.invoke('db:get-resources'),
        getMasterBoqs: () => ipcRenderer.invoke('db:get-master-boqs'),

        // Regions
        createRegion: (name) => ipcRenderer.invoke('db:create-region', name),
        deleteRegion: (id, name) => ipcRenderer.invoke('db:delete-region', id, name),

        // Resources
        createResource: (data) => ipcRenderer.invoke('db:create-resource', data),
        updateResource: (id, field, value) => ipcRenderer.invoke('db:update-resource', id, field, value),
        deleteResource: (id) => ipcRenderer.invoke('db:delete-resource', id),

        // Master BOQ
        saveMasterBoq: (payload, id, isNew) => ipcRenderer.invoke('db:save-master-boq', payload, id, isNew),
        deleteMasterBoq: (id) => ipcRenderer.invoke('db:delete-master-boq', id),

        // Mass Operations
        importExcel: (regionName) => ipcRenderer.invoke('db:import-excel', regionName),
        restoreDatabase: (data, mode) => ipcRenderer.invoke('db:restore-database', data, mode),
        purgeDatabase: () => ipcRenderer.invoke('db:purge-database')
    }
});