import { useRef, useState, useEffect, useMemo } from "react";
import {
    Box, Typography, Button, Paper,
    Grid, IconButton, Divider, Container, Pagination,
    TextField, InputAdornment, Avatar, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";

// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import HandymanIcon from '@mui/icons-material/Handyman';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import BadgeIcon from '@mui/icons-material/Badge';
import EngineeringIcon from '@mui/icons-material/Engineering';
import GroupsIcon from '@mui/icons-material/Groups';
import SearchIcon from '@mui/icons-material/Search';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import RouterIcon from '@mui/icons-material/Router';

// Components
import CompanySettingsDialog from "./CompanySettingsDialog";

// Import Auth and Settings Hooks
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

export default function Home({ onOpenProject, onOpenDb, onOpenDirectory, onOpenWorkLog, onOpenServerManager }) {
    const fileInputRef = useRef(null);

    const { currentUser, logout, hasClearance } = useAuth();
    const { settings } = useSettings();

    // --- DIALOG & BRANDING STATE ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [importData, setImportData] = useState(null);
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    // BRANDING STATE
    const [brandName, setBrandName] = useState("");
    const [brandLogo, setBrandLogo] = useState("");

    // PROFILE MODAL STATE
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileData, setProfileData] = useState({});

    // --- SQLITE DATA STATE ---
    const [projects, setProjects] = useState([]);
    const [resources, setResources] = useState([]);
    const [masterBoqs, setMasterBoqs] = useState([]);
    const [regions, setRegions] = useState([]);
    const [crmContacts, setCrmContacts] = useState([]);
    const [orgStaff, setOrgStaff] = useState([]);

    const loadData = async () => {
        try {
            const [projData, resData, boqData, regData, contactData, staffData] = await Promise.all([
                window.api.db.getProjects(),
                window.api.db.getResources(),
                window.api.db.getMasterBoqs(),
                window.api.db.getRegions(),
                window.api.db.getCrmContacts(),
                window.api.db.getOrgStaff()
            ]);

            const sortedProjects = (projData || []).sort((a, b) => b.createdAt - a.createdAt);

            setProjects(sortedProjects);
            setResources(resData || []);
            setMasterBoqs(boqData || []);
            setRegions(regData || []);
            setCrmContacts(contactData || []);
            setOrgStaff(staffData || []);
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        }
    };

    const loadBranding = async () => {
        let fetchedName = "";
        let fetchedLogo = "";

        try {
            if (window.api.db.getSettings) {
                const dbSettings = await window.api.db.getSettings('company_info');
                if (dbSettings) {
                    fetchedName = dbSettings.name || "";
                    fetchedLogo = dbSettings.logo || "";
                }
            }
        } catch (e) {
            console.warn("Could not fetch branding from DB directly", e);
        }

        if (!fetchedName && settings?.name) fetchedName = settings.name;
        if (!fetchedLogo && settings?.logo) fetchedLogo = settings.logo;

        setBrandName(fetchedName);
        setBrandLogo(fetchedLogo);
    };

    useEffect(() => {
        loadData();
        loadBranding();
    }, [settings]);

    // --- SEARCH & PAGINATION STATE ---
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const itemsPerPage = 6;

    // MASTER VISIBILITY FILTER
    const visibleProjects = useMemo(() => {
        if (!projects) return [];
        if (hasClearance(4)) return projects;

        return projects.filter(p => {
            try {
                const assigned = JSON.parse(p.assignedStaff || '[]');
                return assigned.includes(currentUser?.id);
            } catch (e) {
                return false;
            }
        });
    }, [projects, currentUser, hasClearance]);

    // METRICS
    const stats = useMemo(() => {
        let active = 0, completed = 0, draft = 0;
        visibleProjects.forEach(p => {
            if (p.status === 'In Progress' || p.status === 'Active') active++;
            else if (p.status === 'Completed') completed++;
            else draft++;
        });

        const suppliers = crmContacts.filter(c => {
            const type = (c.type || "").toLowerCase();
            return type === 'subcontractor' || type === 'supplier' || type === 'vendor';
        }).length;

        const clients = crmContacts.filter(c => {
            const type = (c.type || "").toLowerCase();
            return type === 'client' || type === 'lead';
        }).length;

        return {
            activeCount: active,
            completedCount: completed,
            draftCount: draft,
            totalStaff: orgStaff.length,
            totalExternal: crmContacts.length,
            totalSuppliers: suppliers,
            totalClients: clients
        };
    }, [visibleProjects, crmContacts, orgStaff]);

    // SEARCH FILTER
    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return visibleProjects;

        const query = searchQuery.toLowerCase();
        return visibleProjects.filter(p =>
            (p.name && p.name.toLowerCase().includes(query)) ||
            (p.code && p.code.toLowerCase().includes(query)) ||
            (p.clientName && p.clientName.toLowerCase().includes(query)) ||
            (p.region && p.region.toLowerCase().includes(query))
        );
    }, [visibleProjects, searchQuery]);

    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

    useEffect(() => {
        if (page > totalPages && totalPages > 0) setPage(totalPages);
    }, [filteredProjects.length, page, totalPages]);

    const paginatedProjects = filteredProjects.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // 🔥 Bulletproof ID Generator for both Desktop and Web HTTP environments
    const generateSecureId = () => {
        if (window.crypto && window.crypto.randomUUID) {
            try {
                return window.crypto.randomUUID();
            } catch (e) { } // Fallback if browser restricts it
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const createProject = async () => {
        const newProject = {
            id: generateSecureId(),
            name: "New Project",
            code: "",
            clientName: "",
            region: "",
            status: "Draft",
            assignedStaff: JSON.stringify([currentUser?.id]),
            createdAt: Date.now()
        };
        await window.api.db.addProject(newProject);
        loadData();
        onOpenProject(newProject.id);
    };

    const deleteProject = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("CRITICAL WARNING: Are you sure you want to delete this project? This will erase all BOQs and logs.")) {
            await window.api.db.deleteProject(id);
            loadData();
        }
    };

    const handleExport = async () => {
        const res = await window.api.db.exportAllProjectsSqlite();
        if (res.success) alert("Full project archive exported successfully.");
    };

    const handlePurge = async () => {
        if (window.confirm("CRITICAL: This will permanently delete ALL projects. Proceed?")) {
            await window.api.db.purgeProjects();
            loadData();
        }
    };

    const handleFileSelect = async () => {
        const res = await window.api.db.selectArchiveFile();
        if (res.success) {
            setImportData({ projects: res.projects, filePath: res.filePath });
            setImportDialogOpen(true);
        }
    };

    const processImport = async (mode) => {
        const res = await window.api.db.importProjectsSqlite(importData.filePath, mode);
        if (res.success) {
            alert(`Archive imported successfully (${mode}).`);
            loadData();
            setImportDialogOpen(false);
        }
    };

    // PROFILE EVENT HANDLERS
    const handleOpenProfile = () => {
        const freshUserData = orgStaff.find(s => s.id === currentUser.id) || currentUser;
        setProfileData(freshUserData);
        setIsProfileOpen(true);
    };

    const handleSaveProfile = async () => {
        if (!profileData.name || !profileData.username || !profileData.password) {
            return alert("Name, Username, and Password cannot be empty.");
        }

        const payload = {
            ...profileData,
            username: profileData.username.trim().toLowerCase().replace(/\s+/g, ''),
            accessLevel: currentUser.accessLevel,
            role: currentUser.role
        };

        await window.api.db.saveOrgStaff(payload);
        alert("Profile updated securely! You will be logged out to apply changes to your session.");
        logout();
    };

    const MetricCard = ({ title, value, subtitle, icon, color }) => (
        <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Avatar sx={{ bgcolor: `rgba(${color === 'success' ? '16, 185, 129' : color === 'info' ? '59, 130, 246' : color === 'warning' ? '245, 158, 11' : '139, 92, 246'}, 0.1)`, color: `${color}.main`, width: 42, height: 42 }}>
                {icon}
            </Avatar>
            <Box>
                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', letterSpacing: '1px', display: 'block', textTransform: 'uppercase', mt: 0.5 }}>{title}</Typography>
                {subtitle && <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', opacity: 0.7 }}>{subtitle}</Typography>}
            </Box>
        </Paper>
    );

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
            {/* --- NEXUS HEADER (RESPONSIVE) --- */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', md: 'center' },
                gap: { xs: 3, md: 0 },
                mb: 4, pb: 4,
                borderBottom: '1px solid', borderColor: 'divider'
            }}>
                <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-start' } }}>
                        {brandLogo ? (
                            <Box
                                component="img"
                                src={brandLogo}
                                alt={brandName || "Company Logo"}
                                sx={{ height: 45, maxWidth: 300, objectFit: 'contain' }}
                            />
                        ) : (
                            <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                                {brandName ? brandName.toUpperCase() : "// OPENPRIX_NEXUS"}
                            </Typography>
                        )}
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1 }}>
                        <span style={{ color: '#10b981' }}>●</span> Logged in as: <strong>{currentUser?.name}</strong> [L{currentUser?.accessLevel || 1}]
                    </Typography>
                </Box>

                <Box display="flex" gap={1.5} flexWrap="wrap" justifyContent={{ xs: 'center', md: 'flex-end' }}>
                    {hasClearance(5) && (
                        <Button
                            onClick={() => setIsSettingsOpen(true)}
                            variant="outlined"
                            color="inherit"
                            startIcon={<BusinessIcon sx={{ fontSize: 16 }} />}
                            sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px', borderColor: 'divider' }}
                        >
                            SETTINGS
                        </Button>
                    )}
                    {hasClearance(5) && (
                        <Button
                            onClick={onOpenServerManager}
                            variant="outlined"
                            color="info"
                            startIcon={<RouterIcon sx={{ fontSize: 16 }} />}
                            sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}
                        >
                            HOST_NETWORK
                        </Button>
                    )}
                    {hasClearance(2) && (
                        <Button onClick={onOpenDb} variant="outlined" color="secondary" sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}>DATABASE</Button>
                    )}
                    {hasClearance(3) && (
                        <Button onClick={onOpenDirectory} variant="outlined" color="success" sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}>DIRECTORY</Button>
                    )}
                    {hasClearance(3) && (
                        <Button onClick={createProject} variant="contained" color="primary" disableElevation sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}>+ NEW_WORKSPACE</Button>
                    )}
                    <Divider orientation="vertical" flexItem sx={{ mx: 1, display: { xs: 'none', sm: 'block' } }} />

                    <Button
                        onClick={handleOpenProfile}
                        variant="outlined"
                        color="primary"
                        startIcon={<AccountCircleIcon sx={{ fontSize: 16 }} />}
                        sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}
                    >
                        MY_PROFILE
                    </Button>

                    <Button
                        onClick={logout}
                        variant="outlined"
                        color="error"
                        startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
                        sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}
                    >
                        LOGOUT
                    </Button>
                </Box>
            </Box>

            {/* --- PRODUCTION STATS (RESPONSIVE GRIDS) --- */}
            <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, display: 'block', opacity: 0.5, letterSpacing: '2px' }}>CORE_PRODUCTION</Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}><MetricCard title="Total_Projects" value={visibleProjects.length} subtitle={`${stats.activeCount} Active`} icon={<FolderSpecialIcon />} color="info" /></Grid>
                <Grid item xs={12} sm={6} md={3}><MetricCard title="Databook_Items" value={masterBoqs.length} subtitle=" Assemblies" icon={<AutoStoriesIcon />} color="success" /></Grid>
                <Grid item xs={12} sm={6} md={3}><MetricCard title="Resource_Library" value={resources.length} subtitle="Materials & Labor" icon={<HandymanIcon />} color="warning" /></Grid>
                <Grid item xs={12} sm={6} md={3}><MetricCard title="Region_Markets" value={regions.length} subtitle="Active Prices" icon={<BusinessIcon />} color="secondary" /></Grid>
            </Grid>

            {/* --- HUMAN RESOURCES (RESPONSIVE GRIDS) --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", opacity: 0.5, letterSpacing: '2px' }}>HUMAN_RESOURCES</Typography>

                <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    onClick={onOpenWorkLog}
                    sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', borderRadius: 50, px: 3 }}
                >
                    VIEW DAILY WORK LOGS
                </Button>
            </Box>

            <Grid container spacing={2} sx={{ mb: 6 }}>
                <Grid item xs={12} sm={6} md={3}><MetricCard title="Internal_Staff" value={stats.totalStaff} subtitle="Firm Members" icon={<BadgeIcon />} color="secondary" /></Grid>
                <Grid item xs={12} sm={6} md={3}><MetricCard title="External_Contacts" value={stats.totalExternal} subtitle="Total Network" icon={<PeopleAltIcon />} color="info" /></Grid>
                <Grid item xs={12} sm={6} md={3}><MetricCard title="Supply_Chain" value={stats.totalSuppliers} subtitle="Subs & Vendors" icon={<EngineeringIcon />} color="warning" /></Grid>
                <Grid item xs={12} sm={6} md={3}><MetricCard title="Client_Base" value={stats.totalClients} subtitle="Active Leads" icon={<GroupsIcon />} color="success" /></Grid>
            </Grid>

            {/* --- ARCHIVE SECTION (RESPONSIVE ALIGNMENT) --- */}
            <Box sx={{
                mb: 3,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: 'space-between',
                gap: 2
            }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>PROJECT_ARCHIVE</Typography>
                    <TextField size="small" placeholder="Filter..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', borderRadius: 2, height: 32, bgcolor: 'rgba(0,0,0,0.2)', width: { xs: '100%', sm: 200 } } }} />
                </Box>
                <Box display="flex" gap={1} justifyContent={{ xs: 'space-between', sm: 'flex-start' }}>
                    {hasClearance(4) && (
                        <>
                            <Button size="small" variant="outlined" color="info" startIcon={<DownloadIcon />} onClick={handleExport} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>EXPORT</Button>
                            <Button size="small" variant="outlined" color="success" startIcon={<UploadIcon />} onClick={handleFileSelect} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>IMPORT</Button>
                        </>
                    )}
                    {hasClearance(5) && (
                        <Button size="small" variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={handlePurge} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>PURGE</Button>
                    )}
                </Box>
            </Box>

            <Grid container spacing={3}>
                {paginatedProjects.map(p => (
                    <Grid item xs={12} sm={6} lg={4} key={p.id}>
                        <Paper elevation={0} sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'rgba(13, 31, 60, 0.5)', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                <Box>
                                    <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 'bold' }}>{p.name}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.code || "NO_CODE"}</Typography>
                                </Box>
                                <Chip label={p.status || 'Draft'} size="small" variant="outlined" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', height: 18 }} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                <Box>
                                    {hasClearance(4) && (
                                        <IconButton color="error" onClick={(e) => deleteProject(p.id, e)} size="small"><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
                                    )}
                                </Box>
                                <Button variant="contained" disableElevation onClick={() => onOpenProject(p.id)} endIcon={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', height: 28 }}>ACCESS</Button>
                            </Box>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={4}>
                    <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)} size="small" color="primary" sx={{ '& .MuiPaginationItem-root': { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />
                </Box>
            )}

            <CompanySettingsDialog open={isSettingsOpen} onClose={() => { setIsSettingsOpen(false); loadBranding(); }} />

            {/* USER PROFILE MODAL */}
            <Dialog open={isProfileOpen} onClose={() => setIsProfileOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>EDIT_IDENTITY_PROFILE</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', pt: 3 }}>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="FULL NAME" value={profileData.name || ""} onChange={e => setProfileData({ ...profileData, name: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="EMAIL ADDRESS" value={profileData.email || ""} onChange={e => setProfileData({ ...profileData, email: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="PHONE NUMBER" value={profileData.phone || ""} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="LOGIN USERNAME" value={profileData.username || ""} onChange={e => setProfileData({ ...profileData, username: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="PASSWORD / PIN" type="text" value={profileData.password || ""} onChange={e => setProfileData({ ...profileData, password: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="SYSTEM CLEARANCE LEVEL"
                                value={`LEVEL ${currentUser?.accessLevel || 1} [${currentUser?.role || 'Staff'}]`}
                                disabled
                                InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                helperText="Clearance locked. Contact L5 Root."
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsProfileOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={handleSaveProfile} sx={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: 50, px: 3 }}>SAVE_IDENTITY</Button>
                </DialogActions>
            </Dialog>

            {/* IMPORT RESOLUTION DIALOG */}
            <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider', minWidth: '400px' } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '14px' }}>DATABASE IMPORT RESOLUTION</DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 3, color: '#ccc', fontSize: '12px' }}>How would you like to process the imported projects?</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button variant="outlined" color="info" onClick={() => processImport('append')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', py: 1.5, fontSize: '12px' }}>[APPEND] Add as new entries</Button>
                        <Button variant="outlined" color="warning" onClick={() => processImport('merge')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', py: 1.5, fontSize: '12px' }}>[MERGE] Update matching IDs</Button>
                        <Button variant="outlined" color="error" onClick={() => processImport('replace')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', py: 1.5, fontSize: '12px' }}>[REPLACE] Delete current, use imported</Button>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setImportDialogOpen(false)} sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '12px' }}>CANCEL</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}