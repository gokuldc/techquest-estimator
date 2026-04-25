import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const savedSession = localStorage.getItem('openprix_session');
            if (savedSession) {
                const parsedUser = JSON.parse(savedSession);

                // 🔥 Validate it's an actual user with an access level
                if (parsedUser && parsedUser.id && parsedUser.accessLevel !== undefined) {
                    setCurrentUser(parsedUser);
                } else {
                    // Wipe the junk data
                    localStorage.removeItem('openprix_session');
                }
            }
        } catch (e) {
            console.error("Session parse error, wiping local storage.");
            localStorage.removeItem('openprix_session');
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            let response;

            // 1. Desktop Environment (Electron)
            if (window.api && window.api.db && typeof window.api.db.verifyEmployeeLogin === 'function') {
                response = await window.api.db.verifyEmployeeLogin(username, password);
            }
            // 2. Web Browser Environment (Network Hosting)
            else {
                const res = await fetch('/api/rpc', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: 'db:verify-login',
                        args: [username, password]
                    })
                });
                const json = await res.json();
                response = json.data; // Express wraps the data payload
            }

            // Check if the response was successful
            if (response && response.success) {
                setCurrentUser(response.user);
                localStorage.setItem('openprix_session', JSON.stringify(response.user));
                return true;
            } else {
                console.warn("Login failed:", response?.error || "Unknown error");
                return false;
            }
        } catch (error) {
            console.error("Login Exception:", error);
            return false;
        }
    };

    const logout = () => {
        console.log("System Logout Triggered");
        localStorage.removeItem('openprix_session');
        setCurrentUser(null); // Instantly kicks user back to Login screen
    };

    // 🔥 THE NUMERICAL CLEARANCE ENGINE
    const hasClearance = (minimumLevel) => {
        if (!currentUser) return false;

        // Failsafe: Ensure SuperAdmin string maps to top-tier clearance
        if (currentUser.role === 'SuperAdmin') return true;

        const userLevel = Number(currentUser.accessLevel || 1);
        return userLevel >= minimumLevel;
    };

    return (
        <AuthContext.Provider value={{ currentUser, login, logout, hasClearance, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);