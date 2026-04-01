import { useState, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import * as XLSX from "xlsx";
import { getResourceRate, calculateMasterBoqRate } from "../engines/calculationEngine";
import {
    Box, Button, Typography, Paper, Grid, Alert, Tabs, Tab, TextField, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Chip,
    TablePagination, TableSortLabel, InputAdornment, Stack, Divider
} from "@mui/material";
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';

// --- FIXED RESIZER COMPONENT ---
const Resizer = ({ onMouseDown }) => (
    <div
        onMouseDown={onMouseDown}
        style={{
            display: 'inline-block',
            width: '10px',
            height: '100%',
            position: 'absolute',
            right: 0,
            top: 0,
            cursor: 'col-resize',
            zIndex: 1,
            backgroundColor: 'transparent',
            transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'}
        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
    />
);

// --- INTEGRATED COMPONENT: Master BOQ DataGrid ---
function MasterBOQTab({ masterBoqs, regions, resources, editMasterBoq, deleteMasterBoq }) {
    const [searchCode, setSearchCode] = useState('');
    const [searchDesc, setSearchDesc] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [previewRegion, setPreviewRegion] = useState('');

    // Column Width State
    const [colWidths, setColWidths] = useState({
        code: 150,
        desc: 400,
        unit: 100,
        rate: 150,
        actions: 150
    });

    // Smarter Resize Math: Grabs the actual rendered width to prevent jumping
    const handleResizeStart = (colKey) => (e) => {
        e.preventDefault();
        const startX = e.clientX;

        // Get the actual physical width of the column from the DOM
        const thElement = e.target.closest('th');
        const startWidth = thElement ? thElement.getBoundingClientRect().width : colWidths[colKey];

        const handleMouseMove = (moveEvent) => {
            const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
            setColWidths(prev => ({ ...prev, [colKey]: newWidth }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleSortToggle = () => {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    };

    const processedBOQs = useMemo(() => {
        let filtered = masterBoqs.filter((boq) => {
            const matchCode = boq.itemCode?.toLowerCase().includes(searchCode.toLowerCase());
            const matchDesc = boq.description?.toLowerCase().includes(searchDesc.toLowerCase());
            return matchCode && matchDesc;
        });

        filtered.sort((a, b) => {
            const codeA = a.itemCode || '';
            const codeB = b.itemCode || '';
            return sortDirection === 'asc'
                ? codeA.localeCompare(codeB, undefined, { numeric: true })
                : codeB.localeCompare(codeA, undefined, { numeric: true });
        });

        return filtered;
    }, [masterBoqs, searchCode, searchDesc, sortDirection]);

    const paginatedBOQs = useMemo(() => {
        const startIndex = page * rowsPerPage;
        return processedBOQs.slice(startIndex, startIndex + rowsPerPage);
    }, [processedBOQs, page, rowsPerPage]);

    return (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>
            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <TextField
                    label="Search by Item Code"
                    variant="outlined"
                    size="small"
                    value={searchCode}
                    onChange={(e) => { setSearchCode(e.target.value); setPage(0); }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                    sx={{ width: '200px' }}
                />
                <TextField
                    label="Search by Description"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={searchDesc}
                    onChange={(e) => { setSearchDesc(e.target.value); setPage(0); }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <TextField
                    select
                    size="small"
                    label="Preview Rate for Region"
                    value={previewRegion}
                    onChange={e => setPreviewRegion(e.target.value)}
                    sx={{ minWidth: 200 }}
                    color="primary"
                    focused
                >
                    <MenuItem value="">-- Select Region --</MenuItem>
                    {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                </TextField>
            </Stack>

            <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ overflowX: 'auto', width: '100%', borderRadius: 3 }}>
                {/* minWidth: '100%' ensures the table never shrinks smaller than the layout container */}
                <Table size="small" sx={{ tableLayout: 'fixed', minWidth: '100%', width: Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
                    <TableHead sx={{ bgcolor: 'background.default' }}>
                        <TableRow>
                            <TableCell sx={{ width: colWidths.code, position: 'relative', overflow: 'visible' }}>
                                <TableSortLabel active={true} direction={sortDirection} onClick={handleSortToggle}>
                                    <strong>Item Code</strong>
                                </TableSortLabel>
                                <Resizer onMouseDown={handleResizeStart('code')} />
                            </TableCell>

                            <TableCell sx={{ width: colWidths.desc, position: 'relative', overflow: 'visible' }}>
                                <strong>Description</strong>
                                <Resizer onMouseDown={handleResizeStart('desc')} />
                            </TableCell>

                            <TableCell sx={{ width: colWidths.unit, position: 'relative', overflow: 'visible' }}>
                                <strong>Unit</strong>
                                <Resizer onMouseDown={handleResizeStart('unit')} />
                            </TableCell>

                            <TableCell sx={{ width: colWidths.rate, position: 'relative', overflow: 'visible' }}>
                                <strong>Rate Preview</strong>
                                <Resizer onMouseDown={handleResizeStart('rate')} />
                            </TableCell>

                            <TableCell align="center" sx={{ width: colWidths.actions }}>
                                <strong>Actions</strong>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedBOQs.length > 0 ? (
                            paginatedBOQs.map((b) => {
                                const rate = previewRegion ? calculateMasterBoqRate(b, resources, masterBoqs, previewRegion) : 0;
                                return (
                                    <TableRow key={b.id} hover>
                                        <TableCell sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {b.itemCode || '-'}
                                        </TableCell>
                                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {b.description}
                                        </TableCell>
                                        <TableCell>{b.unit}</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: previewRegion ? 'success.main' : 'text.secondary' }}>
                                            {previewRegion ? `₹ ${rate.toFixed(2)}` : 'Select Region ↑'}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box display="flex" gap={1} justifyContent="center">
                                                <Button size="small" variant="outlined" color="warning" onClick={() => editMasterBoq(b)}>Edit</Button>
                                                <Button size="small" variant="outlined" color="error" onClick={() => deleteMasterBoq(b.id)}>Delete</Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>No BOQ items match your search.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={processedBOQs.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
        </Box>
    );
}


export default function DatabaseEditor({ onBack }) {
    const [tab, setTab] = useState("resources");

    const regions = useLiveQuery(() => db.regions.toArray(), []) || [];
    const resources = useLiveQuery(() => db.resources.toArray(), []) || [];
    const masterBoqs = useLiveQuery(() => db.masterBoq.toArray(), []) || [];

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

    const [editingBoqId, setEditingBoqId] = useState(null);
    const [boqCode, setBoqCode] = useState("");
    const [boqDesc, setBoqDesc] = useState("");
    const [boqUnit, setBoqUnit] = useState("cum");
    const [boqOH, setBoqOH] = useState(10);
    const [boqProfit, setBoqProfit] = useState(10);
    const [previewRegion, setPreviewRegion] = useState("");
    const [boqRows, setBoqRows] = useState([]);

    const fileInputRef = useRef(null);

    const handleAddRegion = async () => {
        if (newRegion) {
            await db.regions.add({ id: crypto.randomUUID(), name: newRegion });
            setNewRegion("");
        }
    };

    const handleDeleteRegion = async (regionId, regionName) => {
        if (window.confirm(`Are you sure you want to delete the region "${regionName}"? All local rates for this region will be permanently erased.`)) {
            await db.regions.delete(regionId);
            const allResources = await db.resources.toArray();
            const updates = [];
            for (const res of allResources) {
                if (res.rates && res.rates[regionName] !== undefined) {
                    const newRates = { ...res.rates };
                    delete newRates[regionName];
                    updates.push({ ...res, rates: newRates });
                }
            }
            if (updates.length > 0) {
                await db.resources.bulkPut(updates);
            }
        }
    };

    const addResourceManually = async () => { if (!resDesc) return; await db.resources.add({ id: crypto.randomUUID(), code: resCode, description: resDesc, unit: resUnit, rates: {} }); setResCode(""); setResDesc(""); };
    const updateResourceInline = (id, field, value) => db.resources.update(id, { [field]: value });
    const deleteResource = async (id) => { if (window.confirm("Delete this resource?")) await db.resources.delete(id); };

    const handleSort = (field) => {
        if (sortField === field) setSortAsc(!sortAsc);
        else { setSortField(field); setSortAsc(true); }
        setCurrentPage(1);
    };

    const handleExcelUpload = (e) => {
        if (!importRegion) return alert("Select a region for import first.");
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });

            let headerIdx = -1;
            for (let i = 0; i < 20; i++) if (jsonData[i] && jsonData[i].includes("Code") && jsonData[i].includes("Description")) { headerIdx = i; break; }
            if (headerIdx === -1) return alert("Invalid Excel Format");

            const headers = jsonData[headerIdx];
            const codeIdx = headers.indexOf("Code"), descIdx = headers.indexOf("Description"), unitIdx = headers.indexOf("Unit"), rateIdx = headers.findIndex(h => h && String(h).toLowerCase().includes("lmr rate"));

            let updates = [], adds = [];
            const currentResources = await db.resources.toArray();

            for (let i = headerIdx + 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || !row[descIdx]) continue;
                const code = String(row[codeIdx] || "").trim(), desc = String(row[descIdx]).trim(), unit = String(row[unitIdx] || "").trim(), rate = Number(String(row[rateIdx]).replace(/,/g, '')) || 0;
                if (rate > 0) {
                    const existing = currentResources.find(r => (code && r.code === code) || r.description === desc);
                    if (existing) { existing.rates[importRegion] = rate; updates.push(existing); }
                    else { const newItem = { id: crypto.randomUUID(), code, description: desc, unit, rates: { [importRegion]: rate } }; adds.push(newItem); currentResources.push(newItem); }
                }
            }
            if (updates.length > 0) if (!window.confirm(`Found ${updates.length} existing items. Update their rates for ${importRegion}?`)) updates = [];
            if (adds.length > 0 || updates.length > 0) { await db.resources.bulkPut([...updates, ...adds]); alert(`Success! Appended ${adds.length} new items, updated ${updates.length} existing.`); }
            else alert("No items imported.");
            e.target.value = null;
        };
        reader.readAsArrayBuffer(file);
    };

    const addSpreadsheetRow = () => setBoqRows([...boqRows, { id: crypto.randomUUID(), itemType: "resource", itemId: "", qty: 1 }]);
    const updateSpreadsheetRow = (id, field, value) => setBoqRows(boqRows.map(row => row.id === id ? { ...row, [field]: value, ...(field === 'itemType' ? { itemId: "" } : {}) } : row));
    const removeSpreadsheetRow = (id) => setBoqRows(boqRows.filter(row => row.id !== id));

    const saveMasterBoq = async () => {
        if (!boqCode || !boqDesc) return alert("Please enter a Code and Description.");
        const validComponents = boqRows.filter(r => r.itemId && r.qty > 0).map(r => ({ itemType: r.itemType, itemId: r.itemId, qty: Number(r.qty) }));
        if (validComponents.length === 0) return alert("Add at least one component.");
        const payload = { itemCode: boqCode, description: boqDesc, unit: boqUnit, overhead: Number(boqOH), profit: Number(boqProfit), components: validComponents };

        if (editingBoqId) { await db.masterBoq.update(editingBoqId, payload); alert("Master BOQ Item Updated!"); }
        else { await db.masterBoq.add({ id: crypto.randomUUID(), ...payload }); alert("Master BOQ Item Created!"); }
        setEditingBoqId(null); setBoqCode(""); setBoqDesc(""); setBoqRows([]);
    };

    const editMasterBoq = (b) => {
        setEditingBoqId(b.id); setBoqCode(b.itemCode || ""); setBoqDesc(b.description); setBoqUnit(b.unit); setBoqOH(b.overhead || 0); setBoqProfit(b.profit || 0);
        setBoqRows(b.components.map(c => ({ id: crypto.randomUUID(), itemType: c.itemType || 'resource', itemId: c.itemId, qty: c.qty })));
        setTab("createBoq");
    };
    const deleteMasterBoq = async (id) => { if (window.confirm("Delete this Master BOQ item?")) await db.masterBoq.delete(id); };

    const exportDatabase = () => {
        const data = { regions, resources, masterBoq: masterBoqs, exportDate: new Date().toISOString(), type: "MasterDatabase" };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `Master_DB_Template_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`; a.click(); URL.revokeObjectURL(url);
    };

    const importDatabase = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!window.confirm("WARNING: This will overwrite your Master Database (Rates and BOQs). Active projects will NOT be affected. Proceed?")) { e.target.value = null; return; }
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.type !== "MasterDatabase" && !data.masterBoq) throw new Error("Invalid format");
                await db.transaction('rw', db.regions, db.resources, db.masterBoq, async () => {
                    await db.regions.clear(); await db.resources.clear(); await db.masterBoq.clear();
                    if (data.regions?.length) await db.regions.bulkAdd(data.regions);
                    if (data.resources?.length) await db.resources.bulkAdd(data.resources);
                    if (data.masterBoq?.length) await db.masterBoq.bulkAdd(data.masterBoq);
                });
                alert("Master Database successfully restored!");
            } catch (err) { alert("Failed to import. Please ensure this is a Master Database backup file."); }
            e.target.value = null;
        };
        reader.readAsText(file);
    };

    const filteredResources = useMemo(() => {
        let filtered = resources.filter(r => (r.code || "").toLowerCase().includes(searchCode.toLowerCase()) && (r.description || "").toLowerCase().includes(searchDesc.toLowerCase()));
        filtered.sort((a, b) => { let valA = (a[sortField] || "").toLowerCase(), valB = (b[sortField] || "").toLowerCase(); if (valA < valB) return sortAsc ? -1 : 1; if (valA > valB) return sortAsc ? 1 : -1; return 0; });
        return filtered;
    }, [resources, searchCode, searchDesc, sortField, sortAsc]);

    const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
    const paginatedResources = filteredResources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const { renderedRows, subTotal, grandTotal, ohAmount, profitAmount } = useMemo(() => {
        let sub = 0;
        const rows = boqRows.map(row => {
            let rate = 0; let unit = "-";
            if (row.itemType === 'resource') { const resource = resources.find(r => r.id === row.itemId); if (resource) { rate = getResourceRate(resource, previewRegion); unit = resource.unit; } }
            else if (row.itemType === 'boq') { const nestedBoq = masterBoqs.find(b => b.id === row.itemId); if (nestedBoq) { rate = calculateMasterBoqRate(nestedBoq, resources, masterBoqs, previewRegion); unit = nestedBoq.unit; } }
            const amount = rate * (Number(row.qty) || 0); sub += amount;
            return { ...row, rate, unit, amount };
        });
        const oh = sub * (Number(boqOH) / 100), prof = sub * (Number(boqProfit) / 100);
        return { renderedRows: rows, subTotal: sub, ohAmount: oh, profitAmount: prof, grandTotal: sub + oh + prof };
    }, [boqRows, resources, masterBoqs, previewRegion, boqOH, boqProfit]);

    const tableInputStyle = { width: "100%", padding: "6px", boxSizing: "border-box", border: "1px solid transparent", background: "transparent", color: "inherit", fontFamily: "inherit" };
    const tableInputActiveStyle = { ...tableInputStyle, border: "1px solid var(--mui-palette-divider)", borderRadius: "4px", background: "var(--mui-palette-background-default)" };

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" color="inherit" sx={{ borderRadius: 2 }}>
                    Home
                </Button>
                <Typography variant="h4" fontWeight="bold">Database Manager</Typography>
            </Box>

            <Paper elevation={0} variant="outlined" sx={{ mb: 4, borderRadius: 3 }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
                    <Tab value="resources" label="1. Manage Resources" sx={{ fontWeight: 'bold' }} />
                    <Tab value="createBoq" label={`2. ${editingBoqId ? "Edit" : "Create"} Master BOQ`} sx={{ fontWeight: 'bold' }} />
                    <Tab value="viewBoq" label="3. View Master BOQs" sx={{ fontWeight: 'bold' }} />
                    <Tab value="backup" label="4. Backup Master Data" sx={{ fontWeight: 'bold' }} />
                </Tabs>
            </Paper>

            {tab === "backup" && (
                <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
                    <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
                        This section manages your <b>Master Template Data</b> (Regions, Resources, and Master BOQs).
                        Your client projects and estimates are safely exported/imported from the main Home screen.
                    </Alert>
                    <Grid container spacing={4}>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center', height: '100%', borderRadius: 3 }}>
                                <CloudDownloadIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h6" gutterBottom>Export Master DB</Typography>
                                <Typography variant="body2" color="text.secondary" paragraph>Download your master database (regions, rates, and master BOQ assemblies) as a template.</Typography>
                                <Button variant="contained" disableElevation size="large" onClick={exportDatabase} sx={{ mt: 2, borderRadius: 2 }}>Download Master File</Button>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center', height: '100%', borderStyle: 'dashed', borderColor: 'error.main', borderRadius: 3 }}>
                                <CloudUploadIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
                                <Typography variant="h6" color="error.main" gutterBottom>Restore Master DB</Typography>
                                <Typography variant="body2" color="text.secondary" paragraph>Upload a previously saved Master DB file. <br /><b>WARNING: Overwrites Master Database.</b></Typography>
                                <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={importDatabase} />
                                <Button variant="outlined" color="error" size="large" onClick={() => fileInputRef.current.click()} sx={{ mt: 2, borderRadius: 2 }}>Upload Master File</Button>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {tab === "resources" && (
                <Box>
                    <Grid container spacing={3} mb={3}>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3 }}>
                                <Typography variant="subtitle1" fontWeight="bold" mb={2}>Import Excel (LMR)</Typography>
                                <Box display="flex" gap={2} alignItems="center">
                                    <TextField select size="small" label="Target Region" value={importRegion} onChange={e => setImportRegion(e.target.value)} sx={{ minWidth: 150 }}>
                                        {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                                    </TextField>
                                    <input type="file" accept=".xls,.xlsx" onChange={handleExcelUpload} style={{ color: "var(--mui-palette-text-primary)" }} />
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3 }}>
                                <Typography variant="subtitle1" fontWeight="bold" mb={2}>Manage Regions</Typography>
                                <Box display="flex" gap={2}>
                                    <TextField size="small" label="New Region Name" value={newRegion} onChange={e => setNewRegion(e.target.value)} fullWidth />
                                    <Button variant="contained" disableElevation onClick={handleAddRegion} sx={{ borderRadius: 2 }}>Add</Button>
                                </Box>
                                {regions.length > 0 && (
                                    <Box display="flex" gap={1} flexWrap="wrap" mt={2} pt={2} borderTop="1px dashed" borderColor="divider">
                                        {regions.map(r => (
                                            <Chip key={r.id} label={r.name} onDelete={() => handleDeleteRegion(r.id, r.name)} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                                        ))}
                                    </Box>
                                )}
                            </Paper>
                        </Grid>
                    </Grid>

                    <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" fontWeight="bold" mb={1}>Search Resources</Typography>
                                <Box display="flex" gap={2}>
                                    <TextField size="small" label="Search Code" value={searchCode} onChange={e => { setSearchCode(e.target.value); setCurrentPage(1); }} />
                                    <TextField size="small" label="Search Description" value={searchDesc} onChange={e => { setSearchDesc(e.target.value); setCurrentPage(1); }} fullWidth />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" fontWeight="bold" mb={1}>Add Manual Resource</Typography>
                                <Box display="flex" gap={1}>
                                    <TextField size="small" label="Code" value={resCode} onChange={e => setResCode(e.target.value)} sx={{ width: 100 }} />
                                    <TextField size="small" label="Description" value={resDesc} onChange={e => setResDesc(e.target.value)} fullWidth />
                                    <TextField size="small" label="Unit" value={resUnit} onChange={e => setResUnit(e.target.value)} sx={{ width: 80 }} />
                                    <Button variant="contained" disableElevation onClick={addResourceManually} sx={{ borderRadius: 2 }}>Add</Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                            Showing {paginatedResources.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredResources.length)} of {filteredResources.length}
                        </Typography>
                        <Box display="flex" gap={1} alignItems="center">
                            <Button size="small" variant="outlined" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} sx={{ borderRadius: 2 }}>Prev</Button>
                            <Typography variant="body2" fontWeight="bold">Page {currentPage} of {totalPages || 1}</Typography>
                            <Button size="small" variant="outlined" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} sx={{ borderRadius: 2 }}>Next</Button>
                        </Box>
                    </Box>

                    <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ maxHeight: 600, borderRadius: 3 }}>
                        <Table stickyHeader size="small" sx={{ minWidth: '100%' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: 60, bgcolor: 'background.default' }}>Action</TableCell>
                                    <TableCell onClick={() => handleSort('code')} sx={{ cursor: 'pointer', width: 120, bgcolor: 'background.default' }}>Code {sortField === 'code' ? (sortAsc ? '↑' : '↓') : ''}</TableCell>
                                    <TableCell onClick={() => handleSort('description')} sx={{ cursor: 'pointer', bgcolor: 'background.default' }}>Description {sortField === 'description' ? (sortAsc ? '↑' : '↓') : ''}</TableCell>
                                    <TableCell sx={{ width: 100, bgcolor: 'background.default' }}>Unit</TableCell>
                                    {regions.map(r => <TableCell key={r.id} sx={{ color: 'primary.main', fontWeight: 'bold', width: 120, bgcolor: 'background.default' }}>{r.name}</TableCell>)}
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
                                {paginatedResources.length === 0 && <TableRow><TableCell colSpan={4 + regions.length} align="center" sx={{ py: 3 }}>No matching resources.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {tab === "createBoq" && (
                <Paper elevation={0} variant="outlined" sx={{ p: 4, borderRadius: 3 }}>
                    <Typography variant="h6" fontWeight="bold" mb={3}>
                        {editingBoqId ? "Edit" : "Create"} Master BOQ Item
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Box display="flex" gap={3} flexWrap="wrap" mb={4}>
                        <TextField label="Unique Item Code" value={boqCode} onChange={e => setBoqCode(e.target.value)} placeholder="e.g. BOQ-001" sx={{ flex: 1, minWidth: 150 }} />
                        <TextField label="Item Description" value={boqDesc} onChange={e => setBoqDesc(e.target.value)} placeholder="e.g. Earthwork..." sx={{ flex: 2, minWidth: 300 }} />
                        <TextField label="Unit" value={boqUnit} onChange={e => setBoqUnit(e.target.value)} sx={{ width: 100 }} />
                        <TextField select label="Live Preview Region" value={previewRegion} onChange={e => setPreviewRegion(e.target.value)} sx={{ flex: 1, minWidth: 200 }} color="primary" focused>
                            <MenuItem value="">-- Default Rate --</MenuItem>
                            {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                        </TextField>
                    </Box>

                    <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'action.hover' }}>
                                <TableRow>
                                    <TableCell sx={{ width: '12%' }}>Type</TableCell>
                                    <TableCell sx={{ width: '15%' }}>Code Search</TableCell>
                                    <TableCell sx={{ width: '30%' }}>Description Search</TableCell>
                                    <TableCell sx={{ width: '8%' }}>Unit</TableCell>
                                    <TableCell sx={{ width: '10%' }}>Quantity</TableCell>
                                    <TableCell sx={{ width: '10%' }}>Rate</TableCell>
                                    <TableCell sx={{ width: '10%' }}>Amount</TableCell>
                                    <TableCell align="center" sx={{ width: '5%' }}>Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {renderedRows.map((row) => {
                                    const sourceList = row.itemType === 'boq' ? masterBoqs : resources;
                                    return (
                                        <TableRow key={row.id}>
                                            <TableCell>
                                                <select value={row.itemType} onChange={e => updateSpreadsheetRow(row.id, 'itemType', e.target.value)} style={tableInputActiveStyle}>
                                                    <option value="resource">Resource</option><option value="boq">Master BOQ</option>
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <select value={row.itemId} onChange={e => updateSpreadsheetRow(row.id, 'itemId', e.target.value)} style={tableInputActiveStyle}>
                                                    <option value="">-- Code --</option>
                                                    {sourceList.filter(s => s.code || s.itemCode).map(s => <option key={s.id} value={s.id}>{s.code || s.itemCode}</option>)}
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <select value={row.itemId} onChange={e => updateSpreadsheetRow(row.id, 'itemId', e.target.value)} style={tableInputActiveStyle}>
                                                    <option value="">-- Description --</option>
                                                    {sourceList.map(s => <option key={s.id} value={s.id}>{s.description}</option>)}
                                                </select>
                                            </TableCell>
                                            <TableCell color="text.secondary">{row.unit}</TableCell>
                                            <TableCell><input type="number" value={row.qty} onChange={e => updateSpreadsheetRow(row.id, 'qty', e.target.value)} style={tableInputActiveStyle} /></TableCell>
                                            <TableCell color="text.secondary">₹ {row.rate.toFixed(2)}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>₹ {row.amount.toFixed(2)}</TableCell>
                                            <TableCell align="center"><IconButton size="small" color="error" onClick={() => removeSpreadsheetRow(row.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Button variant="outlined" disableElevation onClick={addSpreadsheetRow} sx={{ mb: 4, borderRadius: 2 }}>+ Add Component Row</Button>

                    <Box display="flex" justifyContent="flex-end">
                        <Paper elevation={0} variant="outlined" sx={{ width: 400, p: 3, bgcolor: 'action.hover', borderRadius: 3 }}>
                            <Box display="flex" justifyContent="space-between" mb={2}><Typography>Subtotal:</Typography><Typography fontWeight="bold">₹ {subTotal.toFixed(2)}</Typography></Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Box display="flex" alignItems="center" gap={1}><Typography>Overhead (%):</Typography><input type="number" value={boqOH} onChange={e => setBoqOH(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} /></Box>
                                <Typography>₹ {ohAmount.toFixed(2)}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} borderBottom="2px solid" borderColor="divider">
                                <Box display="flex" alignItems="center" gap={1}><Typography>Profit (%):</Typography><input type="number" value={boqProfit} onChange={e => setBoqProfit(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} /></Box>
                                <Typography>₹ {profitAmount.toFixed(2)}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" mb={3} color="success.main">
                                <Typography variant="h6" fontWeight="bold">Final Rate per {boqUnit}:</Typography>
                                <Typography variant="h6" fontWeight="bold">₹ {grandTotal.toFixed(2)}</Typography>
                            </Box>
                            <Button variant="contained" color="success" fullWidth size="large" onClick={saveMasterBoq} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2 }}>
                                {editingBoqId ? "Update Item" : "Save Item"}
                            </Button>
                        </Paper>
                    </Box>
                </Paper>
            )}

            {tab === "viewBoq" && (
                <Box>
                    <Typography variant="h6" fontWeight="bold" mb={3}>Existing Master BOQ Items</Typography>
                    <MasterBOQTab
                        masterBoqs={masterBoqs}
                        regions={regions}
                        resources={resources}
                        editMasterBoq={editMasterBoq}
                        deleteMasterBoq={deleteMasterBoq}
                    />
                </Box>
            )}
        </Box>
    );
}