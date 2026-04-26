import React, { useState, useEffect } from 'react';
import {
    ThemeProvider, createTheme, CssBaseline, Box, AppBar, Toolbar,
    Typography, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Drawer,
    Badge, TextField
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ChatIcon from '@mui/icons-material/Chat';
import CloudSyncIcon from '@mui/icons-material/CloudSync';

import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import DatabaseEditor from './components/DatabaseEditor';
import Home from './components/Home';
import ProjectWorkspace from './components/ProjectWorkspace';
import About from './components/About';
import ErrorBoundary from './components/ErrorBoundary';
import Directory from './components/Directory';
import ChatModule from './components/workspace/ChatModule';
import { SettingsProvider } from './context/SettingsContext';
import StaffWorkLog from './components/StaffWorkLog';
import ServerManager from './components/ServerManager';

// GATEKEEPER
function Gatekeeper({ children }) {
    const { currentUser } = useAuth();

    if (!currentUser || !currentUser.role) return <Login />;
    return children;
}

// ISOLATED NOTIFICATION BADGE COMPONENT
function GlobalChatButton({ chatOpen, onOpen }) {
    const { currentUser } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!currentUser) return;

        const checkUnreadMessages = async () => {
            if (chatOpen) {
                localStorage.setItem(`last_chat_check_${currentUser.id}`, Date.now().toString());
                setUnreadCount(0);
                return;
            }

            try {
                const lastChecked = parseInt(localStorage.getItem(`last_chat_check_${currentUser.id}`) || '0');
                const count = await window.api.db.checkNotifications(currentUser.id, lastChecked);
                setUnreadCount(count);
            } catch (err) {
                console.warn("Notification polling failed", err);
            }
        };

        checkUnreadMessages();
        const interval = setInterval(checkUnreadMessages, 3000);
        return () => clearInterval(interval);
    }, [currentUser, chatOpen]);

    return (
        <Tooltip title="Global CommLink">
            <IconButton
                onClick={onOpen}
                sx={{ color: 'text.secondary', mr: 1, '&:hover': { color: 'info.main' } }}
            >
                <Badge badgeContent={unreadCount} color="error" overlap="circular">
                    <ChatIcon />
                </Badge>
            </IconButton>
        </Tooltip>
    );
}

