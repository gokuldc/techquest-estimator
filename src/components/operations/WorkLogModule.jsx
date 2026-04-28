import React, { useState, useMemo } from 'react';
import {
    Box, Typography, Paper, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, TextField, MenuItem, 
    Grid, Stack, alpha, useTheme, Select, Dialog, DialogTitle, 
    DialogContent, DialogActions, List, ListItem, ListItemText, InputBase
} from '@mui/material';

// Icons
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SortIcon from '@mui/icons-material/Sort';
import DownloadIcon from '@mui/icons-material/Download';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import * as XLSX from 'xlsx';

const STATUS_OPTIONS = ['Ongoing', 'Completed', 'On Hold', 'Cancelled'];
const LOCATION_OPTIONS = ['Office', 'Site', 'Work From Home', 'Leave'];

const INITIAL_COLUMNS = [
    { id: 'slNo', label: 'SL NO' },
    { id: 'date', label: 'DATE' },
    { id: 'staffId', label: 'PERSONNEL' },
    { id: 'projectId', label: 'PROJECT' },
    { id: 'details', label: 'WORK EXECUTED' },
    { id: 'remarks', label: 'LOCATION' }, 
    { id: 'status', label: 'STATUS' }, 
];

// 🔥 FIX: Removed filterMonth and setFilterMonth from props
export default function WorkLogModule({ 
    logs, staff, projects, currentUser, hasClearance, loadData
}) {
    const theme = useTheme();
    
    // --- LOCAL UI STATE ---
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnOrder, setColumnOrder] = useState(INITIAL_COLUMNS);
    const [colSettingsOpen, setColSettingsOpen] = useState(false);
    
    // 🔥 FIX: Initialized filterMonth as local state here instead
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; 
    });
    
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        staffId: currentUser?.id || "",
        projectId: "",
        details: "",
        remarks: "Office", 
        status: "Ongoing"
    });

    // --- LOGIC: COLUMN REORDERING ---
    const moveColumn = (index, direction) => {
        const newOrder = [...columnOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
        }
        setColumnOrder(newOrder);
    };

    // --- LOGIC: HOT EDITING ---
    const handleUpdateField = async (id, field, value) => {
        const original = logs.find(l => l.id === id);
        if (original && original[field] === value) return;
        try {
            await window.api.db.updateWorkLog(id, { [field]: value });
            loadData();
        } catch (err) { console.error("Update failed:", err); }
    };

    // --- LOGIC: SORTING & FILTERING ---
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const sortedLogs = useMemo(() => {
        let filtered = logs.filter(log => log.date && log.date.startsWith(filterMonth));
        return [...filtered].sort((a, b) => {
            let aVal = a[sortConfig.key] || "";
            let bVal = b[sortConfig.key] || "";
            if (sortConfig.key === 'staffId') {
                aVal = staff.find(s => s.id === a.staffId)?.name || "";
                bVal = staff.find(s => s.id === b.staffId)?.name || "";
            }
            if (sortConfig.key === 'projectId') {
                aVal = projects.find(p => p.id === a.projectId)?.name || "";
                bVal = projects.find(p => p.id === b.projectId)?.name || "";
            }
            return sortConfig.direction === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
        });
    }, [logs, filterMonth, sortConfig, staff, projects]);

    // --- LOGIC: ACTIONS ---
    const handleSaveLog = async () => {
        if (!formData.details && formData.remarks !== 'Leave') return alert("Work details required.");
        const newLog = { 
            id: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2), 
            slNo: logs.length + 1, 
            ...formData, 
            createdAt: Date.now() 
        };
        await window.api.db.saveWorkLog(newLog);
        setFormData(prev => ({ ...prev, details: "", projectId: "" }));
        loadData();
    };

    const handleDelete = async (id) => {
        if (window.confirm("Permanently delete this entry?")) {
            await window.api.db.deleteWorkLog(id);
            loadData();
        }
    };

    const handleExportExcel = () => {
        if (sortedLogs.length === 0) return alert("No records found.");
        const exportData = sortedLogs.map(log => ({
            "SL NO": log.slNo,
            "Date": log.date,
            "Staff Member": staff.find(s => s.id === log.staffId)?.name || 'Unknown',
            "Project": projects.find(p => p.id === log.projectId)?.name || 'N/A',
            "Work Executed": log.details,
            "Location": log.remarks || 'Office',
            "Status": log.status || 'Ongoing'
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "WorkLogs");
        XLSX.writeFile(wb, `Firm_Work_Logs_${filterMonth}.xlsx`);
    };

    // --- STYLES FOR GHOST INPUTS ---
    const ghostInputStyle = {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '12px',
        color: 'text.primary',
        width: '100%',
        padding: '6px 8px',
        borderRadius: '6px',
        transition: 'all 0.2s ease',
        border: '1px solid transparent',
        '&:hover': { 
            bgcolor: alpha(theme.palette.common.white, 0.05),
            borderColor: alpha(theme.palette.common.white, 0.1)
        },
        '&.Mui-focused': { 
            bgcolor: alpha(theme.palette.background.default, 0.8),
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Completed') return 'success';
        if (status === 'On Hold') return 'warning';
        if (status === 'Cancelled') return 'error';
        return 'info'; // Ongoing
    };

    return (
        <Box>
            {/* CONTROLS BAR */}
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" gap={2} mb={4}>
                <TextField
                    type="month" size="small" label="FILTER MONTH" value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                    sx={{ width: { xs: '100%', sm: 200 } }}
                />
                <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <Button variant="outlined" color="inherit" startIcon={<ViewColumnIcon />} onClick={() => setColSettingsOpen(true)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', borderColor: 'divider' }}>
                        LAYOUT
                    </Button>
                    <Button variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={handleExportExcel} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', boxShadow: 'none' }}>
                        EXPORT
                    </Button>
                </Stack>
            </Box>

            {/* QUICK ADD FORM */}
            <Paper elevation={0} sx={{ 
                p: {xs: 2, md: 3}, mb: 4, 
                bgcolor: alpha(theme.palette.background.paper, 0.3), 
                border: '1px solid', borderColor: 'divider', 
                borderTop: `3px solid ${theme.palette.primary.main}`,
                borderRadius: 2, flexShrink: 0 
            }}>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                    <AddCircleOutlineIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        SUBMIT_NEW_LOG
                    </Typography>
                </Box>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={2}><TextField fullWidth type="date" size="small" label="DATE" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField fullWidth select size="small" label="PERSONNEL" value={staff.some(s => s.id === formData.staffId) ? formData.staffId : ""} onChange={e => setFormData({ ...formData, staffId: e.target.value })} disabled={!hasClearance(4)}>
                            {staff.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}><TextField fullWidth select size="small" label="LOCATION" value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })}>{LOCATION_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</TextField></Grid>
                    <Grid item xs={12} sm={6} md={2}><TextField fullWidth select size="small" label="STATUS" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>{STATUS_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</TextField></Grid>
                    <Grid item xs={12} sm={12} md={4}><TextField fullWidth select size="small" label="ASSIGNED PROJECT" value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })}><MenuItem value="" sx={{ fontStyle: 'italic', opacity: 0.5 }}>-- Non-Project / Office --</MenuItem>{projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField></Grid>
                    <Grid item xs={12} md={10}><TextField fullWidth size="small" label="EXECUTED TASKS / DETAILS" value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })} /></Grid>
                    <Grid item xs={12} md={2}><Button fullWidth variant="contained" color="primary" onClick={handleSaveLog} sx={{ height: 40, fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', boxShadow: 'none' }}>COMMIT</Button></Grid>
                </Grid>
            </Paper>

            {/* TABLE */}
            <TableContainer component={Paper} elevation={0} sx={{ 
                border: '1px solid', borderColor: 'divider', 
                bgcolor: alpha(theme.palette.background.paper, 0.2), 
                borderRadius: 2, height: 'auto', maxHeight: 'none', overflowX: 'auto' 
            }}>
                <Table size="small" sx={{ minWidth: 1100 }}>
                    <TableHead sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9) }}>
                        <TableRow>
                            {columnOrder.map((col) => (
                                <TableCell 
                                    key={col.id} 
                                    onClick={() => setSortConfig({ key: col.id, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} 
                                    sx={{ cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}
                                >
                                    <Box display="flex" alignItems="center" gap={0.5}>{col.label} <SortIcon sx={{ fontSize: 14, opacity: sortConfig.key === col.id ? 1 : 0.2 }} /></Box>
                                </TableCell>
                            ))}
                            {hasClearance(4) && <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}></TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedLogs.length === 0 ? (
                            <TableRow><TableCell colSpan={columnOrder.length + 1} align="center" sx={{ py: 10, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", border: 'none' }}>NO_RECORDS_FOUND</TableCell></TableRow>
                        ) : (
                            sortedLogs.map((log, idx) => (
                                <TableRow key={log.id} hover sx={{ 
                                    bgcolor: idx % 2 === 0 ? 'transparent' : alpha(theme.palette.common.white, 0.01),
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                                    '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)' }
                                }}>
                                    {columnOrder.map(col => (
                                        <TableCell key={col.id} sx={{ p: '4px' }}>
                                            
                                            {/* TEXT INPUTS */}
                                            {col.id === 'slNo' || col.id === 'date' || col.id === 'details' ? (
                                                <InputBase 
                                                    type={col.id === 'slNo' ? 'number' : col.id === 'date' ? 'date' : 'text'}
                                                    multiline={col.id === 'details'}
                                                    defaultValue={log[col.id]} 
                                                    onBlur={(e) => handleUpdateField(log.id, col.id, col.id === 'slNo' ? parseInt(e.target.value) : e.target.value)} 
                                                    sx={ghostInputStyle} 
                                                />
                                            ) : (
                                                
                                                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    {/* DROPDOWNS AND VISUAL BADGES */}
                                                    {col.id === 'status' && (
                                                        <Box sx={{ position: 'absolute', left: 8, pointerEvents: 'none' }}>
                                                            <Typography sx={{ fontSize: '10px', fontWeight: 'bold', color: theme.palette[getStatusColor(log.status || 'Ongoing')].main, bgcolor: alpha(theme.palette[getStatusColor(log.status || 'Ongoing')].main, 0.1), px: 1, py: 0.5, borderRadius: 1, border: `1px solid ${alpha(theme.palette[getStatusColor(log.status || 'Ongoing')].main, 0.3)}` }}>
                                                                {log.status || 'Ongoing'}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    {col.id === 'remarks' && (
                                                        <Box sx={{ position: 'absolute', left: 8, pointerEvents: 'none' }}>
                                                            <Typography sx={{ fontSize: '10px', color: 'text.secondary', bgcolor: 'rgba(255,255,255,0.05)', px: 1, py: 0.5, borderRadius: 1, border: '1px solid rgba(255,255,255,0.1)' }}>
                                                                {log.remarks || 'Office'}
                                                            </Typography>
                                                        </Box>
                                                    )}

                                                    <Select 
                                                        value={log[col.id] || ""} 
                                                        onChange={(e) => handleUpdateField(log.id, col.id, e.target.value)} 
                                                        sx={{ 
                                                            ...ghostInputStyle, 
                                                            color: (col.id === 'status' || col.id === 'remarks') ? 'transparent' : 'text.primary', 
                                                            '& .MuiSelect-icon': { opacity: 0.2, transition: '0.2s' },
                                                            '&:hover .MuiSelect-icon': { opacity: 1 }
                                                        }} 
                                                        variant="standard" 
                                                        disableUnderline
                                                    >
                                                        {col.id === 'status' ? STATUS_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ fontSize: '12px' }}>{o}</MenuItem>) :
                                                         col.id === 'remarks' ? LOCATION_OPTIONS.map(o => <MenuItem key={o} value={o} sx={{ fontSize: '12px' }}>{o}</MenuItem>) :
                                                         col.id === 'staffId' ? staff.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontSize: '12px' }}>{s.name}</MenuItem>) :
                                                         [<MenuItem key="none" value="" sx={{ fontSize: '12px', fontStyle: 'italic', opacity: 0.5 }}>-- N/A --</MenuItem>, ...projects.map(p => <MenuItem key={p.id} value={p.id} sx={{ fontSize: '12px' }}>{p.name}</MenuItem>)]}
                                                    </Select>
                                                </Box>
                                            )}
                                        </TableCell>
                                    ))}
                                    {hasClearance(4) && (
                                        <TableCell align="right" sx={{ p: '4px 16px' }}>
                                            <IconButton size="small" onClick={() => handleDelete(log.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.1) } }}>
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* COLUMNS DIALOG */}
            <Dialog open={colSettingsOpen} onClose={() => setColSettingsOpen(false)} PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider', minWidth: 300, borderRadius: 2 } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'text.secondary' }}>TABLE_LAYOUT</DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <List>
                        {columnOrder.map((col, idx) => (
                            <ListItem key={col.id} divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                <ListItemText primary={col.label} primaryTypographyProps={{ sx: { fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" } }} />
                                <IconButton size="small" onClick={() => moveColumn(idx, 'up')} disabled={idx === 0}><ArrowUpwardIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={() => moveColumn(idx, 'down')} disabled={idx === columnOrder.length - 1}><ArrowDownwardIcon fontSize="small" /></IconButton>
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setColSettingsOpen(false)} variant="contained" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', boxShadow: 'none' }}>APPLY</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}