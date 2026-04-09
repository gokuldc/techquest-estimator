import React, { useMemo } from 'react';
import {
    Box, Paper, Typography, Grid, TextField, MenuItem, Switch, Divider, Avatar
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EventIcon from '@mui/icons-material/Event';
import FlagIcon from '@mui/icons-material/Flag';
import EngineeringIcon from '@mui/icons-material/Engineering';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
// New Icons for the extended team
import ArchitectureIcon from '@mui/icons-material/Architecture';
import FoundationIcon from '@mui/icons-material/Foundation';
import BusinessIcon from '@mui/icons-material/Business';

export default function ProjectDetailsTab({
    project, updateProject, regions, totalAmount, projectBoqItems, togglePriceLock
}) {
    // --- DASHBOARD CALCULATIONS ---
    // --- DASHBOARD CALCULATIONS ---
    const tasks = project.ganttTasks || [];

    const { minDate, maxDate, currentPhase } = useMemo(() => {
        if (tasks.length === 0) return { minDate: null, maxDate: null, currentPhase: "No Schedule" };

        let min = new Date(tasks[0].startDate);
        let max = new Date(tasks[0].endDate);

        const activePhases = new Set();
        let allCompleted = true;
        let anyStarted = false;

        tasks.forEach(task => {
            const sDate = new Date(task.startDate);
            const eDate = new Date(task.endDate);
            if (sDate < min) min = sDate;
            if (eDate > max) max = eDate;

            // Log states
            if (task.status === "In Progress") activePhases.add(task.phase);
            if (task.status !== "Completed") allCompleted = false;
            if (task.status === "In Progress" || task.status === "Completed") anyStarted = true;
        });

        // Determine Dashboard Phase based on live execution status
        let active = "Not Started";
        if (activePhases.size > 0) {
            active = Array.from(activePhases).join(", "); // E.g., "Substructure, MEP"
        } else if (allCompleted && tasks.length > 0) {
            active = "Project Completed";
        } else if (anyStarted) {
            active = "Between Active Phases";
        }

        return { minDate: min, maxDate: max, currentPhase: active };
    }, [tasks]);
    // --- PHASE & SUBCONTRACTOR MAPPING ---
    const availablePhases = useMemo(() => {
        const phases = new Set((projectBoqItems || []).map(item => item.phase).filter(Boolean));
        tasks.forEach(t => { if (t.phase) phases.add(t.phase); });
        if (phases.size === 0) return ["General"];
        return Array.from(phases);
    }, [projectBoqItems, tasks]);

    const subcontractors = project.subcontractors || [];
    const phaseAssignments = project.phaseAssignments || {};

    const handlePhaseAssignment = async (phase, subId) => {
        const newAssignments = { ...phaseAssignments, [phase]: subId };
        await updateProject("phaseAssignments", newAssignments);
    };

    // --- REUSABLE METRIC CARD ---
    const MetricCard = ({ title, value, icon, color }) => (
        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: `${color}.main`, width: 48, height: 48 }}>{icon}</Avatar>
            <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>{title}</Typography>
                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>{value}</Typography>
            </Box>
        </Paper>
    );

    return (
        <Box display="flex" flexDirection="column" gap={3}>

            {/* --- TOP DASHBOARD METRICS --- */}
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="ESTIMATED COST"
                        value={`₹ ${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                        icon={<AttachMoneyIcon />} color="success"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="START DATE"
                        value={minDate ? minDate.toLocaleDateString() : "TBD"}
                        icon={<EventIcon />} color="info"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="EST. END DATE"
                        value={maxDate ? maxDate.toLocaleDateString() : "TBD"}
                        icon={<EventIcon />} color="warning"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="CURRENT PHASE"
                        value={currentPhase ? currentPhase.toUpperCase() : "-"}
                        icon={<FlagIcon />} color="secondary"
                    />
                </Grid>
            </Grid>

            <Grid container spacing={3}>

                {/* --- LEFT COLUMN: PROJECT SETTINGS --- */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', height: '100%' }}>
                        <Typography variant="h6" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}>
                            PROJECT_CONFIGURATION
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <TextField label="PROJECT_NAME" value={project.name || ""} onChange={e => updateProject("name", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField label="PROJECT_CODE" value={project.code || ""} onChange={e => updateProject("code", e.target.value)} fullWidth helperText="Unique code for this project (e.g., OP-2026-001)" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} FormHelperTextProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField label="CLIENT_NAME" value={project.clientName || ""} onChange={e => updateProject("clientName", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField select label="RATES_REGION" value={regions.some(r => r.name === project.region) ? project.region : ""} onChange={e => updateProject("region", e.target.value)} fullWidth helperText="Leave empty to use default rates" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} FormHelperTextProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}>
                                    <MenuItem value="">-- AUTO_DETECT_FIRST_RATE --</MenuItem>
                                    {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{r.name}</MenuItem>)}
                                </TextField>
                            </Grid>

                            <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} /></Grid>

                            {/* IN-HOUSE TEAM ROW */}
                            <Grid item xs={12} md={4}>
                                <TextField select label="PROJECT_STATUS" value={project.status || "Draft"} onChange={e => updateProject("status", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                    <MenuItem value="Draft" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Draft</MenuItem>
                                    <MenuItem value="In Progress" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>In Progress</MenuItem>
                                    <MenuItem value="On Hold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>On Hold</MenuItem>
                                    <MenuItem value="Completed" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Completed</MenuItem>
                                    <MenuItem value="Archived" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Archived</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <AssignmentIndIcon color="action" />
                                    <TextField label="PROJECT_LEAD" value={project.projectLead || ""} onChange={e => updateProject("projectLead", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <EngineeringIcon color="action" />
                                    <TextField label="SITE_ENGINEER" value={project.siteSupervisor || ""} onChange={e => updateProject("siteSupervisor", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                </Box>
                            </Grid>

                            {/* EXTERNAL CONSULTANTS ROW */}
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <BusinessIcon color="action" />
                                    <TextField label="PMC (CONSULTANT)" value={project.pmc || ""} onChange={e => updateProject("pmc", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <ArchitectureIcon color="action" />
                                    <TextField label="ARCHITECT" value={project.architect || ""} onChange={e => updateProject("architect", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <FoundationIcon color="action" />
                                    <TextField label="STRUCTURAL_ENGINEER" value={project.structuralEngineer || ""} onChange={e => updateProject("structuralEngineer", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                {/* --- RIGHT COLUMN: PHASES & SECURITY --- */}
                <Grid item xs={12} md={4}>
                    <Box display="flex" flexDirection="column" gap={3} height="100%">

                        {/* PRICE LOCK COMPONENT */}
                        <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: project.isPriceLocked ? 'success.main' : 'divider', bgcolor: project.isPriceLocked ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.2)' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                <Box pr={2}>
                                    <Typography variant="subtitle1" fontWeight="bold" color={project.isPriceLocked ? 'success.main' : 'text.primary'} sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {project.isPriceLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                                        PRICE_LOCK
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', mt: 1, lineHeight: 1.5 }}>
                                        {project.isPriceLocked
                                            ? "Prices are frozen. Master Database updates will NOT alter this project's cost."
                                            : "Live Mode. Master Database updates will actively alter this project's cost."}
                                    </Typography>
                                </Box>
                                <Switch checked={!!project.isPriceLocked} onChange={togglePriceLock} color="success" />
                            </Box>
                        </Paper>

                        {/* SUBCONTRACTOR ASSIGNMENTS */}
                        <Paper sx={{ p: 3, flex: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>
                                PHASE_AWARDS
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                Assign registered Bidders to specific construction phases.
                            </Typography>

                            <Box display="flex" flexDirection="column" gap={2}>
                                {availablePhases.map(phase => (
                                    <Box key={phase} display="flex" justifyContent="space-between" alignItems="center" p={1.5} borderRadius={1} bgcolor="rgba(0,0,0,0.2)" border="1px solid" borderColor="divider">
                                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 'bold' }}>
                                            {phase.toUpperCase()}
                                        </Typography>
                                        <TextField
                                            select size="small"
                                            value={phaseAssignments[phase] || ""}
                                            onChange={e => handlePhaseAssignment(phase, e.target.value)}
                                            sx={{ minWidth: 150 }}
                                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: 30 } }}
                                        >
                                            <MenuItem value="" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontStyle: 'italic' }}>In-House (Self-Execute)</MenuItem>
                                            {subcontractors.map(sub => (
                                                <MenuItem key={sub.id} value={sub.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                                    {sub.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Box>
                                ))}
                            </Box>
                        </Paper>

                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}