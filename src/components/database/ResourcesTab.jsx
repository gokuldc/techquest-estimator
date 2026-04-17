import { useState, useMemo, useRef, useEffect } from "react";
import {
    Box, Button, Typography, Paper, Grid, TextField, MenuItem, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    InputAdornment, Drawer, Pagination, Divider
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CloseIcon from '@mui/icons-material/Close';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { tableInputActiveStyle } from "../../styles";

// Import global settings hook for currency formatting
import { useSettings } from "../../context/SettingsContext";

// 🔥 THE FIX: HIGH-PERFORMANCE ISOLATED INPUT CELL
// This prevents the entire app from re-rendering on every single keystroke.
const RateInputCell = ({ resource, regionName, onSave }) => {
    const [localVal, setLocalVal] = useState(resource.rates[regionName] || "");

    // Keep local state in sync if data changes from an Excel import
    useEffect(() => {
        setLocalVal(resource.rates[regionName] || "");
    }, [resource.rates, regionName]);

    // Only save to SQLite when the user clicks away or presses Tab
    const handleBlur = () => {
        const numVal = Number(localVal);
        const currentDbVal = Number(resource.rates[regionName] || 0);
        if (numVal !== currentDbVal) {
            onSave(resource.id, numVal);
        }
    };

    // Allow saving by pressing Enter
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };

    return (
        <input
            type="number"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={tableInputActiveStyle}
        />
    );
};

export default function ResourcesTab({ regions, resources, loadData }) {
    const { formatCurrency } = useSettings();
    const fileInputRef = useRef(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [importRegion, setImportRegion] = useState("");
    const [newRegion, setNewRegion] = useState("");

    // Quick Add State
    const [resCode, setResCode] = useState("");
    const [resDesc, setResDesc] = useState("");
    const [resUnit, setResUnit] = useState("nos");

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Analytics State
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

    // --- DATA MUTATION FUNCTIONS ---
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

    // Excel Import Logic
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
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    alert("Upload Failed: Could not find a header row containing 'Code'.");
                    return;
                }

                const headers = rawSheetData[headerRowIdx].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');
                const codeIdx = headers.findIndex(h => h === 'code' || h.includes('code'));
                const descIdx = headers.findIndex(h => h.includes('description') || h.includes('item'));
                const unitIdx = headers.findIndex(h => h === 'unit' || h.includes('unit'));
                const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price'));

                if (codeIdx === -1 || descIdx === -1 || rateIdx === -1) {
                    alert("Missing required columns. Ensure your file has 'Code', 'Description', and 'Rate' headers.");
                    return;
                }

                const formattedData = [];
                for (let i = headerRowIdx + 1; i < rawSheetData.length; i++) {
                    const row = rawSheetData[i];
                    if (!row || row.length === 0) continue;

                    const code = String(row[codeIdx] || '').trim();
                    const desc = String(row[descIdx] || '').trim();
                    const unit = String(row[unitIdx] || 'nos').trim();
                    const rate = Number(row[rateIdx] || 0);

                    if (code && desc) {
                        formattedData.push({ code, description: desc, unit, rate });
                    }
                }

                if (formattedData.length === 0) {
                    alert("No valid material rows found under the headers.");
                    return;
                }

                for (const item of formattedData) {
                    let existingRes = resources.find(r => r.code === item.code);
                    if (existingRes) {
                        const newRates = { ...existingRes.rates, [importRegion]: item.rate };
                        await updateResourceRate(existingRes.id, 'rates', newRates, importRegion);
                    } else {
                        await window.api.db.createResource({
                            code: item.code,
                            description: item.description,
                            unit: item.unit,
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
                            <TextField select fullWidth size="small" label="TARGET REGION" value={importRegion} onChange={e => setImportRegion(e.target.value)}>
                                {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                            </TextField>

                            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                            <Button
                                variant="contained"
                                startIcon={<UploadIcon />}
                                disabled={!importRegion}
                                onClick={() => fileInputRef.current.click()}
                            >
                                UPLOAD
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)', borderRadius: 2 }}>
                        <Typography variant="subtitle2" mb={2}>MANAGE_REGIONS</Typography>
                        <Box display="flex" gap={1}>
                            <TextField fullWidth size="small" label="NEW_REGION" value={newRegion} onChange={e => setNewRegion(e.target.value)} />
                            <Button variant="contained" disabled={!newRegion} onClick={async () => { await window.api.db.createRegion(newRegion); setNewRegion(""); loadData(); }}>ADD</Button>
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
                        <Button variant="contained" onClick={async () => { await window.api.db.createResource({ code: resCode, description: resDesc, unit: resUnit }); setResCode(""); setResDesc(""); loadData(); }}>ADD</Button>
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

            {/* REDESIGNED EXCEL-STYLE TABLE */}
            <TableContainer component={Paper} sx={{ maxHeight: '60vh', border: '1px solid', borderColor: 'divider' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: '#0b172d', width: 40, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>NO</TableCell>
                            <TableCell sx={{ bgcolor: '#0b172d', width: 120, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CODE</TableCell>
                            <TableCell sx={{ bgcolor: '#0b172d', color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DESCRIPTION</TableCell>
                            <TableCell sx={{ bgcolor: '#0b172d', width: 80, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UNIT</TableCell>

                            {regions.map(r => (
                                <TableCell key={r.id} sx={{ bgcolor: '#0b172d', minWidth: 120 }}>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <Typography sx={{ color: 'primary.main', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                            {r.name.toUpperCase()}
                                        </Typography>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteRegion(r.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </Box>
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{ bgcolor: '#0b172d', width: 80, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTIONS</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedResources.map((res, index) => (
                            <TableRow key={res.id} hover>
                                <TableCell sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                    {res.code || '---'}
                                </TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                    {res.description}
                                </TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                    {res.unit}
                                </TableCell>

                                {regions.map(r => (
                                    <TableCell key={r.id}>
                                        {/* 🔥 Using the isolated, high-performance cell here */}
                                        <RateInputCell
                                            resource={res}
                                            regionName={r.name}
                                            onSave={(resId, val) => updateResourceRate(resId, 'rates', { ...res.rates, [r.name]: val }, r.name)}
                                        />
                                    </TableCell>
                                ))}

                                <TableCell align="right">
                                    <IconButton size="small" color="primary" onClick={() => setSelectedResource(res)}><TimelineIcon fontSize="small" /></IconButton>
                                    <IconButton size="small" color="error" onClick={() => deleteResource(res.id)}><DeleteIcon fontSize="small" /></IconButton>
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