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
        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
    />
);

function MasterBOQTab({ masterBoqs, regions, resources, editMasterBoq, deleteMasterBoq }) {
    const [searchCode, setSearchCode] = useState('');
    const [searchDesc, setSearchDesc] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [previewRegion, setPreviewRegion] = useState('');

    const [colWidths, setColWidths] = useState({
        code: 150,
        desc: 400,
        unit: 100,
        rate: 150,
        actions: 150
    });

    const handleResizeStart = (colKey) => (e) => {
        e.preventDefault();
        const startX = e.clientX;
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
                    label="SEARCH_CODE"
                    variant="outlined"
                    size="small"
                    value={searchCode}
                    onChange={(e) => { setSearchCode(e.target.value); setPage(0); }}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                        sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }
                    }}
                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                    sx={{ width: '200px' }}
                />
                <TextField
                    label="SEARCH_DESC"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={searchDesc}
                    onChange={(e) => { setSearchDesc(e.target.value); setPage(0); }}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                        sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }
                    }}
                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                />
                <TextField
                    select
                    size="small"
                    label="PREVIEW_REGION"
                    value={previewRegion}
                    onChange={e => setPreviewRegion(e.target.value)}
                    sx={{ minWidth: 200 }}
                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                >
                    <MenuItem value="">-- SELECT_REGION --</MenuItem>
                    {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{r.name}</MenuItem>)}
                </TextField>
            </Stack>

            <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ overflowX: 'auto', width: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Table size="small" sx={{ tableLayout: 'fixed', minWidth: '100%', width: Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell sx={{ width: colWidths.code, position: 'relative', overflow: 'visible', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                <TableSortLabel active={true} direction={sortDirection} onClick={handleSortToggle}>
                                    <strong>ITEM_CODE</strong>
                                </TableSortLabel>
                                <Resizer onMouseDown={handleResizeStart('code')} />
                            </TableCell>

                            <TableCell sx={{ width: colWidths.desc, position: 'relative', overflow: 'visible', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                <strong>DESCRIPTION</strong>
                                <Resizer onMouseDown={handleResizeStart('desc')} />
                            </TableCell>

                            <TableCell sx={{ width: colWidths.unit, position: 'relative', overflow: 'visible', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                <strong>UNIT</strong>
                                <Resizer onMouseDown={handleResizeStart('unit')} />
                            </TableCell>

                            <TableCell sx={{ width: colWidths.rate, position: 'relative', overflow: 'visible', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                <strong>RATE_PREVIEW</strong>
                                <Resizer onMouseDown={handleResizeStart('rate')} />
                            </TableCell>

                            <TableCell align="center" sx={{ width: colWidths.actions, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                <strong>ACTIONS</strong>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedBOQs.length > 0 ? (
                            paginatedBOQs.map((b) => {
                                const rate = previewRegion ? calculateMasterBoqRate(b, resources, masterBoqs, previewRegion) : 0;
                                return (
                                    <TableRow key={b.id} hover>
                                        <TableCell sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                            {b.itemCode || '-'}
                                        </TableCell>
                                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                            {b.description}
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{b.unit}</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: previewRegion ? 'success.main' : 'text.disabled', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                            {previewRegion ? `₹ ${rate.toFixed(2)}` : 'SELECT_REGION'}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box display="flex" gap={1} justifyContent="center">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="warning"
                                                    onClick={() => editMasterBoq(b)}
                                                    sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }}
                                                >
                                                    EDIT
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    onClick={() => deleteMasterBoq(b.id)}
                                                    sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }}
                                                >
                                                    DELETE
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary' }}>NO_MATCHING_ITEMS</TableCell>
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
                sx={{ fontFamily: "'JetBrains Mono', monospace" }}
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

    const tableInputStyle = { width: "100%", padding: "6px", boxSizing: "border-box", border: "1px solid transparent", background: "transparent", color: "inherit", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" };
    const tableInputActiveStyle = { ...tableInputStyle, border: "1px solid var(--mui-palette-divider)", borderRadius: "4px", background: "var(--mui-palette-background-default)" };

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={onBack}
                    variant="outlined"
                    color="inherit"
                    sx={{
                        borderRadius: 2,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '1px',
                        fontSize: '12px',
                        borderColor: 'divider',
                        color: 'text.secondary',
                        '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                    }}
                >
                    {'< '}HOME
                </Button>
                <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '1px',
                        fontSize: { xs: '18px', md: '22px' },
                    }}
                >
                    DATABASE_MANAGER
                </Typography>
            </Box>

            <Paper elevation={0} variant="outlined" sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
                    <Tab value="resources" label="01_RESOURCES" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="createBoq" label={`02_${editingBoqId ? "EDIT" : "CREATE"}_BOQ`} sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="viewBoq" label="03_VIEW_BOQS" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="backup" label="04_BACKUP" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                </Tabs>
            </Paper>

            {tab === "backup" && (
                <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
                    <Alert severity="info" sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                        <strong>MASTER_TEMPLATE_DATA</strong> — Regions, Resources, and Master BOQs.
                        Client projects are exported/imported from the Home screen.
                    </Alert>
                    <Grid container spacing={4}>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center', height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                                <CloudDownloadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                <Typography variant="h6" gutterBottom sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '14px' }}>EXPORT_DB</Typography>
                                <Typography variant="body2" color="text.secondary" paragraph>Download master database as template.</Typography>
                                <Button
                                    variant="contained"
                                    disableElevation
                                    size="large"
                                    onClick={exportDatabase}
                                    sx={{ mt: 2, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}
                                >
                                    DOWNLOAD
                                </Button>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center', height: '100%', borderStyle: 'dashed', borderColor: 'error.main', borderRadius: 2, bgcolor: 'rgba(239, 68, 68, 0.03)' }}>
                                <CloudUploadIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
                                <Typography variant="h6" color="error.main" gutterBottom sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '14px' }}>RESTORE_DB</Typography>
                                <Typography variant="body2" color="text.secondary" paragraph>Upload Master DB file. <br /><strong>WARNING: Overwrites Master Database.</strong></Typography>
                                <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={importDatabase} />
                                <Button
                                    variant="outlined"
                                    color="error"
                                    size="large"
                                    onClick={() => fileInputRef.current.click()}
                                    sx={{ mt: 2, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}
                                >
                                    UPLOAD
                                </Button>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {tab === "resources" && (
                <Box>
                    <Grid container spacing={3} mb={3}>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                                <Typography variant="subtitle1" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '13px' }}>IMPORT_EXCEL_LMR</Typography>
                                <Box display="flex" gap={2} alignItems="center">
                                    <TextField
                                        select
                                        size="small"
                                        label="TARGET_REGION"
                                        value={importRegion}
                                        onChange={e => setImportRegion(e.target.value)}
                                        sx={{ minWidth: 150 }}
                                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                    >
                                        {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{r.name}</MenuItem>)}
                                    </TextField>
                                    <input type="file" accept=".xls,.xlsx" onChange={handleExcelUpload} style={{ color: "var(--mui-palette-text-primary)" }} />
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                                <Typography variant="subtitle1" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '13px' }}>MANAGE_REGIONS</Typography>
                                <Box display="flex" gap={2}>
                                    <TextField
                                        size="small"
                                        label="NEW_REGION"
                                        value={newRegion}
                                        onChange={e => setNewRegion(e.target.value)}
                                        fullWidth
                                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                    />
                                    <Button
                                        variant="contained"
                                        disableElevation
                                        onClick={handleAddRegion}
                                        sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}
                                    >
                                        ADD
                                    </Button>
                                </Box>
                                {regions.length > 0 && (
                                    <Box display="flex" gap={1} flexWrap="wrap" mt={2} pt={2} borderTop="1px dashed" borderColor="divider">
                                        {regions.map(r => (
                                            <Chip
                                                key={r.id}
                                                label={r.name}
                                                onDelete={() => handleDeleteRegion(r.id, r.name)}
                                                size="small"
                                                variant="outlined"
                                                sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }}
                                            />
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
                                <Box display="flex" gap={2}>
                                    <TextField
                                        size="small"
                                        label="SEARCH_CODE"
                                        value={searchCode}
                                        onChange={e => { setSearchCode(e.target.value); setCurrentPage(1); }}
                                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                    />
                                    <TextField
                                        size="small"
                                        label="SEARCH_DESC"
                                        value={searchDesc}
                                        onChange={e => { setSearchDesc(e.target.value); setCurrentPage(1); }}
                                        fullWidth
                                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" fontWeight="bold" mb={1} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '12px' }}>ADD_RESOURCE</Typography>
                                <Box display="flex" gap={1}>
                                    <TextField
                                        size="small"
                                        label="CODE"
                                        value={resCode}
                                        onChange={e => setResCode(e.target.value)}
                                        sx={{ width: 100 }}
                                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                    />
                                    <TextField
                                        size="small"
                                        label="DESCRIPTION"
                                        value={resDesc}
                                        onChange={e => setResDesc(e.target.value)}
                                        fullWidth
                                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                    />
                                    <TextField
                                        size="small"
                                        label="UNIT"
                                        value={resUnit}
                                        onChange={e => setResUnit(e.target.value)}
                                        sx={{ width: 80 }}
                                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                    />
                                    <Button
                                        variant="contained"
                                        disableElevation
                                        onClick={addResourceManually}
                                        sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}
                                    >
                                        ADD
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                            SHOWING {paginatedResources.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} TO {Math.min(currentPage * itemsPerPage, filteredResources.length)} OF {filteredResources.length}
                        </Typography>
                        <Box display="flex" gap={1} alignItems="center">
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}
                            >
                                PREV
                            </Button>
                            <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>PAGE {currentPage} OF {totalPages || 1}</Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage(p => p + 1)}
                                sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}
                            >
                                NEXT
                            </Button>
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
            )}

            {tab === "createBoq" && (
                <Paper elevation={0} variant="outlined" sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Typography variant="h6" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}>
                        {editingBoqId ? "EDIT" : "CREATE"}_MASTER_BOQ
                    </Typography>
                    <Divider sx={{ mb: 3, borderColor: 'divider' }} />

                    <Box display="flex" gap={3} flexWrap="wrap" mb={4}>
                        <TextField
                            label="ITEM_CODE"
                            value={boqCode}
                            onChange={e => setBoqCode(e.target.value)}
                            placeholder="e.g. BOQ-001"
                            sx={{ flex: 1, minWidth: 150 }}
                            InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                        />
                        <TextField
                            label="DESCRIPTION"
                            value={boqDesc}
                            onChange={e => setBoqDesc(e.target.value)}
                            placeholder="e.g. Earthwork..."
                            sx={{ flex: 2, minWidth: 300 }}
                            InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                        />
                        <TextField
                            label="UNIT"
                            value={boqUnit}
                            onChange={e => setBoqUnit(e.target.value)}
                            sx={{ width: 100 }}
                            InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                        />
                        <TextField
                            select
                            label="PREVIEW_REGION"
                            value={previewRegion}
                            onChange={e => setPreviewRegion(e.target.value)}
                            sx={{ flex: 1, minWidth: 200 }}
                            InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                        >
                            <MenuItem value="">-- DEFAULT_RATE --</MenuItem>
                            {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{r.name}</MenuItem>)}
                        </TextField>
                    </Box>

                    <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                                <TableRow>
                                    <TableCell sx={{ width: '12%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>TYPE</TableCell>
                                    <TableCell sx={{ width: '15%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CODE_SEARCH</TableCell>
                                    <TableCell sx={{ width: '30%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DESC_SEARCH</TableCell>
                                    <TableCell sx={{ width: '8%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UNIT</TableCell>
                                    <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY</TableCell>
                                    <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RATE</TableCell>
                                    <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>AMOUNT</TableCell>
                                    <TableCell align="center" sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {renderedRows.map((row) => {
                                    const sourceList = row.itemType === 'boq' ? masterBoqs : resources;
                                    return (
                                        <TableRow key={row.id}>
                                            <TableCell>
                                                <select value={row.itemType} onChange={e => updateSpreadsheetRow(row.id, 'itemType', e.target.value)} style={tableInputActiveStyle}>
                                                    <option value="resource">RESOURCE</option><option value="boq">MASTER_BOQ</option>
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <select value={row.itemId} onChange={e => updateSpreadsheetRow(row.id, 'itemId', e.target.value)} style={tableInputActiveStyle}>
                                                    <option value="">-- CODE --</option>
                                                    {sourceList.filter(s => s.code || s.itemCode).map(s => <option key={s.id} value={s.id}>{s.code || s.itemCode}</option>)}
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <select value={row.itemId} onChange={e => updateSpreadsheetRow(row.id, 'itemId', e.target.value)} style={tableInputActiveStyle}>
                                                    <option value="">-- DESCRIPTION --</option>
                                                    {sourceList.map(s => <option key={s.id} value={s.id}>{s.description}</option>)}
                                                </select>
                                            </TableCell>
                                            <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{row.unit}</TableCell>
                                            <TableCell><input type="number" value={row.qty} onChange={e => updateSpreadsheetRow(row.id, 'qty', e.target.value)} style={tableInputActiveStyle} /></TableCell>
                                            <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {row.rate.toFixed(2)}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {row.amount.toFixed(2)}</TableCell>
                                            <TableCell align="center"><IconButton size="small" color="error" onClick={() => removeSpreadsheetRow(row.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Button
                        variant="outlined"
                        disableElevation
                        onClick={addSpreadsheetRow}
                        sx={{ mb: 4, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}
                    >
                        + ADD_COMPONENT
                    </Button>

                    <Box display="flex" justifyContent="flex-end">
                        <Paper elevation={0} variant="outlined" sx={{ width: 400, p: 3, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Box display="flex" justifyContent="space-between" mb={2}>
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>SUBTOTAL:</Typography>
                                <Typography fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {subTotal.toFixed(2)}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>OVERHEAD (%):</Typography>
                                    <input type="number" value={boqOH} onChange={e => setBoqOH(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} />
                                </Box>
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {ohAmount.toFixed(2)}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} borderBottom="2px solid" borderColor="divider">
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>PROFIT (%):</Typography>
                                    <input type="number" value={boqProfit} onChange={e => setBoqProfit(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} />
                                </Box>
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {profitAmount.toFixed(2)}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" mb={3} color="success.main">
                                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>FINAL_RATE/{boqUnit}:</Typography>
                                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>₹ {grandTotal.toFixed(2)}</Typography>
                            </Box>
                            <Button
                                variant="contained"
                                color="success"
                                fullWidth
                                size="large"
                                onClick={saveMasterBoq}
                                startIcon={<SaveIcon />}
                                disableElevation
                                sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '13px' }}
                            >
                                {editingBoqId ? "UPDATE_ITEM" : "SAVE_ITEM"}
                            </Button>
                        </Paper>
                    </Box>
                </Paper>
            )}

            {tab === "viewBoq" && (
                <Box>
                    <Typography variant="h6" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}>
                        EXISTING_MASTER_BOQ_ITEMS
                    </Typography>
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
