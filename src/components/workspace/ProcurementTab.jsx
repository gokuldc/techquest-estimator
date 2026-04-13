import React, { useState, useMemo } from "react";
import {
    Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, MenuItem, Chip, IconButton, Tooltip, Zoom
} from "@mui/material";
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SaveIcon from '@mui/icons-material/Save';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/Timeline';
import { exportPoPdf } from "../../utils/exportPdf";
import { tableInputActiveStyle } from "../../styles";
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';

// 🔥 1. Import the global settings hook
import { useSettings } from "../../context/SettingsContext";

// --- MINI CHART COMPONENT ---
const PriceInsight = ({ resource }) => {
    // 🔥 Grab the formatter for the mini-chart
    const { formatCurrency } = useSettings();

    const history = useMemo(() => {
        return (resource?.rateHistory || []).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [resource]);

    if (history.length < 2) return <Typography variant="caption" sx={{ p: 1, display: 'block' }}>Limited price data available</Typography>;

    return (
        <Box sx={{ width: 220, height: 120, p: 1.5, bgcolor: '#0b172d', borderRadius: 2 }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 'bold', color: 'primary.main', fontFamily: "'JetBrains Mono', monospace" }}>
                MARKET_TREND ({resource.unit})
            </Typography>
            <ResponsiveContainer width="100%" height="70%">
                <LineChart data={history}>
                    <Line type="monotone" dataKey="rate" stroke="#3b82f6" dot={false} strokeWidth={2} />
                    <YAxis hide domain={['auto', 'auto']} />
                </LineChart>
            </ResponsiveContainer>
            <Box display="flex" justifyContent="space-between" mt={1}>
                {/* 🔥 Replaced Hardcoded ₹ */}
                <Typography sx={{ fontSize: '9px', opacity: 0.6 }}>Old: {formatCurrency(history[0].rate)}</Typography>
                <Typography sx={{ fontSize: '9px', fontWeight: 'bold' }}>New: {formatCurrency(history[history.length - 1].rate)}</Typography>
            </Box>
        </Box>
    );
};

