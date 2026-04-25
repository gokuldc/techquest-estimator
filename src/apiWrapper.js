// This file intelligently routes database requests.
// Desktop App -> Uses Electron IPC Bridge
// Web Browser -> Uses HTTP Fetch to your Node Server

const isElectron = window && window.api && window.api.db;

const webRpc = async (channel, ...args) => {
    const response = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, args })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
};

export const api = {
    getProjects: () => isElectron ? window.api.db.getProjects() : webRpc('db:get-projects'),
    getOrgStaff: () => isElectron ? window.api.db.getOrgStaff() : webRpc('db:get-org-staff'),
    checkNotifications: (userId, lastChecked) => isElectron ? window.api.db.checkNotifications(userId, lastChecked) : webRpc('db:check-notifications', userId, lastChecked),
    // ... map the rest of your functions here ...
};