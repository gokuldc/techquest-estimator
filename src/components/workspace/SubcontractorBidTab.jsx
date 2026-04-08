import React, { useState } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Button } from '@mui/material';
import { tableInputActiveStyle } from '../../styles';

export default function SubcontractorBidTab({ project, renderedProjectBoq, updateProject }) {
    const [newSubName, setNewSubName] = useState("");

    const addSubcontractor = async () => {
        if (!newSubName) return;
        const subs = [...(project.subcontractors || []), { id: crypto.randomUUID(), name: newSubName, rates: {} }];
        await updateProject("subcontractors", subs);
        setNewSubName("");
    };

    const handleSubRateChange = async (subId, boqId, rate) => {
        const subs = [...(project.subcontractors || [])];
        const subIndex = subs.findIndex(s => s.id === subId);
        if (subIndex > -1) {
            subs[subIndex].rates[boqId] = Number(rate);
            await updateProject("subcontractors", subs);
        }
    };

    return (
        <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
            <Box display="flex" gap={2} mb={3}>
                <TextField
                    size="small"
                    label="SUBCONTRACTOR_NAME"
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                />
                <Button variant="contained" disableElevation onClick={addSubcontractor} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                    + ADD BIDDER
                </Button>
            </Box>

            <TableContainer>
                <Table size="small">
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell rowSpan={2} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DESCRIPTION</TableCell>
                            <TableCell rowSpan={2} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY</TableCell>
                            <TableCell colSpan={2} align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', borderRight: '2px solid rgba(255,255,255,0.1)' }}>ESTIMATED (IN-HOUSE)</TableCell>
                            {(project.subcontractors || []).map(sub => (
                                <TableCell key={sub.id} colSpan={2} align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'secondary.main', borderRight: '2px solid rgba(255,255,255,0.1)' }}>
                                    {sub.name.toUpperCase()}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>RATE</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', borderRight: '2px solid rgba(255,255,255,0.1)' }}>AMOUNT</TableCell>
                            {(project.subcontractors || []).map(sub => (
                                <React.Fragment key={`${sub.id}-headers`}>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'secondary.main' }}>RATE</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'secondary.main', borderRight: '2px solid rgba(255,255,255,0.1)' }}>AMOUNT</TableCell>
                                </React.Fragment>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {renderedProjectBoq.map(item => (
                            <TableRow key={item.id}>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.displayDesc}</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{Number(item.computedQty).toFixed(2)} {item.displayUnit}</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹{item.rate.toFixed(2)}</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', borderRight: '2px solid rgba(255,255,255,0.05)' }}>₹{item.amount.toFixed(2)}</TableCell>

                                {(project.subcontractors || []).map(sub => {
                                    const subRate = sub.rates[item.id] || 0;
                                    const subAmount = subRate * item.computedQty;
                                    return (
                                        <React.Fragment key={`${sub.id}-${item.id}`}>
                                            <TableCell>
                                                <input type="number" value={sub.rates[item.id] || ""} onChange={(e) => handleSubRateChange(sub.id, item.id, e.target.value)} style={tableInputActiveStyle} />
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', color: subAmount > item.amount ? 'error.main' : 'success.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', borderRight: '2px solid rgba(255,255,255,0.05)' }}>
                                                ₹{subAmount.toFixed(2)}
                                            </TableCell>
                                        </React.Fragment>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}