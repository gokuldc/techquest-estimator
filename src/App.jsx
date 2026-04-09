import React, { useState, useEffect } from 'react';
import { 
    ThemeProvider, createTheme, CssBaseline, Box, AppBar, Toolbar, 
    Typography, IconButton, Tooltip, Dialog, DialogContent, DialogActions, Button 
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import DatabaseEditor from './components/DatabaseEditor';
import Home from './components/Home';
import ProjectWorkspace from './components/ProjectWorkspace';
import About from './components/About'; // We will use this as the inner content
import ErrorBoundary from './components/ErrorBoundary';
import Directory from './components/Directory';

export default function App() {
    const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'dark');
    const [currentView, setCurrentView] = useState('home');
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [aboutOpen, setAboutOpen] = useState(false); // Popup state

    useEffect(() => {
        localStorage.setItem('themeMode', mode);
    }, [mode]);

    const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

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
            }
        }
    });

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
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

                    {/* TRIGGER ABOUT POPUP */}
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
                    {/* Reuse your existing About component logic here */}
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
        </ThemeProvider>
    );
}