import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { 
    Box, Typography, Paper, Grid, IconButton, Button, 
    Chip, Avatar, Dialog, DialogTitle, DialogContent, 
    DialogActions, TextField, MenuItem 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const COLUMNS = [
    { id: 'BACKLOG', label: '01_BACKLOG', color: '#94a3b8' },
    { id: 'PROCUREMENT', label: '02_PROCUREMENT', color: '#f59e0b' },
    { id: 'ON_SITE', label: '03_IN_PROGRESS', color: '#3b82f6' },
    { id: 'QA_CHECK', label: '04_QUALITY_CONTROL', color: '#8b5cf6' },
    { id: 'DONE', label: '05_COMPLETED', color: '#10b981' }
];

export default function KanbanBoardTab({ project, renderedProjectBoq, orgStaff }) {
    const tasks = useLiveQuery(() => db.kanbanTasks.where({ projectId: project.id }).toArray()) || [];
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [formData, setFormData] = useState({ title: '', status: 'BACKLOG', priority: 'Medium', boqItemId: '', assigneeId: '' });

    // --- DRAG AND DROP LOGIC ---
    const handleDragStart = (e, taskId) => {
        e.dataTransfer.setData("taskId", taskId);
    };

    const handleOnDrop = async (e, newStatus) => {
        const taskId = e.dataTransfer.getData("taskId");
        await db.kanbanTasks.update(taskId, { status: newStatus });
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow drop
    };

    // --- ACTIONS ---
    const handleOpenDialog = (task = null) => {
        if (task) {
            setEditingTaskId(task.id);
            setFormData(task);
        } else {
            setEditingTaskId(null);
            setFormData({ title: '', status: 'BACKLOG', priority: 'Medium', boqItemId: '', assigneeId: '' });
        }
        setIsDialogOpen(true);
    };

    const handleSaveTask = async () => {
        if (!formData.title) return;
        const payload = {
            ...formData,
            id: editingTaskId || crypto.randomUUID(),
            projectId: project.id,
            createdAt: formData.createdAt || Date.now()
        };
        await db.kanbanTasks.put(payload);
        setIsDialogOpen(false);
    };

    const handleDeleteTask = async (id) => {
        if (window.confirm("Delete this task?")) {
            await db.kanbanTasks.delete(id);
        }
    };

    const TaskCard = ({ task }) => (
        <Paper
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
            sx={{
                p: 2, mb: 2, bgcolor: '#0b172d', border: '1px solid', borderColor: 'divider',
                borderRadius: 2, cursor: 'grab', transition: '0.2s',
                '&:active': { cursor: 'grabbing', opacity: 0.5 },
                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(59, 130, 246, 0.05)' }
            }}
        >
            <Box display="flex" justifyContent="space-between" mb={1}>
                <Chip 
                    label={task.priority?.toUpperCase()} 
                    size="small" 
                    sx={{ 
                        fontSize: '9px', height: 18, fontFamily: "'JetBrains Mono', monospace",
                        bgcolor: task.priority === 'High' || task.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                        color: task.priority === 'High' || task.priority === 'CRITICAL' ? 'error.main' : 'text.secondary'
                    }} 
                />
                <Box>
                    <IconButton size="small" onClick={() => handleOpenDialog(task)} sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                        <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteTask(task.id)} sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                        <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Box>
            </Box>
            
            <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, color: 'text.primary' }}>
                {task.title}
            </Typography>

            <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={0.5} sx={{ opacity: 0.6 }}>
                    <AccessTimeIcon sx={{ fontSize: 12 }} />
                    <Typography sx={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(task.createdAt).toLocaleDateString()}
                    </Typography>
                </Box>
                <Avatar sx={{ width: 22, height: 22, fontSize: '10px', bgcolor: 'primary.dark', border: '1px solid #3b82f6', color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
                    {task.assigneeId ? task.assigneeId.charAt(0) : '?'}
                </Avatar>
            </Box>
        </Paper>
    );

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                    TASK_MANAGER: <span style={{ color: '#3b82f6' }}>KANBAN</span>
                </Typography>
                <Button 
                    variant="contained" startIcon={<AddIcon />} 
                    onClick={() => handleOpenDialog()}
                    sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', px: 3 }}
                >
                    NEW_TASK
                </Button>
            </Box>

            <Grid container spacing={2}>
                {COLUMNS.map(col => (
                    <Grid 
                        item xs={12} md={2.4} key={col.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleOnDrop(e, col.id)}
                    >
                        <Box sx={{ 
                            bgcolor: 'rgba(13, 31, 60, 0.4)', borderRadius: 2, p: 1.5, minHeight: '65vh', 
                            border: '1px solid', borderColor: 'divider', transition: '0.2s',
                            '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' } 
                        }}>
                            <Box display="flex" alignItems="center" gap={1} mb={2} px={1}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: col.color }} />
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 'bold', color: 'text.secondary' }}>
                                    {col.label}
                                </Typography>
                                <Typography sx={{ ml: 'auto', fontSize: '11px', opacity: 0.5, fontFamily: "'JetBrains Mono', monospace" }}>
                                    {tasks.filter(t => t.status === col.id).length}
                                </Typography>
                            </Box>

                            <Box sx={{ height: '100%' }}>
                                {tasks.filter(t => t.status === col.id).map(task => (
                                    <TaskCard key={task.id} task={task} />
                                ))}
                            </Box>
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* TASK DIALOG (EDIT / ADD) */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                    {editingTaskId ? 'UPDATE_TASK' : 'INITIALIZE_TASK'}
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', pt: 3 }}>
                    <Box display="flex" flexDirection="column" gap={3}>
                        <TextField fullWidth label="TASK_TITLE" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                        
                        <TextField select fullWidth label="PRIORITY" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                            {['Low', 'Medium', 'High', 'CRITICAL'].map(p => <MenuItem key={p} value={p} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.toUpperCase()}</MenuItem>)}
                        </TextField>

                        <TextField select fullWidth label="STATUS_LANE" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                            {COLUMNS.map(col => <MenuItem key={col.id} value={col.id} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{col.label}</MenuItem>)}
                        </TextField>

                        <TextField select fullWidth label="LINK_BOQ_ITEM" value={formData.boqItemId} onChange={e => setFormData({...formData, boqItemId: e.target.value})}>
                            <MenuItem value="">NONE</MenuItem>
                            {renderedProjectBoq.map(item => (
                                <MenuItem key={item.id} value={item.id} sx={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>{item.displayDesc}</MenuItem>
                            ))}
                        </TextField>

                        <TextField select fullWidth label="ASSIGN_TO" value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
                            <MenuItem value="">UNASSIGNED</MenuItem>
                            {orgStaff.map(s => <MenuItem key={s.id} value={s.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.name.toUpperCase()}</MenuItem>)}
                        </TextField>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsDialogOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={handleSaveTask} sx={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: 50, px: 3 }}>
                        {editingTaskId ? 'SYNC_CHANGES' : 'COMMIT_TASK'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}