export default function App() {
    const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'dark');
    const [currentView, setCurrentView] = useState('home');
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [aboutOpen, setAboutOpen] = useState(false);

    // GLOBAL CHAT STATE
    const [globalChatOpen, setGlobalChatOpen] = useState(false);
    const [orgStaff, setOrgStaff] = useState([]);

    // SYNC SERVER STATE
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [syncUrl, setSyncUrl] = useState("");

    useEffect(() => {
        localStorage.setItem('themeMode', mode);
    }, [mode]);

    const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

    const handleOpenGlobalChat = async () => {
        try {
            const staff = await window.api.db.getOrgStaff();
            setOrgStaff(staff || []);
            setGlobalChatOpen(true);
        } catch (error) {
            console.error("Failed to load staff for chat:", error);
        }
    };

    // LISTEN FOR TRAY ICON CLICKS TO OPEN SYNC MODAL
    useEffect(() => {
        if (window.api && window.api.onOpenSyncSettings) {
            window.api.onOpenSyncSettings(() => {
                window.api.db.getSettings('sync_server_url').then(data => {
                    if (data) setSyncUrl(data.value || "");
                });
                setSyncModalOpen(true);
            });
        }
    }, []);

    const handleSaveSyncUrl = async () => {
        await window.api.db.saveSettings('sync_server_url', { value: syncUrl });
        setSyncModalOpen(false);
        alert("Sync Server Address saved! Background sync is now active.");
    };

    const theme = createTheme({
        palette: {
            mode: mode,
            primary: { main: mode === 'dark' ? '#3b82f6' : '#1e40af' },
            secondary: { main: '#22d3ee' },
            background: { default: mode === 'dark' ? '#0a1628' : '#f0f4f8', paper: mode === 'dark' ? '#0d1f3c' : '#ffffff' },
            divider: mode === 'dark' ? '#1e3a5f' : '#cbd5e1',
        },
        typography: { fontFamily: "'Inter', sans-serif" },

        components: {
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        // Ensure the background is completely opaque so scrolling content doesn't bleed through
                        backgroundColor: mode === 'dark' ? 'rgba(6, 14, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(8px)', // Adds a nice modern frosted glass effect
                        borderBottom: `1px solid ${mode === 'dark' ? '#1e3a5f' : '#cbd5e1'}`,
                    }
                }
            },
            MuiCssBaseline: {
                styleOverrides: {
                    html: {
                        scrollbarWidth: "thin",
                        scrollbarColor: mode === 'dark' ? "#3b82f6 rgba(0,0,0,0.3)" : "#1e40af rgba(0,0,0,0.1)",
                    },
                    body: { margin: 0 },
                    "*::-webkit-scrollbar": { width: "10px", height: "10px" },
                    "*::-webkit-scrollbar-track": {
                        background: mode === 'dark' ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.05)",
                    },
                    "*::-webkit-scrollbar-thumb": {
                        background: mode === 'dark' ? "linear-gradient(180deg, #3b82f6, #22d3ee)" : "linear-gradient(180deg, #1e40af, #3b82f6)",
                        borderRadius: "8px",
                    },
                    "*::-webkit-scrollbar-thumb:hover": {
                        background: mode === 'dark' ? "linear-gradient(180deg, #2563eb, #06b6d4)" : "linear-gradient(180deg, #1d4ed8, #2563eb)",
                    },
                    MuiTableContainer: {
                        styleOverrides: {
                            root: {
                                scrollbarWidth: "thin",
                                scrollbarColor: mode === 'dark' ? "#3b82f6 rgba(0,0,0,0.3)" : "#1e40af rgba(0,0,0,0.1)",
                                "&::-webkit-scrollbar": { width: "10px", height: "10px" },
                                "&::-webkit-scrollbar-track": {
                                    background: mode === 'dark' ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.05)",
                                },
                                "&::-webkit-scrollbar-thumb": {
                                    background: mode === 'dark' ? "linear-gradient(180deg, #3b82f6, #22d3ee)" : "linear-gradient(180deg, #1e40af, #3b82f6)",
                                    borderRadius: "8px",
                                },
                                "&::-webkit-scrollbar-thumb:hover": {
                                    background: mode === 'dark' ? "linear-gradient(180deg, #2563eb, #06b6d4)" : "linear-gradient(180deg, #1d4ed8, #2563eb)",
                                },
                            }
                        }
                    }
                }
            }
        }
    });

    return (
        <SettingsProvider>
            <AuthProvider>
                <ThemeProvider theme={theme}>
                    <CssBaseline />

                    <Gatekeeper>
                        {/* 🔥 FIX: Changed position to sticky, added zIndex, locked top to 0 */}
                        <AppBar position="sticky" elevation={0} sx={{ top: 0, zIndex: 1100 }}>
                            <Toolbar>
                                <Typography
                                    variant="h6"
                                    onClick={() => setCurrentView('home')}
                                    sx={{
                                        flexGrow: 1,
                                        fontWeight: 'bold',
                                        fontFamily: "'JetBrains Mono', monospace",
                                        color: 'primary.main',
                                        cursor: 'pointer',
                                        letterSpacing: '1px',
                                    }}
                                >
                                    {'// '}OPENPRIX
                                </Typography>

                                <GlobalChatButton chatOpen={globalChatOpen} onOpen={handleOpenGlobalChat} />

                                <Tooltip title="System Info">
                                    <IconButton
                                        onClick={() => setAboutOpen(true)}
                                        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                    >
                                        <InfoOutlinedIcon />
                                    </IconButton>
                                </Tooltip>

                                <IconButton onClick={toggleTheme} sx={{ ml: 1, color: 'text.secondary' }}>
                                    {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                                </IconButton>
                            </Toolbar>
                        </AppBar>

                        <Box sx={{ width: '100%', minHeight: 'calc(100vh - 64px)' }}>
                            <ErrorBoundary>
                                {currentView === 'home' && (
                                    <Home
                                        onOpenDb={() => setCurrentView('database')}
                                        onOpenProject={(id) => { setActiveProjectId(id); setCurrentView('workspace'); }}
                                        onOpenDirectory={() => setCurrentView('directory')}
                                        onOpenWorkLog={() => setCurrentView('worklogs')}
                                        onOpenServerManager={() => setCurrentView('servermanager')} 
                                    />
                                )}
                                {currentView === 'database' && <DatabaseEditor onBack={() => setCurrentView('home')} />}
                                {currentView === 'workspace' && <ProjectWorkspace projectId={activeProjectId} onBack={() => setCurrentView('home')} />}
                                {currentView === 'directory' && <Directory onBack={() => setCurrentView('home')} />}
                                {currentView === 'worklogs' && <StaffWorkLog onBack={() => setCurrentView('home')} />}
                                {currentView === 'servermanager' && <ServerManager onBack={() => setCurrentView('home')} />}
                            </ErrorBoundary>
                        </Box>

                        <Dialog
                            open={aboutOpen}
                            onClose={() => setAboutOpen(false)}
                            maxWidth="md"
                            fullWidth
                            PaperProps={{
                                sx: { bgcolor: '#0b172d', border: '1px solid', borderColor: 'divider', borderRadius: 2 }
                            }}
                        >
                            <DialogContent>
                                <About isPopup={true} />
                            </DialogContent>
                            <DialogActions sx={{ p: 3 }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => setAboutOpen(false)}
                                    sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}
                                >
                                    CLOSE_TERMINAL
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* SYNC SERVER MODAL */}
                        <Dialog open={syncModalOpen} onClose={() => setSyncModalOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider' } }}>
                            <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CloudSyncIcon /> CLOUD_SYNC_TARGET
                            </DialogTitle>
                            <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                                <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', mb: 3 }}>
                                    Configure the remote endpoint for background synchronization.
                                    The app will securely push the SQLite database file to this URL periodically while running in the system tray.
                                </Typography>
                                <TextField
                                    fullWidth
                                    label="SERVER ENDPOINT URL"
                                    placeholder="https://api.yourcompany.com/sync"
                                    value={syncUrl}
                                    onChange={e => setSyncUrl(e.target.value)}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}
                                />
                            </DialogContent>
                            <DialogActions sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.2)' }}>
                                <Button onClick={() => setSyncModalOpen(false)} sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                                <Button onClick={handleSaveSyncUrl} variant="contained" color="primary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>ACTIVATE SYNC</Button>
                            </DialogActions>
                        </Dialog>

                        <Drawer anchor="right" open={globalChatOpen} onClose={() => setGlobalChatOpen(false)}>
                            <Box sx={{
                                width: { xs: '100vw', sm: 400 },
                                height: '100vh',
                                display: 'flex',
                                flexDirection: 'column',
                                bgcolor: mode === 'dark' ? '#0d1f3c' : '#ffffff',
                                overflow: 'hidden'
                            }}>
                                <ChatModule
                                    projectId={null}
                                    orgStaff={orgStaff}
                                    onClose={() => setGlobalChatOpen(false)}
                                />
                            </Box>
                        </Drawer>

                    </Gatekeeper>

                </ThemeProvider>
            </AuthProvider>
        </SettingsProvider>
    );
}