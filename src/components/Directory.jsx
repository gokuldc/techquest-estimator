import React, { useState, useMemo, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, Tabs, Tab, Grid, Avatar, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Chip, TextField, IconButton, Dialog, DialogTitle, 
    DialogContent, DialogActions, MenuItem
} from '@mui/material';

// Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BadgeIcon from '@mui/icons-material/Badge';
import EngineeringIcon from '@mui/icons-material/Engineering';
import GroupsIcon from '@mui/icons-material/Groups';
import ApartmentIcon from '@mui/icons-material/Apartment';

export default function Directory({ onBack }) {
    const [tab, setTab] = useState('crm');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editId, setEditId] = useState(null);

    // 🔥 SQLite State
    const [crmContacts, setCrmContacts] = useState([]);
    const [orgStaff, setOrgStaff] = useState([]);

    const loadData = async () => {
        try {
            const [contacts, staff] = await Promise.all([
                window.api.db.getCrmContacts(),
                window.api.db.getOrgStaff()
            ]);
            // Sort by newest first
            setCrmContacts((contacts || []).sort((a, b) => b.createdAt - a.createdAt));
            setOrgStaff((staff || []).sort((a, b) => b.createdAt - a.createdAt));
        } catch (error) {
            console.error("Failed to load directory data:", error);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // --- KPI CALCULATIONS ---
    const stats = useMemo(() => {
        const ext = crmContacts.length;
        const int = orgStaff.length;
        const subs = crmContacts.filter(c => c.type === 'Subcontractor' || c.type === 'Supplier').length;
        const clients = crmContacts.filter(c => c.type === 'Client' || c.type === 'Lead').length;
        return { ext, int, subs, clients };
    }, [crmContacts, orgStaff]);

    const [formData, setFormData] = useState({});

    const handleOpenDialog = (item = null) => {
        if (item) {
            setEditId(item.id);
            setFormData(item);
        } else {
            setEditId(null);
            setFormData(tab === 'crm' 
                ? { name: "", company: "", type: "Client", status: "Active", email: "", phone: "" }
                : { name: "", designation: "", department: "Operations", status: "Active", email: "", phone: "" }
            );
        }
        setIsDialogOpen(true);
    };

    // 🔥 Updated Save Logic
    const handleSave = async () => {
        if (!formData.name) return;
        const payload = { ...formData, id: editId || crypto.randomUUID(), createdAt: formData.createdAt || Date.now() };
        
        if (tab === 'crm') {
            await window.api.db.saveCrmContact(payload);
        } else {
            await window.api.db.saveOrgStaff(payload);
        }
        
        loadData();
        setIsDialogOpen(false);
    };

    // 🔥 Updated Delete Logic
    const handleDelete = async (id) => {
        if (!window.confirm("CRITICAL: Delete this record permanently?")) return;
        
        if (tab === 'crm') {
            await window.api.db.deleteCrmContact(id);
        } else {
            await window.api.db.deleteOrgStaff(id);
        }
        loadData();
    };

    const MetricCard = ({ title, value, icon, color }) => (
        <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: `${color}.main`, width: 42, height: 42 }}>{icon}</Avatar>
            <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>{title}</Typography>
                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>{value}</Typography>
            </Box>
        </Paper>
    );

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            
            {/* --- NEXUS HEADER (PILL BUTTONS & REDUCED TITLE) --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Button 
                        startIcon={<ArrowBackIcon />} 
                        onClick={onBack} 
                        variant="outlined" 
                        sx={{ 
                            borderRadius: 50, // PILL SHAPE
                            fontFamily: "'JetBrains Mono', monospace", 
                            letterSpacing: '1px', 
                            fontSize: '11px', 
                            borderColor: 'divider', 
                            color: 'text.secondary', 
                            px: 3,
                            '&:hover': { borderColor: 'primary.main', color: 'primary.main' } 
                        }}
                    >
                        {'< '}BACK
                    </Button>
                    <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        DIRECTORY: <span style={{ color: '#3b82f6' }}>SYSTEM_ROOT</span>
                    </Typography>
                </Box>

                <Button 
                    variant="contained" 
                    color="primary" 
                    disableElevation
                    startIcon={<AddCircleOutlineIcon />} 
                    onClick={() => handleOpenDialog()}
                    sx={{ 
                        borderRadius: 50, // PILL SHAPE
                        fontFamily: "'JetBrains Mono', monospace", 
                        fontSize: '11px', 
                        letterSpacing: '1px', 
                        height: '36px',
                        px: 4
                    }}
                >
                    NEW_ENTRY
                </Button>
            </Box>

            {/* KPI STRIP */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={6} md={3}><MetricCard title="EXTERNAL_CRM" value={stats.ext} icon={<ApartmentIcon />} color="info" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="INTERNAL_ORG" value={stats.int} icon={<BadgeIcon />} color="secondary" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="SUPPLY_CHAIN" value={stats.subs} icon={<EngineeringIcon />} color="warning" /></Grid>
                <Grid item xs={6} md={3}><MetricCard title="ACTIVE_CLIENTS" value={stats.clients} icon={<GroupsIcon />} color="success" /></Grid>
            </Grid>

            {/* TABS NAVIGATION */}
            <Paper sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Tabs 
                    value={tab} 
                    onChange={(e, v) => setTab(v)} 
                    indicatorColor="primary" 
                    textColor="primary" 
                    variant="scrollable" 
                    scrollButtons="auto"
                >
                    <Tab value="crm" label="01_EXTERNAL_CRM" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="org" label="02_INTERNAL_ORG" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                </Tabs>
            </Paper>

            {/* DATA TABLE */}
            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                        <TableRow>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px' }}>IDENTITY</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px' }}>{tab === 'crm' ? 'ENTITY_COMPANY' : 'ROLE_DESIGNATION'}</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px' }}>{tab === 'crm' ? 'TYPE' : 'DEPT'}</TableCell>
                            <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px' }}>ACTIONS</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(tab === 'crm' ? crmContacts : orgStaff).map((item) => (
                            <TableRow key={item.id} hover sx={{ '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                                <TableCell>
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <Avatar sx={{ width: 28, height: 28, fontSize: '11px', bgcolor: 'primary.dark', fontFamily: "'JetBrains Mono', monospace" }}>{item.name?.charAt(0)}</Avatar>
                                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold' }}>{item.name}</Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary' }}>{tab === 'crm' ? item.company : item.designation}</TableCell>
                                <TableCell>
                                    <Chip label={tab === 'crm' ? item.type : item.department} size="small" variant="outlined" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', borderRadius: 1 }} />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" color="primary" onClick={() => handleOpenDialog(item)}><EditIcon sx={{ fontSize: 18 }} /></IconButton>
                                    <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* ENTRY DIALOG */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>{editId ? 'UPDATE_RECORD' : 'INITIALIZE_NEW_RECORD'}</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', pt: 3 }}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}><TextField fullWidth label="LEGAL_NAME" value={formData.name || ""} onChange={e => setFormData({...formData, name: e.target.value})} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} /></Grid>
                        {tab === 'crm' ? (
                            <>
                                <Grid item xs={12} md={6}><TextField fullWidth label="COMPANY_ENTITY" value={formData.company || ""} onChange={e => setFormData({...formData, company: e.target.value})} /></Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField select fullWidth label="CLASSIFICATION" value={formData.type || ""} onChange={e => setFormData({...formData, type: e.target.value})}>
                                        {['Client', 'Lead', 'Consultant', 'Subcontractor', 'Supplier'].map(opt => <MenuItem key={opt} value={opt} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{opt.toUpperCase()}</MenuItem>)}
                                    </TextField>
                                </Grid>
                            </>
                        ) : (
                            <>
                                <Grid item xs={12} md={6}><TextField fullWidth label="OFFICIAL_DESIGNATION" value={formData.designation || ""} onChange={e => setFormData({...formData, designation: e.target.value})} /></Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField select fullWidth label="DEPT_ASSIGNMENT" value={formData.department || ""} onChange={e => setFormData({...formData, department: e.target.value})}>
                                        {['Operations', 'Design', 'Finance', 'Management', 'Site Logistics'].map(opt => <MenuItem key={opt} value={opt} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{opt.toUpperCase()}</MenuItem>)}
                                    </TextField>
                                </Grid>
                            </>
                        )}
                        <Grid item xs={12} md={6}><TextField fullWidth label="EMAIL_ADDRESS" value={formData.email || ""} onChange={e => setFormData({...formData, email: e.target.value})} /></Grid>
                        <Grid item xs={12} md={6}><TextField fullWidth label="PHONE_NUMBER" value={formData.phone || ""} onChange={e => setFormData({...formData, phone: e.target.value})} /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsDialogOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={handleSave} sx={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: 50, px: 3 }}>COMMIT_RECORD</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}