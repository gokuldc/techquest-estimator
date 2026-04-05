import {
    Box, Button, Paper, Typography, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow
} from "@mui/material";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { tableInputStyle } from "../../styles";

export default function MeasurementBookTab({
    renderedProjectBoq,
    mbInputs,
    handleMbInputChange,
    addMeasurementRow,
    deleteMeasurementRow,
    focusedMbCell,
    setFocusedMbCell,
    updateMeasurementInline,
    setFormulaHelpOpen
}) {
    if (renderedProjectBoq.length === 0) {
        return (
            <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>ADD_ITEMS_TO_BOQ_FIRST</Typography>
            </Paper>
        );
    }

    return (
        <Box display="flex" flexDirection="column" gap={4}>
            {renderedProjectBoq.map(item => (
                <Paper key={item.id} elevation={0} sx={{ overflow: "hidden", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Box sx={{ bgcolor: "rgba(0,0,0,0.2)", p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '14px' }}>{item.slNo}. {item.displayCode ? `[${item.displayCode}]` : ''} {item.displayDesc}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>TOTAL_QTY: <Box component="span" color="success.main" fontWeight="bold" fontSize="1rem">{Number(item.computedQty || 0).toFixed(2)} {item.displayUnit}</Box></Typography>
                        </Box>
                        <Button variant="outlined" size="small" startIcon={<HelpOutlineIcon />} onClick={() => setFormulaHelpOpen(true)} sx={{ py: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                            FORMULA GUIDE
                        </Button>
                    </Box>

                    <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                                <TableRow>
                                    <TableCell sx={{ width: '30%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>LOCATION_DETAILS</TableCell>
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
                                                <input value={m.details} onChange={e => updateMeasurementInline(item, m.id, 'details', e.target.value)} style={tableInputStyle} />
                                                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>Row Index: {idx + 1}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isNoFocused ? (m.no !== undefined ? m.no : "") : ((m.no === "" || m.no === undefined) ? "" : Number(m.computedNo || 0).toFixed(2))}
                                                    onFocus={() => setFocusedMbCell(`${m.id}-no`)} onBlur={() => setFocusedMbCell(null)}
                                                    onChange={e => updateMeasurementInline(item, m.id, 'no', e.target.value)} style={tableInputStyle}
                                                />
                                                {isNoFocused && String(m.no || "").startsWith("=") && <Typography variant="caption" color="info.main" display="block">={Number(m.computedNo || 0).toFixed(2)}</Typography>}
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isLFocused ? (m.l !== undefined ? m.l : "") : ((m.l === "" || m.l === undefined) ? "" : Number(m.computedL || 0).toFixed(2))}
                                                    onFocus={() => setFocusedMbCell(`${m.id}-l`)} onBlur={() => setFocusedMbCell(null)}
                                                    onChange={e => updateMeasurementInline(item, m.id, 'l', e.target.value)} style={tableInputStyle}
                                                />
                                                {isLFocused && String(m.l || "").startsWith("=") && <Typography variant="caption" color="info.main" display="block">={Number(m.computedL || 0).toFixed(2)}</Typography>}
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isBFocused ? (m.b !== undefined ? m.b : "") : ((m.b === "" || m.b === undefined) ? "" : Number(m.computedB || 0).toFixed(2))}
                                                    onFocus={() => setFocusedMbCell(`${m.id}-b`)} onBlur={() => setFocusedMbCell(null)}
                                                    onChange={e => updateMeasurementInline(item, m.id, 'b', e.target.value)} style={tableInputStyle}
                                                />
                                                {isBFocused && String(m.b || "").startsWith("=") && <Typography variant="caption" color="info.main" display="block">={Number(m.computedB || 0).toFixed(2)}</Typography>}
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isDFocused ? (m.d !== undefined ? m.d : "") : ((m.d === "" || m.d === undefined) ? "" : Number(m.computedD || 0).toFixed(2))}
                                                    onFocus={() => setFocusedMbCell(`${m.id}-d`)} onBlur={() => setFocusedMbCell(null)}
                                                    onChange={e => updateMeasurementInline(item, m.id, 'd', e.target.value)} style={tableInputStyle}
                                                />
                                                {isDFocused && String(m.d || "").startsWith("=") && <Typography variant="caption" color="info.main" display="block">={Number(m.computedD || 0).toFixed(2)}</Typography>}
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{Number(m.computedQty || 0).toFixed(2)}</TableCell>
                                            <TableCell align="center"><Button color="error" size="small" onClick={() => deleteMeasurementRow(item, m.id)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DELETE</Button></TableCell>
                                        </TableRow>
                                    );
                                })}
                                <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.15)' }}>
                                    <TableCell><input placeholder="e.g. Ground Floor Room 1" value={mbInputs[item.id]?.details || ""} onChange={e => handleMbInputChange(item.id, 'details', e.target.value)} style={tableInputStyle} /></TableCell>
                                    <TableCell><input type="text" placeholder="No. or =" value={mbInputs[item.id]?.no || ""} onChange={e => handleMbInputChange(item.id, 'no', e.target.value)} style={tableInputStyle} /></TableCell>
                                    <TableCell><input type="text" placeholder="L or =" value={mbInputs[item.id]?.l || ""} onChange={e => handleMbInputChange(item.id, 'l', e.target.value)} style={tableInputStyle} /></TableCell>
                                    <TableCell><input type="text" placeholder="B or =" value={mbInputs[item.id]?.b || ""} onChange={e => handleMbInputChange(item.id, 'b', e.target.value)} style={tableInputStyle} /></TableCell>
                                    <TableCell><input type="text" placeholder="D/H or =" value={mbInputs[item.id]?.d || ""} onChange={e => handleMbInputChange(item.id, 'd', e.target.value)} style={tableInputStyle} /></TableCell>
                                    <TableCell color="text.secondary">-</TableCell>
                                    <TableCell align="center"><Button variant="contained" size="small" onClick={() => addMeasurementRow(item)} fullWidth sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }}>ADD</Button></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            ))}
        </Box>
    );
}