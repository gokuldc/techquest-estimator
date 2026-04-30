// 🔥 The Global Client URL. The user will change this via the Login Screen.
let SERVER_URL = sessionStorage.getItem('openprix_server_url') || 'http://127.0.0.1:3000';

export const setServerUrl = (url) => {
    SERVER_URL = url;
    sessionStorage.setItem('openprix_server_url', url);
};

export const getServerUrl = () => SERVER_URL;

const webRpc = async (channel, ...args) => {
    try {
        const response = await fetch(`${SERVER_URL}/api/rpc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel, args })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        return result.data;
    } catch(err) {
        console.error(`RPC Fail [${channel}]:`, err);
        throw err;
    }
};

const isElectron = window && window.api && window.api.os;

export const api = {
    // We map every database command natively to webRpc
    getProjects: () => webRpc('db:get-projects'),
    getOrgStaff: () => webRpc('db:get-org-staff'),
    checkNotifications: (userId, lastChecked) => webRpc('db:check-notifications', userId, lastChecked),
    
    // BUT we keep OS commands routed through Electron
    os: {
        pickFile: () => isElectron ? window.api.os.pickFile() : Promise.resolve(null),
        openFile: (filePath) => isElectron ? window.api.os.openFile(filePath) : window.open(`${SERVER_URL}/api/download?path=${encodeURIComponent(filePath)}`, '_blank'),
        uploadFileWeb: (name, b64, id) => webRpc('os:upload-file-web', name, b64, id)
    }
};