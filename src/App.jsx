import React, { useState, useEffect } from 'react';
import {
    ThemeProvider, createTheme, CssBaseline, Box, AppBar, Toolbar,
    Typography, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Drawer,
    Badge, TextField, Paper, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Grid
} from '@mui/material';

// Icons
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ChatIcon from '@mui/icons-material/Chat';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial'; // Used for Archive
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'; // 🔥 New Icon for Project Creation
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import StorageIcon from '@mui/icons-material/Storage';
import RouterIcon from '@mui/icons-material/Router';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuBookIcon from '@mui/icons-material/MenuBook';

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
import ProjectArchive from './components/ProjectArchive';
import DailyLogs from './components/DailyLogs';
import ServerManager from './components/ServerManager';
import CompanySettings from './components/CompanySettings';

// GATEKEEPER
function Gatekeeper({ children }) {
    const { currentUser } = useAuth();
    if (!currentUser || !currentUser.role) return <Login />;
    return children;
}

// NOTIFICATION BADGE
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
            } catch (err) { }
        };
        checkUnreadMessages();
        const interval = setInterval(checkUnreadMessages, 15000); // Throttled to 15 seconds
        return () => clearInterval(interval);
    }, [currentUser, chatOpen]);

    return (
        <Tooltip title="Global CommLink">
            <IconButton onClick={onOpen} sx={{ color: 'text.secondary', mr: 1, '&:hover': { color: 'info.main' } }}>
                <Badge badgeContent={unreadCount} color="error" overlap="circular"><ChatIcon /></Badge>
            </IconButton>
        </Tooltip>
    );
}

export default function App() {
    const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'dark');
    const [currentView, setCurrentView] = useState('home');
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [aboutOpen, setAboutOpen] = useState(false);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileData, setProfileData] = useState({});

    const [globalChatOpen, setGlobalChatOpen] = useState(false);
    const [orgStaff, setOrgStaff] = useState([]);
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [syncUrl, setSyncUrl] = useState("");

    const toggleTheme = () => setMode((prev) => {
        const newMode = prev === 'light' ? 'dark' : 'light';
        localStorage.setItem('themeMode', newMode);
        return newMode;
    });

    useEffect(() => {
        window.api?.db?.getOrgStaff().then(data => setOrgStaff(data || []));
    }, [currentView]);

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
                        backgroundColor: mode === 'dark' ? 'rgba(6, 14, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(8px)',
                        borderBottom: `1px solid ${mode === 'dark' ? '#1e3a5f' : '#cbd5e1'}`,
                    }
                }
            },
            MuiCssBaseline: {
                styleOverrides: {
                    html: { scrollbarWidth: "thin", scrollbarColor: mode === 'dark' ? "#3b82f6 rgba(0,0,0,0.3)" : "#1e40af rgba(0,0,0,0.1)" },
                    body: { margin: 0 },
                    "*::-webkit-scrollbar": { width: "10px", height: "10px" },
                    "*::-webkit-scrollbar-track": { background: mode === 'dark' ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.05)" },
                    "*::-webkit-scrollbar-thumb": { background: mode === 'dark' ? "linear-gradient(180deg, #3b82f6, #22d3ee)" : "linear-gradient(180deg, #1e40af, #3b82f6)", borderRadius: "8px" },
                    "*::-webkit-scrollbar-thumb:hover": { background: mode === 'dark' ? "linear-gradient(180deg, #2563eb, #06b6d4)" : "linear-gradient(180deg, #1d4ed8, #2563eb)" }
                }
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        fontFamily: "'JetBrains Mono', monospace",
                        textTransform: 'none',
                        fontWeight: 600,
                        padding: '8px 16px',
                    },
                    contained: {
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: '0px 4px 12px rgba(59, 130, 246, 0.4)',
                        }
                    }
                }
            },
            MuiTextField: {
                defaultProps: {
                    variant: 'outlined',
                    size: 'small',
                }
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        fontFamily: "'Inter', sans-serif",
                    }
                }
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        borderRadius: 12,
                    }
                }
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        backgroundColor: mode === 'dark' ? '#0d1f3c' : '#ffffff',
                        border: `1px solid ${mode === 'dark' ? '#1e3a5f' : '#cbd5e1'}`,
                        backgroundImage: 'none',
                    }
                }
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: {
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 'bold',
                        letterSpacing: '1px',
                    }
                }
            }
        }
    });

    const generateSecureId = () => {
        if (window.crypto && window.crypto.randomUUID) try { return window.crypto.randomUUID(); } catch (e) { }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
        });
    };

    return (
        <SettingsProvider>
            <AuthProvider>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <Gatekeeper>
                        <AppContent
                            mode={mode} theme={theme} toggleTheme={toggleTheme}
                            currentView={currentView} setCurrentView={setCurrentView}
                            activeProjectId={activeProjectId} setActiveProjectId={setActiveProjectId}
                            aboutOpen={aboutOpen} setAboutOpen={setAboutOpen}
                            sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
                            globalChatOpen={globalChatOpen} setGlobalChatOpen={setGlobalChatOpen}
                            orgStaff={orgStaff}
                            syncModalOpen={syncModalOpen} setSyncModalOpen={setSyncModalOpen}
                            syncUrl={syncUrl} setSyncUrl={setSyncUrl} handleSaveSyncUrl={handleSaveSyncUrl}
                            isProfileOpen={isProfileOpen} setIsProfileOpen={setIsProfileOpen}
                            profileData={profileData} setProfileData={setProfileData}
                            generateSecureId={generateSecureId}
                        />
                    </Gatekeeper>
                </ThemeProvider>
            </AuthProvider>
        </SettingsProvider>
    );
}

