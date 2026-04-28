import React, { useState, useEffect, useMemo } from "react";
import {
    Box, Typography, Paper, Grid, IconButton, TextField, InputAdornment, 
    Chip, Button, Pagination, Container, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';

import { useAuth } from "../context/AuthContext";

export default function ProjectArchive({ onOpenProject }) {
    const { currentUser, hasClearance } = useAuth();
    const [projects, setProjects] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const itemsPerPage = 6;

    const [importData, setImportData] = useState(null);
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    const loadData = async () => {
        const projData = await window.api.db.getProjects();
        setProjects((projData || []).sort((a, b) => b.createdAt - a.createdAt));
    };

    useEffect(() => { loadData(); }, []);

    const visibleProjects = useMemo(() => {
        if (hasClearance(4)) return projects;
        return projects.filter(p => {
            try { return JSON.parse(p.assignedStaff || '[]').includes(currentUser?.id); } 
            catch (e) { return false; }
        });
    }, [projects, currentUser, hasClearance]);

    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return visibleProjects;
        const query = searchQuery.toLowerCase();
        return visibleProjects.filter(p =>
            (p.name?.toLowerCase().includes(query)) || (p.code?.toLowerCase().includes(query))
        );
    }, [visibleProjects, searchQuery]);

    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
    const paginatedProjects = filteredProjects.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const deleteProject = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("CRITICAL: Delete this project and all associated data?")) {
            await window.api.db.deleteProject(id);
            loadData();
        }
    };

    const handleExport = async () => {
        const res = await window.api.db.exportAllProjectsSqlite();
        if (res.success) alert("Archive exported successfully.");
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
            alert(`Import completed (${mode}).`);
            loadData();
            setImportDialogOpen(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflowY: 'auto', p: { xs: 2, md: 4 } }}>
            <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
                
                {/* HEADER */}
                <Box sx={{ mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <FolderSpecialIcon color="primary" sx={{ fontSize: 32 }} />
                        <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>PROJECT_ARCHIVE</Typography>
                    </Box>

                    <Box display="flex" gap={1}>
                        {hasClearance(4) && (
                            <>
                                <Button size="small" variant="outlined" color="info" startIcon={<DownloadIcon />} onClick={handleExport} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>EXPORT_ALL</Button>
                                <Button size="small" variant="outlined" color="success" startIcon={<UploadIcon />} onClick={handleFileSelect} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>IMPORT_SQLITE</Button>
                            </>
                        )}
                        {hasClearance(5) && (
                            <Button size="small" variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={() => window.api.db.purgeProjects().then(loadData)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>PURGE</Button>
                        )}
                    </Box>
                </Box>

                {/* SEARCH */}
                <TextField 
                    fullWidth 
                    placeholder="Search by project name or code..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    sx={{ mb: 4 }}
                    InputProps={{ 
                        startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                        sx: { bgcolor: 'rgba(0,0,0,0.2)', fontFamily: "'JetBrains Mono', monospace" }
                    }} 
                />

                <Grid container spacing={3}>
                    {paginatedProjects.map(p => (
                        <Grid item xs={12} sm={6} lg={4} key={p.id}>
                            <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', transition: '0.2s', '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                    <Box>
                                        <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 'bold' }}>{p.name}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.code || "NO_CODE"}</Typography>
                                    </Box>
                                    <Chip label={p.status || 'Draft'} size="small" variant="outlined" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', height: 18 }} />
                                </Box>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                    {hasClearance(4) ? (
                                        <IconButton color="error" onClick={(e) => deleteProject(p.id, e)} size="small"><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
                                    ) : <Box />}
                                    <Button variant="contained" disableElevation onClick={() => onOpenProject(p.id)} endIcon={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>ACCESS_WORKSPACE</Button>
                                </Box>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                {totalPages > 1 && (
                    <Box display="flex" justifyContent="center" mt={6}>
                        <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)} color="primary" />
                    </Box>
                )}
            </Box>

            <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider' } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>DATABASE IMPORT RESOLUTION</DialogTitle>
                <DialogContent>
                    <Typography sx={{ mb: 3, color: '#ccc', fontSize: '12px' }}>How would you like to process the imported projects?</Typography>
                    <Box display="flex" flexDirection="column" gap={2}>
                        <Button variant="outlined" color="info" onClick={() => processImport('append')}>[APPEND] Add as new</Button>
                        <Button variant="outlined" color="warning" onClick={() => processImport('merge')}>[MERGE] Update existing</Button>
                        <Button variant="outlined" color="error" onClick={() => processImport('replace')}>[REPLACE] Overwrite all</Button>
                    </Box>
                </DialogContent>
                <DialogActions><Button onClick={() => setImportDialogOpen(false)} color="inherit">CANCEL</Button></DialogActions>
            </Dialog>
        </Box>
    );
}