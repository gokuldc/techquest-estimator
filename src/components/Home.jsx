import { useState, useEffect, useMemo } from "react";
import {
    Box, Typography, Paper, Grid, Avatar,
    useTheme, Divider, Chip, Stack, alpha
} from "@mui/material";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Radar, RadarChart,
    PolarGrid, PolarAngleAxis, Legend
} from 'recharts';

// Icons
import BusinessIcon from '@mui/icons-material/Business';
import BadgeIcon from '@mui/icons-material/Badge';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import CategoryIcon from '@mui/icons-material/Category';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import HandymanIcon from '@mui/icons-material/Handyman';
import EngineeringIcon from '@mui/icons-material/Engineering';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';

import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

export default function Home() {
    const theme = useTheme();
    const { currentUser } = useAuth();
    const { settings } = useSettings();

    const [brandName, setBrandName] = useState("");
    const [brandLogo, setBrandLogo] = useState("");

    const [projects, setProjects] = useState([]);
    const [resources, setResources] = useState([]);
    const [masterBoqs, setMasterBoqs] = useState([]);
    const [regions, setRegions] = useState([]);
    const [crmContacts, setCrmContacts] = useState([]);
    const [orgStaff, setOrgStaff] = useState([]);

    const loadData = async () => {
        try {
            const [projData, resData, boqData, regData, contactData, staffData] = await Promise.all([
                window.api.db.getProjects(), window.api.db.getResources(), window.api.db.getMasterBoqs(),
                window.api.db.getRegions(), window.api.db.getCrmContacts(), window.api.db.getOrgStaff()
            ]);
            setProjects(projData || []);
            setResources(resData || []);
            setMasterBoqs(boqData || []);
            setRegions(regData || []);
            setCrmContacts(contactData || []);
            setOrgStaff(staffData || []);
        } catch (error) { console.error(error); }
    };

    const loadBranding = async () => {
        if (window.api.db.getSettings) {
            const dbSettings = await window.api.db.getSettings('company_info');
            if (dbSettings) {
                setBrandName(dbSettings.name || settings?.name || "");
                setBrandLogo(dbSettings.logo || settings?.logo || "");
            }
        }
    };

    useEffect(() => { loadData(); loadBranding(); }, [settings]);

    const statsData = useMemo(() => {
        const activeCount = projects.filter(p => p.status === 'Active' || p.status === 'In Progress').length;
        const staffLoad = activeCount > 0 ? (orgStaff.length / activeCount).toFixed(1) : 0;

        const crm = { Client: 0, Supplier: 0, Lead: 0, Consultant: 0 };
        crmContacts.forEach(c => {
            const t = c.type || 'Lead';
            if (crm[t] !== undefined) crm[t]++;
            else crm['Lead']++;
        });

        const typeCounts = {};
        projects.forEach(p => { const t = p.type || 'General'; typeCounts[t] = (typeCounts[t] || 0) + 1; });

        const statusCounts = { Active: 0, Completed: 0, Draft: 0 };
        projects.forEach(p => {
            if (p.status === 'In Progress' || p.status === 'Active') statusCounts.Active++;
            else if (p.status === 'Completed') statusCounts.Completed++;
            else statusCounts.Draft++;
        });

        return { activeCount, staffLoad, typeCounts, statusCounts, crm };
    }, [projects, orgStaff, crmContacts]);

    const projectStatusData = useMemo(() => Object.entries(statsData.statusCounts).map(([name, value]) => ({ name, value })), [statsData.statusCounts]);
    const staffDeptData = useMemo(() => {
        const depts = {};
        orgStaff.forEach(s => { const d = s.department || 'Other'; depts[d] = (depts[d] || 0) + 1; });
        return Object.entries(depts).map(([name, count]) => ({ name, count }));
    }, [orgStaff]);

    const networkMixData = useMemo(() => Object.entries(statsData.crm).map(([subject, A]) => ({ subject, A })), [statsData.crm]);

    const CHART_COLORS = [theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main, theme.palette.secondary.main];

    const StatTile = ({ title, value, icon, color }) => (
        <Paper elevation={0} sx={{
            p: 2, borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette[color].main, 0.2),
            bgcolor: alpha(theme.palette[color].main, 0.03), transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 1.5, height: '100%',
            '&:hover': { borderColor: theme.palette[color].main, bgcolor: alpha(theme.palette[color].main, 0.08), transform: 'translateY(-2px)', boxShadow: `0 4px 20px -5px ${alpha(theme.palette[color].main, 0.3)}` }
        }}>
            <Avatar sx={{ bgcolor: alpha(theme.palette[color].main, 0.1), color: theme.palette[color].main, width: 38, height: 38, borderRadius: 1.5 }}>{icon}</Avatar>
            <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="h5" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
                <Typography noWrap variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '8px', letterSpacing: '0.5px' }}>{title}</Typography>
            </Box>
        </Paper>
    );

    const KPICard = ({ title, value, unit, icon, color, subtitle }) => (
        <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.paper, 0.5), height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                    <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontWeight: 'bold', textTransform: 'uppercase' }}>{title}</Typography>
                    <Typography variant="h3" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', mt: 1 }}>
                        {value}<span style={{ fontSize: '16px', marginLeft: '6px', opacity: 0.5 }}>{unit}</span>
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                        <TrendingUpIcon sx={{ fontSize: 14, color: `${color}.main` }} /> {subtitle}
                    </Typography>
                </Box>
                <Avatar sx={{ bgcolor: `${color}.main`, width: 48, height: 48, borderRadius: 2 }}>{icon}</Avatar>
            </Box>
        </Paper>
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflowY: 'auto', p: { xs: 2, md: 4 } }}>
            {/* 🔥 FIXED: Replaced Container with a 100% width Box */}
            <Box sx={{ width: '100%' }}>

                <Box sx={{ mb: 4, pb: 4, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                        {brandLogo ? (
                            <Box component="img" src={brandLogo} sx={{ height: 50, maxWidth: 400, objectFit: 'contain' }} />
                        ) : (
                            <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                                {brandName ? brandName.toUpperCase() : "// OPENPRIX_CORE_NEXUS"}
                            </Typography>
                        )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1 }}>
                        <span style={{ color: '#10b981' }}>●</span> SYSTEM_READY | NODE: <strong>{currentUser?.name?.toUpperCase()}</strong>
                    </Typography>
                </Box>

                <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", opacity: 0.5, letterSpacing: '2px', display: 'block', mb: 1.5 }}>DATABASE_METRICS</Typography>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                    <Grid item xs={6} sm={4} md={2}><StatTile title="Resources" value={resources.length} icon={<HandymanIcon fontSize="small" />} color="info" /></Grid>
                    <Grid item xs={6} sm={4} md={2}><StatTile title="Assemblies" value={masterBoqs.length} icon={<AutoStoriesIcon fontSize="small" />} color="success" /></Grid>
                    <Grid item xs={6} sm={4} md={2}><StatTile title="Clients" value={statsData.crm.Client} icon={<GroupsIcon fontSize="small" />} color="secondary" /></Grid>
                    <Grid item xs={6} sm={4} md={2}><StatTile title="Suppliers" value={statsData.crm.Supplier} icon={<EngineeringIcon fontSize="small" />} color="warning" /></Grid>
                    <Grid item xs={6} sm={4} md={2}><StatTile title="Leads/Consult" value={statsData.crm.Lead + statsData.crm.Consultant} icon={<PersonSearchIcon fontSize="small" />} color="info" /></Grid>
                    <Grid item xs={6} sm={4} md={2}><StatTile title="Staff" value={orgStaff.length} icon={<BadgeIcon fontSize="small" />} color="secondary" /></Grid>
                </Grid>

                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} lg={4}>
                        <KPICard title="Staff Allocation" value={statsData.staffLoad} unit="Staff/Proj" color="info" icon={<GroupWorkIcon />} subtitle="Resource Saturation" />
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <KPICard title="Market Footprint" value={regions.length} unit="Regions" color="secondary" icon={<BusinessIcon />} subtitle="Geographic Spread" />
                    </Grid>
                    <Grid item xs={12} lg={4}>
                        <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'primary.dark', bgcolor: alpha(theme.palette.primary.main, 0.05), height: '100%' }}>
                            <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                                <CategoryIcon color="primary" sx={{ fontSize: 20 }} />
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>PORTFOLIO_MATRIX</Typography>
                            </Box>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Stack spacing={0.5}>
                                        {Object.entries(statsData.statusCounts).map(([status, count]) => (
                                            <Box key={status} display="flex" justifyContent="space-between" sx={{ bgcolor: alpha('#000', 0.2), p: 0.8, borderRadius: 1 }}>
                                                <Typography variant="caption" sx={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace" }}>{status}</Typography>
                                                <Typography variant="caption" fontWeight="bold" color={status === 'Active' ? 'info.main' : 'text.primary'}>{count}</Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Grid>
                                <Grid item xs={6}>
                                    <Stack spacing={0.5}>
                                        {Object.entries(statsData.typeCounts).slice(0, 3).map(([type, count]) => (
                                            <Box key={type} display="flex" justifyContent="space-between">
                                                <Typography noWrap variant="caption" sx={{ fontSize: '9px', opacity: 0.7 }}>{type}</Typography>
                                                <Typography variant="caption" fontWeight="bold" color="primary.light">{count}</Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>
                </Grid>

                {/* CHARTS ROW WITH FIXES */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} lg={4}>
                        <Paper sx={{ p: 3, borderRadius: 3, bgcolor: alpha(theme.palette.background.paper, 0.3), border: '1px solid', borderColor: 'divider', height: 400 }}>
                            <Typography variant="subtitle2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 3, opacity: 0.7 }}>PROJECT_LIFECYCLE</Typography>
                            {/* 🔥 Box wrapper ensures size is always available to ResponsiveContainer */}
                            <Box sx={{ height: 300, width: '100%', minWidth: 0 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie data={projectStatusData} innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value">
                                            {projectStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                        </Pie>
                                        {/* 🔥 Fixed Tooltip styling to avoid React errors */}
                                        <ReTooltip
                                            contentStyle={{ backgroundColor: '#0d1f3c', border: 'none', borderRadius: '8px' }}
                                            itemStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                                        />
                                        <Legend iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} lg={5}>
                        <Paper sx={{ p: 3, borderRadius: 3, bgcolor: alpha(theme.palette.background.paper, 0.3), border: '1px solid', borderColor: 'divider', height: 400 }}>
                            <Typography variant="subtitle2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 3, opacity: 0.7 }}>ORGANIZATIONAL_STRUCTURE</Typography>
                            <Box sx={{ height: 300, width: '100%', minWidth: 0 }}>
                                <ResponsiveContainer>
                                    <BarChart data={staffDeptData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                        <ReTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0d1f3c', border: 'none' }} />
                                        <Bar dataKey="count" fill={theme.palette.primary.main} radius={[6, 6, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} lg={3}>
                        <Paper sx={{ p: 3, borderRadius: 3, bgcolor: alpha(theme.palette.background.paper, 0.3), border: '1px solid', borderColor: 'divider', height: 400 }}>
                            <Typography variant="subtitle2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 3, opacity: 0.7 }}>NETWORK_BALANCE</Typography>
                            <Box sx={{ height: 300, width: '100%', minWidth: 0 }}>
                                <ResponsiveContainer>
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={networkMixData}>
                                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#999', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                                        <Radar name="Count" dataKey="A" stroke={theme.palette.secondary.main} fill={theme.palette.secondary.main} fillOpacity={0.5} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}