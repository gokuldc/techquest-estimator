import React, { useState, useMemo } from "react";
import { Box, Typography, Button, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, MenuItem, Chip, IconButton } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SaveIcon from '@mui/icons-material/Save';
import { exportRaBillPdf } from "../../utils/exportPdf";
import { tableInputActiveStyle } from "../../styles";

// 🔥 1. Import the global settings hook
import { useSettings } from "../../context/SettingsContext";

export default function ClientBillingTab({ project, renderedProjectBoq, updateProject }) {

    // 🔥 2. Grab the format function and settings
    const { formatCurrency, settings } = useSettings();

    const bills = Array.isArray(project.raBills) ? project.raBills : [];

    const availablePhases = useMemo(() => {
        const phases = new Set(renderedProjectBoq.map(item => item.phase || "General"));
        return Array.from(phases);
    }, [renderedProjectBoq]);

    const [isCreating, setIsCreating] = useState(false);
    const [billNo, setBillNo] = useState(`RA-${String(bills.length + 1).padStart(2, '0')}`);
    const [taxPercent, setTaxPercent] = useState(18);
    const [billingPhase, setBillingPhase] = useState("All Phases");
    const [currentBillItems, setCurrentBillItems] = useState({});

    const totalContractValue = renderedProjectBoq.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalBilled = bills.reduce((sum, bill) => sum + Number(bill.subTotal || 0), 0);
    const unbilledAmount = totalContractValue - totalBilled;

    const handleCreateNewBill = () => {
        const initialItems = {};
        const targetItems = billingPhase === "All Phases"
            ? renderedProjectBoq
            : renderedProjectBoq.filter(i => (i.phase || "General") === billingPhase);

        if (targetItems.length === 0) {
            return alert(`No BOQ items found for Phase: ${billingPhase}`);
        }

        targetItems.forEach(item => {
            const prevQty = bills.reduce((sum, b) => {
                const billedItem = b.items.find(i => i.boqId === item.id);
                return sum + (billedItem ? Number(billedItem.currentQty || 0) : 0);
            }, 0);

            const workDoneQty = Number(item.computedQty || 0);
            let unbilledQty = workDoneQty - prevQty;
            if (unbilledQty < 0) unbilledQty = 0;

            initialItems[item.id] = {
                prevQty: prevQty,
                mbookQty: workDoneQty,
                currentQty: unbilledQty,
                rate: Number(item.rate || 0)
            };
        });

        setCurrentBillItems(initialItems);
        setBillNo(`RA-${String(bills.length + 1).padStart(2, '0')}`);
        setIsCreating(true);
    };

    const updateCurrentQty = (boqId, qty) => {
        setCurrentBillItems(prev => ({
            ...prev,
            [boqId]: { ...prev[boqId], currentQty: Number(qty) }
        }));
    };

    const { currentSubTotal, currentTax, currentGrandTotal } = useMemo(() => {
        let sub = 0;
        Object.values(currentBillItems).forEach(item => {
            sub += (Number(item.currentQty || 0) * Number(item.rate || 0));
        });
        const tax = sub * (Number(taxPercent || 0) / 100);
        return { currentSubTotal: sub, currentTax: tax, currentGrandTotal: sub + tax };
    }, [currentBillItems, taxPercent]);

    const saveBill = async () => {
        if (currentSubTotal <= 0) return alert("Cannot save a bill with zero value.");

        const newBill = {
            id: crypto.randomUUID(),
            billNo,
            phase: billingPhase,
            date: new Date().toISOString().split('T')[0],
            status: "Approved",
            items: Object.entries(currentBillItems).map(([boqId, data]) => ({
                boqId,
                prevQty: Number(data.prevQty || 0),
                currentQty: Number(data.currentQty || 0),
                rate: Number(data.rate || 0),
                amount: Number(data.currentQty || 0) * Number(data.rate || 0)
            })),
            subTotal: currentSubTotal,
            taxPercent: Number(taxPercent || 0),
            taxAmount: currentTax,
            grandTotal: currentGrandTotal
        };

        const updatedBills = [...bills, newBill];
        await updateProject('raBills', updatedBills);
        setIsCreating(false);
    };

    const deleteBill = async (billId) => {
        if (window.confirm("Delete this RA Bill? This will release the quantities back to the unbilled pool.")) {
            const updatedBills = bills.filter(b => b.id !== billId);
            await updateProject('raBills', updatedBills);
        }
    };

    if (isCreating) {
        return (
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                {/* 🔥 FIXED: Responsive Header */}
                <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={3}>
                    <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '16px', sm: '20px' } }}>
                            GENERATE NEW RA BILL: <span style={{ color: '#3b82f6' }}>{billNo}</span>
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>
                            BILLING PHASE: {billingPhase.toUpperCase()}
                        </Typography>
                    </Box>
                    <Button variant="outlined" color="error" fullWidth={{ xs: true, sm: false }} onClick={() => setIsCreating(false)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                        CANCEL
                    </Button>
                </Box>

                {/* 🔥 FIXED: Horizontal Scrolling for Table */}
                <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)', overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 800 }}>
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                            <TableRow>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>SL.NO</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap', width: '30%' }}>DESCRIPTION</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>UNIT</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>RATE ({settings.currencySymbol})</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'info.main', whiteSpace: 'nowrap' }}>MBOOK QTY</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'warning.main', whiteSpace: 'nowrap' }}>PREV BILLED</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'success.main', whiteSpace: 'nowrap' }}>CURRENT BILL QTY</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>AMOUNT ({settings.currencySymbol})</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {renderedProjectBoq.filter(i => billingPhase === "All Phases" || (i.phase || "General") === billingPhase).map((item) => {
                                const rowData = currentBillItems[item.id];
                                if (!rowData) return null;
                                return (
                                    <TableRow key={item.id} hover>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{item.slNo}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{item.displayDesc}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{item.displayUnit}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{Number(rowData.rate || 0).toFixed(2)}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'info.light' }}>{Number(rowData.mbookQty || 0).toFixed(2)}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'warning.light' }}>{Number(rowData.prevQty || 0).toFixed(2)}</TableCell>
                                        <TableCell>
                                            <input type="number" value={rowData.currentQty} onChange={(e) => updateCurrentQty(item.id, e.target.value)} style={{ ...tableInputActiveStyle, minWidth: '80px' }} />
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                            {(Number(rowData.currentQty || 0) * Number(rowData.rate || 0)).toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* 🔥 FIXED: Responsive Totals Panel */}
                <Box display="flex" justifyContent={{ xs: 'center', sm: 'flex-end' }}>
                    <Paper elevation={0} variant="outlined" sx={{ width: { xs: '100%', sm: 400 }, p: { xs: 2, sm: 3 }, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Box display="flex" justifyContent="space-between" mb={2}>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>SUBTOTAL:</Typography>
                            <Typography fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(currentSubTotal)}</Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} borderBottom="1px solid" borderColor="divider">
                            <Box display="flex" alignItems="center" gap={1}>
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>TAX (%):</Typography>
                                <input type="number" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} />
                            </Box>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{formatCurrency(currentTax)}</Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between" mb={3} color="success.main" flexWrap="wrap" gap={1}>
                            <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '14px', sm: '16px' } }}>GRAND_TOTAL:</Typography>
                            <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '14px', sm: '16px' } }}>{formatCurrency(currentGrandTotal)}</Typography>
                        </Box>

                        <Button variant="contained" color="success" fullWidth size="large" onClick={saveBill} startIcon={<SaveIcon />} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '12px', sm: '14px' } }}>APPROVE & SAVE RA BILL</Button>
                    </Paper>
                </Box>
            </Paper>
        );
    }

    return (
        <Box>
            <Grid container spacing={2} mb={4}>
                <Grid item xs={12} md={4}>
                    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1 }}>TOTAL_CONTRACT_VALUE</Typography>
                        <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '18px', sm: '24px' } }}>{formatCurrency(totalContractValue)}</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1 }}>CUMULATIVE_BILLED</Typography>
                        <Typography variant="h5" fontWeight="bold" color="success.main" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '18px', sm: '24px' } }}>{formatCurrency(totalBilled)}</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1 }}>UNBILLED_BALANCE</Typography>
                        <Typography variant="h5" fontWeight="bold" color="warning.main" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '18px', sm: '24px' } }}>{formatCurrency(unbilledAmount)}</Typography>
                    </Paper>
                </Grid>
            </Grid>

            <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                {/* 🔥 FIXED: Responsive Controls Header */}
                <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} mb={3} gap={2}>
                    <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", pt: { md: 1 }, fontSize: { xs: '16px', sm: '20px' } }}>
                        APPROVED_RA_BILLS
                    </Typography>
                    <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <TextField
                            select
                            size="small"
                            label="SELECT PHASE"
                            value={billingPhase}
                            onChange={(e) => setBillingPhase(e.target.value)}
                            sx={{ minWidth: { xs: '100%', sm: 200 } }}
                            InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                        >
                            <MenuItem value="All Phases" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>ALL PHASES</MenuItem>
                            {availablePhases.map(phase => (
                                <MenuItem key={phase} value={phase} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                    {phase.toUpperCase()}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Button variant="contained" color="primary" fullWidth={{ xs: true, sm: false }} startIcon={<AddIcon />} onClick={handleCreateNewBill} disableElevation sx={{ height: 40, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', flexShrink: 0 }}>
                            GENERATE BILL
                        </Button>
                    </Box>
                </Box>

                {bills.length === 0 ? (
                    <Typography sx={{ textAlign: 'center', p: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>NO BILLS GENERATED YET</Typography>
                ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 800 }}>
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                                <TableRow>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>BILL_NO</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>PHASE</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>DATE</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>SUBTOTAL ({settings.currencySymbol})</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>TAX ({settings.currencySymbol})</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>GRAND_TOTAL ({settings.currencySymbol})</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>STATUS</TableCell>
                                    <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>ACTIONS</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {bills.map((bill) => (
                                    <TableRow key={bill.id} hover>
                                        <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#3b82f6', whiteSpace: 'nowrap' }}>{bill.billNo}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', whiteSpace: 'nowrap' }}>{bill.phase || "All Phases"}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', whiteSpace: 'nowrap' }}>{bill.date}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', whiteSpace: 'nowrap' }}>{formatCurrency(bill.subTotal, false)}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', whiteSpace: 'nowrap' }}>{formatCurrency(bill.taxAmount, false)}</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'success.main', whiteSpace: 'nowrap' }}>{formatCurrency(bill.grandTotal, false)}</TableCell>
                                        <TableCell><Chip label={bill.status} color="success" size="small" icon={<CheckCircleIcon />} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} /></TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            <IconButton size="small" color="info" onClick={() => exportRaBillPdf(project, bill, renderedProjectBoq)}><PictureAsPdfIcon fontSize="small" /></IconButton>
                                            <IconButton size="small" color="error" onClick={() => deleteBill(bill.id)}><DeleteIcon fontSize="small" /></IconButton>
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