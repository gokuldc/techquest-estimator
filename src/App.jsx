import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

import DatabaseEditor from './components/DatabaseEditor';
import Home from './components/Home';
import ProjectWorkspace from './components/ProjectWorkspace';
import About from './components/About';
import ErrorBoundary from './components/ErrorBoundary';
import CrmDashboard from './components/CrmDashboard'; // <-- IMPORT ADDED HERE

export default function App() {
    const [mode, setMode] = useState(() => {
        return localStorage.getItem('themeMode') || 'dark';
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
            primary: {
                main: mode === 'dark' ? '#3b82f6' : '#1e40af',
                light: '#60a5fa',
                dark: '#1d4ed8',
                contrastText: '#ffffff',
            },
            secondary: {
                main: '#22d3ee',
                light: '#67e8f9',
                dark: '#0891b2',
                contrastText: '#0a1628',
            },
            success: {
                main: '#10b981',
                light: '#34d399',
                dark: '#059669',
            },
            warning: {
                main: '#f59e0b',
                light: '#fbbf24',
                dark: '#d97706',
            },
            error: {
                main: '#ef4444',
                light: '#f87171',
                dark: '#dc2626',
            },
            background: {
                default: mode === 'dark' ? '#0a1628' : '#f0f4f8',
                paper: mode === 'dark' ? '#0d1f3c' : '#ffffff',
            },
            text: {
                primary: mode === 'dark' ? '#e2e8f0' : '#1e293b',
                secondary: mode === 'dark' ? '#94a3b8' : '#64748b',
                disabled: mode === 'dark' ? '#475569' : '#94a3b8',
            },
            divider: mode === 'dark' ? '#1e3a5f' : '#cbd5e1',
        },
        typography: {
            fontFamily: "'Inter', system-ui, 'Segoe UI', Roboto, sans-serif",
            h1: { fontWeight: 700, letterSpacing: '-0.5px' },
            h2: { fontWeight: 600, letterSpacing: '-0.3px' },
            h3: { fontWeight: 600 },
            h4: { fontWeight: 600 },
            h5: { fontWeight: 600 },
            h6: { fontWeight: 600 },
            subtitle1: { letterSpacing: '1.5px' },
            body2: { lineHeight: 1.7 },
        },
        shape: {
            borderRadius: 8,
        },
        components: {
            // INJECT RAW CSS TO HIT THE MAIN ROOT SCROLLBAR
            MuiCssBaseline: {
                styleOverrides: `
                    /* Firefox Support */
                    * {
                        scrollbar-width: thin;
                        scrollbar-color: rgba(59, 130, 246, 0.4) transparent;
                    }

                    /* Chrome, Edge, and Electron Main Window */
                    ::-webkit-scrollbar {
                        width: 10px;
                        height: 10px;
                    }
                    ::-webkit-scrollbar-track {
                        background: rgba(13, 31, 60, 0.2);
                        border-radius: 4px;
                    }
                    ::-webkit-scrollbar-thumb {
                        background-color: rgba(59, 130, 246, 0.4);
                        border-radius: 10px;
                        /* The border color MUST match your background default color to create the floating pill effect */
                        border: 2px solid ${mode === 'dark' ? '#0a1628' : '#f0f4f8'}; 
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(59, 130, 246, 0.8);
                    }
                    ::-webkit-scrollbar-corner {
                        background: transparent;
                    }
                `,
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        borderBottom: mode === 'dark' ? '1px solid #1e3a5f' : '1px solid #cbd5e1',
                        backgroundColor: mode === 'dark' ? '#060e1a' : '#ffffff',
                        backdropFilter: 'blur(12px)',
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        boxShadow: mode === 'dark'
                            ? '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(59, 130, 246, 0.1)'
                            : '0 4px 24px rgba(0, 0, 0, 0.08)',
                    },
                    outlined: {
                        borderColor: mode === 'dark' ? '#1e3a5f' : '#cbd5e1',
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                        letterSpacing: '0.3px',
                    },
                    contained: {
                        boxShadow: mode === 'dark'
                            ? '0 2px 12px rgba(59, 130, 246, 0.3)'
                            : '0 2px 8px rgba(0, 0, 0, 0.1)',
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    head: {
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                        minHeight: 48,
                    },
                },
            },
            MuiTextField: {
                defaultProps: {
                    variant: 'outlined',
                },
                styleOverrides: {
                    root: {
                        '& .MuiInputLabel-root': {
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '11px',
                        },
                        '& .MuiOutlinedInput-input': {
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '13px',
                        },
                        '& .MuiOutlinedInput-input::placeholder': {
                            color: 'inherit',
                            opacity: 0.6,
                            textAlign: 'left',
                        },
                    },
                },
            },
            MuiSelect: {
                styleOverrides: {
                    root: {
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '13px',
                        textAlign: 'left',
                    },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px',
                        textAlign: 'left',
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: mode === 'dark' ? '#3b82f6' : '#1e40af',
                        },
                    },
                },
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

            <AppBar position="static" color="transparent" elevation={0}>
                <Toolbar>
                    <Typography
                        variant="h6"
                        component="div"
                        sx={{
                            flexGrow: 1,
                            fontWeight: 'bold',
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            color: theme.palette.primary.main,
                            letterSpacing: '1px',
                        }}
                    >
                        {'// '}OPENPRIX
                    </Typography>
                    <IconButton
                        sx={{
                            ml: 1,
                            color: theme.palette.text.secondary,
                            '&:hover': { color: theme.palette.primary.main },
                        }}
                        onClick={toggleTheme}
                        color="inherit"
                        title="Toggle Dark/Light Mode"
                    >
                        {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Box sx={{ width: '100%', minHeight: 'calc(100vh - 64px)' }}>
                <ErrorBoundary>
                    {currentView === 'home' && (
                        <Home
                            onOpenDb={() => setCurrentView('database')}
                            onOpenProject={handleOpenWorkspace}
                            onOpenAbout={() => setCurrentView('about')}
                            onOpenCrm={() => setCurrentView('crm')} // <-- ROUTING PROP ADDED HERE
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

                    {currentView === 'about' && (
                        <About onBack={() => setCurrentView('home')} />
                    )}

                    {/* <-- NEW CRM ROUTE ADDED HERE --> */}
                    {currentView === 'crm' && (
                        <CrmDashboard onBack={() => setCurrentView('home')} />
                    )}
                </ErrorBoundary>
            </Box>
        </ThemeProvider>
    );
}