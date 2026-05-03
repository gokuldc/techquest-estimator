import { useState, useMemo, useEffect } from "react";
import { Box, Button, Typography, Paper, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Alert } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { calculateMasterBoqRate, getResourceRate } from "../../engines/calculationEngine";
import { tableInputActiveStyle } from "../../styles";
import FormulaGuideDialog from "../workspace/FormulaGuideDialog";

import { useSettings } from "../../context/SettingsContext";

export default function CreateBoqTab({ regions, resources, masterBoqs, loadData, editingBoq, clearEdit }) {
    const { formatCurrency } = useSettings();

    const [boqCode, setBoqCode] = useState("");
    const [boqDesc, setBoqDesc] = useState("");
    const [boqUnit, setBoqUnit] = useState("cum");
    const [boqOH, setBoqOH] = useState(15);
    const [boqProfit, setBoqProfit] = useState(15);
    const [previewRegion, setPreviewRegion] = useState("");
    const [boqRows, setBoqRows] = useState([]);
    const [focusedQtyId, setFocusedQtyId] = useState(null);
    const [localRows, setLocalRows] = useState({});
    const [formulaHelpOpen, setFormulaHelpOpen] = useState(false);

    // Initialize with editing data if provided
    useEffect(() => {
        if (editingBoq) {
            setBoqCode(editingBoq.itemCode || "");
            setBoqDesc(editingBoq.description || "");
            setBoqUnit(editingBoq.unit || "cum");
            setBoqOH(editingBoq.overhead || 0);
            setBoqProfit(editingBoq.profit || 0);

            // Defensively ensure components array is valid
            const components = Array.isArray(editingBoq.components) ? editingBoq.components :
                (typeof editingBoq.components === 'string' ? JSON.parse(editingBoq.components || '[]') : []);

            setBoqRows(components.map(c => ({
                id: crypto.randomUUID(),
                itemType: c.itemType || 'resource',
                itemId: c.itemId,
                qty: c.qty,
                formulaStr: c.formulaStr || String(c.qty)
            })));
        } else {
            // Clear form if new
            setBoqCode("");
            setBoqDesc("");
            setBoqUnit("cum");
            setBoqOH(15);
            setBoqProfit(15);
            setBoqRows([]);
        }
    }, [editingBoq]);

    const computeQty = (formulaStr, currentRows) => {
        if (!formulaStr) return 0;
        const str = String(formulaStr).trim().toLowerCase();
        if (str === "") return 0;
        if (!str.startsWith('=')) { const num = Number(str); return isNaN(num) ? 0 : num; }
        let expr = str.substring(1).replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");
        expr = expr.replace(/#(\d+)/g, (match, slNoStr) => {
            const idx = parseInt(slNoStr, 10) - 1;
            return currentRows[idx] ? (currentRows[idx].computedQty || 0) : 0;
        });
        try { return /[^0-9+\-*/().\seE]/.test(expr) ? 0 : (isFinite(new Function(`return ${expr}`)()) ? new Function(`return ${expr}`)() : 0); }
        catch { return 0; }
    };

    const addSpreadsheetRow = () => setBoqRows([...boqRows, { id: crypto.randomUUID(), itemType: "resource", itemId: "", formulaStr: "1", qty: 1 }]);
    const updateSpreadsheetRow = (id, field, value) => setBoqRows(boqRows.map(row => row.id === id ? { ...row, [field]: value, ...(field === 'itemType' ? { itemId: "", tempCode: undefined, tempDesc: undefined } : {}) } : row));
    const removeSpreadsheetRow = (id) => setBoqRows(boqRows.filter(row => row.id !== id));

    const { renderedRows, subTotal, ohAmount, profitAmount, grandTotal } = useMemo(() => {
        let sub = 0; const computedRows = [];
        for (let i = 0; i < boqRows.length; i++) {
            const row = boqRows[i]; let rate = 0; let unit = "-";
            if (row.itemType === 'resource') {
                const resource = resources.find(r => r.id === row.itemId);
                if (resource) { rate = getResourceRate(resource, previewRegion); unit = resource.unit; }
            } else if (row.itemType === 'boq') {
                const nestedBoq = masterBoqs.find(b => b.id === row.itemId);
                if (nestedBoq) { rate = calculateMasterBoqRate(nestedBoq, resources, masterBoqs, previewRegion); unit = nestedBoq.unit; }
            }
            const computedQty = computeQty(row.formulaStr !== undefined ? row.formulaStr : row.qty, computedRows);
            const amount = rate * computedQty;
            sub += amount;
            computedRows.push({ ...row, rate, unit, amount, computedQty });
        }
        const oh = sub * (Number(boqOH) / 100), prof = sub * (Number(boqProfit) / 100);
        return { renderedRows: computedRows, subTotal: sub, ohAmount: oh, profitAmount: prof, grandTotal: sub + oh + prof };
    }, [boqRows, resources, masterBoqs, previewRegion, boqOH, boqProfit]);

    const saveMasterBoq = async (isSaveAsNew = false) => {
        if (!boqCode || !boqDesc) return alert("Please enter a Code and Description.");
        const validComponents = renderedRows.filter(r => r.itemId && r.computedQty !== 0).map(r => ({ itemType: r.itemType, itemId: r.itemId, qty: Number(r.computedQty), formulaStr: r.formulaStr || String(r.computedQty) }));
        if (validComponents.length === 0) return alert("Add at least one valid component.");
        const payload = { itemCode: boqCode, description: boqDesc, unit: boqUnit, overhead: Number(boqOH), profit: Number(boqProfit), components: JSON.stringify(validComponents) };

        await window.api.db.saveMasterBoq(payload, editingBoq ? editingBoq.id : null, isSaveAsNew);
        alert(isSaveAsNew ? "Saved as a New Databook Item!" : "Databook Item Saved!");

        if (clearEdit) clearEdit();
        loadData();
    };

    return (
        <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}>
                    {editingBoq ? "EDIT" : "CREATE"}_DATABOOK_ITEM
                </Typography>
                {editingBoq && (
                    <Button size="small" variant="outlined" color="error" onClick={clearEdit} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CANCEL_EDIT</Button>
                )}
            </Box>

            {/* 🔥 FIXED: Flexible stacking on mobile */}
            <Box display="flex" gap={{ xs: 2, sm: 3 }} flexDirection={{ xs: 'column', md: 'row' }} mb={4}>
                <TextField label="ITEM_CODE" value={boqCode} onChange={e => setBoqCode(e.target.value)} sx={{ flex: 1, minWidth: 150 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                <TextField label="DESCRIPTION" value={boqDesc} onChange={e => setBoqDesc(e.target.value)} sx={{ flex: 3, minWidth: 300 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                <Box display="flex" gap={{ xs: 2, sm: 3 }} flexDirection={{ xs: 'column', sm: 'row' }}>
                    <TextField label="UNIT" value={boqUnit} onChange={e => setBoqUnit(e.target.value)} sx={{ width: { xs: '100%', sm: 100 } }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                    <TextField select label="REGION" value={previewRegion} onChange={e => setPreviewRegion(e.target.value)} sx={{ width: { xs: '100%', sm: 200 } }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                        {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                    </TextField>
                </Box>
            </Box>

            {/* 🔥 FIXED: Alert icon break fix */}
            <Alert severity="info" sx={{ mb: 3 }}>
                <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>💡 <strong>Formula engine:</strong> Use math (<code>= 10 * 2.5</code>) or reference rows (<code>= #1 * 0.45</code>) to automatically calculate mixture ratios.</Typography>
                    <Button variant="outlined" size="small" startIcon={<HelpOutlineIcon />} onClick={() => setFormulaHelpOpen(true)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>FORMULA_GUIDE</Button>
                </Box>
            </Alert>

            {/* 🔥 FIXED: TableContainer with overflowX and minWidth */}
            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3, overflowX: 'auto', width: '100%' }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>SL.NO</TableCell>
                            <TableCell sx={{ width: '12%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>TYPE</TableCell>
                            <TableCell sx={{ width: '15%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>CODE_SEARCH</TableCell>
                            <TableCell sx={{ width: '30%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>DESC_SEARCH</TableCell>
                            <TableCell sx={{ width: '8%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>UNIT</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>QTY/FORMULA</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>RATE</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>AMOUNT</TableCell>
                            <TableCell align="center" sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>ACTION</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {renderedRows.map((row, idx) => {
                            const sourceList = row.itemType === 'boq' ? masterBoqs : resources;
                            const isFocused = focusedQtyId === row.id;
                            return (
                                <TableRow key={row.id}>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{idx + 1}</TableCell>
                                    <TableCell><select value={row.itemType} onChange={e => updateSpreadsheetRow(row.id, 'itemType', e.target.value)} style={{ ...tableInputActiveStyle, width: '100%' }}><option value="resource">RESOURCE</option><option value="boq">DATABOOK_ITEM</option></select></TableCell>

                                    <TableCell>
                                        <input
                                            list={`ws-codes-${row.id}`}
                                            value={localRows[`${row.id}-code`] !== undefined ? localRows[`${row.id}-code`] : (row.tempCode ?? (sourceList.find(s => s.id === row.itemId)?.code || sourceList.find(s => s.id === row.itemId)?.itemCode || ""))}
                                            onFocus={() => setLocalRows(prev => ({ ...prev, [`${row.id}-code`]: row.tempCode ?? (sourceList.find(s => s.id === row.itemId)?.code || sourceList.find(s => s.id === row.itemId)?.itemCode || "") }))}
                                            onBlur={() => {
                                                const val = localRows[`${row.id}-code`];
                                                if (val !== undefined) {
                                                    const matched = sourceList.find(s => (s.code || s.itemCode) === val);
                                                    setBoqRows(prev => prev.map(r => r.id === row.id ? (matched ? { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined } : { ...r, itemId: "", tempCode: val, tempDesc: r.tempDesc }) : r));
                                                }
                                            }}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setLocalRows(prev => ({ ...prev, [`${row.id}-code`]: val }));
                                                const matched = sourceList.find(s => (s.code || s.itemCode) === val);
                                                if (matched) {
                                                    setBoqRows(prev => prev.map(r => r.id === row.id ? { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined } : r));
                                                }
                                            }}
                                            style={{ ...tableInputActiveStyle, width: '100%' }}
                                        />
                                        <datalist id={`ws-codes-${row.id}`}>{sourceList.filter(s => s.code || s.itemCode).map(s => <option key={s.id} value={s.code || s.itemCode} />)}</datalist>
                                    </TableCell>

                                    <TableCell>
                                        <input
                                            list={`ws-descs-${row.id}`}
                                            value={localRows[`${row.id}-desc`] !== undefined ? localRows[`${row.id}-desc`] : (row.tempDesc ?? (sourceList.find(s => s.id === row.itemId)?.description || ""))}
                                            onFocus={() => setLocalRows(prev => ({ ...prev, [`${row.id}-desc`]: row.tempDesc ?? (sourceList.find(s => s.id === row.itemId)?.description || "") }))}
                                            onBlur={() => {
                                                const val = localRows[`${row.id}-desc`];
                                                if (val !== undefined) {
                                                    const matched = sourceList.find(s => s.description === val);
                                                    setBoqRows(prev => prev.map(r => r.id === row.id ? (matched ? { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined } : { ...r, itemId: "", tempCode: r.tempCode, tempDesc: val }) : r));
                                                }
                                            }}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setLocalRows(prev => ({ ...prev, [`${row.id}-desc`]: val }));
                                                const matched = sourceList.find(s => s.description === val);
                                                if (matched) {
                                                    setBoqRows(prev => prev.map(r => r.id === row.id ? { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined } : r));
                                                }
                                            }}
                                            style={{ ...tableInputActiveStyle, width: '100%' }}
                                        />
                                        <datalist id={`ws-descs-${row.id}`}>{sourceList.filter(s => s.description).map(s => <option key={s.id} value={s.description} />)}</datalist>
                                    </TableCell>

                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{row.unit}</TableCell>

                                    <TableCell>
                                        <input
                                            type="text"
                                            value={isFocused ? (localRows[`${row.id}-qty`] !== undefined ? localRows[`${row.id}-qty`] : (row.formulaStr ?? row.qty ?? "")) : ((row.formulaStr === "" || row.formulaStr === undefined) ? "" : Number(row.computedQty || 0).toFixed(4))}
                                            onFocus={() => {
                                                setFocusedQtyId(row.id);
                                                setLocalRows(prev => ({ ...prev, [`${row.id}-qty`]: row.formulaStr ?? row.qty ?? "" }));
                                            }}
                                            onBlur={() => {
                                                setFocusedQtyId(null);
                                                if (localRows[`${row.id}-qty`] !== undefined && localRows[`${row.id}-qty`] !== (row.formulaStr ?? row.qty ?? "")) {
                                                    updateSpreadsheetRow(row.id, 'formulaStr', localRows[`${row.id}-qty`]);
                                                }
                                            }}
                                            onChange={e => setLocalRows(prev => ({ ...prev, [`${row.id}-qty`]: e.target.value }))}
                                            style={{ ...tableInputActiveStyle, width: '100%' }}
                                        />
                                    </TableCell>

                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(row.rate)}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(row.amount)}</TableCell>
                                    <TableCell align="center"><IconButton size="small" color="error" onClick={() => removeSpreadsheetRow(row.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Button variant="outlined" disableElevation onClick={addSpreadsheetRow} sx={{ mb: 4, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', width: { xs: '100%', sm: 'auto' } }}>+ ADD_COMPONENT</Button>

            <Box display="flex" justifyContent="flex-end">
                {/* 🔥 FIXED: Flexible width instead of hardcoded 400px */}
                <Paper elevation={0} variant="outlined" sx={{ width: { xs: '100%', sm: 400 }, p: { xs: 2, sm: 3 }, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>SUBTOTAL:</Typography>
                        <Typography fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(subTotal)}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>OVERHEAD (%):</Typography>
                            <input type="number" value={boqOH} onChange={e => setBoqOH(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} />
                        </Box>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(ohAmount)}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} borderBottom="2px solid" borderColor="divider">
                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>PROFIT (%):</Typography>
                            <input type="number" value={boqProfit} onChange={e => setBoqProfit(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} />
                        </Box>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(profitAmount)}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={3} color="success.main">
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>FINAL_RATE/{boqUnit}:</Typography>
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>{formatCurrency(grandTotal)}</Typography>
                    </Box>

                    {/* 🔥 FIXED: Flexible button stacking */}
                    <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                        {editingBoq && <Button variant="outlined" color="info" fullWidth size="large" onClick={() => saveMasterBoq(true)} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>SAVE_AS_NEW</Button>}
                        <Button variant="contained" color="success" fullWidth size="large" onClick={() => saveMasterBoq(false)} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '13px' }}>{editingBoq ? "UPDATE_ITEM" : "SAVE_ITEM"}</Button>
                    </Box>
                </Paper>
            </Box>

            <FormulaGuideDialog open={formulaHelpOpen} onClose={() => setFormulaHelpOpen(false)} />
        </Paper>
    );
}