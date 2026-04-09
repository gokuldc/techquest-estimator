import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
    Box, Typography, Button, Paper, Grid, Avatar, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Chip, TextField, InputAdornment, IconButton, Dialog, DialogTitle, 
    DialogContent, DialogActions, MenuItem, Tooltip
} from '@mui/material';

import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import EngineeringIcon from '@mui/icons-material/Engineering';
import SearchIcon from '@mui/icons-material/Search';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArchitectureIcon from '@mui/icons-material/Architecture';

export default function CrmDashboard({ onBack }) {
    const contacts = useLiveQuery(() => db.crmContacts.orderBy('createdAt').reverse().toArray()) || [];

    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: "", company: "", email: "", phone: "", type: "Client", status: "Active", notes: ""
    });

    // --- UPDATED METRICS TO INCLUDE CONSULTANTS ---
    const { totalClients, totalLeads, totalSubs, totalConsultants } = useMemo(() => {
        let clients = 0, leads = 0, subs = 0, consultants = 0;
        contacts.forEach(c => {
            if (c.type === 'Client') clients++;
            if (c.type === 'Lead') leads++;
            if (c.type === 'Subcontractor' || c.type === 'Supplier') subs++;
            if (c.type === 'Consultant') consultants++;
        });
        return { totalClients: clients, totalLeads: leads, totalSubs: subs, totalConsultants: consultants };
    }, [contacts]);

    const filteredContacts = useMemo(() => {
        return contacts.filter(c => {
            const matchesSearch = (c.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
                                  (c.company?.toLowerCase() || "").includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === "All" || c.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [contacts, searchQuery, typeFilter]);

    const handleOpenDialog = (contact = null) => {
        if (contact) {
            setEditId(contact.id);
            setFormData(contact);
        } else {
            setEditId(null);
            setFormData({ name: "", company: "", email: "", phone: "", type: "Client", status: "Active", notes: "" });
        }
        setIsDialogOpen(true);
    };

    const handleSaveContact = async () => {
        if (!formData.name) return alert("Name is required.");
        
        const payload = {
            id: editId || crypto.randomUUID(), 
            ...formData, 
            createdAt: editId ? formData.createdAt : Date.now(),
            updatedAt: Date.now()
        };

        await db.crmContacts.put(payload);
        setIsDialogOpen(false);
    };

    const handleDeleteContact = async (id) => {
        if (window.confirm("Are you sure you want to delete this contact?")) {
            await db.crmContacts.delete(id);
        }
    };

    // --- ADDED CONSULTANT COLOR ---
    const getTypeColor = (type) => {
        switch(type) {
            case 'Client': return 'success';
            case 'Lead': return 'info';
            case 'Subcontractor': return 'warning';
            case 'Supplier': return 'error';
            case 'Consultant': return 'secondary';
            default: return 'default';
        }
    };

    const MetricCard = ({ title, value, icon, color }) => (
        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: `rgba(${color === 'success' ? '16, 185, 129' : color === 'info' ? '59, 130, 246' : color === 'secondary' ? '139, 92, 246' : '245, 158, 11'}, 0.1)`, color: `${color}.main`, width: 48, height: 48 }}>
                {icon}
            </Avatar>
            <Box>
                <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>{value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>{title}</Typography>
            </Box>
        </Paper>
    );

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
            
            <Box>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>
                    {'< '}BACK_TO_HOME
                </Button>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid', borderColor: 'divider', pb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h3" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', color: 'primary.main' }}>
                        CRM_DIRECTORY
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mt: 1 }}>
                        Manage Clients, Leads, Consultants, and Supply Chain Partners.
                    </Typography>
                </Box>
                <Button variant="contained" color="primary" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenDialog()} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', px: 3, py: 1.5 }}>
                    NEW_CONTACT
                </Button>
            </Box>

            {/* --- UPDATED TO 4 CARDS --- */}
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="ACTIVE CLIENTS" value={totalClients} icon={<BusinessCenterIcon />} color="success" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="PROSPECTIVE LEADS" value={totalLeads} icon={<GroupAddIcon />} color="info" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="CONSULTANTS" value={totalConsultants} icon={<ArchitectureIcon />} color="secondary" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard title="SUPPLY CHAIN" value={totalSubs} icon={<EngineeringIcon />} color="warning" />
                </Grid>
            </Grid>

            <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', overflow: 'hidden' }}>
                <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <TextField
                        size="small" placeholder="Search name or company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', borderRadius: 2, bgcolor: 'rgba(0,0,0,0.2)' } }}
                        sx={{ width: { xs: '100%', sm: '300px' } }}
                    />
                    
                    {/* --- ADDED CONSULTANT TO FILTER --- */}
                    <TextField 
                        select size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', borderRadius: 2, bgcolor: 'rgba(0,0,0,0.2)', minWidth: 150 } }}
                    >
                        <MenuItem value="All" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>All Types</MenuItem>
                        <MenuItem value="Client" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>Clients</MenuItem>
                        <MenuItem value="Lead" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>Leads</MenuItem>
                        <MenuItem value="Consultant" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>Consultants</MenuItem>
                        <MenuItem value="Subcontractor" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>Subcontractors</MenuItem>
                        <MenuItem value="Supplier" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>Suppliers</MenuItem>
                    </TextField>
                </Box>

                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ bgcolor: '#0b172d', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>CONTACT</TableCell>
                                <TableCell sx={{ bgcolor: '#0b172d', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>COMPANY</TableCell>
                                <TableCell sx={{ bgcolor: '#0b172d', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>TYPE</TableCell>
                                <TableCell sx={{ bgcolor: '#0b172d', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>CONTACT INFO</TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#0b172d', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>STATUS</TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#0b172d', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>ACTIONS</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredContacts.length === 0 && (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>No contacts found in database.</TableCell></TableRow>
                            )}
                            {filteredContacts.map((c) => (
                                <TableRow key={c.id} hover sx={{ '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                                    <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '14px', fontWeight: 'bold' }}>
                                            {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                                        </Avatar>
                                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold' }}>{c.name}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{c.company || '—'}</TableCell>
                                    <TableCell>
                                        <Chip label={c.type} color={getTypeColor(c.type)} size="small" variant="outlined" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 'bold', borderRadius: 1 }} />
                                    </TableCell>
                                    <TableCell>
                                        <Box display="flex" flexDirection="column" gap={0.5}>
                                            <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}><EmailIcon sx={{ fontSize: 14 }}/> {c.email || '—'}</Typography>
                                            <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}><PhoneIcon sx={{ fontSize: 14 }}/> {c.phone || '—'}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip label={c.status} size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', height: 20, bgcolor: c.status === 'Active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)', color: c.status === 'Active' ? 'success.light' : 'text.secondary' }} />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit Contact"><IconButton size="small" color="primary" onClick={() => handleOpenDialog(c)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteContact(c.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>{editId ? "EDIT_CONTACT" : "ADD_NEW_CONTACT"}</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', pt: 3 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="FULL NAME" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="COMPANY" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="EMAIL" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        <Grid item xs={12} sm={6}><TextField fullWidth label="PHONE" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                        
                        {/* --- ADDED CONSULTANT TO CREATION DROPDOWN --- */}
                        <Grid item xs={12} sm={6}>
                            <TextField select fullWidth label="RELATIONSHIP TYPE" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                <MenuItem value="Client" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Client</MenuItem>
                                <MenuItem value="Lead" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Lead</MenuItem>
                                <MenuItem value="Consultant" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Consultant</MenuItem>
                                <MenuItem value="Subcontractor" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Subcontractor</MenuItem>
                                <MenuItem value="Supplier" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Supplier</MenuItem>
                            </TextField>
                        </Grid>
                        
                        <Grid item xs={12} sm={6}>
                            <TextField select fullWidth label="STATUS" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                <MenuItem value="Active" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Active</MenuItem>
                                <MenuItem value="Inactive" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>Inactive</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={12}><TextField fullWidth multiline rows={3} label="INTERNAL NOTES" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsDialogOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={handleSaveContact} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        SAVE CONTACT
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}