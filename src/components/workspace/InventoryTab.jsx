import React, { useState, useMemo } from 'react';
import {
    Box, Typography, Paper, TextField, Button, Autocomplete,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Chip, Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function InventoryTab({ project, resources, updateProject }) {
    const [grnDate, setGrnDate] = useState(new Date().toISOString().split('T')[0]);
    const [grnRes, setGrnRes] = useState(null);
    const [grnQty, setGrnQty] = useState("");
    const [grnInvoice, setGrnInvoice] = useState("");
    const [grnSupplier, setGrnSupplier] = useState("");

    const grns = Array.isArray(project?.grns) ? project.grns : [];
    const logs = Array.isArray(project?.dailyLogs) ? project.dailyLogs : [];

    // 🔥 THE CORE RECONCILIATION ENGINE 🔥
    const stockReconciliation = useMemo(() => {
        const stock = {};

        // 1. Calculate Inward from GRNs (Deliveries)
        grns.forEach(grn => {
            if (!stock[grn.resourceId]) stock[grn.resourceId] = { inward: 0, outward: 0 };
            stock[grn.resourceId].inward += Number(grn.qty);
        });

        // 2. Calculate Outward from Daily Logs (Consumption)
        logs.forEach(log => {
            if (!stock[log.resourceId]) stock[log.resourceId] = { inward: 0, outward: 0 };
            stock[log.resourceId].outward += Number(log.qty);
        });

        // 3. Map to Master Resource details
        return Object.entries(stock).map(([resId, data]) => {
            const res = resources.find(r => r.id === resId) || {};
            const currentStock = data.inward - data.outward;
            return {
                resourceId: resId,
                code: res.code || 'UNKNOWN',
                description: res.description || 'Unknown Resource',
                unit: res.unit || '-',
                inward: data.inward,
                outward: data.outward,
                currentStock: currentStock,
                status: currentStock < 0 ? 'Negative' : (currentStock === 0 ? 'Empty' : 'In Stock')
            };
        }).filter(item => item.inward > 0 || item.outward > 0);
    }, [grns, logs, resources]);

    const submitGrn = async () => {
        if (!grnRes || !grnQty) return alert("Please select a resource and enter the quantity received.");

        const newGrn = {
            id: crypto.randomUUID(),
            date: grnDate,
            resourceId: grnRes.id,
            qty: Number(grnQty),
            invoiceNo: grnInvoice,
            supplier: grnSupplier
        };

        await updateProject("grns", [...grns, newGrn]);
        
        setGrnRes(null);
        setGrnQty("");
        setGrnInvoice("");
    };

    const deleteGrn = async (id) => {
        if (window.confirm("Are you sure you want to delete this receipt? It will alter your current stock levels.")) {
            const updatedGrns = grns.filter(g => g.id !== id);
            await updateProject("grns", updatedGrns);
        }
    };

    const sortedGrns = [...grns].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <Box display="flex" flexDirection="column" gap={4}>
            
            {/* LIVE STOCK DASHBOARD */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InventoryIcon fontSize="small" color="primary" /> LIVE_STOCK_RECONCILIATION
                </Typography>
                
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                            <TableRow>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RESOURCE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'success.main' }}>TOTAL INWARD (GRN)</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'warning.main' }}>TOTAL CONSUMED (LOGS)</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'info.main' }}>CURRENT STOCK</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>STATUS</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {stockReconciliation.map(item => (
                                <TableRow key={item.resourceId} hover>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                        <strong>{item.code}</strong> - {item.description}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'success.light' }}>
                                        {item.inward.toFixed(2)} {item.unit}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'warning.light' }}>
                                        {item.outward.toFixed(2)} {item.unit}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 'bold', color: item.currentStock < 0 ? 'error.main' : 'info.main' }}>
                                        {item.currentStock.toFixed(2)} {item.unit}
                                    </TableCell>
                                    <TableCell>
                                        {item.status === 'Negative' ? (
                                            <Chip icon={<WarningAmberIcon />} label="GHOST CONSUMPTION" color="error" size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} />
                                        ) : item.status === 'Empty' ? (
                                            <Chip label="OUT OF STOCK" color="default" size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} />
                                        ) : (
                                            <Chip label="IN STOCK" color="success" size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {stockReconciliation.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                        NO STOCK DATA AVAILABLE. RECORD A GRN OR DAILY LOG TO BEGIN RECONCILIATION.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* MATERIAL INWARD FORM (GRN) */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(16, 185, 129, 0.05)' }}>
                <Typography variant="subtitle2" fontWeight="bold" color="success.main" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocalShippingIcon fontSize="small" /> LOG_MATERIAL_INWARD (GRN)
                </Typography>
                
                <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-start" mb={4}>
                    <TextField 
                        type="date" size="small" label="DELIVERY DATE" 
                        value={grnDate} onChange={e => setGrnDate(e.target.value)} 
                        InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    />
                    <Autocomplete 
                        options={resources} 
                        getOptionLabel={(option) => option ? `${option.code || ''} - ${option.description || ''}` : ''} 
                        isOptionEqualToValue={(option, value) => option.id === value?.id}
                        value={grnRes} 
                        onChange={(e, newVal) => setGrnRes(newVal)} 
                        sx={{ flex: 2, minWidth: 250 }} 
                        renderInput={(params) => <TextField {...params} size="small" label="DELIVERED RESOURCE" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ ...params.InputProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />} 
                    />
                    <TextField 
                        type="number" size="small" label="QTY RECEIVED" 
                        value={grnQty} onChange={e => setGrnQty(e.target.value)} 
                        sx={{ width: 120 }} 
                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    />
                    <TextField 
                        size="small" label="CHALLAN / INVOICE NO." 
                        value={grnInvoice} onChange={e => setGrnInvoice(e.target.value)} 
                        sx={{ flex: 1, minWidth: 150 }} 
                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    />
                    <TextField 
                        size="small" label="SUPPLIER NAME" 
                        value={grnSupplier} onChange={e => setGrnSupplier(e.target.value)} 
                        sx={{ flex: 1.5, minWidth: 150 }} 
                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    />
                    <Button variant="contained" color="success" onClick={submitGrn} startIcon={<AddIcon />} sx={{ height: 40, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                        RECORD GRN
                    </Button>
                </Box>

                {/* GRN HISTORY TABLE */}
                <Typography variant="subtitle2" mb={1} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'text.secondary' }}>RECENT_RECEIPTS</Typography>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                            <TableRow>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DATE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RESOURCE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY RECEIVED</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>INVOICE REF</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>SUPPLIER</TableCell>
                                <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedGrns.map(grn => {
                                const res = resources.find(r => r.id === grn.resourceId) || {};
                                return (
                                    <TableRow key={grn.id} hover>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{grn.date}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 'bold' }}>{res.code} - {res.description}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'success.light' }}>+ {grn.qty} {res.unit}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'text.secondary' }}>{grn.invoiceNo || '-'}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{grn.supplier || '-'}</TableCell>
                                        <TableCell align="center">
                                            <IconButton size="small" color="error" onClick={() => deleteGrn(grn.id)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}