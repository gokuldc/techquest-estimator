import React, { useMemo, useState } from 'react';
import {
    Box, Typography, Paper, Grid, TextField, MenuItem, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, LinearProgress, Tooltip
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LinkOffIcon from '@mui/icons-material/LinkOff'; 
import LinkIcon from '@mui/icons-material/Link';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';

import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function ProjectDetailsTab({ project, updateProject, regions, resources, totalAmount, projectBoqItems, togglePriceLock, crmContacts, orgStaff }) {

    const { formatCurrency, settings } = useSettings();
    const { hasClearance } = useAuth();

    const [selectedNewMember, setSelectedNewMember] = useState("");
    const assignedIds = JSON.parse(project?.assignedStaff || '[]');
    const availableStaff = (orgStaff || []).filter(staff => !assignedIds.includes(staff.id));

    // 🔥 FIXED: Reverted back to sequential field/value arguments
    const handleAddMember = () => {
        if (!selectedNewMember) return;
        const newAssigned = [...assignedIds, selectedNewMember];
        updateProject('assignedStaff', JSON.stringify(newAssigned));
        setSelectedNewMember("");
    };

    // 🔥 FIXED: Reverted back to sequential field/value arguments
    const handleRemoveStaff = (idToRemove) => {
        const newAssigned = assignedIds.filter(id => id !== idToRemove);
        updateProject('assignedStaff', JSON.stringify(newAssigned));
    };

    const totalBilled = Array.isArray(project?.raBills) ? project.raBills.reduce((sum, bill) => sum + Number(bill.subTotal || 0), 0) : 0;
    const activeTasks = Array.isArray(project?.ganttTasks) ? project.ganttTasks.filter(t => t.status !== 'Completed').length : 0;
    const totalGrns = Array.isArray(project?.grns) ? project.grns.length : 0;

    const timelineMetrics = useMemo(() => {
        const start = new Date(project?.startDate || project?.createdAt || Date.now());
        const end = project?.endDate ? new Date(project.endDate) : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000); 
        const today = new Date();
        const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        const daysElapsed = Math.max(0, Math.ceil((today - start) / (1000 * 60 * 60 * 24)));
        const remaining = Math.max(0, totalDays - daysElapsed);
        const percent = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

        return { start: start.toLocaleDateString(), end: end.toLocaleDateString(), duration: totalDays, elapsed: daysElapsed, remaining, percent };
    }, [project]);

    const inflationRisk = useMemo(() => {
        let totalExposure = 0;
        (projectBoqItems || []).forEach(item => {
            const res = resources?.find(r => r.code === item.itemCode);
            if (res && Array.isArray(res.rateHistory) && res.rateHistory.length > 0) {
                const sortedHistory = [...res.rateHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
                const currentMarketRate = Number(sortedHistory[0].rate || 0);
                const budgetedRate = Number(item.rate || 0);

                if (currentMarketRate > budgetedRate) {
                    totalExposure += ((currentMarketRate - budgetedRate) * Number(item.computedQty || 0));
                }
            }
        });
        return totalExposure;
    }, [projectBoqItems, resources]);

    const costByPhaseData = useMemo(() => {
        const phases = {};
        (projectBoqItems || []).forEach(item => {
            const phase = item.phase || "General";
            phases[phase] = (phases[phase] || 0) + Number(item.amount || 0);
        });
        return Object.entries(phases).map(([name, value]) => ({ name: name.toUpperCase(), value })).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    }, [projectBoqItems]);

    const timeSeriesData = useMemo(() => {
        const months = {};
        const getMonthKey = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            return isNaN(d) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

        (Array.isArray(project?.raBills) ? project.raBills : []).forEach(bill => {
            const key = getMonthKey(bill.date);
            if (key) {
                if (!months[key]) months[key] = { name: key, planned: 0, actual: 0 };
                months[key].actual += Number(bill.subTotal || 0);
            }
        });

        const tasks = Array.isArray(project?.ganttTasks) ? project.ganttTasks : [];
        tasks.forEach(task => {
            const key = getMonthKey(task.createdAt || task.actualStart || project?.createdAt);
            if (key) {
                if (!months[key]) months[key] = { name: key, planned: 0, actual: 0 };
                months[key].planned += (totalAmount / (tasks.length || 1));
            }
        });

        let cumulativePlanned = 0, cumulativeActual = 0;
        return Object.values(months).sort((a, b) => a.name.localeCompare(b.name)).map(month => {
            cumulativePlanned += month.planned; cumulativeActual += month.actual;
            return { name: month.name, MonthlyBilled: month.actual, CumulativePlanned: cumulativePlanned, CumulativeActual: cumulativeActual };
        });
    }, [project, totalAmount]);

    // 🔥 FIXED: Reverted to the stable multi-argument format expected by ProjectWorkspace
    const handleChange = (field, value) => updateProject(field, value);

    const formatYAxis = (val) => {
        if (settings.currencyLocale === 'en-IN') return `${settings.currencySymbol}${(val / 100000).toFixed(1)}L`;
        if (val >= 1000000) return `${settings.currencySymbol}${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${settings.currencySymbol}${(val / 1000).toFixed(0)}K`;
        return `${settings.currencySymbol}${val}`;
    };

    const getExpectedSubPath = () => {
        let template = settings.scaffoldPathTemplate || "./{TYPE}/{STATUS}/{NAME}";
        template = template.replace(/^[.\/\\]+/, ''); 

        const safeStr = (str, fallback) => (str ? String(str).replace(/[<>:"|?*]/g, '').trim() : fallback);

        return template
            .replace(/\{\{?TYPE\}\}?/ig, safeStr(project?.type, 'Uncategorized'))
            .replace(/\{\{?STATUS\}\}?/ig, safeStr(project?.status, 'Active'))
            .replace(/\{\{?CODE\}\}?/ig, safeStr(project?.code, 'NOCODE'))
            .replace(/\{\{?NAME\}\}?/ig, safeStr(project?.name, 'Untitled Project'))
            .replace(/\{\{?CLIENT\}\}?/ig, safeStr(project?.clientName, 'No Client'));
    };

    const handleScaffold = async () => {
        if (!settings.scaffoldRoot) return alert("Please configure the Scaffold Root in Company Settings first.");
        if (!window.api?.os?.scaffoldProject) return alert("Scaffolding is only supported on the Desktop Host App.");

        const subPath = getExpectedSubPath();
        
        let folders = settings.templateFolders || [];
        if (typeof folders === 'string') folders = folders.split(',').map(f => f.trim());

        try {
            const res = await window.api.os.scaffoldProject({
                root: settings.scaffoldRoot,
                subPath: subPath,
                folders: folders.join(',') 
            });

            if (res.success) {
                // 🔥 FIXED: Sent sequentially to match ProjectWorkspace requirements
                await updateProject('isScaffolded', 1);
                await updateProject('isManuallyLinked', 0);
                await updateProject('scaffoldPath', res.path); 
                alert(res.exists ? "Linked to existing directory successfully!" : "Workspace scaffolded successfully!");
            } else {
                alert("Failed to scaffold: " + res.error);
            }
        } catch(err) {
            alert("Error: " + err.message);
        }
    };

    const handleLinkExisting = async () => {
        if (!window.api?.os?.pickDirectory) return alert("File system access is only supported on the Desktop Host App.");
        
        const path = await window.api.os.pickDirectory();
        if (path) {
            // 🔥 FIXED: Sent sequentially
            await updateProject('isScaffolded', 1);
            await updateProject('isManuallyLinked', 1);
            await updateProject('scaffoldPath', path);
            alert("Successfully linked to the existing folder!");
        }
    };

    const handleUnlinkScaffold = async () => {
        if (window.confirm("Unlink this workspace from its host folder?\n\nYour actual files will NOT be deleted, but OpenPrix will disconnect from the folder until you scaffold/link it again.")) {
            // 🔥 FIXED: Sent sequentially
            await updateProject('isScaffolded', 0);
            await updateProject('isManuallyLinked', 0);
            await updateProject('scaffoldPath', null);
        }
    };

    const handleMetadataBlur = async () => {
        if (!project?.isScaffolded || !project?.scaffoldPath || !settings.scaffoldRoot || project?.isManuallyLinked) return;
        if (!window.api?.os?.renameProjectFolder) return;

        const expectedSubPath = getExpectedSubPath();
        
        const res = await window.api.os.renameProjectFolder({
            root: settings.scaffoldRoot,
            oldPath: project.scaffoldPath, 
            newSubPath: expectedSubPath 
        });

        if (res.success) {
            // 🔥 FIXED: Sequential argument format
            await updateProject('scaffoldPath', res.newPath);
        }
    };

    const clientList = (crmContacts || []).filter(c => c.type === 'Client');
    const contractorList = (crmContacts || []).filter(c => c.type === 'Subcontractor' || c.type === 'Supplier');

    return (
        <Box display="flex" flexDirection="column" gap={4}>

            {/* TIER 1: KPI CARDS */}
            <Grid container spacing={2}>
                {[
                    { label: 'TOTAL CONTRACT', val: formatCurrency(totalAmount), color: '#3b82f6' },
                    { label: 'BILLED TO DATE', val: formatCurrency(totalBilled), color: '#10b981' },
                    { label: 'INFLATION RISK', val: `+${formatCurrency(inflationRisk)}`, color: '#ef4444', icon: <ReportProblemIcon fontSize="small" /> },
                    { label: 'PENDING TASKS', val: `${activeTasks} Items`, color: '#f59e0b' },
                    { label: 'GRNs LOGGED', val: `${totalGrns} Inward`, color: '#8b5cf6' }
                ].map((kpi, i) => (
                    <Grid item xs={12} sm={6} md={2.4} key={i}>
                        <Paper elevation={0} sx={{ 
                            p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', 
                            bgcolor: 'rgba(13, 31, 60, 0.5)', borderTop: `4px solid ${kpi.color}`,
                            height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center'
                        }}>
                            <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: 'text.secondary' }}>{kpi.label}</Typography>
                            <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1, display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1.1rem', md: '1.25rem' }, color: kpi.color === '#ef4444' || kpi.color === '#10b981' || kpi.color === '#f59e0b' ? kpi.color : 'inherit' }}>
                                {kpi.icon} {kpi.val}
                            </Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* TIER 2: TIMELINE CARDS */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.3)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'primary.main' }}>PROJECT SCHEDULE TRACKING</Typography>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} sm={6} md={3}>
                        <Box display="flex" alignItems="center" gap={2}>
                            <CalendarTodayIcon color="primary" />
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>START_DATE</Typography>
                                <Typography variant="body1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>{timelineMetrics.start}</Typography>
                            </Box>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Box display="flex" alignItems="center" gap={2}>
                            <AccessTimeIcon color="secondary" />
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>EST_COMPLETION</Typography>
                                <Typography variant="body1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>{timelineMetrics.end}</Typography>
                            </Box>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Box>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                                <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>ELAPSED: <strong style={{ color: '#fff' }}>{timelineMetrics.elapsed} Days</strong></Typography>
                                <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>REMAINING: <strong style={{ color: '#f59e0b' }}>{timelineMetrics.remaining} Days</strong></Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={timelineMetrics.percent} sx={{ height: 8, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.1)' }} />
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* TIER 3: PROJECT METADATA FORM */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box display="flex" flexDirection={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} gap={2} mb={3}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>PROJECT CORE METADATA</Typography>
                    
                    <Box sx={{ width: { xs: '100%', lg: 'auto' }, display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap' }}>
                        
                        {project?.isScaffolded ? (
                            <Box display="flex" gap={1} width={{ xs: '100%', sm: 'auto' }}>
                                <Button
                                    variant="outlined"
                                    color="info"
                                    onClick={() => window.api.os.openFile(project.scaffoldPath)}
                                    fullWidth
                                    startIcon={<FolderOpenIcon />}
                                    sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', borderRadius: 50, whiteSpace: 'nowrap' }}
                                >
                                    OPEN DIRECTORY
                                </Button>
                                <Tooltip title="Unlink Directory">
                                    <IconButton 
                                        color="error" 
                                        onClick={handleUnlinkScaffold} 
                                        sx={{ border: '1px solid', borderColor: 'error.dark', borderRadius: 50, px: 2 }}
                                    >
                                        <LinkOffIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ) : (
                            <Box display="flex" gap={1} width={{ xs: '100%', sm: 'auto' }} flexDirection={{ xs: 'column', sm: 'row' }}>
                                <Button
                                    variant="outlined"
                                    color="info"
                                    onClick={handleLinkExisting}
                                    fullWidth={{ xs: true, sm: false }}
                                    startIcon={<LinkIcon />}
                                    sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', borderRadius: 50, whiteSpace: 'nowrap' }}
                                >
                                    LINK FOLDER
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handleScaffold}
                                    fullWidth={{ xs: true, sm: false }}
                                    startIcon={<CreateNewFolderIcon />}
                                    sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', borderRadius: 50, whiteSpace: 'nowrap' }}
                                >
                                    SCAFFOLD FOLDERS
                                </Button>
                            </Box>
                        )}

                        <Button
                            variant={project?.isPriceLocked ? "outlined" : "contained"}
                            color={project?.isPriceLocked ? "success" : "warning"}
                            onClick={togglePriceLock}
                            fullWidth={{ xs: true, sm: false }}
                            startIcon={project?.isPriceLocked ? <LockIcon /> : <LockOpenIcon />}
                            sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', borderRadius: 50, whiteSpace: 'nowrap' }}
                        >
                            {project?.isPriceLocked ? "PRICING LOCKED" : "LOCK PRICING"}
                        </Button>
                    </Box>
                </Box>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <TextField fullWidth label="PROJECT NAME" value={project?.name || ''} onChange={(e) => handleChange('name', e.target.value)} onBlur={handleMetadataBlur} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 'bold' } }} disabled={!hasClearance(4)} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField fullWidth label="PROJECT CODE" value={project?.code || ''} onChange={(e) => handleChange('code', e.target.value)} onBlur={handleMetadataBlur} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} disabled={!hasClearance(4)} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField fullWidth label="PROJECT TYPE" value={project?.type || ''} placeholder="e.g. Residential, Hospital" onChange={(e) => handleChange('type', e.target.value)} onBlur={handleMetadataBlur} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} disabled={!hasClearance(4)} />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField select fullWidth label="CLIENT NAME" value={project?.clientName || ''} onChange={(e) => handleChange('clientName', e.target.value)} onBlur={handleMetadataBlur} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} disabled={!hasClearance(4)}>
                            <MenuItem value="" sx={{ fontStyle: 'italic', fontFamily: "'JetBrains Mono', monospace" }}>-- No Client Assigned --</MenuItem>
                            {clientList.map(c => (
                                <MenuItem key={c.id} value={c.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.name}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    {/* 🔥 FIXED: Maps directly to the existing "pmc" column */}
                    <Grid item xs={12} md={6}>
                        <TextField select fullWidth label="PRIMARY CONTRACTOR" value={project?.pmc || ''} onChange={(e) => handleChange('pmc', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} disabled={!hasClearance(4)}>
                            <MenuItem value="" sx={{ fontStyle: 'italic', fontFamily: "'JetBrains Mono', monospace" }}>-- Open / Self-Executed --</MenuItem>
                            {contractorList.map(c => (
                                <MenuItem key={c.id} value={c.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.name}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField fullWidth label="LOCATION / SITE" value={project?.location || ''} onChange={(e) => handleChange('location', e.target.value)} onBlur={handleMetadataBlur} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} disabled={!hasClearance(4)} />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField fullWidth select label="REGION / COST ZONE" value={project?.region || ''} onChange={(e) => handleChange('region', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} disabled={!hasClearance(4)}>
                            <MenuItem value="">-- Auto-Detect First Rate --</MenuItem>
                            {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <TextField fullWidth select label="PROJECT STATUS" value={project?.status || ''} onChange={(e) => handleChange('status', e.target.value)} onBlur={handleMetadataBlur} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} disabled={!hasClearance(4)}>
                            {['Draft', 'Planning', 'Active', 'On Hold', 'Completed'].map(s => <MenuItem key={s} value={s} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{s}</MenuItem>)}
                        </TextField>
                    </Grid>
                </Grid>
            </Paper>

            {/* TIER 4: PROJECT TEAM ROSTER */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', mb: 3 }}>PROJECT TEAM ROSTER</Typography>
                <Grid container spacing={3}>
                    {hasClearance(4) && (
                        <Grid item xs={12}>
                            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'center' }} p={2} sx={{ border: '1px dashed', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'rgba(59, 130, 246, 0.05)' }}>
                                <TextField select fullWidth size="small" label="Select Staff Member to Assign" value={selectedNewMember} onChange={(e) => setSelectedNewMember(e.target.value)} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }}>
                                    {availableStaff.length === 0 && <MenuItem disabled value="" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontStyle: 'italic' }}>No available staff to assign.</MenuItem>}
                                    {availableStaff.map((staff) => <MenuItem key={staff.id} value={staff.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{staff.name} — {staff.designation}</MenuItem>)}
                                </TextField>
                                <Button variant="contained" color="primary" disableElevation startIcon={<PersonAddIcon />} onClick={handleAddMember} disabled={!selectedNewMember} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', whiteSpace: 'nowrap', height: '40px', px: 3 }}>ASSIGN</Button>
                            </Box>
                        </Grid>
                    )}
                    <Grid item xs={12}>
                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)', overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: 500 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.4)', width: '40%' }}>MEMBER_NAME</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.4)' }}>OFFICIAL_DESIGNATION</TableCell>
                                        {hasClearance(4) && <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.4)', width: '20%' }}>ACTION</TableCell>}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {assignedIds.length === 0 && <TableRow><TableCell colSpan={hasClearance(4) ? 3 : 2} align="center" sx={{ py: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>No personnel currently assigned to this workspace.</TableCell></TableRow>}
                                    {assignedIds.map(id => {
                                        const staff = orgStaff?.find(s => s.id === id);
                                        if (!staff) return null;
                                        return (
                                            <TableRow key={id} hover sx={{ '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold' }}>{staff.name}</TableCell>
                                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary' }}>{staff.designation || 'Staff'}</TableCell>
                                                {hasClearance(4) && <TableCell align="right"><IconButton size="small" color="error" onClick={() => handleRemoveStaff(id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>
                </Grid>
            </Paper>

            {/* TIER 5: ADVANCED ANALYTICS DASHBOARD */}
            <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)' }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>PROJECT S-CURVE (CUMULATIVE PLANNED VS. ACTUAL)</Typography>
                        <Box sx={{ width: '100%', minHeight: 350 }}>
                            {timeSeriesData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={350}>
                                    <AreaChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                                        <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} tickFormatter={formatYAxis} width={60} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(13,31,60,0.9)', borderColor: '#3b82f6', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }} formatter={(val) => formatCurrency(val)} />
                                        <Legend wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }} />
                                        <Area type="monotone" dataKey="CumulativeActual" name="Actual Progress" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
                                        <Line type="monotone" dataKey="CumulativePlanned" name="Baseline" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" height={350} alignItems="center" justifyContent="center"><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '12px' }}>NOT ENOUGH DATA TO PLOT S-CURVE</Typography></Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12} lg={4}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)' }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={1} sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>BUDGET DISTRIBUTION BY PHASE</Typography>
                        <Box sx={{ width: '100%', minHeight: 350 }}>
                            {costByPhaseData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={350}>
                                    <PieChart>
                                        <Pie data={costByPhaseData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value" stroke="none">
                                            {costByPhaseData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(13,31,60,0.9)', borderColor: '#3b82f6', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }} formatter={(val) => formatCurrency(val)} />
                                        <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" height={350} alignItems="center" justifyContent="center"><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '12px' }}>ADD BOQ ITEMS TO SEE DISTRIBUTION</Typography></Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                <Grid item xs={12}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)' }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>MONTHLY REVENUE / CASH FLOW</Typography>
                        <Box sx={{ width: '100%', minHeight: 350 }}>
                            {timeSeriesData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                                        <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} tickFormatter={formatYAxis} width={60} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(13,31,60,0.9)', borderColor: '#3b82f6', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(val) => formatCurrency(val)} />
                                        <Legend wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }} />
                                        <Bar dataKey="MonthlyBilled" name="Actual Revenue (Billed)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box display="flex" height={350} alignItems="center" justifyContent="center"><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '12px' }}>NO CASH FLOW DATA TO DISPLAY</Typography></Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

        </Box>
    );
}