import React, { useState, useMemo, useRef } from 'react';
import {
    Box, Paper, Typography, Button, TextField, Autocomplete,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { db } from '../../db';
import * as XLSX from 'xlsx';

export default function DailyLogTab({ project, projectBoqItems, resources, updateProject }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [activePhase, setActivePhase] = useState("General");
    const [selectedRes, setSelectedRes] = useState(null);
    const [qty, setQty] = useState("");

    const [isCustomOpen, setIsCustomOpen] = useState(false);
    const [customCode, setCustomCode] = useState("");
    const [customDesc, setCustomDesc] = useState("");
    const [customUnit, setCustomUnit] = useState("nos");

    const fileInputRef = useRef(null);

    const availablePhases = useMemo(() => {
        const phases = new Set((projectBoqItems || []).map(item => item.phase).filter(Boolean));
        if (phases.size === 0) return ["Substructure", "Superstructure", "Finishing", "MEP", "General"];
        return Array.from(phases);
    }, [projectBoqItems]);

    // --- MATERIAL LOGGING LOGIC ---
    const addLog = async () => {
        if (!date || !activePhase || !selectedRes || !qty) return alert("Please fill all fields.");
        const newLog = { id: crypto.randomUUID(), date, phase: activePhase, resourceId: selectedRes.id, qty: Number(qty) };
        const logs = [...(project.dailyLogs || []), newLog];
        await updateProject("dailyLogs", logs);
        setQty(""); setSelectedRes(null);
    };

    const deleteLog = async (id) => {
        const logs = (project.dailyLogs || []).filter(l => l.id !== id);
        await updateProject("dailyLogs", logs);
    };

    const saveCustomResource = async () => {
        if (!customCode || !customDesc) return alert("Code and Description required.");
        const newId = crypto.randomUUID();
        const newRes = { id: newId, code: customCode, description: customDesc, unit: customUnit, rates: {} };
        await db.resources.add(newRes);
        setSelectedRes(newRes);
        setIsCustomOpen(false);
        setCustomCode(""); setCustomDesc("");
    };

    // --- TASK TRACKING LOGIC ---
    const tasks = project.ganttTasks || [];

    const handleTaskStatusChange = async (taskId, newStatus) => {
        const today = new Date().toISOString().split('T')[0];
        const updatedTasks = tasks.map(t => {
            if (t.id === taskId) {
                const updated = { ...t, status: newStatus };
                // Auto-fill actual dates for convenience
                if (newStatus === "In Progress" && !updated.actualStart) updated.actualStart = today;
                if (newStatus === "Completed") {
                    if (!updated.actualStart) updated.actualStart = today;
                    if (!updated.actualEnd) updated.actualEnd = today;
                }
                return updated;
            }
            return t;
        });
        await updateProject("ganttTasks", updatedTasks);
    };

    const handleTaskDateChange = async (taskId, field, value) => {
        const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t);
        await updateProject("ganttTasks", updatedTasks);
    };

    // --- EXCEL PIPELINE (OMITTED FOR BREVITY - REMAINS UNCHANGED) ---
    const exportTemplate = () => { /* existing logic */ };
    const handleImport = async (e) => { /* existing logic */ };

    const sortedLogs = [...(project.dailyLogs || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <Box display="flex" flexDirection="column" gap={4}>
            <Box display="flex" justifyContent="flex-end" gap={2}>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportTemplate} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                    EXPORT LOG TEMPLATE
                </Button>
                <input type="file" accept=".xls,.xlsx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
                <Button variant="contained" disableElevation startIcon={<UploadIcon />} onClick={() => fileInputRef.current.click()} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                    IMPORT EXCEL
                </Button>
            </Box>

            {/* MATERIAL CONSUMPTION LOG */}
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '14px' }}>
                    LOG_MATERIAL_CONSUMPTION
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 3 }}>
                    <TextField type="date" size="small" label="DATE" value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                    <Autocomplete freeSolo options={availablePhases} value={activePhase} onChange={(e, newVal) => setActivePhase(newVal || "General")} onInputChange={(e, newVal) => setActivePhase(newVal || "General")} sx={{ width: 160 }} renderInput={(params) => <TextField {...params} size="small" label="PHASE" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ ...params.InputProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />} />
                    <Box display="flex" flex={2} minWidth={300} gap={1}>
                        <Autocomplete options={resources} getOptionLabel={(option) => `${option.code} - ${option.description}`} value={selectedRes} onChange={(e, newVal) => setSelectedRes(newVal)} sx={{ flex: 1 }} renderInput={(params) => <TextField {...params} size="small" label="RESOURCE / MATERIAL" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ ...params.InputProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />} />
                        <Button variant="outlined" color="secondary" onClick={() => setIsCustomOpen(true)} sx={{ minWidth: 120, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>+ CUSTOM</Button>
                    </Box>
                    <TextField type="number" size="small" label="QUANTITY" value={qty} onChange={e => setQty(e.target.value)} sx={{ width: 120 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                    <Button variant="contained" color="primary" onClick={addLog} startIcon={<AddIcon />} sx={{ height: 40, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>LOG</Button>
                </Box>

                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                            <TableRow>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DATE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>PHASE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CODE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RESOURCE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY_CONSUMED</TableCell>
                                <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedLogs.map(log => {
                                const res = resources.find(r => r.id === log.resourceId) || {};
                                return (
                                    <TableRow key={log.id} hover>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{new Date(log.date).toLocaleDateString()}</TableCell>
                                        <TableCell sx={{ color: 'info.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{log.phase}</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{res.code}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{res.description}</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: 'warning.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{log.qty.toFixed(2)} {res.unit}</TableCell>
                                        <TableCell align="center"><IconButton size="small" color="error" onClick={() => deleteLog(log.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* NEW: TASK EXECUTION TRACKER */}
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '14px' }}>
                    TASK_EXECUTION_&_TRACKING
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                    Update task status and actual dates here. Changes will automatically sync to the Gantt Chart and Dashboard.
                </Typography>

                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                            <TableRow>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '25%' }}>TASK / MILESTONE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '15%' }}>PHASE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '20%' }}>STATUS</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '20%' }}>ACTUAL START</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '20%' }}>ACTUAL END</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tasks.map(task => {
                                const isCompleted = task.status === "Completed";
                                const isInProgress = task.status === "In Progress";

                                return (
                                    <TableRow key={task.id} hover sx={{ bgcolor: isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'inherit' }}>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold' }}>
                                            {task.name} {task.type === "Milestone" && <Typography component="span" color="warning.main" ml={1}>◆</Typography>}
                                        </TableCell>
                                        <TableCell sx={{ color: 'info.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                            {task.phase}
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                select size="small" fullWidth
                                                value={task.status || "Not Started"}
                                                onChange={e => handleTaskStatusChange(task.id, e.target.value)}
                                                InputProps={{
                                                    sx: {
                                                        fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', height: 32,
                                                        color: isCompleted ? 'success.main' : isInProgress ? 'info.main' : 'text.secondary',
                                                        fontWeight: 'bold'
                                                    }
                                                }}
                                            >
                                                <MenuItem value="Not Started" sx={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}>Not Started</MenuItem>
                                                <MenuItem value="In Progress" sx={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'info.main' }}><PlayArrowIcon fontSize="small" sx={{ mr: 1, mb: -0.5 }} /> In Progress</MenuItem>
                                                <MenuItem value="Completed" sx={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'success.main' }}><CheckCircleIcon fontSize="small" sx={{ mr: 1, mb: -0.5 }} /> Completed</MenuItem>
                                            </TextField>
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                type="date" size="small" fullWidth
                                                value={task.actualStart || ""}
                                                onChange={e => handleTaskDateChange(task.id, "actualStart", e.target.value)}
                                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', height: 32 } }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                type="date" size="small" fullWidth
                                                value={task.actualEnd || ""}
                                                onChange={e => handleTaskDateChange(task.id, "actualEnd", e.target.value)}
                                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', height: 32 } }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {tasks.length === 0 && (
                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>No tasks found. Add tasks in the Gantt Schedule tab first.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* NEW CUSTOM RESOURCE DIALOG */}
            <Dialog open={isCustomOpen} onClose={() => setIsCustomOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>ADD_CUSTOM_RESOURCE</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField label="CODE" value={customCode} onChange={e => setCustomCode(e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                    <TextField label="DESCRIPTION" value={customDesc} onChange={e => setCustomDesc(e.target.value)} multiline rows={2} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                    <TextField label="UNIT" value={customUnit} onChange={e => setCustomUnit(e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsCustomOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={saveCustomResource} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace" }}>SAVE</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}