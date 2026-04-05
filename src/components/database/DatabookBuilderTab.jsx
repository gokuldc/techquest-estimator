import { useState, useMemo } from "react";
import {
    Box, Paper, Typography, TextField, MenuItem, Button, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Divider
} from "@mui/material";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import { getResourceRate, calculateMasterBoqRate } from "../../engines/calculationEngine";
import { tableInputStyle, tableInputActiveStyle } from "../../styles";

export default function DatabookBuilderTab({
    editingBoqId,
    boqCode, setBoqCode,
    boqDesc, setBoqDesc,
    boqUnit, setBoqUnit,
    boqRegion, setBoqRegion,
    previewRegion, setPreviewRegion,
    boqOH, setBoqOH,
    boqProfit, setBoqProfit,
    boqRows, setBoqRows,
    resources, masterBoqs, regions,
    focusedQtyId, setFocusedQtyId,
    formulaHelpOpen, setFormulaHelpOpen,
    addSpreadsheetRow,
    updateSpreadsheetRow,
    removeSpreadsheetRow,
    saveBoq,
    clearForm
}) {
    const computedRows = useMemo(() => {
        return boqRows.map(row => {
            const sourceList = row.itemType === 'boq' ? masterBoqs : resources;
            const source = sourceList.find(s => s.id === row.itemId);
            const rate = source ? getResourceRate(source, previewRegion || boqRegion) : 0;
            const computedQty = row.formulaStr?.trim().startsWith("=")
                ? calculateFromFormula(boqRows, row.formulaStr, row.id)
                : Number(row.qty || 0);
            const amount = rate * computedQty;
            return { ...row, unit: source?.unit || "-", rate, computedQty, amount };
        });
    }, [boqRows, resources, masterBoqs, previewRegion, boqRegion]);

    const calculateFromFormula = (rows, formula, currentId) => {
        try {
            if (!formula.startsWith('=')) return Number(formula || 0);
            const expr = formula.slice(1).replace(/#(\d+)/g, (_, idx) => {
                const row = rows.find(r => r.slNo === parseInt(idx));
                return row?.computedQty || 0;
            });
            return eval(expr);
        } catch { return 0; }
    };

    const subTotal = computedRows.reduce((sum, r) => sum + r.amount, 0);
    const ohAmount = subTotal * (Number(boqOH) / 100);
    const profitAmount = subTotal * (Number(boqProfit) / 100);
    const grandTotal = subTotal + ohAmount + profitAmount;

    return (
        <Paper elevation={0} variant="outlined" sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
            <Typography variant="h6" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}>
                {editingBoqId ? "EDIT" : "CREATE"}_DATABOOK_ITEM
            </Typography>
            <Divider sx={{ mb: 3, borderColor: 'divider' }} />

            <Box display="flex" gap={3} flexWrap="wrap" mb={4}>
                <TextField label="ITEM_CODE" value={boqCode} onChange={e => setBoqCode(e.target.value)} placeholder="e.g. BOQ-001" sx={{ flex: 1, minWidth: 150 }} />
                <TextField label="DESCRIPTION" value={boqDesc} onChange={e => setBoqDesc(e.target.value)} placeholder="e.g. Earthwork..." sx={{ flex: 2, minWidth: 300 }} />
                <TextField label="UNIT" value={boqUnit} onChange={e => setBoqUnit(e.target.value)} sx={{ width: 100 }} />
                <TextField select label="REGION" value={boqRegion} onChange={e => setBoqRegion(e.target.value)} sx={{ flex: 1, minWidth: 200 }}>
                    <MenuItem value="">-- DEFAULT --</MenuItem>
                    {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                </TextField>
            </Box>

            <Box display="flex" gap={2} mb={3}>
                <TextField label="OVERHEAD (%)" type="number" value={boqOH} onChange={e => setBoqOH(e.target.value)} sx={{ width: 120 }} size="small" />
                <TextField label="PROFIT (%)" type="number" value={boqProfit} onChange={e => setBoqProfit(e.target.value)} sx={{ width: 120 }} size="small" />
                <TextField select label="PREVIEW_REGION" value={previewRegion} onChange={e => setPreviewRegion(e.target.value)} sx={{ flex: 1, minWidth: 200 }} size="small">
                    <MenuItem value="">-- DEFAULT --</MenuItem>
                    {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                </TextField>
            </Box>

            <Alert severity="info" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                💡 <strong>TIPS:</strong> Start with <code>=</code> for formulas. Use <code>ceil()</code>, <code>floor()</code>, <code>round()</code>. Reference components by row index using <code>#</code> (e.g. <code>=#1 * 1.5</code>).
                <Button variant="outlined" size="small" startIcon={<HelpOutlineIcon />} onClick={() => setFormulaHelpOpen(true)} sx={{ ml: 2, py: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                    FORMULA GUIDE
                </Button>
            </Alert>

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>SL.NO</TableCell>
                            <TableCell sx={{ width: '12%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>TYPE</TableCell>
                            <TableCell sx={{ width: '15%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CODE</TableCell>
                            <TableCell sx={{ width: '25%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DESCRIPTION</TableCell>
                            <TableCell sx={{ width: '8%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UNIT</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY/FORMULA</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RATE</TableCell>
                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>AMOUNT</TableCell>
                            <TableCell align="center" sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {computedRows.map((row, idx) => {
                            const isFormula = String(row.formulaStr || "").trim().startsWith("=");
                            const isFocused = focusedQtyId === row.id;

                            return (
                                <TableRow key={row.id}>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{idx + 1}</TableCell>
                                    <TableCell>
                                        <select value={row.itemType} onChange={e => updateSpreadsheetRow(row.id, 'itemType', e.target.value)} style={tableInputActiveStyle}>
                                            <option value="resource">RESOURCE</option>
                                            <option value="boq">DATABOOK_ITEM</option>
                                        </select>
                                    </TableCell>
                                    <TableCell>
                                        <input
                                            list={`codes-${row.id}`}
                                            value={row.tempCode !== undefined ? row.tempCode : ""}
                                            onChange={e => updateSpreadsheetRow(row.id, 'tempCode', e.target.value)}
                                            placeholder="Type code..."
                                            style={tableInputActiveStyle}
                                        />
                                        <datalist id={`codes-${row.id}`}>
                                            {(row.itemType === 'boq' ? masterBoqs : resources).map(s => <option key={s.id} value={s.code || s.itemCode} />)}
                                        </datalist>
                                    </TableCell>
                                    <TableCell>
                                        <input
                                            list={`descs-${row.id}`}
                                            value={row.tempDesc !== undefined ? row.tempDesc : ""}
                                            onChange={e => updateSpreadsheetRow(row.id, 'tempDesc', e.target.value)}
                                            placeholder="Type description..."
                                            style={tableInputActiveStyle}
                                        />
                                        <datalist id={`descs-${row.id}`}>
                                            {(row.itemType === 'boq' ? masterBoqs : resources).filter(s => s.description).map(s => <option key={s.id} value={s.description} />)}
                                        </datalist>
                                    </TableCell>
                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{row.unit}</TableCell>
                                    <TableCell>
                                        <input
                                            type="text"
                                            value={isFocused ? (row.formulaStr !== undefined ? row.formulaStr : row.qty) : Number(row.computedQty || 0).toFixed(4)}
                                            onFocus={() => setFocusedQtyId(row.id)}
                                            onBlur={() => setFocusedQtyId(null)}
                                            onChange={e => updateSpreadsheetRow(row.id, 'formulaStr', e.target.value)}
                                            placeholder="e.g. =#1 * 0.05"
                                            style={tableInputActiveStyle}
                                        />
                                    </TableCell>
                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(row.rate || 0).toFixed(2)}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(row.amount || 0).toFixed(2)}</TableCell>
                                    <TableCell align="center"><IconButton size="small" color="error" onClick={() => removeSpreadsheetRow(row.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Button variant="outlined" disableElevation onClick={addSpreadsheetRow} sx={{ mb: 4, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>
                + ADD_COMPONENT
            </Button>

            <Box display="flex" justifyContent="flex-end">
                <Paper elevation={0} variant="outlined" sx={{ width: 400, p: 3, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>SUBTOTAL:</Typography>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {subTotal.toFixed(2)}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>OVERHEAD ({boqOH}%):</Typography>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {ohAmount.toFixed(2)}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>PROFIT ({boqProfit}%):</Typography>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {profitAmount.toFixed(2)}</Typography>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Box display="flex" justifyContent="space-between">
                        <Typography fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>FINAL_RATE:</Typography>
                        <Typography fontWeight="bold" color="success.main" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>₹ {grandTotal.toFixed(2)} / {boqUnit}</Typography>
                    </Box>
                </Paper>
            </Box>

            <Box display="flex" gap={2} justifyContent="flex-end" mt={3}>
                <Button variant="outlined" onClick={clearForm} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>CLEAR</Button>
                <Button variant="contained" onClick={saveBoq} startIcon={<DeleteIcon />} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>
                    {editingBoqId ? "UPDATE_ITEM" : "SAVE_TO_DATABOOK"}
                </Button>
            </Box>
        </Paper>
    );
}