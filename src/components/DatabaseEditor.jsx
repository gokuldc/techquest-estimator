import React, { useState, useEffect, useMemo } from "react";
import { 
    Box, Typography, Paper, IconButton, Tooltip,
    List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider 
} from "@mui/material";

// 🔥 Workspace Navigation Icons
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import SettingsBackupRestoreOutlinedIcon from '@mui/icons-material/SettingsBackupRestoreOutlined';

// Components
import ResourcesTab from "./database/ResourcesTab";
import CreateBoqTab from "./database/CreateBoqTab";
import ViewBoqTab from "./database/ViewBoqTab";
import BackupRestoreTab from "./database/BackupRestoreTab";

// Import the Auth Hook
import { useAuth } from "../context/AuthContext";

export default function DatabaseEditor() {
    const { hasClearance } = useAuth();

    // --- SIDEBAR STATE ---
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const SIDEBAR_CLOSED_WIDTH = 68;
    const SIDEBAR_OPEN_WIDTH = 260;

    const [tab, setTab] = useState("resources");

    const [regions, setRegions] = useState([]);
    const [resources, setResources] = useState([]);
    const [masterBoqs, setMasterBoqs] = useState([]);

    // Shared state to tell CreateBoqTab what to edit
    const [editingBoq, setEditingBoq] = useState(null);

    const loadData = async () => {
        try {
            const [reg, res, boqs] = await Promise.all([
                window.api.db.getRegions(),
                window.api.db.getResources(),
                window.api.db.getMasterBoqs()
            ]);

            const parseSafe = (str, fallback = []) => {
                if (!str) return fallback;
                if (typeof str !== 'string') return str;
                try { return JSON.parse(str); } catch { return fallback; }
            };

            const safeRes = (res || []).map(r => ({ ...r, rates: parseSafe(r.rates, {}), rateHistory: parseSafe(r.rateHistory, []) }));
            const safeMBoqs = (boqs || []).map(b => ({ ...b, components: parseSafe(b.components, []) }));

            setRegions(reg || []);
            setResources(safeRes);
            setMasterBoqs(safeMBoqs);
        } catch (error) {
            console.error("Failed to load SQLite data:", error);
        }
    };

    useEffect(() => { loadData(); }, []);

    const deleteMasterBoq = async (id) => {
        if (!hasClearance(3)) return alert("Access Denied: Level 3 Clearance required to delete Master Databook items.");
        if (window.confirm("Delete this Databook item?")) {
            await window.api.db.deleteMasterBoq(id);
            loadData();
        }
    };

    const handleEditBoq = (boq) => {
        if (!hasClearance(3)) return alert("Access Denied: Level 3 Clearance required to edit Master Databook items.");
        setEditingBoq(boq);
        setTab("createBoq");
    };

    const clearEdit = () => {
        setEditingBoq(null);
        setTab("viewBoq");
    };

    const handleTabChange = (newTab) => {
        if (newTab !== 'createBoq' && editingBoq) {
            setEditingBoq(null); // Clear editing state if navigating away
        }
        setTab(newTab);
        if (window.innerWidth < 900) setSidebarOpen(false);
    };

    // 🔥 SIDEBAR NAVIGATION ITEMS
    const NAV_ITEMS = useMemo(() => [
        { id: "resources", label: "LOCAL MARKET RATES", minClearance: 2, icon: <LocalAtmOutlinedIcon />, color: '#10b981' },
        { id: "viewBoq", label: "MASTER DATABOOK", minClearance: 2, icon: <MenuBookOutlinedIcon />, color: '#3b82f6' },
        { id: "createBoq", label: editingBoq ? "EDIT DATABOOK ITEM" : "DATABOOK BUILDER", minClearance: 3, icon: <BuildOutlinedIcon />, color: '#f59e0b' },
        { id: "backup", label: "BACKUP & RESTORE", minClearance: 5, icon: <SettingsBackupRestoreOutlinedIcon />, color: '#ef4444' }
    ], [editingBoq]);

    return (
        <Box sx={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
            
            {/* 🔥 OPTIMIZED INTERNAL DB SIDEBAR */}
            <Paper 
                elevation={0}
                sx={{ 
                    width: sidebarOpen ? SIDEBAR_OPEN_WIDTH : { xs: 0, md: SIDEBAR_CLOSED_WIDTH },
                    flexShrink: 0,
                    bgcolor: 'rgba(13, 31, 60, 0.5)',
                    borderRight: '1px solid', borderColor: 'divider',
                    transition: 'width 0.225s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflowX: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    position: { xs: 'fixed', md: 'relative' },
                    height: '100%',
                    zIndex: { xs: 1100, md: 1 },
                    left: 0, top: 0
                }}
            >
                <Box sx={{ p: 1, display: 'flex', justifyContent: sidebarOpen ? 'flex-end' : 'center', alignItems: 'center', height: 60 }}>
                    <IconButton onClick={() => setSidebarOpen(!sidebarOpen)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }}}>
                        {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
                    </IconButton>
                </Box>
                
                <Box sx={{ 
                    flexGrow: 1, 
                    overflowY: 'auto', 
                    overflowX: 'hidden', 
                    pb: 2,
                    scrollbarWidth: 'none', 
                    '&::-webkit-scrollbar': { display: 'none' } 
                }}>
                    <List sx={{ px: 1 }}>
                        <Typography variant="caption" sx={{ px: sidebarOpen ? 2 : 0, pt: 1, pb: 1, display: 'block', fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: 'text.secondary', letterSpacing: '1px', textAlign: sidebarOpen ? 'left' : 'center', opacity: sidebarOpen ? 0.6 : 0, transition: 'opacity 0.2s' }}>
                            {sidebarOpen ? "DATABASE CONFIG" : ""}
                        </Typography>

                        {NAV_ITEMS.map((item) => {
                            if (!hasClearance(item.minClearance)) return null;
                            const isSelected = tab === item.id;

                            return (
                                <Tooltip key={item.id} title={!sidebarOpen ? item.label : ""} placement="right" disableInteractive>
                                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                                        <ListItemButton 
                                            onClick={() => handleTabChange(item.id)} 
                                            selected={isSelected}
                                            sx={{ 
                                                borderRadius: 1.5, minHeight: 40, justifyContent: sidebarOpen ? 'initial' : 'center', px: 2.5,
                                                '&.Mui-selected': { bgcolor: `rgba(${parseInt(item.color.slice(1, 3), 16)}, ${parseInt(item.color.slice(3, 5), 16)}, ${parseInt(item.color.slice(5, 7), 16)}, 0.15)` },
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } 
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center', color: isSelected ? item.color : 'text.secondary' }}>
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary={item.label} 
                                                sx={{ opacity: sidebarOpen ? 1 : 0, transition: 'opacity 0.2s ease-in-out', m: 0 }}
                                                primaryTypographyProps={{ sx: { fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? item.color : 'text.primary', whiteSpace: 'nowrap' } }} 
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                </Tooltip>
                            );
                        })}
                    </List>
                </Box>
            </Paper>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <Box onClick={() => setSidebarOpen(false)} sx={{ display: { xs: 'block', md: 'none' }, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
            )}

            {/* 🔥 MAIN CONTENT AREA (Scrolls independently) */}
            <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overflowX: 'hidden', p: { xs: 2, md: 3 } }}>
                
                {/* HEADER */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', lg: 'center' }, mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider', gap: { xs: 2, lg: 0 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton onClick={() => setSidebarOpen(true)} sx={{ display: { xs: 'block', md: 'none' }, color: 'text.secondary' }}>
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '18px', md: '22px' } }}>
                            DATABASE_MANAGER
                        </Typography>
                    </Box>
                </Box>

                {/* DYNAMIC TAB CONTENT */}
                <Box sx={{ flexGrow: 1 }}>
                    {tab === "resources" && <ResourcesTab regions={regions} resources={resources} loadData={loadData} />}
                    {tab === "viewBoq" && <ViewBoqTab masterBoqs={masterBoqs} regions={regions} resources={resources} onEditBoq={handleEditBoq} deleteMasterBoq={deleteMasterBoq} loadData={loadData} />}
                    
                    {/* Security Blocks */}
                    {hasClearance(3) && tab === "createBoq" && <CreateBoqTab regions={regions} resources={resources} masterBoqs={masterBoqs} loadData={loadData} editingBoq={editingBoq} clearEdit={clearEdit} />}
                    {hasClearance(5) && tab === "backup" && <BackupRestoreTab loadData={loadData} />}
                </Box>
            </Box>

        </Box>
    );
}