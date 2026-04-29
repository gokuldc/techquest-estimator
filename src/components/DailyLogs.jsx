import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, IconButton, List, ListItem,
    ListItemButton, ListItemIcon, ListItemText, Tooltip, alpha, useTheme
} from '@mui/material';

// Icons
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ChecklistRtlOutlinedIcon from '@mui/icons-material/ChecklistRtlOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';

import { useAuth } from '../context/AuthContext';
import WorkLogModule from './operations/WorkLogModule';
import TasksModule from './operations/TasksModule';
import ChannelsModule from './operations/ChannelsModule';

export default function DailyLogs() {
    const theme = useTheme();
    const { currentUser, hasClearance } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeModule, setActiveModule] = useState("logs");

    const [logs, setLogs] = useState([]);
    const [staff, setStaff] = useState([]);
    const [projects, setProjects] = useState([]);

    const loadData = async () => {
        try {
            const [logData, staffData, projData] = await Promise.all([
                window.api.db.getWorkLogs(),
                window.api.db.getOrgStaff(),
                window.api.db.getProjects()
            ]);
            setLogs(logData || []);
            setStaff(staffData || []);
            setProjects(projData || []);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { loadData(); }, []);

    const NAV_ITEMS = [
        { id: "logs", label: "DAILY WORK LOGS", icon: <AssignmentOutlinedIcon />, color: '#f59e0b' },
        { id: "tasks", label: "TEAM TASKS", icon: <ChecklistRtlOutlinedIcon />, color: '#3b82f6', disabled: false },
        { id: "channels", label: "CHANNELS", icon: <ForumOutlinedIcon />, color: '#10b981', disabled: false },
    ];

    // Responsive widths
    const SIDEBAR_WIDTH = sidebarOpen ? 260 : { xs: 0, md: 68 };

    // 🔥 DYNAMIC TITLE HANDLER
    const getModuleTitle = () => {
        switch (activeModule) {
            case 'logs': return 'OPERATIONS_LOGS';
            case 'tasks': return 'TEAM_TASKS';
            case 'channels': return 'SYSTEM_CHANNELS';
            default: return 'LOCKED_MODULE';
        }
    };

    return (
        <Box sx={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}>

            {/* MOBILE OVERLAY BACKDROP */}
            {sidebarOpen && (
                <Box
                    onClick={() => setSidebarOpen(false)}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1200
                    }}
                />
            )}

            {/* SIDEBAR */}
            <Paper elevation={0} sx={{
                width: SIDEBAR_WIDTH,
                flexShrink: 0,
                bgcolor: 'rgba(13, 31, 60, 0.95)',
                borderRight: '1px solid', borderColor: 'divider',
                transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                position: { xs: 'fixed', md: 'relative' },
                height: '100%',
                zIndex: 1300,
                left: 0, top: 0,
                visibility: { xs: sidebarOpen ? 'visible' : 'hidden', md: 'visible' }
            }}>
                <Box sx={{ p: 1, display: 'flex', justifyContent: sidebarOpen ? 'flex-end' : 'center', alignItems: 'center', height: 60 }}>
                    <IconButton onClick={() => setSidebarOpen(!sidebarOpen)} size="small">
                        {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
                    </IconButton>
                </Box>

                <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                    <List sx={{ px: 1 }}>
                        {NAV_ITEMS.map((item) => (
                            <Tooltip key={item.id} title={!sidebarOpen ? item.label : ""} placement="right" arrow>
                                <ListItem disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton
                                        disabled={item.disabled}
                                        onClick={() => { setActiveModule(item.id); if (window.innerWidth < 900) setSidebarOpen(false); }}
                                        selected={activeModule === item.id}
                                        sx={{
                                            minHeight: 44, height: 44, borderRadius: 1.5,
                                            justifyContent: sidebarOpen ? 'initial' : 'center', px: 2,
                                            '&.Mui-selected': { bgcolor: alpha(item.color, 0.12) }
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', color: activeModule === item.id ? item.color : 'text.secondary' }}>{item.icon}</ListItemIcon>
                                        {sidebarOpen && (
                                            <ListItemText primary={item.label} primaryTypographyProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' } }} />
                                        )}
                                    </ListItemButton>
                                </ListItem>
                            </Tooltip>
                        ))}
                    </List>
                </Box>
            </Paper>

            {/* MAIN CONTENT AREA */}
            <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', p: { xs: 2, md: 4 } }}>

                {/* HEADER WITH MOBILE MENU BUTTON */}
                <Box display="flex" alignItems="center" gap={2} mb={4} pb={2} borderBottom="1px solid" borderColor="divider">
                    <IconButton
                        onClick={() => setSidebarOpen(true)}
                        sx={{ display: { xs: 'flex', md: 'none' }, color: 'text.secondary' }}
                    >
                        <MenuIcon />
                    </IconButton>

                    {/* 🔥 DYNAMIC TITLE INJECTED HERE */}
                    <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        {getModuleTitle()}
                    </Typography>
                </Box>

                {activeModule === 'logs' ? (
                    <WorkLogModule
                        logs={logs} staff={staff} projects={projects}
                        currentUser={currentUser} hasClearance={hasClearance} loadData={loadData}
                    />
                ) : activeModule === 'channels' ? (
                    <ChannelsModule
                        currentUser={currentUser} staff={staff} projects={projects}
                    />
                ) : activeModule === 'tasks' ? (
                    <TasksModule
                        currentUser={currentUser} staff={staff} projects={projects}
                        loadData={loadData}
                    />
                ) : (
                    <Typography sx={{ textAlign: 'center', py: 10, opacity: 0.5 }}>[LOCKED_MODULE]</Typography>
                )}
            </Box>
        </Box>
    );
}