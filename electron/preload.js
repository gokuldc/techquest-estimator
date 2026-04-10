const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Database operations exposed to React
    db: {
        getRegions: () => ipcRenderer.invoke('db:get-regions'),
        // We will add more handlers here for insert/update/delete 
        // as you migrate your Dexie queries
    }
});