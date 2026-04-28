import React, { useState, useMemo } from 'react';
import {
    Box, Typography, Paper, IconButton, Button, Avatar, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
    Grid, alpha, useTheme, Tooltip
} from '@mui/material';

// Icons
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FlagIcon from '@mui/icons-material/Flag';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// 🔥 Synchronized exactly with KanbanBoardTab.jsx
const COLUMNS = [
    { id: 'Not Started', label: '01_BACKLOG', color: '#94a3b8' },
    { id: 'Pending Procurement', label: '02_PROCUREMENT', color: '#f59e0b' },
    { id: 'In Progress', label: '03_IN_PROGRESS', color: '#3b82f6' },
    { id: 'Quality Check', label: '04_QUALITY_CONTROL', color: '#8b5cf6' },
    { id: 'Completed', label: '05_COMPLETED', color: '#10b981' }
];

const PRIORITIES = [
    { id: 'Low', label: 'Low', color: '#64748b' },
    { id: 'Medium', label: 'Medium', color: '#f59e0b' },
    { id: 'High', label: 'High', color: '#ef4444' },
    { id: 'CRITICAL', label: 'CRITICAL', color: '#dc2626' }
];

export default function TasksModule({ currentUser, staff, projects, loadData }) {
    const theme = useTheme();

    // --- STATE ---
    const [filterProject, setFilterProject] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [draggedTask, setDraggedTask] = useState(null);

    const [formData, setFormData] = useState({
        title: "", status: "Not Started", priority: "Medium", 
        assigneeId: "", projectId: ""
    });

    // --- DATA AGGREGATION ---
    // Pulls all tasks from all projects and attaches the projectId to them
    const allTasks = useMemo(() => {
        return projects.flatMap(p => {
            let pTasks = [];
            try {
                pTasks = typeof p.ganttTasks === 'string' ? JSON.parse(p.ganttTasks) : (Array.isArray(p.ganttTasks) ? p.ganttTasks : []);
            } catch (e) { pTasks = []; }
            return pTasks.map(t => ({ ...t, projectId: p.id }));
        });
    }, [projects]);

    const filteredTasks = allTasks.filter(t => !filterProject || t.projectId === filterProject);

    // --- DATABASE ACTIONS ---
    // Saves a specific project's task array back to the DB
    const executeProjectUpdate = async (projectId, updatedProjectTasks) => {
        try {
            await window.api.db.updateProject(projectId, { ganttTasks: JSON.stringify(updatedProjectTasks) });
            loadData(); // Refresh the global state from DailyLogs.jsx
        } catch (err) {
            console.error("Failed to sync task:", err);
            alert("Database sync failed.");
        }
    };

    const handleSaveTask = async () => {
        if (!formData.title.trim() || !formData.projectId) {
            return alert("Task Title and a Target Project are required.");
        }
        
        const targetProject = projects.find(p => p.id === formData.projectId);
        let projectTasks = [];
        try { projectTasks = typeof targetProject.ganttTasks === 'string' ? JSON.parse(targetProject.ganttTasks) : (Array.isArray(targetProject.ganttTasks) ? targetProject.ganttTasks : []); } catch(e){}

        const newTask = {
            id: `task_${window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2)}`,
            title: formData.title.trim(),
            name: formData.title.trim(), // Keep sync with project workspace
            status: formData.status,
            priority: formData.priority,
            assigneeId: formData.assigneeId,
            createdAt: new Date().toISOString()
        };

        await executeProjectUpdate(formData.projectId, [...projectTasks, newTask]);
        
        setIsDialogOpen(false);
        setFormData({ title: "", status: "Not Started", priority: "Medium", assigneeId: "", projectId: "" });
    };

    const handleDeleteTask = async (task) => {
        if (!window.confirm("Permanently delete this task from the project?")) return;
        
        const targetProject = projects.find(p => p.id === task.projectId);
        let projectTasks = [];
        try { projectTasks = typeof targetProject.ganttTasks === 'string' ? JSON.parse(targetProject.ganttTasks) : (Array.isArray(targetProject.ganttTasks) ? targetProject.ganttTasks : []); } catch(e){}

        const updatedTasks = projectTasks.filter(t => t.id !== task.id);
        await executeProjectUpdate(task.projectId, updatedTasks);
    };

    // --- NATIVE DRAG & DROP LOGIC ---
    const handleDragStart = (e, task) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        setTimeout(() => e.target.style.opacity = "0.4", 0);
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = "1";
        setDraggedTask(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e, newStatus) => {
        e.preventDefault();
        if (!draggedTask || draggedTask.status === newStatus) return;

        // Find the specific project this task belongs to
        const targetProject = projects.find(p => p.id === draggedTask.projectId);
        if (!targetProject) return;

        let projectTasks = [];
        try { projectTasks = typeof targetProject.ganttTasks === 'string' ? JSON.parse(targetProject.ganttTasks) : (Array.isArray(targetProject.ganttTasks) ? targetProject.ganttTasks : []); } catch(e){}

        // Update the status of the specific task within its project's array
        const updatedTasks = projectTasks.map(t => t.id === draggedTask.id ? { ...t, status: newStatus } : t);
        
        await executeProjectUpdate(targetProject.id, updatedTasks);
    };

    // --- PARSERS ---
    const getStaff = (name) => staff.find(s => s.name === name || s.id === name); // Handles both ID and Name matching from old DBs
    const getProject = (id) => projects.find(p => p.id === id);
    const getPriorityColor = (p) => PRIORITIES.find(x => x.id === p)?.color || '#64748b';

    // --- STYLES ---
    const ghostInputStyle = {
        '& .MuiOutlinedInput-root': {
            fontFamily: "'Inter', sans-serif", fontSize: '13px',
            bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
            '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        }
    };

    return (
        <Box display="flex" flexDirection="column" height="calc(100vh - 120px)">
            
            {/* --- CONTROLS HEADER --- */}
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" gap={2} mb={3}>
                <Box display="flex" alignItems="center" gap={2} width={{ xs: '100%', sm: 'auto' }}>
                    <TextField 
                        select size="small" label="FILTER BY PROJECT" 
                        value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
                        sx={{ width: 250, ...ghostInputStyle }}
                    >
                        <MenuItem value="" sx={{ fontStyle: 'italic', opacity: 0.7 }}>Global Overview (All Projects)</MenuItem>
                        {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </TextField>
                </Box>
                
                <Button 
                    variant="contained" color="primary" 
                    startIcon={<AddCircleOutlineIcon />} 
                    onClick={() => setIsDialogOpen(true)}
                    sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', boxShadow: 'none', width: { xs: '100%', sm: 'auto' } }}
                >
                    NEW_GLOBAL_TASK
                </Button>
            </Box>

            {/* --- KANBAN BOARD AREA --- */}
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 3, overflowX: 'auto', overflowY: 'hidden', pb: 2, scrollSnapType: 'x mandatory' }}>
                {COLUMNS.map(col => {
                    const colTasks = filteredTasks.filter(t => t.status === col.id);

                    return (
                        <Paper 
                            key={col.id} elevation={0}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                            sx={{ 
                                minWidth: 320, width: 320, flexShrink: 0, 
                                bgcolor: alpha(theme.palette.background.paper, 0.2), 
                                border: '1px solid', borderColor: 'divider', 
                                borderRadius: 3, display: 'flex', flexDirection: 'column',
                                scrollSnapAlign: 'start'
                            }}
                        >
                            {/* Column Header */}
                            <Box p={2} borderBottom="1px solid" borderColor="divider" bgcolor={alpha(col.color, 0.1)} display="flex" justifyContent="space-between" alignItems="center">
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Box width={12} height={12} borderRadius="50%" bgcolor={col.color} />
                                    <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", color: col.color, letterSpacing: '1px' }}>
                                        {col.label}
                                    </Typography>
                                </Box>
                                <Chip label={colTasks.length} size="small" sx={{ bgcolor: alpha(col.color, 0.2), color: col.color, fontWeight: 'bold', height: 20, fontSize: '10px' }} />
                            </Box>

                            {/* Droppable Task List */}
                            <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {colTasks.map(task => {
                                    const assignee = getStaff(task.assigneeId);
                                    const project = getProject(task.projectId);
                                    const title = task.title || task.name || 'Untitled Task';
                                    
                                    return (
                                        <Paper 
                                            key={`${task.projectId}_${task.id}`} elevation={0}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task)}
                                            onDragEnd={handleDragEnd}
                                            sx={{ 
                                                p: 2, cursor: 'grab', position: 'relative',
                                                bgcolor: alpha(theme.palette.background.paper, 0.6), 
                                                border: '1px solid', borderColor: 'divider', 
                                                borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
                                                borderRadius: 2, transition: '0.2s',
                                                '&:hover': { bgcolor: alpha(theme.palette.background.paper, 0.9), borderColor: theme.palette.primary.main, transform: 'translateY(-2px)' },
                                                '&:active': { cursor: 'grabbing' },
                                                '&:hover .delete-btn': { opacity: 1 }
                                            }}
                                        >
                                            <IconButton 
                                                className="delete-btn" size="small" 
                                                onClick={() => handleDeleteTask(task)}
                                                sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, transition: '0.2s', color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                                            >
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>

                                            {project && !filterProject && (
                                                <Typography variant="caption" sx={{ display: 'block', mb: 1, fontSize: '9px', color: 'info.light', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
                                                    {project.name}
                                                </Typography>
                                            )}

                                            <Typography variant="body2" fontWeight="bold" mb={1} sx={{ pr: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {title}
                                            </Typography>

                                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                                <Box display="flex" alignItems="center" gap={0.5} sx={{ opacity: 0.6 }}>
                                                    <AccessTimeIcon sx={{ fontSize: 12 }} />
                                                    <Typography sx={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace" }}>
                                                        {new Date(task.createdAt || Date.now()).toLocaleDateString()}
                                                    </Typography>
                                                </Box>
                                                <Box display="flex" gap={1}>
                                                    <Tooltip title={`Priority: ${task.priority || 'Medium'}`}>
                                                        <FlagIcon sx={{ fontSize: 16, color: getPriorityColor(task.priority || 'Medium') }} />
                                                    </Tooltip>
                                                    {assignee && (
                                                        <Tooltip title={`Assigned to: ${assignee.name}`}>
                                                            <Avatar sx={{ width: 20, height: 20, fontSize: '9px', bgcolor: 'primary.dark' }}>
                                                                {assignee.name.charAt(0)}
                                                            </Avatar>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </Box>
                                        </Paper>
                                    );
                                })}
                                
                                {colTasks.length === 0 && (
                                    <Box textAlign="center" py={4} opacity={0.3}>
                                        <AssignmentIcon sx={{ fontSize: 40, mb: 1 }} />
                                        <Typography variant="caption" display="block" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>DROP_TASKS_HERE</Typography>
                                    </Box>
                                )}
                            </Box>
                        </Paper>
                    );
                })}
            </Box>

            {/* --- NEW GLOBAL TASK DIALOG --- */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider', borderRadius: 3 } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'text.secondary' }}>
                    CONFIGURE_NEW_TASK
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Grid container spacing={2} sx={{ mt: 0 }}>
                        <Grid item xs={12}>
                            <TextField fullWidth label="TARGET PROJECT (REQUIRED)" select value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })} sx={ghostInputStyle}>
                                {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                            </TextField>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="TASK TITLE" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} sx={ghostInputStyle} autoFocus />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth select label="PRIORITY" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} sx={ghostInputStyle}>
                                {PRIORITIES.map(p => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
                            </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth select label="STATUS_LANE" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} sx={ghostInputStyle}>
                                {COLUMNS.map(col => <MenuItem key={col.id} value={col.id}>{col.label}</MenuItem>)}
                            </TextField>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth select label="ASSIGNEE" value={formData.assigneeId} onChange={e => setFormData({ ...formData, assigneeId: e.target.value })} sx={ghostInputStyle}>
                                <MenuItem value="">UNASSIGNED</MenuItem>
                                {staff.map(s => <MenuItem key={s.id} value={s.name}>{s.name.toUpperCase()}</MenuItem>)}
                            </TextField>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Button onClick={() => setIsDialogOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button onClick={handleSaveTask} variant="contained" color="success" disabled={!formData.title.trim() || !formData.projectId} sx={{ fontFamily: "'JetBrains Mono', monospace", boxShadow: 'none' }}>
                        DEPLOY_TASK
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}