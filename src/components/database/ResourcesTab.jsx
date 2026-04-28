import { useState, useMemo, useRef, useEffect } from "react";
import {
    Box, Button, Typography, Paper, Grid, TextField, MenuItem, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    InputAdornment, Drawer, Pagination, Divider, alpha, useTheme, InputBase
} from "@mui/material";

// Icons
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useSettings } from "../../context/SettingsContext";

// 🔥 UPGRADED HIGH-PERFORMANCE "GHOST" INPUT CELL
const RateInputCell = ({ resource, regionName, onSave, ghostInputStyle }) => {
    const [localVal, setLocalVal] = useState(resource.rates[regionName] || "");

    useEffect(() => {
        setLocalVal(resource.rates[regionName] || "");
    }, [resource.rates, regionName]);

    const handleBlur = () => {
        const numVal = Number(localVal);
        const currentDbVal = Number(resource.rates[regionName] || 0);
        if (numVal !== currentDbVal) {
            onSave(resource.id, numVal);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') e.target.blur();
    };

    return (
        <InputBase
            type="number"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            sx={ghostInputStyle}
        />
    );
};

export default function ResourcesTab({ regions, resources, loadData }) {
    const theme = useTheme();
    const { formatCurrency } = useSettings();
    const fileInputRef = useRef(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [importRegion, setImportRegion] = useState("");
    const [newRegion, setNewRegion] = useState("");

    const [resCode, setResCode] = useState("");
    const [resDesc, setResDesc] = useState("");
    const [resUnit, setResUnit] = useState("nos");

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const [selectedResource, setSelectedResource] = useState(null);

    const filteredResources = useMemo(() => {
        return resources.filter(r =>
            (r.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.description || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [resources, searchTerm]);

    const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
    const paginatedResources = filteredResources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // --- LOGIC HANDLERS (Unchanged) ---
    const updateResourceRate = async (id, field, value, regionName = null) => {
        const res = resources.find(r => r.id === id);
        if (field === 'rates' && regionName) {
            const currentHistory = Array.isArray(res.rateHistory) ? res.rateHistory : [];
            const updatedHistory = [
                ...currentHistory,
                { date: new Date().toISOString().split('T')[0], rate: value[regionName], region: regionName }
            ];
            await window.api.db.updateResource(id, 'rates', JSON.stringify(value));
            await window.api.db.updateResource(id, 'rateHistory', JSON.stringify(updatedHistory));
        } else {
            await window.api.db.updateResource(id, field, value);
        }
        loadData();
    };

    const deleteResource = async (id) => {
        if (window.confirm("CRITICAL: Delete this resource? This will break formulas in BOQs that rely on it.")) {
            await window.api.db.deleteResource(id);
            loadData();
        }
    };

    const handleDeleteRegion = async (id) => {
        if (window.confirm("WARNING: Delete this region? All historical prices saved under this region will become orphaned.")) {
            await window.api.db.deleteRegion(id);
            loadData();
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !importRegion) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const XLSX = await import('xlsx');
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const rawSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(10, rawSheetData.length); i++) {
                    const row = rawSheetData[i];
                    if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('code'))) {
                        headerRowIdx = i; break;
                    }
                }

                if (headerRowIdx === -1) return alert("Upload Failed: Could not find a header row containing 'Code'.");

                const headers = rawSheetData[headerRowIdx].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');
                const codeIdx = headers.findIndex(h => h === 'code' || h.includes('code'));
                const descIdx = headers.findIndex(h => h.includes('description') || h.includes('item'));
                const unitIdx = headers.findIndex(h => h === 'unit' || h.includes('unit'));
                const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price'));

                if (codeIdx === -1 || descIdx === -1 || rateIdx === -1) {
                    return alert("Missing required columns. Ensure your file has 'Code', 'Description', and 'Rate' headers.");
                }

                const formattedData = [];
                for (let i = headerRowIdx + 1; i < rawSheetData.length; i++) {
                    const row = rawSheetData[i];
                    if (!row || row.length === 0) continue;

                    const code = String(row[codeIdx] || '').trim();
                    const desc = String(row[descIdx] || '').trim();
                    const unit = String(row[unitIdx] || 'nos').trim();
                    const rate = Number(row[rateIdx] || 0);

                    if (code && desc) formattedData.push({ code, description: desc, unit, rate });
                }

                if (formattedData.length === 0) return alert("No valid material rows found under the headers.");

                for (const item of formattedData) {
                    let existingRes = resources.find(r => r.code === item.code);
                    if (existingRes) {
                        const newRates = { ...existingRes.rates, [importRegion]: item.rate };
                        await updateResourceRate(existingRes.id, 'rates', newRates, importRegion);
                    } else {
                        await window.api.db.createResource({
                            code: item.code, description: item.description, unit: item.unit,
                            rates: JSON.stringify({ [importRegion]: item.rate }),
                            rateHistory: JSON.stringify([{ date: new Date().toISOString().split('T')[0], rate: item.rate, region: importRegion }])
                        });
                    }
                }
                alert(`Successfully imported ${formattedData.length} items into the [${importRegion}] market!`);
                loadData();
            } catch (err) {
                console.error("Import Error:", err);
                alert("Failed to parse Excel file. Is the file corrupted?");
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- STYLES FOR GHOST INPUTS ---
    const ghostInputStyle = {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '12px',
        color: 'text.primary',
        width: '100%',
        padding: '2px 8px',
        borderRadius: '6px',
        transition: 'all 0.2s ease',
        border: '1px solid transparent',
        '&:hover': { 
            bgcolor: alpha(theme.palette.common.white, 0.05),
            borderColor: alpha(theme.palette.common.white, 0.1)
        },
        '&.Mui-focused': { 
            bgcolor: alpha(theme.palette.background.default, 0.8),
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
        }
    };

    const InflationDrawer = () => {
        if (!selectedResource) return null;
        const history = (selectedResource.rateHistory || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        const latest = history.length > 0 ? history[history.length - 1].rate : 0;
        const oldest = history.length > 0 ? history[0].rate : 0;
        const trend = oldest > 0 ? ((latest - oldest) / oldest) * 100 : 0;

        return (
            <Drawer anchor="right" open={!!selectedResource} onClose={() => setSelectedResource(null)} PaperProps={{ sx: { bgcolor: 'background.default', backgroundImage: 'none' } }}>
                <Box sx={{ width: { xs: '100vw', sm: 500 }, p: { xs: 2, sm: 4 }, height: '100%' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '16px', sm: '20px' } }}>MARKET_ANALYTICS</Typography>
                        <IconButton onClick={() => setSelectedResource(null)} color="inherit"><CloseIcon /></IconButton>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="primary.main" sx={{ fontSize: { xs: '18px', sm: '24px' } }}>{selectedResource.description}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>CODE: {selectedResource.code}</Typography>

                    <Box display="flex" gap={2} my={4} flexDirection={{ xs: 'column', sm: 'row' }}>
                        <Paper elevation={0} sx={{ p: 2, flex: 1, bgcolor: alpha(theme.palette.background.paper, 0.5), border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" color="text.secondary">LATEST_PRICE</Typography>
                            <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(latest)}</Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, flex: 1, bgcolor: alpha(theme.palette.background.paper, 0.5), border: '1px solid', borderColor: trend >= 0 ? alpha(theme.palette.error.main, 0.5) : alpha(theme.palette.success.main, 0.5) }}>
                            <Typography variant="caption" color="text.secondary">MARKET_TREND</Typography>
                            <Box display="flex" alignItems="center" color={trend >= 0 ? 'error.main' : 'success.main'}>
                                {trend >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                                <Typography variant="h6" ml={1} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.abs(trend).toFixed(1)}%</Typography>
                            </Box>
                        </Paper>
                    </Box>

                    <Box sx={{ height: 300, mt: 4 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} stroke="none" />
                                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: theme.palette.text.secondary }} stroke="none" />
                                <RechartsTooltip contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: '8px' }} formatter={(val) => formatCurrency(val)} />
                                <Area type="monotone" dataKey="rate" stroke={theme.palette.primary.main} fill={theme.palette.primary.main} fillOpacity={0.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Box>
                </Box>
            </Drawer>
        );
    };

    return (
        <Box>
            {/* TOP CONTROLS (IMPORT & REGIONS) */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 3, bgcolor: alpha(theme.palette.background.paper, 0.3), border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Typography variant="subtitle2" mb={2} color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>// IMPORT_EXCEL_LMR</Typography>
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                            <TextField select fullWidth size="small" label="TARGET REGION" value={importRegion} onChange={e => setImportRegion(e.target.value)}>
                                {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                            </TextField>
                            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                            <Button variant="outlined" color="primary" startIcon={<UploadIcon />} disabled={!importRegion} onClick={() => fileInputRef.current.click()} sx={{ flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                                UPLOAD_DATA
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 3, bgcolor: alpha(theme.palette.background.paper, 0.3), border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Typography variant="subtitle2" mb={2} color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>// MANAGE_REGIONS</Typography>
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                            <TextField fullWidth size="small" label="NEW_REGION" value={newRegion} onChange={e => setNewRegion(e.target.value)} />
                            <Button variant="contained" disabled={!newRegion} onClick={async () => { await window.api.db.createRegion(newRegion); setNewRegion(""); loadData(); }} sx={{ flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", boxShadow: 'none' }}>
                                ADD_REGION
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* SEARCH & QUICK ADD */}
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mb: 3, bgcolor: alpha(theme.palette.background.paper, 0.3), border: '1px solid', borderColor: 'divider', borderTop: `3px solid ${theme.palette.primary.main}`, borderRadius: 2 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <AddCircleOutlineIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        RESOURCE_DIRECTORY
                    </Typography>
                </Box>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <TextField fullWidth placeholder="Search Materials..." size="small" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
                    </Grid>

                    <Grid item sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                        <Divider orientation="vertical" flexItem sx={{ height: 40 }} />
                    </Grid>

                    <Grid item xs={12} md>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={3} md={2}><TextField fullWidth size="small" label="CODE" value={resCode} onChange={e => setResCode(e.target.value)} /></Grid>
                            <Grid item xs={12} sm={5} md={5}><TextField fullWidth size="small" label="DESCRIPTION" value={resDesc} onChange={e => setResDesc(e.target.value)} /></Grid>
                            <Grid item xs={12} sm={2} md={2}><TextField fullWidth size="small" label="UNIT" value={resUnit} onChange={e => setResUnit(e.target.value)} /></Grid>
                            <Grid item xs={12} sm={2} md={3}>
                                <Button fullWidth variant="contained" color="primary" sx={{ height: { xs: 40, sm: '100%' }, fontFamily: "'JetBrains Mono', monospace", boxShadow: 'none' }} onClick={async () => { await window.api.db.createResource({ code: resCode, description: resDesc, unit: resUnit }); setResCode(""); setResDesc(""); loadData(); }}>
                                    REGISTER_ITEM
                                </Button>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Paper>

            {/* TABLE HEADER & PAGINATION */}
            <Box display="flex" justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} flexDirection={{ xs: 'column', sm: 'row' }} gap={2} mb={2}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>
                    SHOWING {paginatedResources.length} OF {filteredResources.length} ENTRIES
                </Typography>
                <Pagination count={totalPages} page={currentPage} onChange={(e, v) => setCurrentPage(v)} color="primary" size="small" />
            </Box>

            {/* 🔥 BEAUTIFIED EXCEL-STYLE TABLE */}
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.paper, 0.2), borderRadius: 2, overflowX: 'auto', height: 'auto' }}>
                <Table size="small" sx={{ minWidth: 1000 }}>
                    <TableHead sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9) }}>
                        <TableRow>
                            <TableCell sx={{ width: 40, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>NO</TableCell>
                            <TableCell sx={{ width: 120, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>CODE</TableCell>
                            <TableCell sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>DESCRIPTION</TableCell>
                            <TableCell sx={{ width: 80, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>UNIT</TableCell>

                            {regions.map(r => (
                                <TableCell key={r.id} sx={{ minWidth: 120, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <Typography sx={{ color: 'primary.main', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                            {r.name.toUpperCase()}
                                        </Typography>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteRegion(r.id)} sx={{ opacity: 0.3, '&:hover': { opacity: 1 } }}>
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </Box>
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{ width: 80, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedResources.map((res, index) => (
                            <TableRow key={res.id} hover sx={{ 
                                bgcolor: index % 2 === 0 ? 'transparent' : alpha(theme.palette.common.white, 0.01),
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                                '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)' }
                            }}>
                                <TableCell sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'primary.light' }}>
                                    {res.code || '---'}
                                </TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                    {res.description}
                                </TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                    {res.unit}
                                </TableCell>

                                {regions.map(r => (
                                    <TableCell key={r.id} sx={{ p: '4px' }}>
                                        <RateInputCell
                                            resource={res}
                                            regionName={r.name}
                                            ghostInputStyle={ghostInputStyle}
                                            onSave={(resId, val) => updateResourceRate(resId, 'rates', { ...res.rates, [r.name]: val }, r.name)}
                                        />
                                    </TableCell>
                                ))}

                                <TableCell align="right" sx={{ p: '4px 16px' }}>
                                    <Box display="flex" justifyContent="flex-end" gap={0.5}>
                                        <IconButton size="small" color="primary" onClick={() => setSelectedResource(res)} sx={{ opacity: 0.6, '&:hover': { opacity: 1, bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>
                                            <TimelineIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={() => deleteResource(res.id)} sx={{ opacity: 0.6, '&:hover': { opacity: 1, bgcolor: alpha(theme.palette.error.main, 0.1) } }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <InflationDrawer />
        </Box>
    );
}