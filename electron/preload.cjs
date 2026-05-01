const { contextBridge, ipcRenderer } = require('electron');

// Expose OS Native operations under 'electronHost' instead of 'api'
contextBridge.exposeInMainWorld('electronHost', {
    os: {
        pickFile: () => ipcRenderer.invoke('os:pick-file'),
        openFile: (filePath) => ipcRenderer.invoke('os:open-file', filePath),
        getBase64: (filePath) => ipcRenderer.invoke('os:get-base64', filePath),
        pickDirectory: () => ipcRenderer.invoke('os:pick-directory'),
    }
});