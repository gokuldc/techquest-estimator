import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Paper, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, TextField, MenuItem, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortIcon from '@mui/icons-material/Sort';
import DownloadIcon from '@mui/icons-material/Download';

import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['Office / Site', 'Work From Home', 'Sick Leave', 'Casual Leave', 'Half-Day'];

const ALL_COLUMNS = [
    { id: 'slNo', label: 'SL NO' },
    { id: 'date', label: 'DATE' },
    { id: 'staffId', label: 'BY (STAFF)' },
    { id: 'projectId', label: 'PROJECT NAME' },
    { id: 'details', label: 'WORK DETAILS' },
    { id: 'remarks', label: 'REMARKS' },
    { id: 'status', label: 'STATUS' },
];

export default function StaffWorkLog({ onBack }) {
    const { currentUser, hasClearance } = useAuth();

    const [logs, setLogs] = useState([]);
    const [staff, setStaff] = useState([]);
    const [projects, setProjects] = useState([]);

    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`; 
    });

    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnOrder, setColumnOrder] = useState(ALL_COLUMNS);
    const [colSettingsOpen, setColSettingsOpen] = useState(false);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        staffId: currentUser?.id || "",
        projectId: "",
        details: "",
        remarks: "",
        status: "Office / Site"
    });

    const loadData = async () => {
        try {
            const logData = await window.api.db.getWorkLogs();
            const staffData = await window.api.db.getOrgStaff();
            const projData = await window.api.db.getProjects();

            setLogs(logData || []);
            setStaff(staffData || []);
            setProjects(projData || []);
        } catch (err) {
            console.error("Failed to load work log dependencies:", err);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const currentMonthLogs = useMemo(() => {
        if (!filterMonth) return logs;
        return logs.filter(log => log.date && log.date.startsWith(filterMonth));
    }, [logs, filterMonth]);

    const sortedLogs = useMemo(() => {
        let sortable = [...currentMonthLogs];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
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

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [currentMonthLogs, sortConfig, staff, projects]);

    const handleExportExcel = async () => {
        if (sortedLogs.length === 0) return alert("No logs found for the selected month to export.");
        try {
            const XLSX = await import('xlsx');

            const exportData = sortedLogs.map(log => ({
                "Sl No": log.slNo,
                "Date": log.date,
                "Staff Name": staff.find(s => s.id === log.staffId)?.name || 'Unknown',
                "Project": log.projectId ? (projects.find(p => p.id === log.projectId)?.name || 'Unknown') : 'N/A',
                "Status": log.status,
                "Work Details": log.details || '-',
                "Remarks": log.remarks || '-'
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `Logs_${filterMonth}`);

            XLSX.writeFile(workbook, `Staff_Work_Logs_${filterMonth}.xlsx`);
        } catch (err) {
            console.error("Export Error: ", err);
            alert("Failed to export Excel file.");
        }
    };

    const moveColumn = (index, direction) => {
        const newOrder = [...columnOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
        }
        setColumnOrder(newOrder);
    };

    const handleSaveLog = async () => {
        if (!formData.details && !formData.status.includes('Leave')) {
            return alert("Work details are required unless logging a Leave.");
        }

        const newLog = {
            id: crypto.randomUUID(),
            slNo: logs.length + 1,
            ...formData,
            projectId: formData.status.includes('Leave') ? null : formData.projectId,
            createdAt: Date.now()
        };

        await window.api.db.saveWorkLog(newLog);

        setFormData(prev => ({ ...prev, details: "", remarks: "", projectId: "", status: "Office / Site" }));
        loadData();
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this log entry?")) {
            await window.api.db.deleteWorkLog(id);
            loadData();
        }
    };

    const renderCell = (log, colId) => {
        switch (colId) {
            case 'slNo': return log.slNo;
            case 'date': return log.date;
            case 'staffId': return <Typography fontWeight="bold" fontSize="13px" sx={{ whiteSpace: 'nowrap' }}>{staff.find(s => s.id === log.staffId)?.name || 'Unknown'}</Typography>;
            case 'projectId': return log.projectId ? <Typography sx={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{projects.find(p => p.id === log.projectId)?.name || 'Unknown'}</Typography> : <Typography color="text.secondary" fontStyle="italic" sx={{ fontSize: '12px' }}>N/A</Typography>;
            case 'details': return <Typography sx={{ minWidth: 200, fontSize: '12px' }}>{log.details || '-'}</Typography>;
            case 'remarks': return <Typography sx={{ minWidth: 150, fontSize: '12px' }}>{log.remarks || '-'}</Typography>;
            case 'status':
                let color = "default";
                if (log.status.includes("Leave")) color = "error";
                if (log.status.includes("Home")) color = "secondary";
                if (log.status.includes("Office")) color = "success";
                return <Chip label={log.status} color={color} size="small" sx={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }} />;
            default: return null;
        }
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: "auto", p: { xs: 1, sm: 2, md: 3 } }}>
            {/* 🔥 MOBILE RESPONSIVE HEADER */}
            <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} mb={3} gap={2}>
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" justifyContent={{ xs: 'center', md: 'flex-start' }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" color="inherit" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        {'< '}HOME
                    </Button>
                    <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>
                        ORGANIZATION_WORK_LOG
                    </Typography>
                </Box>

                {/* CONTROLS (Month Picker, Export, Columns) */}
                <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap" justifyContent={{ xs: 'center', md: 'flex-end' }}>
                    <TextField
                        type="month"
                        size="small"
                        label="FILTER MONTH"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }}
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', height: 36 } }}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                    />
                    <Button fullWidth={{ xs: true, sm: false }} variant="outlined" color="success" startIcon={<DownloadIcon />} onClick={handleExportExcel} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: 36, flex: { xs: 1, sm: 'none' } }}>
                        EXPORT
                    </Button>
                    <Button fullWidth={{ xs: true, sm: false }} variant="outlined" color="primary" startIcon={<ViewColumnIcon />} onClick={() => setColSettingsOpen(true)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: 36, flex: { xs: 1, sm: 'none' } }}>
                        COLUMNS
                    </Button>
                </Box>
            </Box>

            {/* 🔥 MOBILE RESPONSIVE QUICK ADD FORM */}
            <Paper sx={{ p: { xs: 2, md: 3 }, mb: 4, bgcolor: 'rgba(13, 31, 60, 0.5)', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" mb={2} color="primary.main" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>// SUBMIT_DAILY_LOG</Typography>
                
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4} md={2}>
                        <TextField fullWidth type="date" size="small" label="DATE" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <TextField fullWidth select size="small" label="BY (STAFF)" value={formData.staffId} onChange={e => setFormData({ ...formData, staffId: e.target.value })} disabled={!hasClearance(4)}>
                            {staff.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{s.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={4} md={3}>
                        <TextField fullWidth select size="small" label="STATUS" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value, projectId: e.target.value.includes('Leave') ? "" : formData.projectId })}>
                            {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{s}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} sm={12} md={5}>
                        <TextField fullWidth select size="small" label="PROJECT" value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })} disabled={formData.status.includes('Leave')}>
                            <MenuItem value="" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontStyle: 'italic' }}>-- General / N/A --</MenuItem>
                            {projects.map(p => <MenuItem key={p.id} value={p.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{p.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={5}>
                        <TextField fullWidth size="small" label="WORK DETAILS / TASKS COMPLETED" value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })} disabled={formData.status.includes('Leave')} />
                    </Grid>
                    <Grid item xs={12} md={5}>
                        <TextField fullWidth size="small" label="REMARKS (Optional)" value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button fullWidth variant="contained" color="success" onClick={handleSaveLog} sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', height: 40 }}>LOG_ENTRY</Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* DYNAMIC DATA TABLE (Horizontal scroll handles overflow) */}
            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: '60vh', border: '1px solid', borderColor: 'divider', bgcolor: 'transparent', overflowX: 'auto' }}>
                <Table stickyHeader size="small" sx={{ minWidth: 800 }}>
                    <TableHead>
                        <TableRow>
                            {columnOrder.map((col) => (
                                <TableCell
                                    key={col.id}
                                    onClick={() => handleSort(col.id)}
                                    sx={{ bgcolor: 'rgba(0,0,0,0.8)', color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', cursor: 'pointer', '&:hover': { color: 'primary.main' }, whiteSpace: 'nowrap' }}
                                >
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        {col.label}
                                        {sortConfig.key === col.id && (
                                            <SortIcon sx={{ fontSize: 14, transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'none' }} />
                                        )}
                                    </Box>
                                </TableCell>
                            ))}
                            {hasClearance(4) && <TableCell align="right" sx={{ bgcolor: 'rgba(0,0,0,0.8)', color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>ACTIONS</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedLogs.length === 0 && (
                            <TableRow><TableCell colSpan={columnOrder.length + 1} align="center" sx={{ py: 5, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>NO LOGS RECORDED FOR THIS MONTH</TableCell></TableRow>
                        )}
                        {sortedLogs.map((log) => (
                            <TableRow key={log.id} hover sx={{ '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                                {columnOrder.map(col => (
                                    <TableCell key={`${log.id}-${col.id}`} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                        {renderCell(log, col.id)}
                                    </TableCell>
                                ))}
                                {hasClearance(4) && (
                                    <TableCell align="right">
                                        <IconButton size="small" color="error" onClick={() => handleDelete(log.id)}><DeleteIcon fontSize="small" /></IconButton>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* COLUMN CONFIGURATION DIALOG */}
            <Dialog open={colSettingsOpen} onClose={() => setColSettingsOpen(false)} PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider', minWidth: 300 } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'primary.main', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    REARRANGE_COLUMNS
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <List sx={{ pt: 0 }}>
                        {columnOrder.map((col, index) => (
                            <ListItem key={col.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(0,0,0,0.2)' }}>
                                <ListItemText primary={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{col.label}</Typography>} />
                                <IconButton size="small" onClick={() => moveColumn(index, 'up')} disabled={index === 0}><ArrowUpwardIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={() => moveColumn(index, 'down')} disabled={index === columnOrder.length - 1}><ArrowDownwardIcon fontSize="small" /></IconButton>
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setColSettingsOpen(false)} variant="contained" color="primary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>APPLY LAYOUT</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}