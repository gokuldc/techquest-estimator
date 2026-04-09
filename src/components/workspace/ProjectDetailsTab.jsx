import React, { useMemo } from 'react';
import {
    Box, Paper, Typography, Grid, TextField, MenuItem, Switch, Divider, Avatar, Autocomplete, Chip
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EventIcon from '@mui/icons-material/Event';
import FlagIcon from '@mui/icons-material/Flag';
import EngineeringIcon from '@mui/icons-material/Engineering';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import FoundationIcon from '@mui/icons-material/Foundation';
import BusinessIcon from '@mui/icons-material/Business';

export default function ProjectDetailsTab({
    project, updateProject, regions, totalAmount, projectBoqItems, togglePriceLock, 
    crmContacts = [], orgStaff = [] // Accepting both directories
}) {
    
    // --- 1. DIRECTORY MAPPING LOGIC ---

    // Strictly Internal Staff (Project Leads, Site Engineers)
    const internalStaffOptions = useMemo(() => {
        return orgStaff.map(s => s.name);
    }, [orgStaff]);

    // External Clients / Leads
    const clientOptions = useMemo(() => {
        return crmContacts
            .filter(c => {
                const type = c.type ? c.type.toLowerCase() : "";
                return type === 'client' || type === 'lead';
            })
            .map(c => c.company ? `${c.company} (${c.name})` : c.name);
    }, [crmContacts]);

    // Hybrid Options: Could be Internal (Org) or External (Consultant CRM)
    const hybridConsultantOptions = useMemo(() => {
        const external = crmContacts
            .filter(c => (c.type || "").toLowerCase() === 'consultant')
            .map(c => `${c.name} [EXT]`);
        
        const internal = orgStaff
            .map(s => `${s.name} [INT]`);

        return [...internal, ...external];
    }, [crmContacts, orgStaff]);

    const crmSubcontractors = useMemo(() => {
        return crmContacts.filter(c => {
            const type = c.type ? c.type.toLowerCase() : "";
            return type === 'subcontractor' || type === 'supplier';
        });
    }, [crmContacts]);

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
            if (task.status === "In Progress") activePhases.add(task.phase);
            if (task.status !== "Completed") allCompleted = false;
            if (task.status === "In Progress" || task.status === "Completed") anyStarted = true;
        });

        let active = "Not Started";
        if (activePhases.size > 0) active = Array.from(activePhases).join(", ");
        else if (allCompleted && tasks.length > 0) active = "Project Completed";
        else if (anyStarted) active = "Between Active Phases";

        return { minDate: min, maxDate: max, currentPhase: active };
    }, [tasks]);

    const availablePhases = useMemo(() => {
        const phases = new Set((projectBoqItems || []).map(item => item.phase).filter(Boolean));
        tasks.forEach(t => { if (t.phase) phases.add(t.phase); });
        return phases.size === 0 ? ["General"] : Array.from(phases);
    }, [projectBoqItems, tasks]);

    const phaseAssignments = project.phaseAssignments || {};

    const handlePhaseAssignment = async (phase, subId) => {
        const newAssignments = { ...phaseAssignments, [phase]: subId };
        await updateProject("phaseAssignments", newAssignments);
    };

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
                    <MetricCard title="ESTIMATED COST" value={`₹ ${(totalAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} icon={<AttachMoneyIcon />} color="success" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="START DATE" value={minDate ? minDate.toLocaleDateString() : "TBD"} icon={<EventIcon />} color="info" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="EST. END DATE" value={maxDate ? maxDate.toLocaleDateString() : "TBD"} icon={<EventIcon />} color="warning" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="CURRENT PHASE" value={currentPhase ? currentPhase.toUpperCase() : "-"} icon={<FlagIcon />} color="secondary" />
                </Grid>
            </Grid>

            <Grid container spacing={3}>
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
                                <TextField label="PROJECT_CODE" value={project.code || ""} onChange={e => updateProject("code", e.target.value)} fullWidth helperText="Unique code for this project" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} FormHelperTextProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Autocomplete freeSolo openOnFocus disablePortal options={clientOptions} value={project.clientName || ""} onInputChange={(e, newVal) => updateProject("clientName", newVal)} sx={{ '& .MuiInputBase-input': { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} renderInput={(params) => (<TextField {...params} label="CLIENT_NAME (CRM)" InputLabelProps={{ ...params.InputLabelProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />)} />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField select label="RATES_REGION" value={regions.some(r => r.name === project.region) ? project.region : ""} onChange={e => updateProject("region", e.target.value)} fullWidth helperText="Leave empty for default" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} FormHelperTextProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}>
                                    <MenuItem value="">-- AUTO_DETECT --</MenuItem>
                                    {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{r.name}</MenuItem>)}
                                </TextField>
                            </Grid>

                            <Grid item xs={12}><Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} /></Grid>

                            {/* IN-HOUSE STAFF (Strictly Org) */}
                            <Grid item xs={12} md={4}>
                                <TextField select label="PROJECT_STATUS" value={project.status || "Draft"} onChange={e => updateProject("status", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                    {['Draft', 'In Progress', 'On Hold', 'Completed', 'Archived'].map(s => <MenuItem key={s} value={s} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{s}</MenuItem>)}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <AssignmentIndIcon color="action" />
                                    <Autocomplete freeSolo openOnFocus disablePortal options={internalStaffOptions} value={project.projectLead || ""} onInputChange={(e, newVal) => updateProject("projectLead", newVal)} fullWidth renderInput={(params) => <TextField {...params} label="PROJECT_LEAD (INT)" InputLabelProps={{ ...params.InputLabelProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />} />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <EngineeringIcon color="action" />
                                    <Autocomplete freeSolo openOnFocus disablePortal options={internalStaffOptions} value={project.siteSupervisor || ""} onInputChange={(e, newVal) => updateProject("siteSupervisor", newVal)} fullWidth renderInput={(params) => <TextField {...params} label="SITE_ENGINEER (INT)" InputLabelProps={{ ...params.InputLabelProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />} />
                                </Box>
                            </Grid>

                            {/* HYBRID ROLES (Staff or CRM Consultants) */}
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <BusinessIcon color="action" />
                                    <Autocomplete freeSolo openOnFocus disablePortal options={hybridConsultantOptions} value={project.pmc || ""} onInputChange={(e, newVal) => updateProject("pmc", newVal)} fullWidth renderInput={(params) => <TextField {...params} label="PMC (INT/EXT)" InputLabelProps={{ ...params.InputLabelProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />} />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <ArchitectureIcon color="action" />
                                    <Autocomplete freeSolo openOnFocus disablePortal options={hybridConsultantOptions} value={project.architect || ""} onInputChange={(e, newVal) => updateProject("architect", newVal)} fullWidth renderInput={(params) => <TextField {...params} label="ARCHITECT (INT/EXT)" InputLabelProps={{ ...params.InputLabelProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />} />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <FoundationIcon color="action" />
                                    <Autocomplete freeSolo openOnFocus disablePortal options={hybridConsultantOptions} value={project.structuralEngineer || ""} onInputChange={(e, newVal) => updateProject("structuralEngineer", newVal)} fullWidth renderInput={(params) => <TextField {...params} label="STRUCTURAL (INT/EXT)" InputLabelProps={{ ...params.InputLabelProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />} />
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Box display="flex" flexDirection="column" gap={3} height="100%">
                        <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: project.isPriceLocked ? 'success.main' : 'divider', bgcolor: project.isPriceLocked ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.2)' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                <Box pr={2}>
                                    <Typography variant="subtitle1" fontWeight="bold" color={project.isPriceLocked ? 'success.main' : 'text.primary'} sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {project.isPriceLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />} PRICE_LOCK
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', mt: 1, lineHeight: 1.5 }}>
                                        {project.isPriceLocked ? "Prices frozen." : "Live Mode."}
                                    </Typography>
                                </Box>
                                <Switch checked={!!project.isPriceLocked} onChange={togglePriceLock} color="success" />
                            </Box>
                        </Paper>

                        <Paper sx={{ p: 3, flex: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>PHASE_AWARDS</Typography>
                            <Box display="flex" flexDirection="column" gap={2}>
                                {availablePhases.map(phase => (
                                    <Box key={phase} display="flex" justifyContent="space-between" alignItems="center" p={1.5} borderRadius={1} bgcolor="rgba(0,0,0,0.2)" border="1px solid" borderColor="divider">
                                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 'bold' }}>{phase.toUpperCase()}</Typography>
                                        <TextField select size="small" value={phaseAssignments[phase] || ""} onChange={e => handlePhaseAssignment(phase, e.target.value)} sx={{ minWidth: 150 }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: 30 } }}>
                                            <MenuItem value="" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontStyle: 'italic' }}>In-House</MenuItem>
                                            {crmSubcontractors.map(sub => (
                                                <MenuItem key={sub.id} value={sub.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{sub.company ? `${sub.company} (${sub.name})` : sub.name}</MenuItem>
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