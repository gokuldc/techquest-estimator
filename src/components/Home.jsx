import { useRef, useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import {
    Box, Typography, Button, Paper,
    Grid, IconButton, Tooltip, Divider, Container, Pagination,
    TextField, InputAdornment, Avatar, Chip
} from "@mui/material";

// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import StorageIcon from '@mui/icons-material/Storage';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SearchIcon from '@mui/icons-material/Search';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import HandymanIcon from '@mui/icons-material/Handyman';
import BusinessIcon from '@mui/icons-material/Business';

export default function Home({ onOpenProject, onOpenDb, onOpenAbout, onOpenCrm }) {
    const fileInputRef = useRef(null);

    // --- LIVE DATABASE QUERIES ---
    const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray()) || [];
    const resources = useLiveQuery(() => db.resources.toArray()) || [];
    const masterBoqs = useLiveQuery(() => db.masterBoq.toArray()) || [];
    const regions = useLiveQuery(() => db.regions.toArray()) || [];

    // --- SEARCH & PAGINATION STATE ---
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const itemsPerPage = 6;

    // --- DASHBOARD METRICS ---
    const { activeCount, completedCount, draftCount, holdCount } = useMemo(() => {
        let active = 0, completed = 0, draft = 0, hold = 0;
        projects.forEach(p => {
            if (p.status === 'In Progress') active++;
            else if (p.status === 'Completed') completed++;
            else if (p.status === 'On Hold') hold++;
            else draft++;
        });
        return { activeCount: active, completedCount: completed, draftCount: draft, holdCount: hold };
    }, [projects]);

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
        if (page > totalPages && totalPages > 0) {
            setPage(totalPages);
        }
    }, [filteredProjects.length, page, totalPages]);

    const paginatedProjects = filteredProjects.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // --- ACTIONS ---
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
        await db.projects.add(newProject);
        setSearchQuery("");
        setPage(1);
        onOpenProject(newProject.id);
    };

    const deleteProject = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("CRITICAL WARNING: Are you sure you want to delete this project?")) {
            await db.projects.delete(id);
            await db.projectBoq.where({ projectId: id }).delete();
        }
    };

    const purgeAllProjects = async () => {
        if (window.confirm("CRITICAL WARNING: This will permanently delete ALL Projects, Measurement Books, and custom BOQs. Proceed?")) {
            await db.transaction('rw', db.projects, db.projectBoq, async () => {
                await db.projects.clear();
                await db.projectBoq.clear();
            });
            setSearchQuery("");
            setPage(1);
        }
    };

    const exportProjects = async () => {
        const allProjects = await db.projects.toArray();
        const allProjectBoqs = await db.projectBoq.toArray();

        const data = {
            projects: allProjects,
            projectBoq: allProjectBoqs,
            exportDate: new Date().toISOString(),
            type: "ProjectData"
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `OpenPrix_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importProjects = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm("This will merge uploaded projects with your current ones. Proceed?")) {
            e.target.value = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.type !== "ProjectData" && !data.projects) throw new Error("Invalid format");

                let addedProjects = 0;
                await db.transaction('rw', db.projects, db.projectBoq, async () => {
                    const existingProjectIds = new Set((await db.projects.toArray()).map(p => p.id));
                    const newProjects = (data.projects || []).filter(p => !existingProjectIds.has(p.id));
                    const newProjectIds = new Set(newProjects.map(p => p.id));
                    const newBoqs = (data.projectBoq || []).filter(b => newProjectIds.has(b.projectId));

                    if (newProjects.length > 0) {
                        await db.projects.bulkAdd(newProjects);
                        await db.projectBoq.bulkAdd(newBoqs);
                        addedProjects = newProjects.length;
                    }
                });
                alert(`Imported ${addedProjects} new projects.`);
            } catch (err) {
                alert("Failed to import. Invalid backup file.");
            }
            e.target.value = null;
        };
        reader.readAsText(file);
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'In Progress': return 'info';
            case 'Completed': return 'success';
            case 'On Hold': return 'warning';
            default: return 'default';
        }
    };

    const MetricCard = ({ title, value, subtitle, icon, color }) => (
        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
            <Avatar sx={{ bgcolor: `rgba(${color === 'success' ? '16, 185, 129' : color === 'info' ? '59, 130, 246' : color === 'warning' ? '245, 158, 11' : '139, 92, 246'}, 0.1)`, color: `${color}.main`, width: 48, height: 48 }}>
                {icon}
            </Avatar>
            <Box>
                <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>{value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', display: 'block' }}>{title}</Typography>
                {subtitle && <Typography variant="caption" color={`${color}.main`} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>{subtitle}</Typography>}
            </Box>
        </Paper>
    );

    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            {/* --- HEADER --- */}
            <Box sx={{
                display: 'flex', flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' },
                mb: 4, gap: 3, pb: 4, borderBottom: '1px solid', borderColor: 'divider',
            }}>
                <Box>
                    <Typography variant="h3" component="h1" color="primary.main" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '24px', md: '32px' }, fontWeight: 'bold', letterSpacing: '1px' }}>
                        {'// '}OPENPRIX
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1 }}>
                        System Nexus: Projects, Resources, and Databook Management.
                    </Typography>
                </Box>
                <Box display="flex" gap={2} flexWrap="wrap">
                    <Button startIcon={<StorageIcon />} onClick={onOpenDb} variant="outlined" color="secondary" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        DATABASE MANAGER
                    </Button>
                    <Button startIcon={<BusinessIcon />} onClick={onOpenCrm} variant="outlined" color="success" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        CRM DIRECTORY
                    </Button>
                    <Button startIcon={<InfoIcon />} onClick={onOpenAbout} variant="outlined" color="inherit" sx={{ borderRadius: 2, borderColor: 'divider', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        ABOUT
                    </Button>
                    <Button startIcon={<AddCircleOutlineIcon />} onClick={createProject} variant="contained" color="primary" disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        NEW WORKSPACE
                    </Button>
                </Box>
            </Box>

            {/* --- TOP KPI DASHBOARD --- */}
            <Grid container spacing={3} sx={{ mb: 6 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="TOTAL PROJECTS" value={projects.length} subtitle={`${activeCount} Active / ${draftCount} Draft`} icon={<FolderSpecialIcon />} color="info" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="MASTER DATABOOK" value={masterBoqs.length} subtitle="Standardized Assemblies" icon={<AutoStoriesIcon />} color="success" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="GLOBAL RESOURCES" value={resources.length} subtitle="Materials & Labor" icon={<HandymanIcon />} color="warning" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="REGIONAL RATES" value={regions.length} subtitle="Geographic Pricing" icon={<BusinessIcon />} color="secondary" />
                </Grid>
            </Grid>

            {/* --- PROJECT ARCHIVE TOOLBAR --- */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                    <Typography variant="h5" fontWeight="700" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}>
                        PROJECT_ARCHIVE
                    </Typography>
                    <TextField
                        size="small"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                            sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', borderRadius: 2, height: 36, bgcolor: 'rgba(0,0,0,0.2)' }
                        }}
                        sx={{ width: { xs: '100%', sm: '250px' } }}
                    />
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button size="small" variant="text" startIcon={<DownloadIcon />} onClick={exportProjects} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>EXPORT</Button>
                    <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={importProjects} />
                    <Button size="small" variant="text" startIcon={<UploadIcon />} onClick={() => fileInputRef.current.click()} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>IMPORT</Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={purgeAllProjects} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>PURGE ALL</Button>
                </Box>
            </Box>
            <Divider sx={{ mb: 4, borderColor: 'divider' }} />

            {/* --- PROJECT CARDS GRID --- */}
            <Grid container spacing={3}>
                {filteredProjects.length === 0 ? (
                    <Grid item xs={12}>
                        <Box sx={{ py: 10, textAlign: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'rgba(0,0,0,0.15)' }}>
                            <FolderOpenIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                            <Typography color="text.secondary" variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>
                                {searchQuery ? "NO_PROJECTS_MATCH_SEARCH" : "NO_ACTIVE_PROJECTS"}
                            </Typography>
                        </Box>
                    </Grid>
                ) : (
                    paginatedProjects.map(p => (
                        <Grid item xs={12} md={6} lg={4} key={p.id}>
                            <Paper elevation={0} sx={{
                                p: 3, display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'space-between',
                                border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%', background: 'rgba(13, 31, 60, 0.5)',
                                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(59, 130, 246, 0.05)' }
                            }}>
                                <Box>
                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                        <Typography variant="h6" sx={{ lineHeight: 1.2, fontFamily: "'JetBrains Mono', monospace", fontSize: '16px' }}>{p.name}</Typography>
                                        <Chip label={p.status || 'Draft'} color={getStatusColor(p.status)} size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', height: 20 }} />
                                    </Box>
                                    {p.code && <Typography variant="body2" color="secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', mb: 0.5 }}>CODE: {p.code}</Typography>}
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{p.clientName ? `CLIENT: ${p.clientName}` : 'CLIENT: Unassigned'}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', mt: 0.5 }}>REGION: <span style={{ color: '#3b82f6' }}>{p.region || "STANDARD"}</span></Typography>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'rgba(255,255,255,0.05)' }}>
                                    <Tooltip title="Delete">
                                        <IconButton color="error" onClick={(e) => deleteProject(p.id, e)} size="small"><DeleteIcon fontSize="small" /></IconButton>
                                    </Tooltip>
                                    <Button variant="contained" disableElevation onClick={() => onOpenProject(p.id)} endIcon={<ArrowForwardIosIcon sx={{ fontSize: '10px !important' }}/>} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                        OPEN
                                    </Button>
                                </Box>
                            </Paper>
                        </Grid>
                    ))
                )}
            </Grid>

            {/* --- PAGINATION --- */}
            {totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={6}>
                    <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)} color="primary" shape="rounded" sx={{ '& .MuiPaginationItem-root': { fontFamily: "'JetBrains Mono', monospace" } }} />
                </Box>
            )}
        </Container>
    );
}