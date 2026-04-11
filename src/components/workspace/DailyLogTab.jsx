import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
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

export default function DailyLogTab({ project, projectBoqItems, resources, updateProject, loadData }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [activePhase, setActivePhase] = useState("General");
    const [selectedRes, setSelectedRes] = useState(null);
    const [qty, setQty] = useState("");

    const [isCustomOpen, setIsCustomOpen] = useState(false);
    const [customCode, setCustomCode] = useState("");
    const [customDesc, setCustomDesc] = useState("");
    const [customUnit, setCustomUnit] = useState("nos");

    // --- DAILY SCHEDULE STATE ---
    const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
    const [shiftStart, setShiftStart] = useState("08:00");
    const [shiftEnd, setShiftEnd] = useState("17:00");
    const [weather, setWeather] = useState("Clear");
    const [shiftNotes, setShiftNotes] = useState("");

    const fileInputRef = useRef(null);

    const availablePhases = useMemo(() => {
        const phases = new Set((projectBoqItems || []).map(item => item.phase).filter(Boolean));
        if (phases.size === 0) return ["Substructure", "Superstructure", "Finishing", "MEP", "General"];
        return Array.from(phases);
    }, [projectBoqItems]);

    const validLogs = Array.isArray(project?.dailyLogs) ? project.dailyLogs.filter(l => l && l.id) : [];
    const validSchedules = Array.isArray(project?.dailySchedules) ? project.dailySchedules.filter(s => s && s.id) : [];
    const validTasks = Array.isArray(project?.ganttTasks) ? project.ganttTasks.filter(t => t && t.id) : [];

    // --- MATERIAL LOGGING LOGIC ---
    const addLog = async () => {
        if (!date || !activePhase || !selectedRes || !qty) return alert("Please fill all fields.");
        const newLog = { id: crypto.randomUUID(), date, phase: activePhase, resourceId: selectedRes.id, qty: Number(qty) };
        const logs = [...validLogs, newLog];
        await updateProject("dailyLogs", logs);
        setQty(""); setSelectedRes(null);
    };

    const deleteLog = async (id) => {
        const logs = validLogs.filter(l => l.id !== id);
        await updateProject("dailyLogs", logs);
    };

    const saveCustomResource = async () => {
        if (!customCode || !customDesc) return alert("Code and Description required.");
        const newId = crypto.randomUUID();
        const newRes = { id: newId, code: customCode, description: customDesc, unit: customUnit, rates: {} };
        
        await window.api.db.createResource(newRes); 
        
        if (loadData) await loadData(); 
        
        setSelectedRes(newRes);
        setIsCustomOpen(false);
        setCustomCode(""); setCustomDesc("");
    };

    // --- DAILY SCHEDULE LOGIC ---
    const addSchedule = async () => {
        if (!scheduleDate || !shiftStart || !shiftEnd) return alert("Please specify Date and Shift timings.");
        const newSchedule = { 
            id: crypto.randomUUID(), 
            date: scheduleDate, 
            shiftStart, 
            shiftEnd, 
            weather, 
            notes: shiftNotes 
        };
        const schedules = [...validSchedules, newSchedule];
        await updateProject("dailySchedules", schedules);
        setShiftNotes(""); 
    };

    const deleteSchedule = async (id) => {
        const schedules = validSchedules.filter(s => s.id !== id);
        await updateProject("dailySchedules", schedules);
    };

    // --- TASK TRACKING LOGIC ---
    const handleTaskStatusChange = async (taskId, newStatus) => {
        const today = new Date().toISOString().split('T')[0];
        const updatedTasks = validTasks.map(t => {
            if (t.id === taskId) {
                const updated = { ...t, status: newStatus };
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
        const updatedTasks = validTasks.map(t => t.id === taskId ? { ...t, [field]: value } : t);
        await updateProject("ganttTasks", updatedTasks);
    };

    const exportTemplate = () => { 
        const header = ["Date", "Phase", "Resource Code", "Resource Description", "Quantity Consumed", "Unit"];
        const wsData = [header];

        if (validLogs.length === 0) {
            wsData.push([new Date().toISOString().split('T')[0], "General", "CEM-01", "Sample Cement", 50, "Bags"]);
        } else {
            validLogs.forEach(log => {
                const res = resources.find(r => r.id === log.resourceId) || {};
                wsData.push([
                    log.date || new Date().toISOString().split('T')[0],
                    log.phase || "General",
                    res.code || "",
                    res.description || "",
                    Number(log.qty) || 0,
                    res.unit || ""
                ]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Daily_Material_Logs");
        XLSX.writeFile(wb, `${project.name || 'Project'}_MaterialLogs.xlsx`); 
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });

                if (jsonData.length === 0) return;

                const newLogs = [];
                let requiresGlobalRefresh = false;

                for (const row of jsonData) {
                    const dateRaw = row["Date"] || row["Date (YYYY-MM-DD)"];
                    const phase = row["Phase"] || "General";
                    const code = String(row["Resource Code"] || "").trim();
                    const qty = Number(row["Quantity Consumed"]);
                    const desc = String(row["Resource Description"] || "");
                    const unit = String(row["Unit"] || "nos");

                    if (!dateRaw || !code || isNaN(qty)) continue;

                    let resource = resources.find(r => (r.code || "").trim().toLowerCase() === code.toLowerCase());
                    
                    if (!resource) {
                        const newResId = crypto.randomUUID();
                        const newRes = { id: newResId, code: code, description: desc || `Imported Item ${code}`, unit: unit, rates: {} };
                        await window.api.db.createResource(newRes);
                        resource = newRes;
                        requiresGlobalRefresh = true;
                    }

                    if (resource) {
                        newLogs.push({ id: crypto.randomUUID(), date: dateRaw, phase, resourceId: resource.id, qty });
                    }
                }

                if (newLogs.length > 0) {
                    const updatedLogs = [...validLogs, ...newLogs];
                    await updateProject("dailyLogs", updatedLogs);
                    alert(`Successfully imported ${newLogs.length} material logs!`);
                    
                    if (loadData && requiresGlobalRefresh) await loadData();
                    else if (loadData) loadData(); 
                } else {
                    alert("No valid rows found. Ensure the 'Resource Code' column is filled.");
                }
            } catch (err) {
                console.error(err);
                alert("Failed to parse Daily Log Excel.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null; 
    };

    const sortedLogs = [...validLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const sortedSchedules = [...validSchedules].sort((a, b) => new Date(b.date) - new Date(a.date));

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

            {/* --- DAILY WORK SCHEDULE --- */}
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '14px' }}>
                    DAILY_WORK_SCHEDULE
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 3 }}>
                    <TextField 
                        type="date" size="small" label="DATE" 
                        value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} 
                        InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    />
                    <TextField 
                        type="time" size="small" label="START" 
                        value={shiftStart} onChange={e => setShiftStart(e.target.value)} 
                        InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    />
                    <TextField 
                        type="time" size="small" label="END" 
                        value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} 
                        InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    />
                    <TextField 
                        select size="small" label="WEATHER" 
                        value={weather} onChange={e => setWeather(e.target.value)} 
                        sx={{ minWidth: 120 }}
                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    >
                        {["Clear", "Cloudy", "Rain", "Heavy Rain", "Extreme Heat"].map(w => (
                            <MenuItem key={w} value={w} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{w}</MenuItem>
                        ))}
                    </TextField>
                    <TextField 
                        size="small" label="GENERAL NOTES" 
                        value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} 
                        sx={{ flex: 1, minWidth: 200 }}
                        placeholder="Site conditions, incidents, etc."
                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} 
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} 
                    />
                    <Button variant="contained" color="primary" onClick={addSchedule} startIcon={<AddIcon />} sx={{ height: 40, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>
                        LOG_SHIFT
                    </Button>
                </Box>

                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                            <TableRow>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '15%' }}>DATE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '20%' }}>SHIFT TIMING</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '15%' }}>WEATHER</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>NOTES</TableCell>
                                <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '10%' }}>ACTION</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedSchedules.map(schedule => (
                                <TableRow key={schedule.id} hover>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                        {new Date(schedule.date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold' }}>
                                        {schedule.shiftStart} - {schedule.shiftEnd}
                                    </TableCell>
                                    <TableCell sx={{ color: 'info.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                        {schedule.weather}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                        {schedule.notes || "-"}
                                    </TableCell>
                                    <TableCell align="center">
                                        <IconButton size="small" color="error" onClick={() => deleteSchedule(schedule.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sortedSchedules.length === 0 && (
                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>No daily schedules logged yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* MATERIAL CONSUMPTION LOG */}
            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '14px' }}>
                    LOG_MATERIAL_CONSUMPTION
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 3 }}>
                    <TextField type="date" size="small" label="DATE" value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                    <Autocomplete freeSolo options={availablePhases} value={activePhase} onChange={(e, newVal) => setActivePhase(newVal || "General")} onInputChange={(e, newVal) => setActivePhase(newVal || "General")} sx={{ width: 160 }} renderInput={(params) => <TextField {...params} size="small" label="PHASE" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ ...params.InputProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />} />
                    <Box display="flex" flex={2} minWidth={300} gap={1}>
                        <Autocomplete 
                            options={resources} 
                            getOptionLabel={(option) => option ? `${option.code || ''} - ${option.description || ''}` : ''} 
                            isOptionEqualToValue={(option, value) => option.id === value?.id}
                            value={selectedRes} 
                            onChange={(e, newVal) => setSelectedRes(newVal)} 
                            sx={{ flex: 1 }} 
                            renderInput={(params) => <TextField {...params} size="small" label="RESOURCE / MATERIAL" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ ...params.InputProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />} 
                        />
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
                                        <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{res.code || "-"}</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{res.description || "Unknown Resource"}</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: 'warning.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{Number(log.qty).toFixed(2)} {res.unit || ""}</TableCell>
                                        <TableCell align="center"><IconButton size="small" color="error" onClick={() => deleteLog(log.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* 🔥 THE RESTORED TASK EXECUTION TRACKER 🔥 */}
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
                            {validTasks.map(task => {
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
                            {validTasks.length === 0 && (
                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>No tasks found. Add tasks in the Gantt Schedule tab first.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* CUSTOM RESOURCE DIALOG */}
            <Paper>
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
            </Paper>
        </Box>
    );
}