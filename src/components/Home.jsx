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

export default function Home({ onOpenProject, onOpenDb, onOpenDirectory }) {
    const fileInputRef = useRef(null);

    // --- ARCHIVE STATE ---
    const [importData, setImportData] = useState(null);
    const [importDialogOpen, setImportDialogOpen] = useState(false);

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

            // Sort projects latest first
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

    useEffect(() => {
        loadData();
    }, []);

    // --- SEARCH & PAGINATION STATE ---
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const itemsPerPage = 6;

    // --- DASHBOARD METRICS ---
    const stats = useMemo(() => {
        let active = 0, completed = 0, draft = 0;
        projects.forEach(p => {
            if (p.status === 'In Progress') active++;
            else if (p.status === 'Completed') completed++;
            else draft++;
        });

        const suppliers = crmContacts.filter(c => {
            const type = (c.type || "").toLowerCase();
            return type === 'subcontractor' || type === 'supplier';
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
    }, [projects, crmContacts, orgStaff]);

    // --- FILTER & PAGINATION LOGIC ---
    const filteredProjects = useMemo(() => {
        if (!projects) return [];
        if (!searchQuery.trim()) return projects;

        const query = searchQuery.toLowerCase();
        return projects.filter(p =>
            (p.name && p.name.toLowerCase().includes(query)) ||
            (p.code && p.code.toLowerCase().includes(query)) ||
            (p.clientName && p.clientName.toLowerCase().includes(query)) ||
            (p.region && p.region.toLowerCase().includes(query))
        );
    }, [projects, searchQuery]);

    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

    useEffect(() => {
        if (page > totalPages && totalPages > 0) setPage(totalPages);
    }, [filteredProjects.length, page, totalPages]);

    const paginatedProjects = filteredProjects.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // --- SQLITE ACTIONS ---
    const createProject = async () => {
        const newProject = {
            id: crypto.randomUUID(),
            name: "New Project",
            code: "",
            clientName: "",
            region: "",
            status: "Draft",
            createdAt: Date.now()
        };
        await window.api.db.addProject(newProject);
        loadData();
        onOpenProject(newProject.id);
    };

    const deleteProject = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("CRITICAL WARNING: Are you sure you want to delete this project?")) {
            await window.api.db.deleteProject(id);
            loadData();
        }
    };

    // --- IMPORT / EXPORT / PURGE LOGIC ---
    const handleExport = async () => {
        try {
            const res = await window.api.db.exportAllProjectsSqlite();
            if (res.success) { alert("Project archive exported successfully!"); }
            else if (!res.canceled) { alert("Export failed: " + res.error); }
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export project archive.");
        }
    };

    const handlePurge = async () => {
        if (window.confirm("CRITICAL WARNING: Are you sure you want to permanently delete ALL projects? This cannot be undone.")) {
            try {
                await window.api.db.purgeProjects();
                loadData();
                alert("Project archive has been purged successfully.");
            } catch (error) {
                console.error("Purge failed:", error);
                alert("Failed to purge project archive.");
            }
        }
    };

    const handleFileSelect = async () => {
        try {
            const res = await window.api.db.selectArchiveFile();
            if (res.success) {
                setImportData({ projects: res.projects, filePath: res.filePath });
                setImportDialogOpen(true);
            } else if (!res.canceled) {
                alert("Failed to open archive file: " + res.error);
            }
        } catch (error) {
            console.error("File selection failed:", error);
            alert("Failed to select archive file.");
        }
    };

    const processImport = async (mode) => {
        if (!importData || !importData.filePath) return;
        try {
            const res = await window.api.db.importProjectsSqlite(importData.filePath, mode);
            if (res.success) { alert(`Project archive successfully imported (${mode.toUpperCase()} mode). ${res.count || 0} projects.`); loadData(); }
            else { alert("Import failed: " + res.error); }
        } catch (error) {
            console.error("Import transaction failed:", error);
            alert("Failed to import project archive.");
        } finally {
            setImportDialogOpen(false);
            setImportData(null);
        }
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
        <Container maxWidth="lg" sx={{ py: 6 }}>
            {/* --- NEXUS HEADER --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 4, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        {'// '}OPENPRIX_NEXUS
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1 }}>
                        System Status: Operational. All modules linked.
                    </Typography>
                </Box>
                <Box display="flex" gap={1.5} flexWrap="wrap">
                    <Button onClick={onOpenDb} variant="outlined" color="secondary" sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}>DATABASE</Button>
                    <Button onClick={onOpenDirectory} variant="outlined" color="success" sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}>DIRECTORY</Button>
                    <Button onClick={createProject} variant="contained" color="primary" disableElevation sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3, height: '36px' }}>+ NEW_WORKSPACE</Button>
                </Box>
            </Box>

            {/* --- PRODUCTION STATS --- */}
            <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, display: 'block', opacity: 0.5, letterSpacing: '2px' }}>CORE_PRODUCTION</Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={6} md={3}><MetricCard title="Total_Projects" value={projects.length} subtitle={`${stats.activeCount} Active`} icon={<FolderSpecialIcon />} color="info" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="Databook_Items" value={masterBoqs.length} subtitle=" Assemblies" icon={<AutoStoriesIcon />} color="success" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="Resource_Library" value={resources.length} subtitle="Materials & Labor" icon={<HandymanIcon />} color="warning" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="Region_Markets" value={regions.length} subtitle="Active Prices" icon={<BusinessIcon />} color="secondary" /></Grid>
            </Grid>

            {/* --- DIRECTORY STATS --- */}
            <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, display: 'block', opacity: 0.5, letterSpacing: '2px' }}>HUMAN_RESOURCES</Typography>
            <Grid container spacing={2} sx={{ mb: 6 }}>
                <Grid item xs={6} md={3}><MetricCard title="Internal_Staff" value={stats.totalStaff} subtitle="Firm Members" icon={<BadgeIcon />} color="secondary" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="External_Contacts" value={stats.totalExternal} subtitle="Total Network" icon={<PeopleAltIcon />} color="info" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="Supply_Chain" value={stats.totalSuppliers} subtitle="Subs & Vendors" icon={<EngineeringIcon />} color="warning" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="Client_Base" value={stats.totalClients} subtitle="Active Leads" icon={<GroupsIcon />} color="success" /></Grid>
            </Grid>

            {/* --- ARCHIVE SECTION --- */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>PROJECT_ARCHIVE</Typography>
                    <TextField size="small" placeholder="Filter..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', borderRadius: 2, height: 32, bgcolor: 'rgba(0,0,0,0.2)', width: 200 } }} />
                </Box>
                <Box display="flex" gap={1}>
                    <Button size="small" variant="outlined" color="info" startIcon={<DownloadIcon />} onClick={handleExport} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>EXPORT</Button>
                    <Button size="small" variant="outlined" color="success" startIcon={<UploadIcon />} onClick={handleFileSelect} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>IMPORT</Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={handlePurge} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>PURGE</Button>
                </Box>
            </Box>

            <Grid container spacing={3}>
                {paginatedProjects.map(p => (
                    <Grid item xs={12} md={6} lg={4} key={p.id}>
                        <Paper elevation={0} sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'rgba(13, 31, 60, 0.5)', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                <Box>
                                    <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 'bold' }}>{p.name}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.code || "NO_CODE"}</Typography>
                                </Box>
                                <Chip label={p.status || 'Draft'} size="small" variant="outlined" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', height: 18 }} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                <IconButton color="error" onClick={(e) => deleteProject(p.id, e)} size="small"><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
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

            {/* IMPORT RESOLUTION DIALOG */}
            <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider', minWidth: '400px' } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '14px' }}>DATABASE IMPORT RESOLUTION</DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 3, color: '#ccc', fontSize: '12px' }}>How would you like to process the imported projects?</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button variant="outlined" color="info" onClick={() => processImport('append')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px' }}><strong>[APPEND]</strong>&nbsp;&nbsp;Add as new entries.</Button>
                        <Button variant="outlined" color="warning" onClick={() => processImport('merge')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px' }}><strong>[MERGE]</strong>&nbsp;&nbsp;&nbsp;Overwrite matching IDs, keep others.</Button>
                        <Button variant="outlined" color="error" onClick={() => processImport('replace')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px' }}><strong>[REPLACE]</strong>&nbsp;Delete current projects, use imported.</Button>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
                    <Button onClick={() => setImportDialogOpen(false)} sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '12px' }}>CANCEL</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}