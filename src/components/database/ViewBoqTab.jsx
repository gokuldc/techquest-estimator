import { useState, useMemo, useRef } from "react";
import { Box, Button, Typography, Paper, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TableSortLabel, InputAdornment } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import * as XLSX from "xlsx";
import { calculateMasterBoqRate } from "../../engines/calculationEngine";

const Resizer = ({ onMouseDown }) => (
    <div onMouseDown={onMouseDown} style={{ display: 'inline-block', width: '10px', height: '100%', position: 'absolute', right: 0, top: 0, cursor: 'col-resize', zIndex: 1, backgroundColor: 'transparent', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'} onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'} />
);

export default function ViewBoqTab({ masterBoqs, regions, resources, onEditBoq, deleteMasterBoq, loadData }) {
    const [searchCode, setSearchCode] = useState('');
    const [searchDesc, setSearchDesc] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [previewRegion, setPreviewRegion] = useState('');
    const excelInputRef = useRef(null);

    const [colWidths, setColWidths] = useState({ code: 150, desc: 400, unit: 100, rate: 150, actions: 150 });

    const handleResizeStart = (colKey) => (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const thElement = e.target.closest('th');
        const startWidth = thElement ? thElement.getBoundingClientRect().width : colWidths[colKey];
        const handleMouseMove = (moveEvent) => setColWidths(prev => ({ ...prev, [colKey]: Math.max(50, startWidth + (moveEvent.clientX - startX)) }));
        const handleMouseUp = () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
        document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
    };

    const handleSortToggle = () => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));

    const processedBOQs = useMemo(() => {
        let filtered = masterBoqs.filter((boq) => {
            const matchCode = boq.itemCode?.toLowerCase().includes(searchCode.toLowerCase());
            const matchDesc = boq.description?.toLowerCase().includes(searchDesc.toLowerCase());
            return matchCode && matchDesc;
        });
        filtered.sort((a, b) => {
            const codeA = a.itemCode || ''; const codeB = b.itemCode || '';
            return sortDirection === 'asc' ? codeA.localeCompare(codeB, undefined, { numeric: true }) : codeB.localeCompare(codeA, undefined, { numeric: true });
        });
        return filtered;
    }, [masterBoqs, searchCode, searchDesc, sortDirection]);

    const paginatedBOQs = useMemo(() => processedBOQs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [processedBOQs, page, rowsPerPage]);

    const generateDatabookTemplate = () => {
        const wsData = [
            { "BOQ_Code": "EXAMPLE-01", "BOQ_Description": "12 mm cement plaster of mix: 1:4", "BOQ_Unit": "sqm", "Overhead_Percent": 15, "Profit_Percent": 15, "Component_Type": "boq", "Component_Code": "MIX.01", "Component_Qty": 0.0144 },
            { "BOQ_Code": "EXAMPLE-01", "BOQ_Description": "12 mm cement plaster of mix: 1:4", "BOQ_Unit": "sqm", "Overhead_Percent": 15, "Profit_Percent": 15, "Component_Type": "resource", "Component_Code": "0155", "Component_Qty": 0.067 }
        ];
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Databook Template");
        XLSX.writeFile(wb, "Databook_Upload_Template.xlsx");
    };

    const handleDatabookExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if (jsonData.length === 0) throw new Error("Empty Excel file");

                const boqGroups = {};
                jsonData.forEach(row => {
                    const boqCode = String(row["BOQ_Code"] || "").trim();
                    if (!boqCode) return;
                    if (!boqGroups[boqCode]) boqGroups[boqCode] = { itemCode: boqCode, description: String(row["BOQ_Description"] || ""), unit: String(row["BOQ_Unit"] || "each"), overhead: Number(row["Overhead_Percent"]) || 0, profit: Number(row["Profit_Percent"]) || 0, components: [] };
                    const compType = String(row["Component_Type"] || "").toLowerCase().trim();
                    const compCode = String(row["Component_Code"] || "").trim();
                    const compQty = Number(row["Component_Qty"]) || 0;
                    if (compType && compCode && compQty > 0) boqGroups[boqCode].components.push({ tempType: compType, tempCode: compCode, qty: compQty });
                });

                let added = 0, updated = 0;
                for (const boqCode of Object.keys(boqGroups)) {
                    const group = boqGroups[boqCode];
                    const validComponents = [];
                    for (const comp of group.components) {
                        let itemId = null; let itemType = "resource";
                        if (comp.tempType === 'resource') { const res = resources.find(r => r.code === comp.tempCode); if (res) itemId = res.id; }
                        else if (comp.tempType === 'boq' || comp.tempType === 'databook_item') { const b = masterBoqs.find(b => b.itemCode === comp.tempCode); if (b) itemId = b.id; itemType = "boq"; }
                        if (itemId) validComponents.push({ itemType, itemId, qty: comp.qty, formulaStr: String(comp.qty) });
                    }
                    const payload = { ...group, components: JSON.stringify(validComponents) };
                    const existing = masterBoqs.find(b => b.itemCode === group.itemCode);
                    if (existing) { await window.api.db.saveMasterBoq(payload, existing.id, false); updated++; }
                    else { await window.api.db.saveMasterBoq(payload, null, true); added++; }
                }
                alert(`Databook Excel Processed!\n\nProcessed: ${added + updated} items`);
                loadData();
            } catch (err) { alert("Failed to parse Excel file."); }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>
            <Typography variant="h6" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}>DATABOOK_ITEMS</Typography>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
                <Box display="flex" gap={2} flexWrap="wrap" flex={1} alignItems="flex-start">
                    <TextField placeholder="Search Code..." variant="outlined" size="small" value={searchCode} onChange={(e) => { setSearchCode(e.target.value); setPage(0); }} sx={{ flex: 1, minWidth: 150 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                    <TextField placeholder="Search Description..." variant="outlined" size="small" value={searchDesc} onChange={(e) => { setSearchDesc(e.target.value); setPage(0); }} sx={{ flex: 2, minWidth: 250 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                    <TextField select size="small" label="PREVIEW_REGION" value={previewRegion} onChange={e => setPreviewRegion(e.target.value)} sx={{ flex: 1, minWidth: 150 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                        <MenuItem value="">-- SELECT_REGION --</MenuItem>
                        {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{r.name}</MenuItem>)}
                    </TextField>
                </Box>
                <Box display="flex" gap={2} alignItems="flex-start">
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={generateDatabookTemplate} sx={{ height: 40, px: 3, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>TEMPLATE</Button>
                    <input type="file" accept=".xls,.xlsx" ref={excelInputRef} style={{ display: 'none' }} onChange={(e) => { handleDatabookExcelUpload(e); excelInputRef.current.value = null; }} />
                    <Button size="small" variant="contained" disableElevation startIcon={<UploadIcon />} onClick={() => excelInputRef.current.click()} sx={{ height: 40, px: 3, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>IMPORT EXCEL</Button>
                </Box>
            </Box>

            <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ overflowX: 'auto', width: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Table size="small" sx={{ tableLayout: 'fixed', minWidth: '100%', width: Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell sx={{ width: colWidths.code, position: 'relative', overflow: 'visible', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}><TableSortLabel active={true} direction={sortDirection} onClick={handleSortToggle}><strong>ITEM_CODE</strong></TableSortLabel><Resizer onMouseDown={handleResizeStart('code')} /></TableCell>
                            <TableCell sx={{ width: colWidths.desc, position: 'relative', overflow: 'visible', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}><strong>DESCRIPTION</strong><Resizer onMouseDown={handleResizeStart('desc')} /></TableCell>
                            <TableCell sx={{ width: colWidths.unit, position: 'relative', overflow: 'visible', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}><strong>UNIT</strong><Resizer onMouseDown={handleResizeStart('unit')} /></TableCell>
                            <TableCell sx={{ width: colWidths.rate, position: 'relative', overflow: 'visible', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}><strong>RATE_PREVIEW</strong><Resizer onMouseDown={handleResizeStart('rate')} /></TableCell>
                            <TableCell align="center" sx={{ width: colWidths.actions, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}><strong>ACTIONS</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedBOQs.length > 0 ? (
                            paginatedBOQs.map((b) => {
                                const rate = previewRegion ? calculateMasterBoqRate(b, resources, masterBoqs, previewRegion) : 0;
                                return (
                                    <TableRow key={b.id} hover>
                                        <TableCell sx={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{b.itemCode || '-'}</TableCell>
                                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{b.description}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{b.unit}</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: previewRegion ? 'success.main' : 'text.disabled', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{previewRegion ? `₹ ${rate.toFixed(2)}` : 'SELECT_REGION'}</TableCell>
                                        <TableCell align="center"><Box display="flex" gap={1} justifyContent="center"><Button size="small" variant="outlined" color="warning" onClick={() => onEditBoq(b)} sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>EDIT</Button><Button size="small" variant="outlined" color="error" onClick={() => deleteMasterBoq(b.id)} sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DELETE</Button></Box></TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (<TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary' }}>NO_MATCHING_ITEMS</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination rowsPerPageOptions={[10, 25, 50, 100]} component="div" count={processedBOQs.length} rowsPerPage={rowsPerPage} page={page} onPageChange={(e, newPage) => setPage(newPage)} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} sx={{ fontFamily: "'JetBrains Mono', monospace" }} />
        </Box>
    );
}