function AppContent({
    mode, theme, toggleTheme, currentView, setCurrentView, activeProjectId, setActiveProjectId,
    aboutOpen, setAboutOpen, sidebarOpen, setSidebarOpen, globalChatOpen, setGlobalChatOpen,
    orgStaff, syncModalOpen, setSyncModalOpen, syncUrl, setSyncUrl, handleSaveSyncUrl,
    isProfileOpen, setIsProfileOpen, profileData, setProfileData, generateSecureId
}) {
    const { currentUser, logout, hasClearance } = useAuth();

    const handleOpenGlobalChat = () => {
        setGlobalChatOpen(true);
        setSidebarOpen(false);
    };

    const handleCreateProject = async () => {
        const newProject = {
            name: "New Project", code: "", clientName: "", region: "", status: "Draft",
            assignedStaff: JSON.stringify([currentUser?.id]), createdAt: Date.now()
        };
        const createdId = await window.api.db.addProject(newProject);
        if (createdId && createdId.success !== false) {
            setActiveProjectId(createdId);
            setCurrentView('workspace');
        } else {
            alert("Failed to create project: " + (createdId?.error || "Unknown error"));
        }
    };

    const handleOpenProfile = () => {
        const freshUserData = orgStaff.find(s => s.id === currentUser.id) || currentUser;
        setProfileData(freshUserData);
        setIsProfileOpen(true);
    };

    const handleSaveProfile = async () => {
        if (!profileData.name || !profileData.username || !profileData.password) return alert("Fields cannot be empty.");
        const payload = { ...profileData, username: profileData.username.trim().toLowerCase().replace(/\s+/g, ''), accessLevel: currentUser.accessLevel, role: currentUser.role };
        await window.api.db.saveOrgStaff(payload);
        alert("Profile updated securely! You will be logged out to apply changes.");
        logout();
    };

    const navItems = [
        { label: 'Home Dashboard', icon: <HomeIcon />, action: () => setCurrentView('home'), clearance: 1, color: 'text.primary' },
        { label: 'New Project', icon: <CreateNewFolderIcon />, action: handleCreateProject, clearance: 3, color: 'primary.main' }, // 🔥 Visual fix
        { label: 'Project Archive', icon: <FolderSpecialIcon />, action: () => setCurrentView('archive'), clearance: 1, color: 'info.main' },
        { label: 'Directory', icon: <AutoStoriesIcon />, action: () => setCurrentView('directory'), clearance: 3, color: 'success.main' },
        { label: 'Database Editor', icon: <StorageIcon />, action: () => setCurrentView('database'), clearance: 2, color: 'secondary.main' },
        { label: 'Organization Logs', icon: <MenuBookIcon />, action: () => setCurrentView('logs'), clearance: 1, color: 'warning.main' },
        { label: 'Network Host', icon: <RouterIcon />, action: () => setCurrentView('servermanager'), clearance: 5, color: 'info.main' },
        { label: 'System Settings', icon: <SettingsIcon />, action: () => setCurrentView('settings'), clearance: 5, color: 'text.secondary' }
    ];

    const userItems = [
        { label: 'My Profile', icon: <AccountCircleIcon />, action: handleOpenProfile, clearance: 1, color: 'text.primary' },
        { label: 'Secure Logout', icon: <LogoutIcon />, action: logout, clearance: 1, color: 'error.main' }
    ];

    const SIDEBAR_CLOSED_WIDTH = 68;
    const SIDEBAR_OPEN_WIDTH = 260;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <AppBar position="relative" elevation={0} sx={{ zIndex: 1300, flexShrink: 0 }}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={() => { setSidebarOpen(!sidebarOpen); setGlobalChatOpen(false); }} sx={{ mr: 2 }}><MenuIcon /></IconButton>
                    <Typography variant="h6" onClick={() => setCurrentView('home')} sx={{ flexGrow: 1, fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", color: 'primary.main', cursor: 'pointer', letterSpacing: '1px' }}>{'// '}OPENPRIX</Typography>
                    <GlobalChatButton chatOpen={globalChatOpen} onOpen={handleOpenGlobalChat} />
                    <Tooltip title="System Info"><IconButton onClick={() => setAboutOpen(true)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}><InfoOutlinedIcon /></IconButton></Tooltip>
                    <IconButton onClick={toggleTheme} sx={{ ml: 1, color: 'text.secondary' }}>{theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}</IconButton>
                </Toolbar>
            </AppBar>

            <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
                <Paper elevation={0} sx={{
                    width: sidebarOpen ? SIDEBAR_OPEN_WIDTH : { xs: 0, sm: SIDEBAR_CLOSED_WIDTH },
                    flexShrink: 0, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider',
                    transition: 'width 0.225s cubic-bezier(0.4, 0, 0.2, 1)', overflowX: 'hidden', display: 'flex', flexDirection: 'column',
                    position: { xs: 'absolute', sm: 'relative' }, height: '100%', zIndex: 1200, left: 0, top: 0
                }}>
                    <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', pt: 2 }}>
                        <List sx={{ px: 1 }}>
                            {navItems.map((item, idx) => {
                                if (!hasClearance(item.clearance)) return null;
                                return (
                                    <Tooltip key={idx} title={!sidebarOpen ? item.label : ""} placement="right" disableInteractive>
                                        <ListItem disablePadding sx={{ mb: 1 }}>
                                            <ListItemButton onClick={() => { item.action(); if (window.innerWidth < 900) setSidebarOpen(false); }} sx={{ borderRadius: 2, minHeight: 48, justifyContent: sidebarOpen ? 'initial' : 'center', px: 2.5, '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' } }}>
                                                <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center', color: item.color }}>{item.icon}</ListItemIcon>
                                                <ListItemText primary={item.label} sx={{ opacity: sidebarOpen ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }} primaryTypographyProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold', color: item.color, whiteSpace: 'nowrap' } }} />
                                            </ListItemButton>
                                        </ListItem>
                                    </Tooltip>
                                );
                            })}
                        </List>
                    </Box>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                    <Box sx={{ py: 2 }}>
                        <List sx={{ px: 1 }}>
                            {userItems.map((item, idx) => (
                                <Tooltip key={idx} title={!sidebarOpen ? item.label : ""} placement="right" disableInteractive>
                                    <ListItem disablePadding sx={{ mb: 1 }}>
                                        <ListItemButton onClick={item.action} sx={{ borderRadius: 2, minHeight: 48, justifyContent: sidebarOpen ? 'initial' : 'center', px: 2.5, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}>
                                            <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center', color: item.color }}>{item.icon}</ListItemIcon>
                                            <ListItemText primary={item.label} sx={{ opacity: sidebarOpen ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }} primaryTypographyProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold', color: item.color, whiteSpace: 'nowrap' } }} />
                                        </ListItemButton>
                                    </ListItem>
                                </Tooltip>
                            ))}
                        </List>
                    </Box>
                </Paper>

                {sidebarOpen && <Box onClick={() => setSidebarOpen(false)} sx={{ display: { xs: 'block', sm: 'none' }, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1100 }} />}

                <Box sx={{ flexGrow: 1, minWidth: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <ErrorBoundary>
                        {currentView === 'home' && <Home onOpenProject={(id) => { setActiveProjectId(id); setCurrentView('workspace'); }} />}
                        {currentView === 'archive' && <ProjectArchive onOpenProject={(id) => { setActiveProjectId(id); setCurrentView('workspace'); }} />}
                        {currentView === 'database' && <DatabaseEditor />}
                        {currentView === 'workspace' && <ProjectWorkspace projectId={activeProjectId} onBack={() => setCurrentView('home')} />}
                        {currentView === 'directory' && <Directory />}
                        {currentView === 'logs' && <DailyLogs />}
                        {currentView === 'servermanager' && <ServerManager />}
                        {currentView === 'settings' && <CompanySettings />}
                    </ErrorBoundary>
                </Box>
            </Box>

            <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#0b172d', border: '1px solid', borderColor: 'divider', borderRadius: 2 } }}>
                <DialogContent><About isPopup={true} /></DialogContent>
                <DialogActions sx={{ p: 3 }}><Button variant="outlined" onClick={() => setAboutOpen(false)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CLOSE_TERMINAL</Button></DialogActions>
            </Dialog>

            <Dialog open={syncModalOpen} onClose={() => setSyncModalOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider' } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}><CloudSyncIcon /> CLOUD_SYNC_TARGET</DialogTitle>
                <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', mb: 3 }}>Configure the remote endpoint for background synchronization.</Typography>
                    <TextField fullWidth label="SERVER ENDPOINT URL" value={syncUrl} onChange={e => setSyncUrl(e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} />
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.2)' }}>
                    <Button onClick={() => setSyncModalOpen(false)} sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button onClick={handleSaveSyncUrl} variant="contained" color="primary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>ACTIVATE SYNC</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={isProfileOpen} onClose={() => setIsProfileOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>EDIT_IDENTITY_PROFILE</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', pt: 3 }}>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}><TextField fullWidth label="FULL NAME" value={profileData.name || ""} onChange={e => setProfileData({ ...profileData, name: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        <Grid item xs={12} md={6}><TextField fullWidth label="EMAIL ADDRESS" value={profileData.email || ""} onChange={e => setProfileData({ ...profileData, email: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        <Grid item xs={12} md={6}><TextField fullWidth label="PHONE NUMBER" value={profileData.phone || ""} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        <Grid item xs={12} md={6}><TextField fullWidth label="LOGIN USERNAME" value={profileData.username || ""} onChange={e => setProfileData({ ...profileData, username: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        <Grid item xs={12} md={6}><TextField fullWidth label="PASSWORD / PIN" type="text" value={profileData.password || ""} onChange={e => setProfileData({ ...profileData, password: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        <Grid item xs={12} md={6}><TextField fullWidth label="SYSTEM CLEARANCE LEVEL" value={`LEVEL ${currentUser?.accessLevel || 1} [${currentUser?.role || 'Staff'}]`} disabled InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} helperText="Clearance locked. Contact L5 Root." /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsProfileOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={handleSaveProfile} sx={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: 50, px: 3 }}>SAVE_IDENTITY</Button>
                </DialogActions>
            </Dialog>

            <Drawer anchor="right" open={globalChatOpen} onClose={() => setGlobalChatOpen(false)} sx={{ zIndex: 1400 }} PaperProps={{ sx: { top: { xs: 56, sm: 64 }, height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' } } }}>
                <Box sx={{ width: { xs: '100vw', sm: 400 }, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: mode === 'dark' ? '#0d1f3c' : '#ffffff', overflow: 'hidden' }}>
                    <ChatModule projectId={null} orgStaff={orgStaff} onClose={() => setGlobalChatOpen(false)} />
                </Box>
            </Drawer>
        </Box>
    );
}