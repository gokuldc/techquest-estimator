import React, { useMemo } from 'react';
import { Box, Typography, Paper, Grid, TextField, MenuItem, Button, Chip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';

// 🔥 1. Import the new Settings Hook
import { useSettings } from '../../context/SettingsContext';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function ProjectDetailsTab({ project, updateProject, regions, resources, totalAmount, projectBoqItems, togglePriceLock, crmContacts, orgStaff }) {

    // 🔥 2. Grab the format function and raw settings from the "Radio Tower"
    const { formatCurrency, settings } = useSettings();

    // --- 1. KPI DATA AGGREGATION ---
    const totalBilled = Array.isArray(project?.raBills) ? project.raBills.reduce((sum, bill) => sum + Number(bill.subTotal || 0), 0) : 0;
    const activeTasks = Array.isArray(project?.ganttTasks) ? project.ganttTasks.filter(t => t.status !== 'Completed').length : 0;
    const totalGrns = Array.isArray(project?.grns) ? project.grns.length : 0;

    // INFLATION RISK ENGINE
    const inflationRisk = useMemo(() => {
        let totalExposure = 0;
        (projectBoqItems || []).forEach(item => {
            const res = resources?.find(r => r.code === item.itemCode);
            if (res && Array.isArray(res.rateHistory) && res.rateHistory.length > 0) {
                const sortedHistory = [...res.rateHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
                const currentMarketRate = Number(sortedHistory[0].rate || 0);
                const budgetedRate = Number(item.rate || 0);

                if (currentMarketRate > budgetedRate) {
                    const priceDiff = currentMarketRate - budgetedRate;
                    const totalQty = Number(item.computedQty || 0);
                    totalExposure += (priceDiff * totalQty);
                }
            }
        });
        return totalExposure;
    }, [projectBoqItems, resources]);

    // --- 2. COST BREAKDOWN BY PHASE (PIE CHART) ---
    const costByPhaseData = useMemo(() => {
        const phases = {};
        (projectBoqItems || []).forEach(item => {
            const phase = item.phase || "General";
            phases[phase] = (phases[phase] || 0) + Number(item.amount || 0);
        });
        return Object.entries(phases)
            .map(([name, value]) => ({ name: name.toUpperCase(), value }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [projectBoqItems]);

    // --- 3. TIME SERIES ENGINE (S-CURVE & CASH FLOW) ---
    const timeSeriesData = useMemo(() => {
        const months = {};

        const getMonthKey = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            if (isNaN(d)) return null;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

        const bills = Array.isArray(project?.raBills) ? project.raBills : [];
        bills.forEach(bill => {
            const key = getMonthKey(bill.date);
            if (key) {
                if (!months[key]) months[key] = { name: key, planned: 0, actual: 0 };
                months[key].actual += Number(bill.subTotal || 0);
            }
        });

        const tasks = Array.isArray(project?.ganttTasks) ? project.ganttTasks : [];
        tasks.forEach(task => {
            const key = getMonthKey(task.createdAt || task.actualStart || project.createdAt);
            if (key) {
                if (!months[key]) months[key] = { name: key, planned: 0, actual: 0 };
                months[key].planned += (totalAmount / (tasks.length || 1));
            }
        });

        let cumulativePlanned = 0;
        let cumulativeActual = 0;

        return Object.values(months).sort((a, b) => a.name.localeCompare(b.name)).map(month => {
            cumulativePlanned += month.planned;
            cumulativeActual += month.actual;
            return {
                name: month.name,
                MonthlyBilled: month.actual,
                MonthlyPlanned: month.planned,
                CumulativePlanned: cumulativePlanned,
                CumulativeActual: cumulativeActual
            };
        });
    }, [project, totalAmount]);

    const handleChange = (field, value) => {
        updateProject(field, value);
    };

    // 🔥 3. SMART AXIS FORMATTER (Converts to Lakhs for India, K/M for Western)
    const formatYAxis = (val) => {
        if (settings.currencyLocale === 'en-IN') {
            return `${settings.currencySymbol}${(val / 100000).toFixed(1)}L`; // Lakhs formatting
        } else {
            if (val >= 1000000) return `${settings.currencySymbol}${(val / 1000000).toFixed(1)}M`; // Millions
            if (val >= 1000) return `${settings.currencySymbol}${(val / 1000).toFixed(1)}K`; // Thousands
            return `${settings.currencySymbol}${val}`;
        }
    };

    return (
        <Box display="flex" flexDirection="column" gap={4}>

            {/* TIER 1: KPI CARDS */}
            <Grid container spacing={2}>
                <Grid item xs={12} md={2.4}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', borderTop: '4px solid #3b82f6' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>TOTAL CONTRACT</Typography>
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* 🔥 Replaced Hardcoded Math */}
                            {formatCurrency(totalAmount)}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={2.4}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', borderTop: '4px solid #10b981' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>BILLED TO DATE</Typography>
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
                            {/* 🔥 Replaced Hardcoded Math */}
                            {formatCurrency(totalBilled)}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={2.4}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(239, 68, 68, 0.05)', borderTop: '4px solid #ef4444' }}>
                        <Typography variant="caption" color="error.main" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>INFLATION RISK</Typography>
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                            {/* 🔥 Replaced Hardcoded Math */}
                            <ReportProblemIcon fontSize="small" /> +{formatCurrency(inflationRisk)}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={2.4}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', borderTop: '4px solid #f59e0b' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>PENDING TASKS</Typography>
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
                            {activeTasks} Tasks
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={2.4}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', borderTop: '4px solid #8b5cf6' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>GRNs LOGGED</Typography>
                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'info.main' }}>
                            {totalGrns} Inward
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* TIER 2: PROJECT METADATA FORM */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>PROJECT CORE METADATA</Typography>
                    <Box display="flex" gap={2}>
                        <Button
                            variant={project?.isPriceLocked ? "outlined" : "contained"}
                            color={project?.isPriceLocked ? "success" : "warning"}
                            onClick={togglePriceLock}
                            startIcon={project?.isPriceLocked ? <LockIcon /> : <LockOpenIcon />}
                            sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', borderRadius: 50 }}
                        >
                            {project?.isPriceLocked ? "PRICING LOCKED (SAFE)" : "LOCK PROJECT PRICING"}
                        </Button>
                    </Box>
                </Box>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <TextField fullWidth label="PROJECT NAME" value={project?.name || ''} onChange={(e) => handleChange('name', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 'bold' } }} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField fullWidth label="PROJECT CODE" value={project?.code || ''} onChange={(e) => handleChange('code', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField fullWidth select label="REGION / COST ZONE" value={project?.region || ''} onChange={(e) => handleChange('region', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}>
                            {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField fullWidth label="CLIENT NAME" value={project?.clientName || ''} onChange={(e) => handleChange('clientName', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField fullWidth select label="PROJECT STATUS" value={project?.status || ''} onChange={(e) => handleChange('status', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}>
                            {['Planning', 'Active', 'On Hold', 'Completed'].map(s => <MenuItem key={s} value={s} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{s}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField fullWidth select label="PROJECT LEAD" value={project?.projectLead || ''} onChange={(e) => handleChange('projectLead', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}>
                            <MenuItem value="">Unassigned</MenuItem>
                            {orgStaff.map(s => <MenuItem key={s.id} value={s.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField fullWidth select label="SITE SUPERVISOR" value={project?.siteSupervisor || ''} onChange={(e) => handleChange('siteSupervisor', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}>
                            <MenuItem value="">Unassigned</MenuItem>
                            {orgStaff.map(s => <MenuItem key={s.id} value={s.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField fullWidth select label="ARCHITECT" value={project?.architect || ''} onChange={(e) => handleChange('architect', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}>
                            <MenuItem value="">Unassigned</MenuItem>
                            {crmContacts.filter(c => c.type === 'Architect').map(c => <MenuItem key={c.id} value={c.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField fullWidth select label="STRUCTURAL ENGINEER" value={project?.structuralEngineer || ''} onChange={(e) => handleChange('structuralEngineer', e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}>
                            <MenuItem value="">Unassigned</MenuItem>
                            {crmContacts.filter(c => c.type === 'Consultant' || c.type === 'Architect').map(c => <MenuItem key={c.id} value={c.name} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.name}</MenuItem>)}
                        </TextField>
                    </Grid>
                </Grid>
            </Paper>

            {/* TIER 3: ADVANCED ANALYTICS DASHBOARD */}
            <Grid container spacing={3}>

                {/* THE S-CURVE */}
                <Grid item xs={12} md={8}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)', height: 400 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>
                            PROJECT S-CURVE (CUMULATIVE PLANNED VS. ACTUAL)
                        </Typography>
                        {timeSeriesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="85%">
                                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} />

                                    {/* 🔥 Replaced Hardcoded ₹ and L with Smart Formatter */}
                                    <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} tickFormatter={formatYAxis} />

                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(13,31,60,0.9)', borderColor: '#3b82f6', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                                        formatter={(val) => formatCurrency(val)} // 🔥 Passed through formatCurrency
                                    />
                                    <Legend wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }} />
                                    <Area type="monotone" dataKey="CumulativeActual" name="Actual Progress (Billed)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
                                    <Line type="monotone" dataKey="CumulativePlanned" name="Baseline (Planned)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <Box display="flex" height="100%" alignItems="center" justifyContent="center">
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '12px' }}>NOT ENOUGH DATA TO PLOT S-CURVE</Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* COST BREAKDOWN BY PHASE */}
                <Grid item xs={12} md={4}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)', height: 400 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={1} sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>
                            BUDGET DISTRIBUTION BY PHASE
                        </Typography>
                        {costByPhaseData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="90%">
                                <PieChart>
                                    <Pie data={costByPhaseData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value" stroke="none">
                                        {costByPhaseData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(13,31,60,0.9)', borderColor: '#3b82f6', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                                        formatter={(val) => formatCurrency(val)} // 🔥 Passed through formatCurrency
                                    />
                                    <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <Box display="flex" height="100%" alignItems="center" justifyContent="center">
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '12px' }}>ADD BOQ ITEMS TO SEE DISTRIBUTION</Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* MONTHLY CASH FLOW (BAR CHART) */}
                <Grid item xs={12}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)', height: 350 }}>
                        <Typography variant="subtitle2" fontWeight="bold" mb={3} sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>
                            MONTHLY REVENUE / CASH FLOW
                        </Typography>
                        {timeSeriesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="85%">
                                <BarChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} />

                                    {/* 🔥 Replaced Hardcoded ₹ and L with Smart Formatter */}
                                    <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} tickFormatter={formatYAxis} />

                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(13,31,60,0.9)', borderColor: '#3b82f6', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        formatter={(val) => formatCurrency(val)} // 🔥 Passed through formatCurrency
                                    />
                                    <Legend wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }} />
                                    <Bar dataKey="MonthlyBilled" name="Actual Revenue (Billed)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <Box display="flex" height="100%" alignItems="center" justifyContent="center">
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '12px' }}>NO CASH FLOW DATA TO DISPLAY</Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

        </Box>
    );
}