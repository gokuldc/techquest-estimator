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

// --- THE UNIVERSAL HTTP DATABASE BRIDGE ---
const fetchRpc = async (channel, ...args) => {
    try {
        const targetUrl = sessionStorage.getItem('openprix_server_url') || 'http://127.0.0.1:3000';
        
        const res = await fetch(`${targetUrl}/api/rpc`, {
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

// --- WEB FALLBACK FOR FILE PICKING ---
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

// --- OS NETWORK CALLS (Always sent to Rust via HTTP) ---
const osNetworkCalls = {
    scaffoldProject: (data) => fetchRpc('os:scaffold-project', data),
    renameProjectFolder: (data) => fetchRpc('os:rename-project-folder', data),
    uploadFileWeb: (fileName, base64Data, projectId) => fetchRpc('os:upload-file-web', fileName, base64Data, projectId),
};

// --- OS NATIVE FALLBACKS (Used only if accessed via standard web browser) ---
const webOsFallbacks = {
    pickFile: () => webPickFile(),
    pickDirectory: async () => prompt("Host Server Path Mapping:\nBecause you are on a remote web browser, please type the absolute path ON THE HOST SERVER where projects should be scaffolded (e.g., C:/OpenPrix/Projects):") || null,
    openFile: (filePath) => {
        const targetUrl = sessionStorage.getItem('openprix_server_url') || 'http://127.0.0.1:3000';
        window.open(`${targetUrl}/api/download?path=${encodeURIComponent(filePath)}`, '_blank');
    },
    getBase64: async (filePath) => {
        try {
            const targetUrl = sessionStorage.getItem('openprix_server_url') || 'http://127.0.0.1:3000';
            const res = await fetch(`${targetUrl}/api/download?path=${encodeURIComponent(filePath)}`);
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch { return null; }
    }
};

// 🔥 BUILD THE GLOBAL API OBJECT 🔥
window.api = {
    db: {
        verifyEmployeeLogin: (un, pw) => fetchRpc('db:verify-login', un, pw),
        getSettings: (key) => fetchRpc('db:get-settings', key),
        saveSettings: (key, val) => fetchRpc('db:save-settings', key, val),
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
        getProjectDocuments: (pid) => fetchRpc('db:get-project-documents', pid),
        saveProjectDocument: (data) => fetchRpc('db:save-project-document', data),
        deleteProjectDocument: (id) => fetchRpc('db:delete-project-document', id),
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
        getMessages: (pid) => fetchRpc('db:get-messages', pid),
        saveMessage: (data) => fetchRpc('db:save-message', data),
        deleteMessage: (id) => fetchRpc('db:delete-message', id), 
        getPrivateMessages: (u1, u2) => fetchRpc('db:get-private-messages', u1, u2),
        savePrivateMessage: (data) => fetchRpc('db:save-private-message', data),
        deletePrivateMessage: (id) => fetchRpc('db:delete-private-message', id), 
        checkNotifications: (id, lc) => fetchRpc('db:check-notifications', id, lc),
        getKanbanTasks: () => fetchRpc('db:get-kanban-tasks'),
    },
    
    // 🔥 MERGE: Native Electron functions (if they exist) + Network RPC OS Functions
    os: {
        ...(window.electronHost ? window.electronHost.os : webOsFallbacks),
        ...osNetworkCalls
    }
};