export default function ProcurementTab({ project, projectResourceMap, resources, updateProject, crmContacts }) {

    // 🔥 2. Grab the format function and raw settings
    const { formatCurrency, settings } = useSettings();

    const pos = Array.isArray(project.purchaseOrders) ? project.purchaseOrders : [];
    const siteRequests = Array.isArray(project.materialRequests) ? project.materialRequests : [];

    const [isCreating, setIsCreating] = useState(false);
    const [poNumber, setPoNumber] = useState(`PO-${String(pos.length + 1).padStart(3, '0')}`);
    const [selectedSupplier, setSelectedSupplier] = useState("");
    const [taxPercent, setTaxPercent] = useState(18);
    const [poItems, setPoItems] = useState({});

    const suppliers = crmContacts.filter(c => c.type === 'Vendor' || c.type === 'Supplier' || c.type === 'Subcontractor');

    const handleCreateNewPO = () => {
        const initialItems = {};
        Object.entries(projectResourceMap).forEach(([resId, data]) => {
            const masterResource = resources.find(r => r.id === resId);
            const rate = masterResource?.rates?.[project.region] || 0;
            initialItems[resId] = { isCustom: false, code: data.code, description: data.description, unit: data.unit, estRequired: data.estimatedQty, orderQty: 0, rate: rate };
        });
        setPoItems(initialItems);
        setPoNumber(`PO-${String(pos.length + 1).padStart(3, '0')}`);
        setIsCreating(true);
    };

    const handleConvertRequestToPo = (req) => {
        const customId = `custom-${crypto.randomUUID()}`;
        setPoItems({
            [customId]: { isCustom: true, code: 'REQ', description: req.item, unit: 'Nos', estRequired: req.qty, orderQty: req.qty, rate: 0, linkedReqId: req.id }
        });
        setPoNumber(`PO-${String(pos.length + 1).padStart(3, '0')}`);
        setIsCreating(true);
    };

    const addUnplannedItem = () => {
        const customId = `custom-${crypto.randomUUID()}`;
        setPoItems(prev => ({
            ...prev,
            [customId]: { isCustom: true, code: 'UNPLANNED', description: '', unit: '', estRequired: 0, orderQty: 0, rate: 0 }
        }));
    };

    const updatePoItem = (resId, field, value) => {
        setPoItems(prev => ({ ...prev, [resId]: { ...prev[resId], [field]: field === 'description' || field === 'unit' ? value : Number(value) } }));
    };

    const { currentSubTotal, currentTax, currentGrandTotal } = useMemo(() => {
        let sub = 0;
        Object.values(poItems).forEach(item => { if (item.orderQty > 0) sub += (Number(item.orderQty || 0) * Number(item.rate || 0)); });
        const tax = sub * (Number(taxPercent || 0) / 100);
        return { currentSubTotal: sub, currentTax: tax, currentGrandTotal: sub + tax };
    }, [poItems, taxPercent]);

    const savePurchaseOrder = async () => {
        if (!selectedSupplier) return alert("Please select a supplier.");
        if (currentSubTotal <= 0) return alert("Please enter quantities and rates to order.");

        const activeItems = Object.entries(poItems)
            .filter(([id, data]) => data.orderQty > 0)
            .map(([id, data]) => ({
                resId: id, code: data.code, description: data.description, unit: data.unit, qty: data.orderQty, rate: data.rate, amount: data.orderQty * data.rate, linkedReqId: data.linkedReqId
            }));

        const supplierName = suppliers.find(s => s.id === selectedSupplier)?.name || "Unknown";
        const newPo = { id: crypto.randomUUID(), poNumber, date: new Date().toISOString().split('T')[0], supplierId: selectedSupplier, supplierName, status: "Issued", items: activeItems, subTotal: currentSubTotal, taxPercent: Number(taxPercent), taxAmount: currentTax, grandTotal: currentGrandTotal };

        let updatedRequests = [...siteRequests];
        activeItems.forEach(item => {
            if (item.linkedReqId) {
                updatedRequests = updatedRequests.map(r => r.id === item.linkedReqId ? { ...r, status: 'Ordered' } : r);
            }
        });

        await updateProject('purchaseOrders', [...pos, newPo]);
        await updateProject('materialRequests', updatedRequests);
        setIsCreating(false);
    };

    const deletePo = async (poId) => {
        if (window.confirm("Are you sure you want to delete this Purchase Order?")) {
            await updateProject('purchaseOrders', pos.filter(p => p.id !== poId));
        }
    };

    if (isCreating) {
        return (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        DRAFT PURCHASE ORDER: <span style={{ color: '#3b82f6' }}>{poNumber}</span>
                    </Typography>
                    <Button variant="outlined" color="error" onClick={() => setIsCreating(false)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CANCEL</Button>
                </Box>

                <Box mb={3} width="300px">
                    <TextField select size="small" fullWidth label="SELECT SUPPLIER / VENDOR" value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                        {suppliers.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{s.name}</MenuItem>)}
                    </TextField>
                </Box>

                <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)', maxHeight: 500 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ bgcolor: 'rgba(13, 31, 60, 1)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RESOURCE</TableCell>
                                <TableCell sx={{ bgcolor: 'rgba(13, 31, 60, 1)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UNIT</TableCell>
                                <TableCell sx={{ bgcolor: 'rgba(13, 31, 60, 1)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'info.main' }}>EST. REQ.</TableCell>
                                <TableCell sx={{ bgcolor: 'rgba(13, 31, 60, 1)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'success.main' }}>ORDER QTY</TableCell>

                                {/* 🔥 Dynamic Table Headers */}
                                <TableCell sx={{ bgcolor: 'rgba(13, 31, 60, 1)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RATE ({settings.currencySymbol})</TableCell>
                                <TableCell sx={{ bgcolor: 'rgba(13, 31, 60, 1)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>AMOUNT ({settings.currencySymbol})</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(poItems).map(([resId, rowData]) => {
                                const resource = !rowData.isCustom ? resources.find(r => r.id === resId) : null;

                                return (
                                    <TableRow key={resId} hover>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                            <Box display="flex" alignItems="center">
                                                {rowData.isCustom ? (
                                                    <input value={rowData.description} placeholder="Type description..." onChange={(e) => updatePoItem(resId, 'description', e.target.value)} style={{ ...tableInputActiveStyle, width: '100%' }} />
                                                ) : (
                                                    <>
                                                        <strong>{rowData.code}</strong> - {rowData.description}
                                                        {resource && (
                                                            <Tooltip
                                                                TransitionComponent={Zoom}
                                                                title={<PriceInsight resource={resource} />}
                                                                arrow
                                                                placement="right"
                                                            >
                                                                <IconButton size="small" color="primary" sx={{ ml: 1, p: 0.5, opacity: 0.7, '&:hover': { opacity: 1 } }}>
                                                                    <TimelineIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                            {rowData.isCustom ? <input value={rowData.unit} placeholder="Unit" onChange={(e) => updatePoItem(resId, 'unit', e.target.value)} style={{ ...tableInputActiveStyle, width: '60px' }} /> : rowData.unit}
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'info.light' }}>
                                            {rowData.estRequired > 0 ? Number(rowData.estRequired || 0).toFixed(2) : '-'}
                                        </TableCell>
                                        <TableCell><input type="number" value={rowData.orderQty || ""} placeholder="0" onChange={(e) => updatePoItem(resId, 'orderQty', e.target.value)} style={tableInputActiveStyle} /></TableCell>
                                        <TableCell><input type="number" value={rowData.rate || ""} onChange={(e) => updatePoItem(resId, 'rate', e.target.value)} style={tableInputActiveStyle} /></TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: rowData.orderQty > 0 ? 'success.main' : 'text.primary' }}>
                                            {Number(rowData.orderQty * rowData.rate || 0).toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Button variant="outlined" color="info" startIcon={<AddIcon />} onClick={addUnplannedItem} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>+ ADD UNPLANNED ITEM</Button>
                    <Paper elevation={0} variant="outlined" sx={{ width: 400, p: 3, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>

                        {/* 🔥 Formatted Totals */}
                        <Box display="flex" justifyContent="space-between" mb={2}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>SUBTOTAL:</Typography><Typography fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(currentSubTotal)}</Typography></Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} borderBottom="1px solid" borderColor="divider">
                            <Box display="flex" alignItems="center" gap={1}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>TAX (%):</Typography><input type="number" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} /></Box>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(currentTax)}</Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" mb={3} color="success.main"><Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>GRAND TOTAL:</Typography><Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>{formatCurrency(currentGrandTotal)}</Typography></Box>

                        <Button variant="contained" color="success" fullWidth size="large" onClick={savePurchaseOrder} startIcon={<SaveIcon />} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>ISSUE PURCHASE ORDER</Button>
                    </Paper>
                </Box>
            </Paper>
        );
    }

    const pendingRequests = siteRequests.filter(r => r.status === 'Pending Procurement');

    return (
        <Box display="flex" flexDirection="column" gap={4}>
            {/* INCOMING SITE REQUISITIONS */}
            {pendingRequests.length > 0 && (
                <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'warning.main', bgcolor: 'rgba(245, 158, 11, 0.05)' }}>
                    <Typography variant="h6" fontWeight="bold" color="warning.main" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AssignmentLateIcon /> PENDING SITE REQUISITIONS ({pendingRequests.length})
                    </Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                                <TableRow>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#fff' }}>DATE</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#fff' }}>REQUESTED ITEM</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#fff' }}>QTY</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#fff' }}>URGENCY</TableCell>
                                    <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#fff' }}>ACTION</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {pendingRequests.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{req.date}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 'bold' }}>{req.item}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{req.qty}</TableCell>
                                        <TableCell><Chip label={req.urgency} color={req.urgency === 'High' ? 'error' : 'default'} size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} /></TableCell>
                                        <TableCell align="right">
                                            <Button variant="contained" color="warning" size="small" onClick={() => handleConvertRequestToPo(req)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                                                CONVERT TO P.O.
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* ISSUED PURCHASE ORDERS */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>ISSUED_PURCHASE_ORDERS</Typography>
                    <Button variant="contained" color="primary" startIcon={<AddShoppingCartIcon />} onClick={handleCreateNewPO} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                        DRAFT NEW P.O.
                    </Button>
                </Box>

                {pos.length === 0 ? (
                    <Typography sx={{ textAlign: 'center', p: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>NO PURCHASE ORDERS ISSUED</Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                                <TableRow>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>PO_NUMBER</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DATE</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>SUPPLIER</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ITEMS</TableCell>

                                    {/* 🔥 Dynamic Total Header */}
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>TOTAL ({settings.currencySymbol})</TableCell>

                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>STATUS</TableCell>
                                    <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTIONS</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {pos.map((po) => (
                                    <TableRow key={po.id} hover>
                                        <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#3b82f6' }}>{po.poNumber}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{po.date}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{po.supplierName}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{po.items.length} items</TableCell>

                                        {/* 🔥 Formatted Grand Total */}
                                        <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'success.main' }}>{formatCurrency(po.grandTotal, false)}</TableCell>

                                        <TableCell><Chip label={po.status} color="info" size="small" icon={<LocalShippingIcon />} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} /></TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" color="info" onClick={() => exportPoPdf(project, po)}><PictureAsPdfIcon fontSize="small" /></IconButton>
                                            <IconButton size="small" color="error" onClick={() => deletePo(po.id)}><DeleteIcon fontSize="small" /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
}