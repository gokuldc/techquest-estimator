import React, { useState, useMemo } from 'react';
import {
    Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Button, Autocomplete, IconButton, MenuItem, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DownloadIcon from '@mui/icons-material/Download';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TimelineIcon from '@mui/icons-material/Timeline';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { tableInputActiveStyle } from '../../styles';

const STICKY_BG = '#0b172d';

export default function GanttScheduleTab({ project, projectBoqItems, updateProject }) {
    const tasks = Array.isArray(project?.ganttTasks) ? project.ganttTasks : [];

    // --- FORM STATE ---
    const [taskName, setTaskName] = useState("");
    const [taskType, setTaskType] = useState("Task");
    const [activePhase, setActivePhase] = useState("General");
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);

    const [predecessorId, setPredecessorId] = useState("");
    const [dependencyType, setDependencyType] = useState("FS");
    const [dependencyLag, setDependencyLag] = useState(0);

    // --- UI STATE ---
    const [zoomLevel, setZoomLevel] = useState(1);
    const [draggedId, setDraggedId] = useState(null);

    const dependencyOptions = [
        { value: "FS", label: "Finish-to-Start (FS)" },
        { value: "SS", label: "Start-to-Start (SS)" },
        { value: "FF", label: "Finish-to-Finish (FF)" },
        { value: "SF", label: "Start-to-Finish (SF)" }
    ];

    const availablePhases = useMemo(() => {
        const phases = new Set((projectBoqItems || []).map(item => item.phase).filter(Boolean));
        tasks.forEach(t => { if (t.phase) phases.add(t.phase); });
        if (phases.size === 0) return ["Substructure", "Superstructure", "Finishing", "MEP", "General"];
        return Array.from(phases);
    }, [projectBoqItems, tasks]);

    // --- CPM AUTO-SCHEDULING ENGINE ---
    const cascadeDates = (taskList) => {
        let changed = true;
        let iterations = 0;
        let currentTasks = [...taskList];

        while (changed && iterations < 10) {
            changed = false;
            iterations++;

            currentTasks = currentTasks.map(task => {
                if (!task.dependency || !task.dependency.taskId) return task;

                const pred = currentTasks.find(t => t.id === task.dependency.taskId);
                if (!pred) return task;

                const newStart = new Date(task.startDate || task.actualStart);
                const newEnd = new Date(task.endDate || task.actualEnd);
                const duration = Math.max(0, (newEnd - newStart) / 86400000);
                const isMilestone = task.type === 'Milestone';
                const lag = Number(task.dependency.lag) || 0;

                const predStart = new Date(pred.startDate || pred.actualStart);
                const predEnd = new Date(pred.endDate || pred.actualEnd);

                let expectedStart = new Date(newStart);
                let expectedEnd = new Date(newEnd);

                if (task.dependency.type === 'FS') {
                    expectedStart = new Date(predEnd);
                    expectedStart.setDate(expectedStart.getDate() + (isMilestone ? 0 : 1) + lag);
                    expectedEnd = new Date(expectedStart);
                    if (!isMilestone) expectedEnd.setDate(expectedEnd.getDate() + duration);
                } else if (task.dependency.type === 'SS') {
                    expectedStart = new Date(predStart);
                    expectedStart.setDate(expectedStart.getDate() + lag);
                    expectedEnd = new Date(expectedStart);
                    if (!isMilestone) expectedEnd.setDate(expectedEnd.getDate() + duration);
                } else if (task.dependency.type === 'FF') {
                    expectedEnd = new Date(predEnd);
                    expectedEnd.setDate(expectedEnd.getDate() + lag);
                    expectedStart = new Date(expectedEnd);
                    if (!isMilestone) expectedStart.setDate(expectedStart.getDate() - duration);
                } else if (task.dependency.type === 'SF') {
                    expectedEnd = new Date(predStart);
                    expectedEnd.setDate(expectedEnd.getDate() + lag);
                    expectedStart = new Date(expectedEnd);
                    if (!isMilestone) expectedStart.setDate(expectedStart.getDate() - duration);
                }

                const expectedStartStr = expectedStart.toISOString().split('T')[0];
                const expectedEndStr = expectedEnd.toISOString().split('T')[0];

                if ((task.startDate || task.actualStart) !== expectedStartStr || (task.endDate || task.actualEnd) !== expectedEndStr) {
                    changed = true;
                    return { ...task, startDate: expectedStartStr, endDate: expectedEndStr, actualStart: expectedStartStr, actualEnd: expectedEndStr };
                }
                return task;
            });
        }
        return currentTasks;
    };

    const saveTasks = async (newTasks) => {
        const scheduledTasks = cascadeDates(newTasks);
        await updateProject("ganttTasks", scheduledTasks);
    };

    // --- CRUD OPERATIONS ---
    const addTask = async () => {
        if (!taskName || !startDate) return alert("Task Name and Start date are required.");
        const finalEndDate = taskType === "Milestone" ? startDate : endDate;
        if (new Date(finalEndDate) < new Date(startDate)) return alert("End date cannot be before Start date.");

        const newTask = {
            id: crypto.randomUUID(), name: taskName, type: taskType,
            phase: activePhase || "General", startDate, endDate: finalEndDate,
            actualStart: startDate, actualEnd: finalEndDate, status: "Not Started", priority: "Medium",
            dependency: predecessorId ? { taskId: predecessorId, type: dependencyType, lag: Number(dependencyLag) } : null,
            createdAt: new Date().toISOString()
        };

        await saveTasks([...tasks, newTask]);
        setTaskName(""); setPredecessorId(""); setDependencyLag(0);
    };

    const deleteTask = async (id) => {
        const updatedTasks = tasks.filter(t => t.id !== id).map(t => {
            if (t.dependency && t.dependency.taskId === id) return { ...t, dependency: null };
            return t;
        });
        await saveTasks(updatedTasks);
    };

    const updateTaskInline = async (id, field, value) => {
        const updatedTasks = tasks.map(t => {
            if (t.id === id) {
                const updated = { ...t, [field]: value };
                if (field === "startDate") updated.actualStart = value;
                if (field === "endDate") updated.actualEnd = value;
                
                if (updated.type === "Milestone" && field !== "name") {
                    updated.endDate = updated.startDate;
                    updated.actualEnd = updated.actualStart;
                } else if (updated.startDate && updated.endDate && new Date(updated.endDate) < new Date(updated.startDate)) {
                    updated.endDate = updated.startDate;
                    updated.actualEnd = updated.actualStart;
                }
                return updated;
            }
            return t;
        });
        await saveTasks(updatedTasks);
    };

    const updateDependency = async (id, predId, type, lag = 0) => {
        const updatedTasks = tasks.map(t => t.id === id ? { ...t, dependency: predId ? { taskId: predId, type, lag: Number(lag) } : null } : t);
        await saveTasks(updatedTasks);
    };

    // --- DRAG AND DROP ---
    const handleDragStart = (e, id) => { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; };
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
    const handleDrop = async (e, targetId) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;
        const items = [...tasks];
        const draggedIdx = items.findIndex(i => i.id === draggedId);
        const targetIdx = items.findIndex(i => i.id === targetId);
        if (draggedIdx === -1 || targetIdx === -1) return;
        const [draggedItem] = items.splice(draggedIdx, 1);
        draggedItem.phase = items[targetIdx > draggedIdx ? targetIdx - 1 : targetIdx]?.phase || items[targetIdx]?.phase || "General";
        items.splice(targetIdx, 0, draggedItem);
        await saveTasks(items);
        setDraggedId(null);
    };

    // --- TIMELINE VISUALIZATION MATH ---
    const { minDate, maxDate, totalDays } = useMemo(() => {
        if (tasks.length === 0) return { minDate: null, maxDate: null, totalDays: 0 };
        let min = new Date(tasks[0].startDate || tasks[0].actualStart);
        let max = new Date(tasks[0].endDate || tasks[0].actualEnd);

        tasks.forEach(task => {
            const sDate = new Date(task.startDate || task.actualStart);
            const eDate = new Date(task.endDate || task.actualEnd);
            if (sDate < min) min = sDate;
            if (eDate > max) max = eDate;
        });

        const span = Math.ceil((max - min) / (1000 * 60 * 60 * 24)) + 1;
        return { minDate: min, maxDate: max, totalDays: span };
    }, [tasks]);

    const baseDayWidth = 30;
    const ganttColumnWidth = totalDays > 0 ? Math.max(400, totalDays * baseDayWidth * zoomLevel) : 400;
    const pixelsPerDay = totalDays > 0 ? ganttColumnWidth / totalDays : 0;

    const getBarColor = (status) => {
        switch(status) {
            case 'Completed': return 'success.main';
            case 'In Progress': return 'info.main';
            case 'Pending Procurement': return 'warning.main';
            case 'Quality Check': return 'secondary.main';
            default: return 'rgba(158, 158, 158, 0.5)';
        }
    };

    const getBarStyles = (task) => {
        if (!task.startDate && !task.actualStart) return { display: 'none' };
        if (totalDays === 0) return { display: 'none' };

        const start = new Date(task.startDate || task.actualStart);
        const end = new Date(task.endDate || task.actualEnd);
        const startOffsetDays = Math.floor((start - minDate) / (1000 * 60 * 60 * 24));
        const durationDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);

        const barColor = getBarColor(task.status);

        if (task.type === 'Milestone') {
            let offsetModifier = 0;
            if (task.dependency && (task.dependency.type === 'FS' || task.dependency.type === 'FF')) offsetModifier = 1;
            const diamondColor = task.status === "Completed" ? 'success.main' : 'warning.main';
            return { left: `${((startOffsetDays + offsetModifier) / totalDays) * 100}%`, width: `0%`, display: 'block', bgcolor: diamondColor };
        } else {
            return { left: `${Math.max(0, (startOffsetDays / totalDays) * 100)}%`, width: `${Math.min(100, (durationDays / totalDays) * 100)}%`, display: 'block', bgcolor: barColor };
        }
    };

    const groupedTasks = useMemo(() => {
        const groups = {};
        tasks.forEach(task => {
            const phase = task.phase || "General";
            if (!groups[phase]) groups[phase] = [];
            groups[phase].push(task);
        });
        return groups;
    }, [tasks]);

    const renderTimelineHeader = () => {
        if (!minDate || totalDays <= 0) return null;
        const daysArray = [];
        let cur = new Date(minDate);

        let scaleMode = 'days';
        if (pixelsPerDay < 15) scaleMode = 'weeks';
        if (pixelsPerDay < 5) scaleMode = 'months';

        for (let i = 0; i < totalDays; i++) {
            daysArray.push(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }

        return (
            <Box sx={{ display: 'flex', width: '100%', height: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {daysArray.map((d, idx) => {
                    const isMon = d.getDay() === 1;
                    const isFirst = d.getDate() === 1;
                    let label = "";
                    if (scaleMode === 'days') label = d.getDate();
                    else if (scaleMode === 'weeks' && isMon) label = `W${Math.ceil(d.getDate() / 7)}`;
                    else if (scaleMode === 'months' && isFirst) label = d.toLocaleDateString('en-US', { month: 'short' });

                    return (
                        <Box key={idx} sx={{
                            flex: 1, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center',
                            justifyContent: 'flex-start', pl: 0.5, fontSize: '10px', color: 'text.secondary',
                            overflow: 'visible', whiteSpace: 'nowrap'
                        }}>
                            {label}
                        </Box>
                    );
                })}
            </Box>
        );
    };

    const exportGanttToExcel = async () => {
        if (!minDate || tasks.length === 0) return alert("No schedule data to export.");
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Project Schedule');

        const columns = [
            { header: 'Task / Milestone', key: 'name', width: 35 },
            { header: 'Start Date', key: 'start', width: 15 },
            { header: 'End Date', key: 'end', width: 15 },
            { header: 'Dependency', key: 'dep', width: 15 },
            { header: 'Phase', key: 'phase', width: 20 },
        ];

        const daysArray = [];
        let curDate = new Date(minDate);
        for (let i = 0; i < totalDays; i++) {
            daysArray.push(curDate.getTime());
            columns.push({ header: `${curDate.getMonth() + 1}/${curDate.getDate()}`, key: `day_${i}`, width: 4 });
            curDate.setDate(curDate.getDate() + 1);
        }
        worksheet.columns = columns;

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B172D' } };
        worksheet.getRow(1).alignment = { horizontal: 'center' };

        Object.entries(groupedTasks).forEach(([phaseName, phaseTasks]) => {
            const phaseRow = worksheet.addRow({ name: `PHASE: ${phaseName.toUpperCase()}` });
            phaseRow.font = { bold: true, color: { argb: 'FF3B82F6' } };
            phaseRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F8FF' } };

            phaseTasks.forEach(task => {
                let depLabel = "-";
                if (task.dependency) {
                    const pred = tasks.find(t => t.id === task.dependency.taskId);
                    if (pred) depLabel = `${pred.name} (${task.dependency.type}) ${task.dependency.lag ? `${task.dependency.lag > 0 ? '+' : ''}${task.dependency.lag}d` : ''}`;
                }

                const row = worksheet.addRow({
                    name: task.name + (task.type === "Milestone" ? " ◆" : ""),
                    start: task.startDate || task.actualStart,
                    end: task.endDate || task.actualEnd,
                    dep: depLabel,
                    phase: task.phase
                });

                const tStart = new Date(task.startDate || task.actualStart).setHours(0, 0, 0, 0);
                const tEnd = new Date(task.endDate || task.actualEnd).setHours(0, 0, 0, 0);

                daysArray.forEach((dayTime, index) => {
                    if (dayTime >= tStart && dayTime <= tEnd) {
                        const cell = row.getCell(`day_${index}`);
                        if (task.type === "Milestone") {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
                        }
                    }
                });
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${project.name}_Gantt_Schedule.xlsx`);
    };

    return (
        <Box display="flex" flexDirection="column" gap={4}>

            {/* --- 1. RESPONSIVE TASK CREATION FORM --- */}
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '14px' }}>
                    ADD_SCHEDULE_ITEM
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                    <Box display="flex" gap={2} flexDirection={{ xs: 'column', md: 'row' }}>
                        <TextField select fullWidth size="small" label="TYPE" value={taskType} onChange={e => setTaskType(e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                            <MenuItem value="Task" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>Task</MenuItem>
                            <MenuItem value="Milestone" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>Milestone</MenuItem>
                        </TextField>
                        <TextField fullWidth size="small" label="NAME" value={taskName} onChange={e => setTaskName(e.target.value)} sx={{ flex: 2 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        <Autocomplete fullWidth freeSolo options={availablePhases} value={activePhase} onChange={(e, newVal) => setActivePhase(newVal || "General")} onInputChange={(e, newVal) => setActivePhase(newVal || "General")} renderInput={(params) => <TextField {...params} size="small" label="PHASE" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ ...params.InputProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />} />
                    </Box>
                    
                    <Box display="flex" gap={2} flexDirection={{ xs: 'column', lg: 'row' }} alignItems={{ xs: 'stretch', lg: 'flex-start' }}>
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }} flex={1}>
                            <TextField type="date" fullWidth size="small" label="START" value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            <TextField type="date" fullWidth size="small" label="END" value={taskType === "Milestone" ? startDate : endDate} onChange={e => setEndDate(e.target.value)} disabled={taskType === "Milestone"} inputProps={{ min: startDate }} InputLabelProps={{ shrink: true, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Box>
                        
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }} flex={2}>
                            <TextField select fullWidth size="small" label="PREDECESSOR" value={predecessorId} onChange={e => setPredecessorId(e.target.value)} sx={{ flex: 2 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                <MenuItem value="">-- NONE --</MenuItem>
                                {tasks.map(t => <MenuItem key={t.id} value={t.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', whiteSpace: 'normal' }}>{t.name}</MenuItem>)}
                            </TextField>
                            <TextField select fullWidth size="small" label="TYPE" value={dependencyType} onChange={e => setDependencyType(e.target.value)} disabled={!predecessorId} sx={{ flex: 1.5 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                {dependencyOptions.map(opt => <MenuItem key={opt.value} value={opt.value} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{opt.value}</MenuItem>)}
                            </TextField>
                            <TextField type="number" fullWidth size="small" label="LAG (Days)" value={dependencyLag} onChange={e => setDependencyLag(e.target.value)} disabled={!predecessorId} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        </Box>
                        
                        <Button variant="contained" color="primary" onClick={addTask} startIcon={<AddIcon />} sx={{ height: 40, flexShrink: 0, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', width: { xs: '100%', lg: 'auto' } }}>ADD</Button>
                    </Box>
                </Box>
            </Paper>

            {/* --- 2. THE WBS DATA TABLE --- */}
            <Paper elevation={0} sx={{ p: { xs: 1, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} px={{ xs: 1, sm: 0 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountTreeIcon color="primary" fontSize="small" /> WORK BREAKDOWN STRUCTURE (WBS)
                    </Typography>
                </Box>

                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 900 }}>
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                            <TableRow>
                                <TableCell sx={{ width: 40 }}></TableCell>
                                <TableCell sx={{ width: '30%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>TASK NAME</TableCell>
                                <TableCell sx={{ width: '15%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>START</TableCell>
                                <TableCell sx={{ width: '15%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>END</TableCell>
                                <TableCell sx={{ width: '20%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>DEPENDENCY</TableCell>
                                <TableCell sx={{ width: '15%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', whiteSpace: 'nowrap' }}>STATUS</TableCell>
                                <TableCell align="center" sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.keys(groupedTasks).length > 0 ? (
                                Object.entries(groupedTasks).map(([phaseName, phaseTasks]) => (
                                    <React.Fragment key={`wbs-phase-${phaseName}`}>
                                        <TableRow sx={{ bgcolor: 'rgba(59, 130, 246, 0.05)' }}>
                                            <TableCell colSpan={7} sx={{ py: 1.5, borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                                <Typography variant="subtitle2" color="primary.main" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>◲ PHASE: {phaseName.toUpperCase()}</Typography>
                                            </TableCell>
                                        </TableRow>
                                        {phaseTasks.map(task => {
                                            const isMilestone = task.type === "Milestone";
                                            const isStartLocked = task.dependency && (task.dependency.type === 'FS' || task.dependency.type === 'SS');
                                            const isEndLocked = isMilestone || (task.dependency && (task.dependency.type === 'FF' || task.dependency.type === 'SF'));
                                            const nativeSelectStyle = { background: 'transparent', color: 'inherit', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', outline: 'none', borderBottom: '1px dotted rgba(255,255,255,0.3)', cursor: 'pointer' };

                                            return (
                                                <TableRow key={task.id} hover draggable onDragStart={(e) => handleDragStart(e, task.id)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, task.id)} sx={{ opacity: draggedId === task.id ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                                                    <TableCell sx={{ cursor: 'grab', py: 0 }}><DragIndicatorIcon color="action" fontSize="small" sx={{ verticalAlign: 'middle' }} /></TableCell>
                                                    <TableCell>
                                                        <Box display="flex" alignItems="center">
                                                            <input type="text" value={task.name} onChange={e => updateTaskInline(task.id, "name", e.target.value)} style={{ background: 'transparent', color: 'inherit', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold', width: '100%', minWidth: '150px', outline: 'none' }} />
                                                            {isMilestone && <Typography component="span" color="warning.main" ml={0.5}>◆</Typography>}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <input type="date" value={task.startDate || task.actualStart} onChange={e => updateTaskInline(task.id, "startDate", e.target.value)} disabled={isStartLocked} style={{ background: 'transparent', color: isStartLocked ? 'gray' : 'inherit', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', width: '100%', minWidth: '110px', outline: 'none' }} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <input type="date" value={task.endDate || task.actualEnd} onChange={e => updateTaskInline(task.id, "endDate", e.target.value)} disabled={isEndLocked} style={{ background: 'transparent', color: isEndLocked ? 'gray' : 'inherit', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', width: '100%', minWidth: '110px', outline: 'none' }} />
                                                    </TableCell>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                        <select value={task.dependency?.taskId || ""} onChange={e => updateDependency(task.id, e.target.value, task.dependency?.type || "FS", task.dependency?.lag || 0)} style={{ ...nativeSelectStyle, width: '80px', marginRight: '6px' }}>
                                                            <option value="" style={{ color: 'black' }}>- None -</option>
                                                            {tasks.filter(t => t.id !== task.id).map(t => <option key={t.id} value={t.id} style={{ color: 'black' }}>{t.name}</option>)}
                                                        </select>
                                                        <select value={task.dependency?.type || "FS"} onChange={e => updateDependency(task.id, task.dependency?.taskId, e.target.value, task.dependency?.lag || 0)} disabled={!task.dependency?.taskId} style={{ ...nativeSelectStyle, width: '40px', marginRight: '6px', opacity: !task.dependency?.taskId ? 0.3 : 1 }}>
                                                            <option value="FS" style={{ color: 'black' }}>FS</option><option value="SS" style={{ color: 'black' }}>SS</option>
                                                            <option value="FF" style={{ color: 'black' }}>FF</option><option value="SF" style={{ color: 'black' }}>SF</option>
                                                        </select>
                                                        <input type="number" value={task.dependency?.lag || 0} onChange={e => updateDependency(task.id, task.dependency?.taskId, task.dependency?.type || "FS", e.target.value)} disabled={!task.dependency?.taskId} style={{ ...nativeSelectStyle, width: '40px', opacity: !task.dependency?.taskId ? 0.3 : 1 }} />
                                                        <Typography variant="caption" color="text.secondary" ml={0.5}>d</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <select value={task.status || "Not Started"} onChange={e => updateTaskInline(task.id, "status", e.target.value)} style={{ ...nativeSelectStyle, width: '100%', minWidth: '100px' }}>
                                                            <option value="Not Started" style={{ color: 'black' }}>Not Started</option>
                                                            <option value="Pending Procurement" style={{ color: 'black' }}>Procurement</option>
                                                            <option value="In Progress" style={{ color: 'black' }}>In Progress</option>
                                                            <option value="Quality Check" style={{ color: 'black' }}>QA Check</option>
                                                            <option value="Completed" style={{ color: 'black' }}>Completed</option>
                                                        </select>
                                                    </TableCell>
                                                    <TableCell align="center"><IconButton size="small" color="error" onClick={() => deleteTask(task.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </React.Fragment>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>NO_TASKS_SCHEDULED</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* --- 3. THE RESPONSIVE GANTT TIMELINE MATRIX --- */}
            <Paper elevation={0} sx={{ overflow: "hidden", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box sx={{ p: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)', gap: 2 }}>
                    <Box display="flex" flexWrap="wrap" alignItems="center" gap={2}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TimelineIcon color="primary" fontSize="small" /> VISUAL GANTT MATRIX
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.5} bgcolor="rgba(0,0,0,0.3)" borderRadius={2} px={1}>
                            <IconButton size="small" onClick={() => setZoomLevel(z => Math.max(0.2, z - 0.2))} color="primary"><ZoomOutIcon fontSize="small" /></IconButton>
                            <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: '40px', textAlign: 'center' }}>{Math.round(zoomLevel * 100)}%</Typography>
                            <IconButton size="small" onClick={() => setZoomLevel(z => Math.min(4, z + 0.2))} color="primary"><ZoomInIcon fontSize="small" /></IconButton>
                        </Box>
                        <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={exportGanttToExcel} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                            EXPORT
                        </Button>
                    </Box>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        DURATION: <Typography component="span" fontWeight="bold" color="success.main">{totalDays > 0 ? `${totalDays} DAYS` : "TBD"}</Typography>
                    </Typography>
                </Box>

                <TableContainer sx={{ overflowX: 'auto', overflowY: 'hidden' }}>
                    <Table size="small" sx={{ minWidth: 'max-content' }}>
                        <TableHead sx={{ bgcolor: STICKY_BG }}>
                            <TableRow>
                                {/* 🔥 THE FIX: Responsive Width for the Sticky Column */}
                                <TableCell sx={{ width: { xs: 120, sm: 200, md: 300 }, minWidth: { xs: 120, sm: 200, md: 300 }, maxWidth: { xs: 120, sm: 200, md: 300 }, position: 'sticky', left: 0, zIndex: 20, bgcolor: STICKY_BG, fontFamily: "'JetBrains Mono', monospace", fontSize: { xs: '10px', md: '11px' }, borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    TASK / MILESTONE
                                </TableCell>
                                <TableCell sx={{ width: ganttColumnWidth, minWidth: ganttColumnWidth, maxWidth: ganttColumnWidth, p: 0, verticalAlign: 'bottom' }}>
                                    {renderTimelineHeader()}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.keys(groupedTasks).length > 0 ? (
                                Object.entries(groupedTasks).map(([phaseName, phaseTasks]) => (
                                    <React.Fragment key={`gantt-phase-${phaseName}`}>
                                        <TableRow sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
                                            {/* 🔥 THE FIX: Match Header Responsiveness */}
                                            <TableCell sx={{ py: 1.5, position: 'sticky', left: 0, zIndex: 10, bgcolor: STICKY_BG, borderBottom: '1px solid rgba(59, 130, 246, 0.3)', borderRight: '1px solid rgba(255,255,255,0.05)', width: { xs: 120, sm: 200, md: 300 }, minWidth: { xs: 120, sm: 200, md: 300 }, maxWidth: { xs: 120, sm: 200, md: 300 }, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <Typography variant="subtitle2" color="primary.main" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: { xs: '11px', md: '14px' } }}>
                                                    ❖ PHASE: {phaseName.toUpperCase()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ borderBottom: '1px solid rgba(59, 130, 246, 0.3)' }}></TableCell>
                                        </TableRow>

                                        {phaseTasks.map(task => {
                                            const barStyles = getBarStyles(task);
                                            const isMilestone = task.type === "Milestone";

                                            return (
                                                <TableRow key={`matrix-${task.id}`} hover>
                                                    {/* 🔥 THE FIX: Match Header Responsiveness */}
                                                    <TableCell sx={{ position: 'sticky', left: 0, zIndex: 10, bgcolor: STICKY_BG, borderRight: '1px solid rgba(255,255,255,0.05)', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 'bold', width: { xs: 120, sm: 200, md: 300 }, minWidth: { xs: 120, sm: 200, md: 300 }, maxWidth: { xs: 120, sm: 200, md: 300 } }}>
                                                        <Box display="flex" alignItems="center" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {task.name}
                                                            {isMilestone && <Typography component="span" color="warning.main" ml={0.5}>◆</Typography>}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ position: 'relative', borderLeft: '1px dashed rgba(255,255,255,0.1)', p: 1, backgroundImage: totalDays > 0 ? `repeating-linear-gradient(to right, transparent, transparent calc(100% / ${totalDays} - 1px), rgba(255,255,255,0.05) calc(100% / ${totalDays}))` : 'none' }}>
                                                        <Box sx={{ width: '100%', height: '24px', position: 'relative', borderRadius: 1 }}>
                                                            {isMilestone ? (
                                                                <Box sx={{ position: 'absolute', left: barStyles.left, width: '14px', height: '14px', bgcolor: barStyles.bgcolor, transform: 'translate(-50%, -50%) rotate(45deg)', top: '50%', boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)', zIndex: 2 }} />
                                                            ) : (
                                                                <Box sx={{ ...barStyles, position: 'absolute', height: '100%', borderRadius: 1, opacity: 0.9, boxShadow: '0 0 8px rgba(0,0,0,0.3)', transition: 'all 0.3s ease', '&:hover': { opacity: 1 } }} />
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </React.Fragment>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={2} align="center" sx={{ py: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>NO_TASKS_SCHEDULED</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

        </Box>
    );
}