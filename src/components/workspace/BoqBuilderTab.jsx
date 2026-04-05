import { useState } from "react";
import {
    Box, Button, TextField, MenuItem, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, Alert
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { tableInputStyle } from "../../styles";

export default function BoqBuilderTab({
    addMode, setAddMode,
    searchCode, setSearchCode,
    searchDesc, setSearchDesc,
    addBoqId, setAddBoqId,
    addBoqQty, setAddBoqQty,
    customCode, setCustomCode,
    customDesc, setCustomDesc,
    customUnit, setCustomUnit,
    customRate, setCustomRate,
    customQty, setCustomQty,
    filteredMasterBoqs,
    renderedProjectBoq,
    focusedQtyId, setFocusedQtyId,
    draggedId,
    addBoqItemToProject,
    openEditDialog,
    deleteProjectBoq,
    updateBoqQtyManual,
    handleDragStart, handleDragOver, handleDrop,
    setFormulaHelpOpen,
    totalAmount
}) {
    return (
        <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
                <Button variant={addMode === "master" ? "contained" : "outlined"} onClick={() => setAddMode("master")} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '12px' }}>
                    MASTER_DATABASE
                </Button>
                <Button variant={addMode === "custom" ? "contained" : "outlined"} onClick={() => setAddMode("custom")} color="secondary" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '12px' }}>
                    CUSTOM_AD_HOC
                </Button>
            </Box>

            <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                {addMode === "master" ? (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <TextField size="small" placeholder="Search Code..." value={searchCode} onChange={e => setSearchCode(e.target.value)} sx={{ flex: 1, minWidth: 120 }} InputProps={{ startAdornment: <SearchIcon fontSize="small" /> }} />
                        <TextField size="small" placeholder="Search Description..." value={searchDesc} onChange={e => setSearchDesc(e.target.value)} sx={{ flex: 1.5, minWidth: 150 }} InputProps={{ startAdornment: <SearchIcon fontSize="small" /> }} />
                        <TextField select size="small" label="SELECT_ITEM" value={addBoqId} onChange={e => setAddBoqId(e.target.value)} sx={{ flex: 2, minWidth: 250 }}>
                            <MenuItem value="">-- CHOOSE_MASTER_BOQ --</MenuItem>
                            {filteredMasterBoqs.map(b => <MenuItem key={b.id} value={b.id}>{b.itemCode ? `[${b.itemCode}] ` : ''}{b.description}</MenuItem>)}
                        </TextField>
                        <TextField size="small" type="text" label="QTY OR FORMULA" value={addBoqQty} onChange={e => setAddBoqQty(e.target.value)} placeholder="e.g. 50 or =#1*10" sx={{ width: 140 }} />
                        <Button variant="contained" onClick={addBoqItemToProject} startIcon={<AddIcon />} sx={{ height: 40, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>ADD</Button>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <TextField size="small" label="CODE" value={customCode} onChange={e => setCustomCode(e.target.value)} sx={{ width: 120 }} />
                        <TextField size="small" label="DESCRIPTION" value={customDesc} onChange={e => setCustomDesc(e.target.value)} sx={{ flex: 2, minWidth: 200 }} />
                        <TextField size="small" label="UNIT" value={customUnit} onChange={e => setCustomUnit(e.target.value)} sx={{ width: 100 }} />
                        <TextField size="small" type="number" label="RATE" value={customRate} onChange={e => setCustomRate(e.target.value)} sx={{ width: 120 }} />
                        <TextField size="small" type="text" label="QTY OR FORMULA" value={customQty} onChange={e => setCustomQty(e.target.value)} placeholder="e.g. 50 or =#1*10" sx={{ width: 140 }} />
                        <Button variant="contained" color="secondary" onClick={addBoqItemToProject} startIcon={<AddIcon />} sx={{ height: 40, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>ADD_CUSTOM</Button>
                    </Box>
                )}
            </Box>

            <Alert severity="info" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                💡 <strong>TIPS:</strong> Drag the grip icon (⋮⋮) to reorder items. Start with <code>=</code> for formulas. Use <code>ceil()</code>, <code>floor()</code>, <code>round()</code>.
                <Button variant="outlined" size="small" startIcon={<HelpOutlineIcon />} onClick={() => setFormulaHelpOpen(true)} sx={{ ml: 2, py: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                    FORMULA GUIDE
                </Button>
            </Alert>

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell sx={{ width: 40 }}></TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>SL.NO</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CODE</TableCell>
                            <TableCell sx={{ width: '35%', fontFamily: "'JetBrains Mono', monospace" }}>DESCRIPTION</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>QUANTITY/FORMULA</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>UNIT</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>UNIT_RATE</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>TOTAL_AMOUNT</TableCell>
                            <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>ACTION</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {renderedProjectBoq.map(item => {
                            const isFormula = String(item.formulaStr || "").trim().startsWith("=");
                            const isFocused = focusedQtyId === item.id;

                            return (
                                <TableRow
                                    key={item.id} draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, item.id)}
                                    sx={{ bgcolor: item.isCustom ? 'rgba(34, 211, 238, 0.03)' : 'inherit', opacity: draggedId === item.id ? 0.4 : 1, transition: 'opacity 0.2s' }}
                                >
                                    <TableCell sx={{ cursor: 'grab', py: 0 }}><DragIndicatorIcon color="action" fontSize="small" sx={{ verticalAlign: 'middle' }} /></TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.slNo}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', color: item.isCustom ? 'secondary.main' : 'inherit', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.displayCode || "-"}</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.displayDesc}</TableCell>
                                    <TableCell>
                                        <input
                                            type="text"
                                            value={item.hasMBook
                                                ? Number(item.computedQty || 0).toFixed(2)
                                                : (isFocused ? (item.formulaStr !== undefined ? item.formulaStr : item.qty) : Number(item.computedQty || 0).toFixed(2))
                                            }
                                            onFocus={() => setFocusedQtyId(item.id)} onBlur={() => setFocusedQtyId(null)}
                                            onChange={e => updateBoqQtyManual(item.id, e.target.value)}
                                            disabled={item.hasMBook} placeholder="e.g. =#1 * 125"
                                            style={{ ...tableInputStyle, background: item.hasMBook ? "var(--mui-palette-action-disabledBackground)" : tableInputStyle.background }}
                                        />
                                        {item.hasMBook ? (
                                            <Box component="span" display="block" mt={0.5} color="success.main" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>AUTO_FROM_MBOOK</Box>
                                        ) : (isFormula && isFocused) ? (
                                            <Box component="span" display="block" mt={0.5} color="info.main" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                                                Computed: <strong>{Number(item.computedQty || 0).toFixed(2)}</strong>
                                            </Box>
                                        ) : null}
                                    </TableCell>
                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.displayUnit}</TableCell>
                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {item.rate.toFixed(2)}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {item.amount.toFixed(2)}</TableCell>
                                    <TableCell align="center">
                                        <Box display="flex" gap={1} justifyContent="center">
                                            <IconButton color="warning" onClick={() => openEditDialog(item)} size="small"><EditIcon fontSize="small" /></IconButton>
                                            <IconButton color="error" onClick={() => deleteProjectBoq(item.id)} size="small"><DeleteIcon fontSize="small" /></IconButton>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {renderedProjectBoq.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>NO_ITEMS_IN_BOQ</TableCell></TableRow>}
                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                            <TableCell colSpan={7} align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', fontFamily: "'JetBrains Mono', monospace" }}>TOTAL_ESTIMATE:</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'success.main', fontFamily: "'JetBrains Mono', monospace" }}>₹ {totalAmount.toFixed(2)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}