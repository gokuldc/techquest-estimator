import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// Import all your main components
import DatabaseEditor from './components/DatabaseEditor';
import Home from './components/Home';
import ProjectWorkspace from './components/ProjectWorkspace';
import About from './components/About'; // <-- UNCOMMENTED THIS

export default function App() {
    const [mode, setMode] = useState(() => {
        return localStorage.getItem('themeMode') || 'light';
    });

    useEffect(() => {
        localStorage.setItem('themeMode', mode);
    }, [mode]);

    const toggleTheme = () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
    };

    const theme = createTheme({
        palette: {
            mode: mode,
            primary: { main: mode === 'light' ? '#0a192f' : '#90caf9' },
            secondary: { main: '#ffc107' },
            background: {
                default: mode === 'light' ? '#f5f5f5' : '#121212',
                paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
            },
        },
    });

    const [currentView, setCurrentView] = useState('home');
    const [activeProjectId, setActiveProjectId] = useState(null);

    const handleOpenWorkspace = (projectId) => {
        setActiveProjectId(projectId);
        setCurrentView('workspace');
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />

            <AppBar position="static" color="primary" elevation={1}>
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                        🏗️ TechQuest Estimator
                    </Typography>
                    <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit" title="Toggle Dark/Light Mode">
                        {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Box sx={{ width: '100%', minHeight: 'calc(100vh - 64px)' }}>

                {currentView === 'home' && (
                    <Home
                        onOpenDb={() => setCurrentView('database')}
                        onOpenProject={handleOpenWorkspace}
                        onOpenAbout={() => setCurrentView('about')}
                    />
                )}

                {currentView === 'database' && (
                    <DatabaseEditor onBack={() => setCurrentView('home')} />
                )}

                {currentView === 'workspace' && (
                    <ProjectWorkspace
                        projectId={activeProjectId}
                        onBack={() => setCurrentView('home')}
                    />
                )}

                {/* <-- UNCOMMENTED THIS SECTION --> */}
                {currentView === 'about' && (
                    <About onBack={() => setCurrentView('home')} />
                )}

            </Box>
        </ThemeProvider>
    );
}