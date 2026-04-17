import React, { useState, useEffect } from 'react';
import {
    ThemeProvider, createTheme, CssBaseline, Box, AppBar, Toolbar,
    Typography, IconButton, Tooltip, Dialog, DialogContent, DialogActions, Button, Drawer
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ChatIcon from '@mui/icons-material/Chat'; // 🔥 New Icon for Global Chat

import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import DatabaseEditor from './components/DatabaseEditor';
import Home from './components/Home';
import ProjectWorkspace from './components/ProjectWorkspace';
import About from './components/About';
import ErrorBoundary from './components/ErrorBoundary';
import Directory from './components/Directory';
import ChatModule from './components/workspace/ChatModule'; // 🔥 Import Chat Module
import { SettingsProvider } from './context/SettingsContext';

// 🔥 THE GATEKEEPER
function Gatekeeper({ children }) {
    const { currentUser } = useAuth();

    // If no user is logged in (or if the user data is corrupted), show the login screen
    if (!currentUser || !currentUser.role) return <Login />;

    // If logged in safely, show the rest of the app
    return children;
}

export default function App() {
    const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'dark');
    const [currentView, setCurrentView] = useState('home');
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [aboutOpen, setAboutOpen] = useState(false);

    // 🔥 GLOBAL CHAT STATE
    const [globalChatOpen, setGlobalChatOpen] = useState(false);
    const [orgStaff, setOrgStaff] = useState([]);

    useEffect(() => {
        localStorage.setItem('themeMode', mode);
    }, [mode]);

    const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

    // Fetch staff right as the drawer opens to ensure we have the names for the chat bubbles
    const handleOpenGlobalChat = async () => {
        try {
            const staff = await window.api.db.getOrgStaff();
            setOrgStaff(staff || []);
            setGlobalChatOpen(true);
        } catch (error) {
            console.error("Failed to load staff for chat:", error);
        }
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
                        backgroundColor: mode === 'dark' ? '#060e1a' : '#ffffff',
                        borderBottom: `1px solid ${mode === 'dark' ? '#1e3a5f' : '#cbd5e1'}`,
                    }
                }
            },
            MuiCssBaseline: {
                styleOverrides: {
                    html: {
                        scrollbarWidth: "thin",
                        scrollbarColor: mode === 'dark'
                            ? "#3b82f6 rgba(0,0,0,0.3)"
                            : "#1e40af rgba(0,0,0,0.1)",
                    },
                    body: {
                        margin: 0,
                    },
                    "*::-webkit-scrollbar": {
                        width: "10px",
                        height: "10px",
                    },
                    "*::-webkit-scrollbar-track": {
                        background: mode === 'dark'
                            ? "rgba(0,0,0,0.25)"
                            : "rgba(0,0,0,0.05)",
                    },
                    "*::-webkit-scrollbar-thumb": {
                        background: mode === 'dark'
                            ? "linear-gradient(180deg, #3b82f6, #22d3ee)"
                            : "linear-gradient(180deg, #1e40af, #3b82f6)",
                        borderRadius: "8px",
                    },
                    "*::-webkit-scrollbar-thumb:hover": {
                        background: mode === 'dark'
                            ? "linear-gradient(180deg, #2563eb, #06b6d4)"
                            : "linear-gradient(180deg, #1d4ed8, #2563eb)",
                    },
                    MuiTableContainer: {
                        styleOverrides: {
                            root: {
                                scrollbarWidth: "thin",
                                scrollbarColor: mode === 'dark'
                                    ? "#3b82f6 rgba(0,0,0,0.3)"
                                    : "#1e40af rgba(0,0,0,0.1)",

                                "&::-webkit-scrollbar": {
                                    width: "10px",
                                    height: "10px",
                                },
                                "&::-webkit-scrollbar-track": {
                                    background: mode === 'dark'
                                        ? "rgba(0,0,0,0.25)"
                                        : "rgba(0,0,0,0.05)",
                                },
                                "&::-webkit-scrollbar-thumb": {
                                    background: mode === 'dark'
                                        ? "linear-gradient(180deg, #3b82f6, #22d3ee)"
                                        : "linear-gradient(180deg, #1e40af, #3b82f6)",
                                    borderRadius: "8px",
                                },
                                "&::-webkit-scrollbar-thumb:hover": {
                                    background: mode === 'dark'
                                        ? "linear-gradient(180deg, #2563eb, #06b6d4)"
                                        : "linear-gradient(180deg, #1d4ed8, #2563eb)",
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

                    {/* 🔥 THE FIX: EVERYTHING IS NOW INSIDE THE GATEKEEPER 🔥 */}
                    <Gatekeeper>
                        <AppBar position="static" color="transparent" elevation={0}>
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

                                {/* 🔥 GLOBAL CHAT BUTTON */}
                                <Tooltip title="Global CommLink">
                                    <IconButton
                                        onClick={handleOpenGlobalChat}
                                        sx={{ color: 'text.secondary', mr: 1, '&:hover': { color: 'info.main' } }}
                                    >
                                        <ChatIcon />
                                    </IconButton>
                                </Tooltip>

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
                                    />
                                )}
                                {currentView === 'database' && <DatabaseEditor onBack={() => setCurrentView('home')} />}
                                {currentView === 'workspace' && <ProjectWorkspace projectId={activeProjectId} onBack={() => setCurrentView('home')} />}
                                {currentView === 'directory' && <Directory onBack={() => setCurrentView('home')} />}
                            </ErrorBoundary>
                        </Box>

                        {/* --- ABOUT SYSTEM POPUP --- */}
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

                        {/* 🔥 GLOBAL CHAT DRAWER (Overlays the entire app) */}
                        <Drawer anchor="right" open={globalChatOpen} onClose={() => setGlobalChatOpen(false)}>
                            <Box sx={{ width: { xs: '100vw', sm: 400 }, height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: mode === 'dark' ? '#0d1f3c' : '#ffffff' }}>
                                <ChatModule projectId={null} orgStaff={orgStaff} />
                            </Box>
                        </Drawer>

                    </Gatekeeper>
                    {/* 🔥 END OF GATEKEEPER 🔥 */}

                </ThemeProvider>
            </AuthProvider>
        </SettingsProvider>
    );
}