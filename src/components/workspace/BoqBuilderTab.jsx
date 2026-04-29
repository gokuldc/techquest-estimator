import React, { useState, useMemo } from "react";
import {
    Box, Typography, Button, Paper, TextField, MenuItem, Autocomplete,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, InputAdornment, Alert
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SearchIcon from '@mui/icons-material/Search';
import { tableInputStyle } from "../../styles";

import { useSettings } from '../../context/SettingsContext';

export default function BoqBuilderTab({
    projectId, projectBoqItems, masterBoqs, renderedProjectBoq, totalAmount,
    handleAddMasterItem, handleAddCustomItem, updateBoqQtyManual, deleteProjectBoq,
    openEditDialog, setFormulaHelpOpen, handleDragStart, handleDragOver, handleDrop, draggedId
}) {
    const { formatCurrency } = useSettings();

    const [addMode, setAddMode] = useState("master");
    const [searchCode, setSearchCode] = useState("");
    const [searchDesc, setSearchDesc] = useState("");
    const [addBoqId, setAddBoqId] = useState("");
    const [addBoqQty, setAddBoqQty] = useState("");

    const [customCode, setCustomCode] = useState("");
    const [customDesc, setCustomDesc] = useState("");
    const [customUnit, setCustomUnit] = useState("cum");
    const [customRate, setCustomRate] = useState("");
    const [customQty, setCustomQty] = useState("");

    const [focusedQtyId, setFocusedQtyId] = useState(null);
    const [localFormulas, setLocalFormulas] = useState({});

    const [activePhase, setActivePhase] = useState("General");

    const availablePhases = useMemo(() => {
        const phases = new Set((projectBoqItems || []).map(item => item.phase).filter(Boolean));
        if (phases.size === 0) return ["Substructure", "Superstructure", "Finishing", "MEP", "General"];
        return Array.from(phases);
    }, [projectBoqItems]);

    const groupedBoq = useMemo(() => {
        const groups = {};
        (renderedProjectBoq || []).forEach(item => {
            const phase = item.phase || "General";
            if (!groups[phase]) groups[phase] = [];
            groups[phase].push(item);
        });
        return groups;
    }, [renderedProjectBoq]);

    const filteredMasterBoqs = (masterBoqs || []).filter(b =>
        (b.itemCode || "").toLowerCase().includes(searchCode.toLowerCase()) &&
        (b.description || "").toLowerCase().includes(searchDesc.toLowerCase())
    );

    const submitMaster = () => {
        if (!addBoqId || !addBoqQty) return alert("Select an item and enter quantity.");
        handleAddMasterItem(addBoqId, addBoqQty, activePhase);
        setAddBoqId(""); setAddBoqQty("");
    };

    const submitCustom = () => {
        if (!customDesc || !customRate || !customQty) return alert("Description, Rate, and Qty required.");
        handleAddCustomItem(customCode, customDesc, customUnit, customRate, customQty, activePhase);
        setCustomCode(""); setCustomDesc(""); setCustomRate(""); setCustomQty("");
    };

    return (
        <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>

            {/* Mode Toggles */}
            <Box sx={{ display: "flex", flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
                <Button variant={addMode === "master" ? "contained" : "outlined"} onClick={() => setAddMode("master")} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '12px' }}>
                    MASTER_DATABASE
                </Button>
                <Button variant={addMode === "custom" ? "contained" : "outlined"} onClick={() => setAddMode("custom")} color="secondary" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '12px' }}>
                    CUSTOM_AD_HOC
                </Button>
            </Box>

            <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                {addMode === "master" ? (
                    <Box display="flex" flexDirection="column" gap={2}>
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', md: 'row' }}>
                            <TextField fullWidth size="small" placeholder="Search Code..." value={searchCode} onChange={e => setSearchCode(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            <TextField fullWidth size="small" placeholder="Search Description..." value={searchDesc} onChange={e => setSearchDesc(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Box>

                        <TextField select fullWidth size="small" label="SELECT_ITEM" value={addBoqId} onChange={e => setAddBoqId(e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                            <MenuItem value="">-- CHOOSE_MASTER_BOQ --</MenuItem>
                            {filteredMasterBoqs.map(b => <MenuItem key={b.id} value={b.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', whiteSpace: 'normal' }}>{b.itemCode ? `[${b.itemCode}] ` : ''}{b.description}</MenuItem>)}
                        </TextField>

                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                            <TextField fullWidth size="small" type="text" label="QTY OR FORMULA" value={addBoqQty} onChange={e => setAddBoqQty(e.target.value)} placeholder="e.g. 50 or =#1*10" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            <Autocomplete
                                freeSolo
                                fullWidth
                                options={availablePhases}
                                value={activePhase}
                                onChange={(event, newValue) => setActivePhase(newValue || "General")}
                                onInputChange={(event, newInputValue) => setActivePhase(newInputValue || "General")}
                                renderInput={(params) => <TextField {...params} size="small" label="PHASE" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ ...params.InputProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />}
                            />
                            <Button variant="contained" fullWidth onClick={submitMaster} startIcon={<AddIcon />} sx={{ height: 40, flexShrink: 0, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', width: { xs: '100%', sm: 'auto' } }}>ADD</Button>
                        </Box>
                    </Box>
                ) : (
                    <Box display="flex" flexDirection="column" gap={2}>
                        {/* Row 1: Code and Description */}
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                            <TextField
                                fullWidth size="small" label="CODE" value={customCode} onChange={e => setCustomCode(e.target.value)}
                                sx={{ flex: { xs: 1, sm: 1 } }}
                                InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                            />
                            <TextField
                                fullWidth size="small" label="DESCRIPTION" value={customDesc} onChange={e => setCustomDesc(e.target.value)}
                                sx={{ flex: { xs: 1, sm: 3 } }}
                                InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                            />
                        </Box>

                        {/* 🔥 FIXED: Row 2: Unit, Rate, and Qty added back into UI */}
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                            <TextField
                                fullWidth size="small" label="UNIT" value={customUnit} onChange={e => setCustomUnit(e.target.value)}
                                InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                            />
                            <TextField
                                fullWidth size="small" type="number" label="RATE" value={customRate} onChange={e => setCustomRate(e.target.value)}
                                InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                            />
                            <TextField
                                fullWidth size="small" type="number" label="QTY" value={customQty} onChange={e => setCustomQty(e.target.value)}
                                InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                            />
                        </Box>

                        {/* Row 3: Phase and Submit */}
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                            <Autocomplete
                                freeSolo
                                fullWidth
                                options={availablePhases}
                                value={activePhase}
                                onChange={(event, newValue) => setActivePhase(newValue || "General")}
                                onInputChange={(event, newInputValue) => setActivePhase(newInputValue || "General")}
                                renderInput={(params) => <TextField {...params} size="small" label="PHASE" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ ...params.InputProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />}
                            />
                            <Button variant="contained" color="secondary" fullWidth onClick={submitCustom} startIcon={<AddIcon />} sx={{ height: 40, flexShrink: 0, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', width: { xs: '100%', sm: 'auto' } }}>ADD_CUSTOM</Button>
                        </Box>
                    </Box>
                )}
            </Box>

            <Alert severity="info" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
                <Box>💡 <strong>TIPS:</strong> Drag the grip icon (⋮⋮) to reorder items. Start with <code>=</code> for formulas. Use <code>ceil()</code>, <code>floor()</code>, <code>round()</code>.</Box>
                <Button variant="outlined" size="small" startIcon={<HelpOutlineIcon />} onClick={() => setFormulaHelpOpen(true)} sx={{ py: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', whiteSpace: 'nowrap' }}>
                    FORMULA GUIDE
                </Button>
            </Alert>

            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell sx={{ width: 40 }}></TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>SL.NO</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>CODE</TableCell>
                            <TableCell sx={{ width: '40%', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>DESCRIPTION</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>QUANTITY/FORMULA</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>UNIT</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>UNIT_RATE</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>TOTAL_AMOUNT</TableCell>
                            <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>ACTION</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {Object.keys(groupedBoq).length > 0 ? (
                            Object.entries(groupedBoq).map(([phaseName, phaseItems]) => (
                                <React.Fragment key={`phase-${phaseName}`}>
                                    <TableRow sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
                                        <TableCell colSpan={9} sx={{ py: 1.5, borderBottom: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                            <Typography variant="subtitle2" color="primary.main" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                                                ❖ PHASE: {phaseName.toUpperCase()}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>

                                    {phaseItems.map(item => {
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
                                                            : (isFocused ? (localFormulas[item.id] !== undefined ? localFormulas[item.id] : (item.formulaStr !== undefined ? item.formulaStr : item.qty)) : Number(item.computedQty || 0).toFixed(2))}
                                                        onFocus={() => {
                                                            setLocalFormulas(prev => ({ ...prev, [item.id]: item.formulaStr !== undefined ? item.formulaStr : item.qty }));
                                                            setFocusedQtyId(item.id);
                                                        }}
                                                        onBlur={() => {
                                                            setFocusedQtyId(null);
                                                            if (localFormulas[item.id] !== undefined && localFormulas[item.id] !== item.formulaStr) {
                                                                updateBoqQtyManual(item.id, localFormulas[item.id]);
                                                            }
                                                        }}
                                                        onChange={e => setLocalFormulas(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                        disabled={item.hasMBook} placeholder="e.g. =#1 * 125"
                                                        style={{ ...tableInputStyle, background: item.hasMBook ? "var(--mui-palette-action-disabledBackground)" : tableInputStyle.background }}
                                                    />
                                                    {item.hasMBook ? (
                                                        <Typography variant="caption" color="success.main" display="block" mt={0.5} fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>AUTO_FROM_MBOOK</Typography>
                                                    ) : (isFormula && isFocused) ? (
                                                        <Typography variant="caption" color="info.main" display="block" mt={0.5} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                                                            Computed: <strong>{Number(item.computedQty || 0).toFixed(2)}</strong>
                                                        </Typography>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.displayUnit}</TableCell>
                                                <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                                    {formatCurrency(Number(item.rate) || 0)}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                                    {formatCurrency(Number(item.amount) || 0)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Box display="flex" gap={1} justifyContent="center">
                                                        <IconButton color="warning" onClick={() => openEditDialog(item)} size="small"><EditIcon fontSize="small" /></IconButton>
                                                        <IconButton color="error" onClick={() => deleteProjectBoq(item.id)} size="small"><DeleteIcon fontSize="small" /></IconButton>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </React.Fragment>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>NO_ITEMS_IN_BOQ</TableCell></TableRow>
                        )}
                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                            <TableCell colSpan={7} align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', fontFamily: "'JetBrains Mono', monospace" }}>TOTAL_ESTIMATE:</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'success.main', fontFamily: "'JetBrains Mono', monospace" }}>
                                {formatCurrency(Number(totalAmount) || 0)}
                            </TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}