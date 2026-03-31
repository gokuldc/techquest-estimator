import { useState, useMemo } from "react";
import { ThemeProvider, createTheme, CssBaseline, IconButton, Box } from "@mui/material";
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

// Components
import Home from "./components/Home";
import DatabaseEditor from "./components/DatabaseEditor";
import ProjectWorkspace from "./components/ProjectWorkspace";
import About from "./components/About";

export default function App() {
    const [view, setView] = useState("home"); 
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [mode, setMode] = useState("light");

    // Premium Architectural Theme
    const theme = useMemo(() => createTheme({
        palette: {
            mode: mode,
            primary: { 
                main: mode === 'light' ? '#0F172A' : '#60A5FA', // Deep Slate / Tech Blue
            },
            secondary: { 
                main: '#F59E0B', // Construction Amber
            },
            background: {
                default: mode === 'light' ? '#F8FAFC' : '#0B0F19',
                paper: mode === 'light' ? '#FFFFFF' : '#111827',
            },
            divider: mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
        },
        typography: { 
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            h3: { fontWeight: 800, letterSpacing: '-0.03em' },
            h5: { fontWeight: 700, letterSpacing: '-0.01em' },
            button: { textTransform: 'none', fontWeight: 600 }
        },
        shape: { borderRadius: 12 },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: { padding: '10px 24px', boxShadow: 'none' },
                    contained: { '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } }
                }
            },
            MuiCard: {
                styleOverrides: {
                    root: { backgroundImage: 'none' } // Removes default MUI dark mode gradient
                }
            }
        }
    }), [mode]);

    const toggleDarkMode = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

    const openProject = (id) => {
        setActiveProjectId(id);
        setView("project");
    };

    let currentView;
    if (view === "about") currentView = <About onBack={() => setView("home")} />;
    else if (view === "db") currentView = <DatabaseEditor onBack={() => setView("home")} />;
    else if (view === "project" && activeProjectId) currentView = <ProjectWorkspace projectId={activeProjectId} onBack={() => setView("home")} />;
    else currentView = <Home onOpenProject={openProject} onOpenDb={() => setView("db")} onOpenAbout={() => setView("about")} />;

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {currentView}

            <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
                <IconButton
                    onClick={toggleDarkMode}
                    sx={{
                        backgroundColor: 'background.paper',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.3s',
                        '&:hover': { transform: 'translateY(-2px)', backgroundColor: 'action.hover' }
                    }}
                >
                    {mode === 'dark' ? <LightModeIcon color="warning" /> : <DarkModeIcon color="primary" />}
                </IconButton>
            </Box>
        </ThemeProvider>
    );
}