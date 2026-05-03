import React, { useState } from 'react';
import {
    Box, Paper, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { tableInputStyle } from '../../styles';

export default function MeasurementBookTab({ renderedProjectBoq, setFormulaHelpOpen, loadData }) {
    const [mbInputs, setMbInputs] = useState({});
    const [focusedMbCell, setFocusedMbCell] = useState(null);
    const [localMb, setLocalMb] = useState({}); 

    const handleMbInputChange = (itemId, field, value) => {
        setMbInputs(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
    };

    const addMeasurementRow = async (item) => {
        const inputs = mbInputs[item.id] || {};
        if (!inputs.details) return alert("Please enter a location/detail description.");
        const newRow = {
            id: crypto.randomUUID(),
            details: inputs.details,
            no: String(inputs.no || 1),
            l: String(inputs.l || ""),
            b: String(inputs.b || ""),
            d: String(inputs.d || "")
        };
        
        const updatedMeasurements = [...(item.measurements || []), newRow];
        await window.api.db.updateProjectBoq(item.id, { measurements: JSON.stringify(updatedMeasurements) });
        setMbInputs(prev => ({ ...prev, [item.id]: { details: "", no: "", l: "", b: "", d: "" } }));
        if (loadData) loadData(); 
    };

    const deleteMeasurementRow = async (item, measurementId) => {
        const updatedMeasurements = (item.measurements || []).filter(m => m.id !== measurementId);
        await window.api.db.updateProjectBoq(item.id, { measurements: JSON.stringify(updatedMeasurements) });
        if (loadData) loadData(); 
    };

    const updateMeasurementInline = async (item, measurementId, field, value) => {
        const updatedMeasurements = (item.measurements || []).map(m => {
            if (m.id === measurementId) return { ...m, [field]: value };
            return m;
        });
        await window.api.db.updateProjectBoq(item.id, { measurements: JSON.stringify(updatedMeasurements) });
        if (loadData) loadData(); 
    };

    return (
        <Box display="flex" flexDirection="column" gap={4}>
            {renderedProjectBoq.length === 0 && (
                <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>
                        ADD_ITEMS_TO_BOQ_FIRST
                    </Typography>
                </Paper>
            )}

            {renderedProjectBoq.map(item => (
                <Paper key={item.id} elevation={0} sx={{ overflow: "hidden", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    
                    {/* 🔥 RESPONSIVE HEADER: Stacks on mobile */}
                    <Box sx={{ 
                        bgcolor: "rgba(0,0,0,0.2)", 
                        p: { xs: 1.5, sm: 2 }, 
                        borderBottom: "1px solid", 
                        borderColor: "divider", 
                        display: "flex", 
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: "space-between", 
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: 1.5
                    }}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: { xs: '13px', sm: '14px' } }}>
                                {item.slNo}. {item.displayCode ? `[${item.displayCode}]` : ''} {item.displayDesc}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                TOTAL_QTY: <Box component="span" color="success.main" fontWeight="bold" fontSize="1rem">{Number(item.computedQty || 0).toFixed(2)} {item.displayUnit}</Box>
                            </Typography>
                        </Box>
                        <Button 
                            variant="outlined" 
                            size="small" 
                            fullWidth={{ xs: true, sm: false }}
                            startIcon={<HelpOutlineIcon />} 
                            onClick={() => setFormulaHelpOpen(true)} 
                            sx={{ py: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}
                        >
                            FORMULA GUIDE
                        </Button>
                    </Box>

                    {/* 🔥 RESPONSIVE TABLE: Horizontal Scroll is mandatory here */}
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 800 }}>
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                                <TableRow>
                                    <TableCell sx={{ width: '30%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>LOCATION_DETAILS</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>NO.</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>L</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>B</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>D/H</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY</TableCell>
                                    <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(item.computedMeasurements || []).map((m, idx) => {
                                    const isNoFocused = focusedMbCell === `${m.id}-no`;
                                    const isLFocused = focusedMbCell === `${m.id}-l`;
                                    const isBFocused = focusedMbCell === `${m.id}-b`;
                                    const isDFocused = focusedMbCell === `${m.id}-d`;

                                    return (
                                        <TableRow key={m.id}>
                                            <TableCell>
                                                <input value={m.details} onChange={e => updateMeasurementInline(item, m.id, 'details', e.target.value)} style={{ ...tableInputStyle, minWidth: '150px' }} />
                                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>Row Index: {idx + 1}</Typography>
                                            </TableCell>
                                            
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isNoFocused ? (localMb[`${m.id}-no`] !== undefined ? localMb[`${m.id}-no`] : m.no) : ((m.no === "" || m.no === undefined) ? "" : Number(m.computedNo || 0).toFixed(2))}
                                                    onFocus={() => { setFocusedMbCell(`${m.id}-no`); setLocalMb(prev => ({ ...prev, [`${m.id}-no`]: m.no !== undefined ? m.no : "" })); }}
                                                    onBlur={() => { setFocusedMbCell(null); if (localMb[`${m.id}-no`] !== undefined && localMb[`${m.id}-no`] !== m.no) updateMeasurementInline(item, m.id, 'no', localMb[`${m.id}-no`]); }}
                                                    onChange={e => setLocalMb(prev => ({ ...prev, [`${m.id}-no`]: e.target.value }))} 
                                                    style={{ ...tableInputStyle, minWidth: '60px' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isLFocused ? (localMb[`${m.id}-l`] !== undefined ? localMb[`${m.id}-l`] : m.l) : ((m.l === "" || m.l === undefined) ? "" : Number(m.computedL || 0).toFixed(2))}
                                                    onFocus={() => { setFocusedMbCell(`${m.id}-l`); setLocalMb(prev => ({ ...prev, [`${m.id}-l`]: m.l !== undefined ? m.l : "" })); }}
                                                    onBlur={() => { setFocusedMbCell(null); if (localMb[`${m.id}-l`] !== undefined && localMb[`${m.id}-l`] !== m.l) updateMeasurementInline(item, m.id, 'l', localMb[`${m.id}-l`]); }}
                                                    onChange={e => setLocalMb(prev => ({ ...prev, [`${m.id}-l`]: e.target.value }))} 
                                                    style={{ ...tableInputStyle, minWidth: '60px' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isBFocused ? (localMb[`${m.id}-b`] !== undefined ? localMb[`${m.id}-b`] : m.b) : ((m.b === "" || m.b === undefined) ? "" : Number(m.computedB || 0).toFixed(2))}
                                                    onFocus={() => { setFocusedMbCell(`${m.id}-b`); setLocalMb(prev => ({ ...prev, [`${m.id}-b`]: m.b !== undefined ? m.b : "" })); }}
                                                    onBlur={() => { setFocusedMbCell(null); if (localMb[`${m.id}-b`] !== undefined && localMb[`${m.id}-b`] !== m.b) updateMeasurementInline(item, m.id, 'b', localMb[`${m.id}-b`]); }}
                                                    onChange={e => setLocalMb(prev => ({ ...prev, [`${m.id}-b`]: e.target.value }))} 
                                                    style={{ ...tableInputStyle, minWidth: '60px' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isDFocused ? (localMb[`${m.id}-d`] !== undefined ? localMb[`${m.id}-d`] : m.d) : ((m.d === "" || m.d === undefined) ? "" : Number(m.computedD || 0).toFixed(2))}
                                                    onFocus={() => { setFocusedMbCell(`${m.id}-d`); setLocalMb(prev => ({ ...prev, [`${m.id}-d`]: m.d !== undefined ? m.d : "" })); }}
                                                    onBlur={() => { setFocusedMbCell(null); if (localMb[`${m.id}-d`] !== undefined && localMb[`${m.id}-d`] !== m.d) updateMeasurementInline(item, m.id, 'd', localMb[`${m.id}-d`]); }}
                                                    onChange={e => setLocalMb(prev => ({ ...prev, [`${m.id}-d`]: e.target.value }))} 
                                                    style={{ ...tableInputStyle, minWidth: '60px' }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', whiteSpace: 'nowrap' }}>{Number(m.computedQty || 0).toFixed(2)}</TableCell>
                                            <TableCell align="center">
                                                <Button color="error" size="small" onClick={() => deleteMeasurementRow(item, m.id)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', minWidth: '60px' }}>DEL</Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                
                                {/* Add New Entry Row */}
                                <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.15)' }}>
                                    <TableCell><input placeholder="Location..." value={mbInputs[item.id]?.details || ""} onChange={e => handleMbInputChange(item.id, 'details', e.target.value)} style={{ ...tableInputStyle, minWidth: '150px' }} /></TableCell>
                                    <TableCell><input type="text" placeholder="No" value={mbInputs[item.id]?.no || ""} onChange={e => handleMbInputChange(item.id, 'no', e.target.value)} style={{ ...tableInputStyle, minWidth: '60px' }} /></TableCell>
                                    <TableCell><input type="text" placeholder="L" value={mbInputs[item.id]?.l || ""} onChange={e => handleMbInputChange(item.id, 'l', e.target.value)} style={{ ...tableInputStyle, minWidth: '60px' }} /></TableCell>
                                    <TableCell><input type="text" placeholder="B" value={mbInputs[item.id]?.b || ""} onChange={e => handleMbInputChange(item.id, 'b', e.target.value)} style={{ ...tableInputStyle, minWidth: '60px' }} /></TableCell>
                                    <TableCell><input type="text" placeholder="D/H" value={mbInputs[item.id]?.d || ""} onChange={e => handleMbInputChange(item.id, 'd', e.target.value)} style={{ ...tableInputStyle, minWidth: '60px' }} /></TableCell>
                                    <TableCell color="text.secondary">-</TableCell>
                                    <TableCell align="center">
                                        <Button variant="contained" size="small" onClick={() => addMeasurementRow(item)} fullWidth sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }}>ADD</Button>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            ))}
        </Box>
    );
}