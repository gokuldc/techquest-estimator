import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Paper, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, TextField, MenuItem, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortIcon from '@mui/icons-material/Sort';
import DownloadIcon from '@mui/icons-material/Download'; // 🔥 Export Icon

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

    // --- NEW: MONTH FILTER STATE ---
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`; // Defaults to Current Month (e.g., "2024-05")
    });

    // --- TABLE CONFIG STATE ---
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [columnOrder, setColumnOrder] = useState(ALL_COLUMNS);
    const [colSettingsOpen, setColSettingsOpen] = useState(false);

    // --- NEW LOG FORM STATE ---
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
            // Fetch individually to prevent Promise.all from failing if one table is empty
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

    // --- FILTER & SORTING LOGIC ---
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // 1. Filter by Selected Month
    const currentMonthLogs = useMemo(() => {
        if (!filterMonth) return logs;
        return logs.filter(log => log.date && log.date.startsWith(filterMonth));
    }, [logs, filterMonth]);

    // 2. Sort the filtered logs
    const sortedLogs = useMemo(() => {
        let sortable = [...currentMonthLogs];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let aVal = a[sortConfig.key] || "";
                let bVal = b[sortConfig.key] || "";

                // Map IDs to Names for sorting alphabetically instead of by raw ID
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

    // --- EXPORT TO EXCEL ---
    const handleExportExcel = async () => {
        if (sortedLogs.length === 0) return alert("No logs found for the selected month to export.");
        try {
            const XLSX = await import('xlsx');

            // Map the data exactly how we want the columns to appear in Excel
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

            // Generate the file directly (works natively in Chromium/Electron)
            XLSX.writeFile(workbook, `Staff_Work_Logs_${filterMonth}.xlsx`);
        } catch (err) {
            console.error("Export Error: ", err);
            alert("Failed to export Excel file.");
        }
    };

    // --- COLUMN REARRANGEMENT LOGIC ---
    const moveColumn = (index, direction) => {
        const newOrder = [...columnOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
        }
        setColumnOrder(newOrder);
    };

    // --- DATA MUTATION ---
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

        // Reset form but keep date and staff intact for quick sequential logging
        setFormData(prev => ({ ...prev, details: "", remarks: "", projectId: "", status: "Office / Site" }));
        loadData();
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this log entry?")) {
            await window.api.db.deleteWorkLog(id);
            loadData();
        }
    };

    // Render cells dynamically based on the current column order
    const renderCell = (log, colId) => {
        switch (colId) {
            case 'slNo': return log.slNo;
            case 'date': return log.date;
            case 'staffId': return <Typography fontWeight="bold" fontSize="13px">{staff.find(s => s.id === log.staffId)?.name || 'Unknown'}</Typography>;
            case 'projectId': return log.projectId ? (projects.find(p => p.id === log.projectId)?.name || 'Unknown') : <Typography color="text.secondary" fontStyle="italic">N/A</Typography>;
            case 'details': return log.details || '-';
            case 'remarks': return log.remarks || '-';
            case 'status':
                let color = "default";
                if (log.status.includes("Leave")) color = "error";
                if (log.status.includes("Home")) color = "secondary";
                if (log.status.includes("Office")) color = "success";
                return <Chip label={log.status} color={color} size="small" sx={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" }} />;
            default: return null;
        }
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: "auto", p: 3 }}>
            {/* HEADER */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                <Box display="flex" alignItems="center" gap={2}>
                    <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" color="inherit" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        {'< '}HOME
                    </Button>
                    <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        ORGANIZATION_WORK_LOG
                    </Typography>
                </Box>

                {/* 🔥 NEW CONTROLS (Month Picker, Export, Columns) */}
                <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                    <TextField
                        type="month"
                        size="small"
                        label="FILTER MONTH"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }}
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', height: 36 } }}
                    />
                    <Button variant="outlined" color="success" startIcon={<DownloadIcon />} onClick={handleExportExcel} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: 36 }}>
                        EXPORT
                    </Button>
                    <Button variant="outlined" color="primary" startIcon={<ViewColumnIcon />} onClick={() => setColSettingsOpen(true)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: 36 }}>
                        COLUMNS
                    </Button>
                </Box>
            </Box>

            {/* QUICK ADD FORM */}
            <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(13, 31, 60, 0.5)', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" mb={2} color="primary.main" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>// SUBMIT_DAILY_LOG</Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                    <TextField type="date" size="small" label="DATE" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace" } }} />

                    <TextField select size="small" label="BY (STAFF)" value={formData.staffId} onChange={e => setFormData({ ...formData, staffId: e.target.value })} sx={{ minWidth: 150 }} disabled={!hasClearance(4)}>
                        {staff.map(s => <MenuItem key={s.id} value={s.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{s.name}</MenuItem>)}
                    </TextField>

                    <TextField select size="small" label="STATUS" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value, projectId: e.target.value.includes('Leave') ? "" : formData.projectId })} sx={{ minWidth: 150 }}>
                        {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{s}</MenuItem>)}
                    </TextField>

                    <TextField select size="small" label="PROJECT" value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })} sx={{ minWidth: 200 }} disabled={formData.status.includes('Leave')}>
                        <MenuItem value="" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontStyle: 'italic' }}>-- General / N/A --</MenuItem>
                        {projects.map(p => <MenuItem key={p.id} value={p.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{p.name}</MenuItem>)}
                    </TextField>

                    <TextField size="small" label="WORK DETAILS / TASKS COMPLETED" value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })} sx={{ flexGrow: 1 }} disabled={formData.status.includes('Leave')} />
                    <TextField size="small" label="REMARKS (Optional)" value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} sx={{ minWidth: 150 }} />

                    <Button variant="contained" color="success" onClick={handleSaveLog} sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>LOG_ENTRY</Button>
                </Box>
            </Paper>

            {/* DYNAMIC DATA TABLE */}
            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: '60vh', border: '1px solid', borderColor: 'divider', bgcolor: 'transparent' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {columnOrder.map((col) => (
                                <TableCell
                                    key={col.id}
                                    onClick={() => handleSort(col.id)}
                                    sx={{ bgcolor: 'rgba(0,0,0,0.4)', color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                                >
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        {col.label}
                                        {sortConfig.key === col.id && (
                                            <SortIcon sx={{ fontSize: 14, transform: sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'none' }} />
                                        )}
                                    </Box>
                                </TableCell>
                            ))}
                            {hasClearance(4) && <TableCell align="right" sx={{ bgcolor: 'rgba(0,0,0,0.4)', color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTIONS</TableCell>}
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