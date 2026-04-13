import { useState, useMemo } from "react";
import {
    Box, Button, Typography, Paper, Grid, TextField, MenuItem, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Chip, InputAdornment, Drawer, Pagination, Divider
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CloseIcon from '@mui/icons-material/Close';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { tableInputStyle, tableInputActiveStyle } from "../../styles";

// 🔥 1. Import the global settings hook
import { useSettings } from "../../context/SettingsContext";

export default function ResourcesTab({ regions, resources, loadData }) {
    // 🔥 2. Grab the format function from the "Radio Tower"
    const { formatCurrency } = useSettings();

    const [searchTerm, setSearchTerm] = useState("");
    const [importRegion, setImportRegion] = useState("");
    const [newRegion, setNewRegion] = useState("");
    const [resCode, setResCode] = useState("");
    const [resDesc, setResDesc] = useState("");
    const [resUnit, setResUnit] = useState("nos");

    // --- PAGINATION STATE ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // --- ANALYTICS STATE ---
    const [selectedResource, setSelectedResource] = useState(null);

    // --- FILTER & PAGINATION LOGIC ---
    const filteredResources = useMemo(() => {
        return resources.filter(r =>
            (r.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.description || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [resources, searchTerm]);

    const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
    const paginatedResources = filteredResources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const updateResourceRate = async (id, field, value, regionName = null) => {
        const res = resources.find(r => r.id === id);

        if (field === 'rates' && regionName) {
            const currentHistory = Array.isArray(res.rateHistory) ? res.rateHistory : [];
            const updatedHistory = [
                ...currentHistory,
                { date: new Date().toISOString().split('T')[0], rate: value[regionName], region: regionName }
            ];
            // Update SQLite: rates is object, rateHistory is array
            await window.api.db.updateResource(id, 'rates', JSON.stringify(value));
            await window.api.db.updateResource(id, 'rateHistory', JSON.stringify(updatedHistory));
        } else {
            await window.api.db.updateResource(id, field, value);
        }
        loadData();
    };

    const deleteResource = async (id) => {
        if (window.confirm("Delete resource?")) {
            await window.api.db.deleteResource(id);
            loadData();
        }
    };

    // --- ANALYTICS DRAWER COMPONENT ---
    const InflationDrawer = () => {
        if (!selectedResource) return null;
        const history = (selectedResource.rateHistory || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        const latest = history.length > 0 ? history[history.length - 1].rate : 0;
        const oldest = history.length > 0 ? history[0].rate : 0;
        const trend = oldest > 0 ? ((latest - oldest) / oldest) * 100 : 0;

        return (
            <Drawer anchor="right" open={!!selectedResource} onClose={() => setSelectedResource(null)}>
                <Box sx={{ width: 500, p: 4, bgcolor: '#0b172d', height: '100%', color: '#fff' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>MARKET_ANALYTICS</Typography>
                        <IconButton onClick={() => setSelectedResource(null)} color="inherit"><CloseIcon /></IconButton>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="primary.main">{selectedResource.description}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>CODE: {selectedResource.code}</Typography>

                    <Box display="flex" gap={2} my={4}>
                        <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Typography variant="caption" color="text.secondary">LATEST_PRICE</Typography>
                            {/* 🔥 Replaced Hardcoded ₹ */}
                            <Typography variant="h6">{formatCurrency(latest)}</Typography>
                        </Paper>
                        <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(255,255,255,0.05)', border: trend >= 0 ? '1px solid #ef4444' : '1px solid #10b981' }}>
                            <Typography variant="caption" color="text.secondary">TREND</Typography>
                            <Box display="flex" alignItems="center" color={trend >= 0 ? 'error.main' : 'success.main'}>
                                {trend >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                                <Typography variant="h6" ml={1}>{Math.abs(trend).toFixed(1)}%</Typography>
                            </Box>
                        </Paper>
                    </Box>

                    <Box sx={{ height: 300, mt: 4 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#555" />
                                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} stroke="#555" />
                                <Tooltip contentStyle={{ backgroundColor: '#0d1f3c', border: '1px solid #3b82f6' }} formatter={(val) => formatCurrency(val)} />
                                <Area type="monotone" dataKey="rate" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Box>
                </Box>
            </Drawer>
        );
    };

    return (
        <Box>
            {/* TOP ACTIONS: IMPORT & REGIONS */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)', borderRadius: 2 }}>
                        <Typography variant="subtitle2" mb={2}>IMPORT_EXCEL_LMR</Typography>
                        <Box display="flex" gap={2}>
                            <TextField select fullWidth size="small" label="REGION" value={importRegion} onChange={e => setImportRegion(e.target.value)}>
                                {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                            </TextField>
                            <Button variant="contained" startIcon={<UploadIcon />}>UPLOAD</Button>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)', borderRadius: 2 }}>
                        <Typography variant="subtitle2" mb={2}>MANAGE_REGIONS</Typography>
                        <Box display="flex" gap={1}>
                            <TextField fullWidth size="small" label="NEW_REGION" value={newRegion} onChange={e => setNewRegion(e.target.value)} />
                            <Button variant="contained" onClick={async () => { await window.api.db.createRegion(newRegion); setNewRegion(""); loadData(); }}>ADD</Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* SEARCH & QUICK ADD */}
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box display="flex" gap={2}>
                    <TextField
                        placeholder="Search Materials..."
                        size="small" sx={{ width: 300 }}
                        value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                    />
                    <Divider orientation="vertical" flexItem />
                    <Box display="flex" gap={1} flexGrow={1}>
                        <TextField size="small" label="CODE" value={resCode} onChange={e => setResCode(e.target.value)} sx={{ width: 100 }} />
                        <TextField size="small" label="DESCRIPTION" value={resDesc} onChange={e => setResDesc(e.target.value)} fullWidth />
                        <TextField size="small" label="UNIT" value={resUnit} onChange={e => setResUnit(e.target.value)} sx={{ width: 100 }} />
                        <Button variant="contained" onClick={async () => { await window.api.db.createResource({ code: resCode, description: resDesc, unit: resUnit }); loadData(); }}>ADD</Button>
                    </Box>
                </Box>
            </Paper>

            {/* TABLE HEADER WITH PAGINATION CONTROLS */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    SHOWING {paginatedResources.length} OF {filteredResources.length} RESOURCES
                </Typography>
                <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={(e, v) => setCurrentPage(v)}
                    color="primary" size="small"
                />
            </Box>

            <TableContainer component={Paper} sx={{ maxHeight: '60vh', border: '1px solid', borderColor: 'divider' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: '#0b172d', width: 80 }}>ACTION</TableCell>
                            <TableCell sx={{ bgcolor: '#0b172d' }}>RESOURCE_DETAILS</TableCell>
                            <TableCell sx={{ bgcolor: '#0b172d', width: 80 }}>UNIT</TableCell>
                            {regions.map(r => <TableCell key={r.id} sx={{ bgcolor: '#0b172d', color: 'primary.main', fontWeight: 'bold' }}>{r.name.toUpperCase()}</TableCell>)}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedResources.map(res => (
                            <TableRow key={res.id} hover>
                                <TableCell>
                                    <IconButton size="small" color="primary" onClick={() => setSelectedResource(res)}><TimelineIcon fontSize="small" /></IconButton>
                                    <IconButton size="small" color="error" onClick={() => deleteResource(res.id)}><DeleteIcon fontSize="small" /></IconButton>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight="bold">{res.code || '---'}</Typography>
                                    <Typography variant="caption" color="text.secondary">{res.description}</Typography>
                                </TableCell>
                                <TableCell>{res.unit}</TableCell>
                                {regions.map(r => (
                                    <TableCell key={r.id}>
                                        <input
                                            type="number"
                                            value={res.rates[r.name] || ""}
                                            onChange={e => updateResourceRate(res.id, 'rates', { ...res.rates, [r.name]: Number(e.target.value) }, r.name)}
                                            style={tableInputActiveStyle}
                                        />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <InflationDrawer />
        </Box>
    );
}