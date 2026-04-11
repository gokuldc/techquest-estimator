import { useState, useMemo } from "react";
import { Box, Button, Typography, Paper, Grid, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Chip, InputAdornment } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import { tableInputStyle, tableInputActiveStyle } from "../../styles";

export default function ResourcesTab({ regions, resources, loadData }) {
    const [newRegion, setNewRegion] = useState("");
    const [importRegion, setImportRegion] = useState("");
    const [searchCode, setSearchCode] = useState("");
    const [searchDesc, setSearchDesc] = useState("");
    const [sortField, setSortField] = useState("code");
    const [sortAsc, setSortAsc] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const [resCode, setResCode] = useState("");
    const [resDesc, setResDesc] = useState("");
    const [resUnit, setResUnit] = useState("nos");

    const handleAddRegion = async () => {
        if (!newRegion) return;
        await window.api.db.createRegion(newRegion);
        setNewRegion("");
        loadData();
    };

    const handleDeleteRegion = async (regionId, regionName) => {
        if (window.confirm(`Are you sure you want to delete the region "${regionName}"? All local rates for this region will be permanently erased.`)) {
            await window.api.db.deleteRegion(regionId, regionName);
            loadData();
        }
    };

    const addResourceManually = async () => {
        if (!resDesc) return;
        await window.api.db.createResource({ code: resCode, description: resDesc, unit: resUnit });
        setResCode(""); setResDesc("");
        loadData();
    };

    const updateResourceInline = async (id, field, value) => {
        await window.api.db.updateResource(id, field, value);
        loadData();
    };

    const deleteResource = async (id) => {
        if (window.confirm("Delete this resource?")) {
            await window.api.db.deleteResource(id);
            loadData();
        }
    };

    const triggerLmrImport = async () => {
        if (!importRegion) return alert("Select a region for import first.");
        const res = await window.api.db.importExcel(importRegion);
        if (res.success) {
            alert(res.message);
            loadData();
        } else if (res.message !== 'User cancelled') {
            alert(res.error);
        }
    };

    const handleSort = (field) => {
        if (sortField === field) setSortAsc(!sortAsc);
        else { setSortField(field); setSortAsc(true); }
        setCurrentPage(1);
    };

    const filteredResources = useMemo(() => {
        let filtered = resources.filter(r => (r.code || "").toLowerCase().includes(searchCode.toLowerCase()) && (r.description || "").toLowerCase().includes(searchDesc.toLowerCase()));
        filtered.sort((a, b) => { let valA = (a[sortField] || "").toLowerCase(), valB = (b[sortField] || "").toLowerCase(); if (valA < valB) return sortAsc ? -1 : 1; if (valA > valB) return sortAsc ? 1 : -1; return 0; });
        return filtered;
    }, [resources, searchCode, searchDesc, sortField, sortAsc]);

    const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
    const paginatedResources = filteredResources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <Box>
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                        <Typography variant="subtitle1" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '13px' }}>IMPORT_EXCEL_LMR</Typography>
                        <Box display="flex" gap={2} alignItems="flex-start" flexWrap="wrap">
                            <TextField select size="small" label="TARGET_REGION" value={regions.some(r => r.name === importRegion) ? importRegion : ""} onChange={e => setImportRegion(e.target.value)} sx={{ minWidth: 150, flex: 1 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                <MenuItem value="">-- SELECT_REGION --</MenuItem>
                                {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{r.name}</MenuItem>)}
                            </TextField>
                            <Button variant="contained" color="primary" disableElevation startIcon={<UploadIcon />} onClick={triggerLmrImport} sx={{ height: 40, px: 3, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                UPLOAD LMR
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                        <Typography variant="subtitle1" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '13px' }}>MANAGE_REGIONS</Typography>
                        <Box display="flex" gap={2} alignItems="flex-start">
                            <TextField size="small" label="NEW_REGION" value={newRegion} onChange={e => setNewRegion(e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            <Button variant="contained" disableElevation onClick={handleAddRegion} sx={{ height: 40, px: 3, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>ADD</Button>
                        </Box>
                        {regions.length > 0 && (
                            <Box display="flex" gap={1} flexWrap="wrap" mt={2} pt={2} borderTop="1px dashed" borderColor="divider">
                                {regions.map(r => (
                                    <Chip key={r.id} label={r.name} onDelete={() => handleDeleteRegion(r.id, r.name)} size="small" variant="outlined" sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                                ))}
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={1} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '12px' }}>SEARCH_RESOURCES</Typography>
                        <Box display="flex" gap={2} alignItems="flex-start">
                            <TextField size="small" placeholder="Search Code..." value={searchCode} onChange={e => { setSearchCode(e.target.value); setCurrentPage(1); }} fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            <TextField size="small" placeholder="Search Description..." value={searchDesc} onChange={e => { setSearchDesc(e.target.value); setCurrentPage(1); }} fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={1} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '12px' }}>ADD_RESOURCE</Typography>
                        <Box display="flex" gap={1} alignItems="flex-start">
                            <TextField size="small" label="CODE" value={resCode} onChange={e => setResCode(e.target.value)} sx={{ width: 120 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            <TextField size="small" label="DESCRIPTION" value={resDesc} onChange={e => setResDesc(e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            <TextField size="small" label="UNIT" value={resUnit} onChange={e => setResUnit(e.target.value)} sx={{ width: 100 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            <Button variant="contained" disableElevation onClick={addResourceManually} sx={{ height: 40, px: 3, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>ADD</Button>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                    SHOWING {paginatedResources.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} TO {Math.min(currentPage * itemsPerPage, filteredResources.length)} OF {filteredResources.length}
                </Typography>
                <Box display="flex" gap={1} alignItems="center">
                    <Button size="small" variant="outlined" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} sx={{ height: 32, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>PREV</Button>
                    <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>PAGE {currentPage} OF {totalPages || 1}</Typography>
                    <Button size="small" variant="outlined" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} sx={{ height: 32, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>NEXT</Button>
                </Box>
            </Box>

            <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ maxHeight: 600, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Table stickyHeader size="small" sx={{ minWidth: '100%' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 60, bgcolor: 'rgba(0,0,0,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                            <TableCell onClick={() => handleSort('code')} sx={{ cursor: 'pointer', width: 120, bgcolor: 'rgba(0,0,0,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CODE {sortField === 'code' ? (sortAsc ? '↑' : '↓') : ''}</TableCell>
                            <TableCell onClick={() => handleSort('description')} sx={{ cursor: 'pointer', bgcolor: 'rgba(0,0,0,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DESCRIPTION {sortField === 'description' ? (sortAsc ? '↑' : '↓') : ''}</TableCell>
                            <TableCell sx={{ width: 100, bgcolor: 'rgba(0,0,0,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UNIT</TableCell>
                            {regions.map(r => <TableCell key={r.id} sx={{ color: 'primary.main', fontWeight: 'bold', width: 120, bgcolor: 'rgba(0,0,0,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{r.name.toUpperCase()}</TableCell>)}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedResources.map(res => (
                            <TableRow key={res.id} hover>
                                <TableCell align="center"><IconButton size="small" color="error" onClick={() => deleteResource(res.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                <TableCell><input value={res.code || ""} onChange={e => updateResourceInline(res.id, 'code', e.target.value)} style={tableInputStyle} /></TableCell>
                                <TableCell><input value={res.description || ""} onChange={e => updateResourceInline(res.id, 'description', e.target.value)} style={tableInputStyle} /></TableCell>
                                <TableCell><input value={res.unit || ""} onChange={e => updateResourceInline(res.id, 'unit', e.target.value)} style={tableInputStyle} /></TableCell>
                                {regions.map(r => (
                                    <TableCell key={r.id}>
                                        <input type="number" value={res.rates[r.name] || ""} onChange={e => updateResourceInline(res.id, 'rates', { ...res.rates, [r.name]: Number(e.target.value) })} style={tableInputActiveStyle} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                        {paginatedResources.length === 0 && <TableRow><TableCell colSpan={4 + regions.length} align="center" sx={{ py: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary' }}>NO_MATCHING_RESOURCES</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}