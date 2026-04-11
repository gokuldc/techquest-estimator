import { useState, useMemo, useEffect } from "react";
import { Box, Typography, Button, Paper, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Alert, Divider, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { getResourceRate, calculateMasterBoqRate } from "../../engines/calculationEngine";
import { tableInputActiveStyle } from "../../styles";

export default function CreateBoqTab({ regions, resources, masterBoqs, loadData, editingBoq, clearEdit }) {
    const [boqCode, setBoqCode] = useState("");
    const [boqDesc, setBoqDesc] = useState("");
    const [boqUnit, setBoqUnit] = useState("cum");
    const [boqOH, setBoqOH] = useState(15);
    const [boqProfit, setBoqProfit] = useState(15);
    const [previewRegion, setPreviewRegion] = useState("");
    const [boqRows, setBoqRows] = useState([]);
    const [focusedQtyId, setFocusedQtyId] = useState(null);
    const [formulaHelpOpen, setFormulaHelpOpen] = useState(false);

    useEffect(() => {
        if (editingBoq) {
            setBoqCode(editingBoq.itemCode || "");
            setBoqDesc(editingBoq.description || "");
            setBoqUnit(editingBoq.unit || "cum");
            setBoqOH(editingBoq.overhead || 15);
            setBoqProfit(editingBoq.profit || 15);
            setBoqRows((editingBoq.components || []).map(c => ({ id: crypto.randomUUID(), itemType: c.itemType || 'resource', itemId: c.itemId, qty: c.qty, formulaStr: c.formulaStr || String(c.qty) })));
        } else {
            setBoqCode(""); setBoqDesc(""); setBoqUnit("cum"); setBoqOH(15); setBoqProfit(15); setBoqRows([]);
        }
    }, [editingBoq]);

    const computeQty = (formulaStr, currentRows) => {
        if (formulaStr === undefined || formulaStr === null) return 0;
        const str = String(formulaStr).trim().toLowerCase();
        if (str === "") return 0;

        if (!str.startsWith('=')) {
            const num = Number(str);
            return isNaN(num) ? 0 : num;
        }

        let expr = str.substring(1).replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");
        expr = expr.replace(/#(\d+)/g, (match, slNoStr) => {
            const idx = parseInt(slNoStr, 10) - 1;
            const refItem = currentRows[idx];
            return refItem ? (refItem.computedQty || 0) : 0;
        });

        try {
            if (/[^0-9+\-*/().\seE]/.test(expr)) return 0;
            const res = new Function(`return ${expr}`)();
            return isFinite(res) ? res : 0;
        } catch { return 0; }
    };

    const { renderedRows, subTotal, grandTotal, ohAmount, profitAmount } = useMemo(() => {
        let sub = 0;
        const computedRows = [];

        for (let i = 0; i < boqRows.length; i++) {
            const row = boqRows[i];
            let rate = 0; let unit = "-";
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

    const addSpreadsheetRow = () => setBoqRows([...boqRows, { id: crypto.randomUUID(), itemType: "resource", itemId: "", formulaStr: "1", qty: 1 }]);
    const updateSpreadsheetRow = (id, field, value) => setBoqRows(boqRows.map(row => row.id === id ? { ...row, [field]: value, ...(field === 'itemType' ? { itemId: "", tempCode: undefined, tempDesc: undefined } : {}) } : row));
    const removeSpreadsheetRow = (id) => setBoqRows(boqRows.filter(row => row.id !== id));

    const saveMasterBoq = async (isSaveAsNew = false) => {
        if (!boqCode || !boqDesc) return alert("Please enter a Code and Description.");
        const validComponents = renderedRows.filter(r => r.itemId && r.computedQty !== 0).map(r => ({ itemType: r.itemType, itemId: r.itemId, qty: Number(r.computedQty), formulaStr: r.formulaStr || String(r.computedQty) }));
        if (validComponents.length === 0) return alert("Add at least one valid component.");

        const payload = { itemCode: boqCode, description: boqDesc, unit: boqUnit, overhead: Number(boqOH), profit: Number(boqProfit), components: JSON.stringify(validComponents) };

        await window.api.db.saveMasterBoq(payload, editingBoq ? editingBoq.id : null, isSaveAsNew);
        alert(isSaveAsNew ? "Saved as a New Databook Item!" : "Databook Item Saved!");

        loadData();
        clearEdit();
    };

    return (
        <Paper elevation={0} variant="outlined" sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}>
                    {editingBoq ? "EDIT" : "CREATE"}_DATABOOK_ITEM
                </Typography>
                {editingBoq && <Button variant="outlined" color="error" size="small" onClick={clearEdit}>CANCEL EDIT</Button>}
            </Box>
            <Divider sx={{ mb: 3, borderColor: 'divider' }} />

            <Box display="flex" gap={3} flexWrap="wrap" mb={4}>
                <TextField label="ITEM_CODE" value={boqCode} onChange={e => setBoqCode(e.target.value)} placeholder="e.g. BOQ-001" sx={{ flex: 1, minWidth: 150 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                <TextField label="DESCRIPTION" value={boqDesc} onChange={e => setBoqDesc(e.target.value)} placeholder="e.g. Earthwork..." sx={{ flex: 2, minWidth: 300 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                <TextField label="UNIT" value={boqUnit} onChange={e => setBoqUnit(e.target.value)} sx={{ width: 100 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                <TextField select label="PREVIEW_REGION" value={previewRegion} onChange={e => setPreviewRegion(e.target.value)} sx={{ flex: 1, minWidth: 200 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                    <MenuItem value="">-- DEFAULT_RATE --</MenuItem>
                    {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{r.name}</MenuItem>)}
                </TextField>
            </Box>

            <Alert severity="info" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                💡 <strong>TIPS:</strong> Start with <code>=</code> for formulas. Use <code>ceil()</code>, <code>floor()</code>, <code>round()</code>. Reference components by row index using <code>#</code> (e.g. <code>=#1 * 1.5</code>).
                <Button variant="outlined" size="small" startIcon={<HelpOutlineIcon />} onClick={() => setFormulaHelpOpen(true)} sx={{ ml: 2, py: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>FORMULA GUIDE</Button>
            </Alert>

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>SL.NO</TableCell>
                            <TableCell sx={{ width: '12%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>TYPE</TableCell>
                            <TableCell sx={{ width: '15%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CODE_SEARCH</TableCell>
                            <TableCell sx={{ width: '30%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DESC_SEARCH</TableCell>
                            <TableCell sx={{ width: '8%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UNIT</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY/FORMULA</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RATE</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>AMOUNT</TableCell>
                            <TableCell align="center" sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {renderedRows.map((row, idx) => {
                            const sourceList = row.itemType === 'boq' ? masterBoqs : resources;
                            const isFormula = String(row.formulaStr || "").trim().startsWith("=");
                            const isFocused = focusedQtyId === row.id;

                            return (
                                <TableRow key={row.id}>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{idx + 1}</TableCell>
                                    <TableCell>
                                        <select value={row.itemType} onChange={e => setBoqRows(prev => prev.map(r => r.id === row.id ? { ...r, itemType: e.target.value, itemId: "", tempCode: undefined, tempDesc: undefined } : r))} style={tableInputActiveStyle}>
                                            <option value="resource">RESOURCE</option><option value="boq">DATABOOK_ITEM</option>
                                        </select>
                                    </TableCell>
                                    <TableCell>
                                        <input list={`codes-${row.id}`} value={row.tempCode !== undefined ? row.tempCode : (sourceList.find(s => s.id === row.itemId)?.code || sourceList.find(s => s.id === row.itemId)?.itemCode || "")} onChange={e => { const val = e.target.value; const matched = sourceList.find(s => (s.code || s.itemCode) === val); setBoqRows(prev => prev.map(r => { if (r.id === row.id) { if (matched) return { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined }; return { ...r, itemId: "", tempCode: val, tempDesc: r.tempDesc }; } return r; })); }} placeholder="Type code..." style={tableInputActiveStyle} />
                                        <datalist id={`codes-${row.id}`}>{sourceList.filter(s => s.code || s.itemCode).map(s => <option key={s.id} value={s.code || s.itemCode} />)}</datalist>
                                    </TableCell>
                                    <TableCell>
                                        <input list={`descs-${row.id}`} value={row.tempDesc !== undefined ? row.tempDesc : (sourceList.find(s => s.id === row.itemId)?.description || "")} onChange={e => { const val = e.target.value; const matched = sourceList.find(s => s.description === val); setBoqRows(prev => prev.map(r => { if (r.id === row.id) { if (matched) return { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined }; return { ...r, itemId: "", tempCode: r.tempCode, tempDesc: val }; } return r; })); }} placeholder="Type description..." style={tableInputActiveStyle} />
                                        <datalist id={`descs-${row.id}`}>{sourceList.filter(s => s.description).map(s => <option key={s.id} value={s.description} />)}</datalist>
                                    </TableCell>
                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{row.unit}</TableCell>
                                    <TableCell>
                                        <input type="text" value={isFocused ? (row.formulaStr !== undefined ? row.formulaStr : row.qty) : Number(row.computedQty).toFixed(4)} onFocus={() => setFocusedQtyId(row.id)} onBlur={() => setFocusedQtyId(null)} onChange={e => updateSpreadsheetRow(row.id, 'formulaStr', e.target.value)} placeholder="e.g. =#1 * 0.05" style={tableInputActiveStyle} />
                                        {(isFormula && isFocused) && <Typography variant="caption" color="info.main" display="block" mt={0.5} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>Computed: <strong>{row.computedQty.toFixed(4)}</strong></Typography>}
                                    </TableCell>
                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {row.rate.toFixed(2)}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {row.amount.toFixed(2)}</TableCell>
                                    <TableCell align="center"><IconButton size="small" color="error" onClick={() => removeSpreadsheetRow(row.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Button variant="outlined" disableElevation onClick={addSpreadsheetRow} sx={{ mb: 4, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>+ ADD_COMPONENT</Button>

            <Box display="flex" justifyContent="flex-end">
                <Paper elevation={0} variant="outlined" sx={{ width: 400, p: 3, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box display="flex" justifyContent="space-between" mb={2}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>SUBTOTAL:</Typography><Typography fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {subTotal.toFixed(2)}</Typography></Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}><Box display="flex" alignItems="center" gap={1}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>OVERHEAD (%):</Typography><input type="number" value={boqOH} onChange={e => setBoqOH(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} /></Box><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {ohAmount.toFixed(2)}</Typography></Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} borderBottom="2px solid" borderColor="divider"><Box display="flex" alignItems="center" gap={1}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>PROFIT (%):</Typography><input type="number" value={boqProfit} onChange={e => setBoqProfit(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} /></Box><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {profitAmount.toFixed(2)}</Typography></Box>
                    <Box display="flex" justifyContent="space-between" mb={3} color="success.main"><Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>FINAL_RATE/{boqUnit}:</Typography><Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>₹ {grandTotal.toFixed(2)}</Typography></Box>
                    <Box display="flex" gap={2} mb={1}>
                        {editingBoq && <Button variant="outlined" color="info" fullWidth size="large" onClick={() => saveMasterBoq(true)} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>SAVE_AS_NEW</Button>}
                        <Button variant="contained" color="success" fullWidth size="large" onClick={() => saveMasterBoq(false)} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '13px' }}>{editingBoq ? "UPDATE_ITEM" : "SAVE_ITEM"}</Button>
                    </Box>
                </Paper>
            </Box>

            <Dialog open={formulaHelpOpen} onClose={() => setFormulaHelpOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: 'primary.main' }}>FORMULA_ENGINE_GUIDE</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', lineHeight: 1.7, p: 4 }}>
                    <Typography variant="body1" paragraph>The Formula Engine allows you to calculate quantities dynamically by referencing other components in your Databook. To trigger the engine, start your input with the equals sign (<code>=</code>).</Typography>
                    <Typography variant="subtitle1" fontWeight="bold" color="secondary.main" mt={3} mb={1}>1. Basic Math & Functions</Typography>
                    <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 1, mb: 2 }}>• <code>= 10 * 5</code> ➔ 50<br />• <code>= ceil(10.2)</code> ➔ 11<br />• <code>= round(10.5)</code> ➔ 11<br />• Supported: <code>+ - * / ( ) ceil() floor() round() min() max()</code></Box>
                    <Typography variant="subtitle1" fontWeight="bold" color="secondary.main" mt={3} mb={1}>2. Referencing Total Item Quantities</Typography>
                    <Typography variant="body2" paragraph>Use <code>#</code> followed by the <strong>Sl.No</strong> to get the total calculated quantity of a component located <em>above</em> the current component.</Typography>
                    <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 1, mb: 2 }}>• <code>= #1 * 0.45</code> ➔ Multiplies the quantity of Sl.No 1 by 0.45.<br />• <code>= #1 + #2</code> ➔ Adds the quantities of Sl.No 1 and Sl.No 2.</Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: 'rgba(13, 31, 60, 0.5)' }}><Button onClick={() => setFormulaHelpOpen(false)} variant="contained" disableElevation sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>UNDERSTOOD</Button></DialogActions>
            </Dialog>
        </Paper>
    );
}