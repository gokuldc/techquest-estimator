import React, { useState, useMemo, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, Grid, Avatar,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, TextField, IconButton, Dialog, DialogTitle,
    DialogContent, DialogActions, MenuItem, Divider, Tooltip,
    List, ListItem, ListItemButton, ListItemIcon, ListItemText
} from '@mui/material';

// Icons
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BadgeIcon from '@mui/icons-material/Badge';
import EngineeringIcon from '@mui/icons-material/Engineering';
import GroupsIcon from '@mui/icons-material/Groups';
import ApartmentIcon from '@mui/icons-material/Apartment';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';

// 🔥 Import the Auth Hook
import { useAuth } from '../context/AuthContext';

export default function Directory() {
    const { hasClearance, currentUser } = useAuth();

    // --- SIDEBAR STATE ---
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const SIDEBAR_CLOSED_WIDTH = 68;
    const SIDEBAR_OPEN_WIDTH = 260;

    // Set default tab to Internal Org if they have L4+ clearance, otherwise fallback to CRM
    const [tab, setTab] = useState(hasClearance(4) ? 'org' : 'crm');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editId, setEditId] = useState(null);

    const [crmContacts, setCrmContacts] = useState([]);
    const [orgStaff, setOrgStaff] = useState([]);

    const loadData = async () => {
        try {
            const [contacts, staff] = await Promise.all([
                window.api.db.getCrmContacts(),
                window.api.db.getOrgStaff()
            ]);
            setCrmContacts((contacts || []).sort((a, b) => b.createdAt - a.createdAt));
            setOrgStaff((staff || []).sort((a, b) => b.createdAt - a.createdAt));
        } catch (error) {
            console.error("Failed to load directory data:", error);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

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
                : { name: "", designation: "", department: "Operations", status: "Active", email: "", phone: "", username: "", password: "", accessLevel: 1, role: "Staff" }
            );
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) return;

        // Server-side failsafe
        if (tab === 'org' && !hasClearance(5)) return alert("Access Denied: Level 5 required to modify system access.");

        const payload = {
            ...formData,
            id: editId || crypto.randomUUID(),
            createdAt: formData.createdAt || Date.now(),
            accessLevel: parseInt(formData.accessLevel, 10) || 1
        };

        if (tab === 'crm') {
            await window.api.db.saveCrmContact(payload);
        } else {
            if (payload.username) {
                payload.username = payload.username.trim().toLowerCase().replace(/\s+/g, '');
            }
            await window.api.db.saveOrgStaff(payload);
        }

        loadData();
        setIsDialogOpen(false);
    };

    const handleDelete = async (id) => {
        // Server-side failsafe
        if (tab === 'crm' && !hasClearance(4)) return alert("Access Denied: Level 4 required to delete CRM contacts.");
        if (tab === 'org' && !hasClearance(5)) return alert("Access Denied: Level 5 required to delete Org Staff.");

        if (!window.confirm("CRITICAL: Delete this record permanently?")) return;

        if (tab === 'crm') {
            await window.api.db.deleteCrmContact(id);
        } else {
            await window.api.db.deleteOrgStaff(id);
        }
        loadData();
    };

    const handleTabChange = (newTab) => {
        setTab(newTab);
        if (window.innerWidth < 900) setSidebarOpen(false);
    };

    const canCreateEntry = tab === 'crm' ? hasClearance(3) : hasClearance(5);

    // 🔥 SIDEBAR NAVIGATION ITEMS
    const NAV_ITEMS = useMemo(() => {
        const items = [];
        if (hasClearance(4)) {
            items.push({ id: 'org', label: 'INTERNAL ORG', icon: <BadgeIcon />, color: '#3b82f6' });
        }
        items.push({ id: 'crm', label: 'EXTERNAL CRM', icon: <ApartmentIcon />, color: '#10b981' });
        return items;
    }, [hasClearance]);

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
        <Box sx={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
            
            {/* OPTIMIZED INTERNAL DIRECTORY SIDEBAR */}
            <Paper 
                elevation={0}
                sx={{ 
                    width: sidebarOpen ? SIDEBAR_OPEN_WIDTH : { xs: 0, md: SIDEBAR_CLOSED_WIDTH },
                    flexShrink: 0,
                    bgcolor: 'rgba(13, 31, 60, 0.5)',
                    borderRight: '1px solid', borderColor: 'divider',
                    transition: 'width 0.225s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflowX: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    position: { xs: 'fixed', md: 'relative' },
                    height: '100%',
                    zIndex: { xs: 1100, md: 1 },
                    left: 0, top: 0
                }}
            >
                <Box sx={{ p: 1, display: 'flex', justifyContent: sidebarOpen ? 'flex-end' : 'center', alignItems: 'center', height: 60 }}>
                    <IconButton onClick={() => setSidebarOpen(!sidebarOpen)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }}}>
                        {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
                    </IconButton>
                </Box>
                
                <Box sx={{ 
                    flexGrow: 1, 
                    overflowY: 'auto', 
                    overflowX: 'hidden', 
                    pb: 2,
                    scrollbarWidth: 'none', 
                    '&::-webkit-scrollbar': { display: 'none' } 
                }}>
                    <List sx={{ px: 1 }}>
                        <Typography variant="caption" sx={{ px: sidebarOpen ? 2 : 0, pt: 1, pb: 1, display: 'block', fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: 'text.secondary', letterSpacing: '1px', textAlign: sidebarOpen ? 'left' : 'center', opacity: sidebarOpen ? 0.6 : 0, transition: 'opacity 0.2s' }}>
                            {sidebarOpen ? "DIRECTORIES" : ""}
                        </Typography>

                        {NAV_ITEMS.map((item) => {
                            const isSelected = tab === item.id;
                            return (
                                <Tooltip key={item.id} title={!sidebarOpen ? item.label : ""} placement="right" disableInteractive>
                                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                                        <ListItemButton 
                                            onClick={() => handleTabChange(item.id)} 
                                            selected={isSelected}
                                            sx={{ 
                                                borderRadius: 1.5, minHeight: 40, justifyContent: sidebarOpen ? 'initial' : 'center', px: 2.5,
                                                '&.Mui-selected': { bgcolor: `rgba(${parseInt(item.color.slice(1, 3), 16)}, ${parseInt(item.color.slice(3, 5), 16)}, ${parseInt(item.color.slice(5, 7), 16)}, 0.15)` },
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } 
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center', color: isSelected ? item.color : 'text.secondary' }}>
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary={item.label} 
                                                sx={{ opacity: sidebarOpen ? 1 : 0, transition: 'opacity 0.2s ease-in-out', m: 0 }}
                                                primaryTypographyProps={{ sx: { fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? item.color : 'text.primary', whiteSpace: 'nowrap' } }} 
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                </Tooltip>
                            );
                        })}
                    </List>
                </Box>
            </Paper>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <Box onClick={() => setSidebarOpen(false)} sx={{ display: { xs: 'block', md: 'none' }, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
            )}

            {/* MAIN CONTENT AREA (Scrolls independently) */}
            <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overflowX: 'hidden', p: { xs: 2, md: 3 } }}>
                
                {/* HEADER */}
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: { xs: 3, sm: 0 },
                    mb: 4, pb: 3,
                    borderBottom: '1px solid', borderColor: 'divider'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton onClick={() => setSidebarOpen(true)} sx={{ display: { xs: 'block', md: 'none' }, color: 'text.secondary' }}>
                            <MenuIcon />
                        </IconButton>
                        {/* 🔥 FIX: Dynamic Directory Name based on the active tab */}
                        <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '18px', md: '22px' } }}>
                            DIRECTORY: <span style={{ color: '#3b82f6' }}>{tab === 'org' ? 'INTERNAL_DIRECTORY' : 'EXTERNAL_DIRECTORY'}</span>
                        </Typography>
                    </Box>

                    {canCreateEntry && (
                        <Button variant="contained" color="primary" disableElevation startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenDialog()} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '1px', height: '36px', px: 4, width: { xs: '100%', sm: 'auto' } }}>
                            NEW_ENTRY
                        </Button>
                    )}
                </Box>

                {/* METRICS */}
                <Grid container spacing={2} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}><MetricCard title="INTERNAL_ORG" value={stats.int} icon={<BadgeIcon />} color="secondary" /></Grid>
                    <Grid item xs={12} sm={6} md={3}><MetricCard title="EXTERNAL_CRM" value={stats.ext} icon={<ApartmentIcon />} color="info" /></Grid>
                    <Grid item xs={12} sm={6} md={3}><MetricCard title="SUPPLY_CHAIN" value={stats.subs} icon={<EngineeringIcon />} color="warning" /></Grid>
                    <Grid item xs={12} sm={6} md={3}><MetricCard title="ACTIVE_CLIENTS" value={stats.clients} icon={<GroupsIcon />} color="success" /></Grid>
                </Grid>

                {/* DATA TABLE */}
                <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                            <TableRow>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px', whiteSpace: 'nowrap' }}>IDENTITY</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px', whiteSpace: 'nowrap' }}>{tab === 'crm' ? 'ENTITY_COMPANY' : 'ROLE_DESIGNATION'}</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px', whiteSpace: 'nowrap' }}>{tab === 'crm' ? 'TYPE' : 'DEPT'}</TableCell>
                                {tab === 'org' && <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px', whiteSpace: 'nowrap' }}>SYSTEM_ACCESS</TableCell>}
                                <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', fontSize: '11px', whiteSpace: 'nowrap' }}>ACTIONS</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(tab === 'crm' ? crmContacts : orgStaff).map((item) => (
                                <TableRow key={item.id} hover sx={{ '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        <Box display="flex" alignItems="center" gap={2}>
                                            <Avatar sx={{ width: 28, height: 28, fontSize: '11px', bgcolor: 'primary.dark', fontFamily: "'JetBrains Mono', monospace" }}>{item.name?.charAt(0)}</Avatar>
                                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold' }}>{item.name}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary', whiteSpace: 'nowrap' }}>{tab === 'crm' ? item.company : item.designation}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        <Chip label={tab === 'crm' ? item.type : item.department} size="small" variant="outlined" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', borderRadius: 1 }} />
                                    </TableCell>

                                    {tab === 'org' && (
                                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                                            {item.username ? (
                                                <Chip
                                                    icon={<VpnKeyIcon style={{ fontSize: 12 }} />}
                                                    label={item.role === 'SuperAdmin' ? 'ROOT L5' : `LEVEL ${item.accessLevel || 1}`}
                                                    size="small"
                                                    color={item.accessLevel >= 4 || item.role === 'SuperAdmin' ? 'error' : item.accessLevel >= 3 ? 'warning' : 'info'}
                                                    sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', borderRadius: 1, fontWeight: 'bold' }}
                                                />
                                            ) : (
                                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px' }}>NO_ACCESS</Typography>
                                            )}
                                        </TableCell>
                                    )}

                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        {tab === 'crm' ? (
                                            <>
                                                {hasClearance(3) && <IconButton size="small" color="primary" onClick={() => handleOpenDialog(item)}><EditIcon sx={{ fontSize: 18 }} /></IconButton>}
                                                {hasClearance(4) && <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>}
                                            </>
                                        ) : (
                                            <>
                                                {hasClearance(5) && (
                                                    <>
                                                        <IconButton size="small" color="primary" onClick={() => handleOpenDialog(item)}><EditIcon sx={{ fontSize: 18 }} /></IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleDelete(item.id)} disabled={item.role === 'SuperAdmin'}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* RECORD DIALOG */}
                <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="sm">
                    <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>{editId ? 'UPDATE_RECORD' : 'INITIALIZE_NEW_RECORD'}</DialogTitle>
                    <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', pt: 3 }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12}><TextField fullWidth label="LEGAL_NAME" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>

                            <Grid item xs={12} md={6}><TextField fullWidth label="EMAIL_ADDRESS" value={formData.email || ""} onChange={e => setFormData({ ...formData, email: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                            <Grid item xs={12} md={6}><TextField fullWidth label="PHONE_NUMBER" value={formData.phone || ""} onChange={e => setFormData({ ...formData, phone: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>

                            {tab === 'crm' ? (
                                <>
                                    <Grid item xs={12} md={6}><TextField fullWidth label="COMPANY_ENTITY" value={formData.company || ""} onChange={e => setFormData({ ...formData, company: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField select fullWidth label="CLASSIFICATION" value={formData.type || ""} onChange={e => setFormData({ ...formData, type: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                            {['Client', 'Lead', 'Consultant', 'Subcontractor', 'Supplier'].map(opt => <MenuItem key={opt} value={opt} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{opt.toUpperCase()}</MenuItem>)}
                                        </TextField>
                                    </Grid>
                                </>
                            ) : (
                                <>
                                    <Grid item xs={12} md={6}><TextField fullWidth label="OFFICIAL_DESIGNATION" value={formData.designation || ""} onChange={e => setFormData({ ...formData, designation: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField select fullWidth label="DEPT_ASSIGNMENT" value={formData.department || ""} onChange={e => setFormData({ ...formData, department: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                            {['Operations', 'Design', 'Finance', 'Management', 'Site Logistics'].map(opt => <MenuItem key={opt} value={opt} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{opt.toUpperCase()}</MenuItem>)}
                                        </TextField>
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Divider sx={{ my: 1, borderColor: 'divider' }}>
                                            <Chip icon={<VpnKeyIcon />} label="SYSTEM ACCESS CREDENTIALS" size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'text.secondary' }} />
                                        </Divider>
                                    </Grid>

                                    <Grid item xs={12} md={4}>
                                        <TextField fullWidth label="USERNAME" value={formData.username || ""} onChange={e => setFormData({ ...formData, username: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField fullWidth label="PIN / PASSWORD" value={formData.password || ""} onChange={e => setFormData({ ...formData, password: e.target.value })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField select fullWidth label="SYSTEM CLEARANCE" value={formData.accessLevel || 1} onChange={e => setFormData({ ...formData, accessLevel: Number(e.target.value) })} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                            <MenuItem value={1}>[ L1 ] Restricted View</MenuItem>
                                            <MenuItem value={2}>[ L2 ] Standard Operations</MenuItem>
                                            <MenuItem value={3}>[ L3 ] Department Lead</MenuItem>
                                            <MenuItem value={4}>[ L4 ] General Management</MenuItem>
                                            <MenuItem value={5} sx={{ color: 'error.main' }}>[ L5 ] System Root</MenuItem>
                                        </TextField>
                                    </Grid>
                                </>
                            )}
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                        <Button onClick={() => setIsDialogOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                        <Button variant="contained" color="success" onClick={handleSave} sx={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: 50, px: 3 }}>COMMIT_RECORD</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
}