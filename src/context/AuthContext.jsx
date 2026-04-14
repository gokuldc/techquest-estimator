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

                // 🔥 THE FIX: Validate it's an actual user with an access level
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
            const user = await window.api.db.verifyEmployeeLogin(username, password);
            if (user) {
                setCurrentUser(user);
                localStorage.setItem('openprix_session', JSON.stringify(user));
                return true;
            }
            return false;
        } catch (error) {
            console.error("Login Error:", error);
            return false;
        }
    };

    const logout = () => {
        console.log("System Logout Triggered");
        localStorage.removeItem('openprix_session');
        setCurrentUser(null); // This instantly kicks the user back to the Login screen
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