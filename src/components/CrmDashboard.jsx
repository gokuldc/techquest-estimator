import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
    Box, Typography, Button, Paper, Grid, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Chip, TextField, IconButton, Dialog, DialogTitle, 
    DialogContent, DialogActions, MenuItem
} from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function CrmDashboard({ onBack }) {
    // 1. Fetch data directly from the DB
    const contacts = useLiveQuery(() => db.crmContacts.orderBy('createdAt').reverse().toArray()) || [];

    // 2. State for the Add/Edit Modal
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: "", company: "", email: "", phone: "", type: "Client", status: "Active"
    });

    const handleOpenDialog = (contact = null) => {
        if (contact) {
            setEditId(contact.id);
            setFormData(contact);
        } else {
            setEditId(null);
            setFormData({ name: "", company: "", email: "", phone: "", type: "Client", status: "Active" });
        }
        setIsDialogOpen(true);
    };

    const handleSaveContact = async () => {
        if (!formData.name) {
            alert("Name is required!");
            return;
        }
        
        const payload = {
            id: editId || crypto.randomUUID(), 
            ...formData, 
            createdAt: editId ? formData.createdAt : Date.now()
        };

        // 3. Save to database
        await db.crmContacts.put(payload);
        setIsDialogOpen(false);
    };

    const handleDeleteContact = async (id) => {
        if (window.confirm("Are you sure you want to delete this contact?")) {
            await db.crmContacts.delete(id);
        }
    };

    const getTypeColor = (type) => {
        switch(type) {
            case 'Client': return 'success';
            case 'Lead': return 'info';
            case 'Subcontractor': return 'warning';
            case 'Supplier': return 'secondary';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace" }}>
                BACK_TO_HOME
            </Button>
            
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4} pb={2} borderBottom="1px solid" borderColor="divider">
                <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        CRM_DIRECTORY
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        Master ledger for clients, leads, and subcontractors.
                    </Typography>
                </Box>
                <Button variant="contained" color="primary" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenDialog()} sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                    NEW_CONTACT
                </Button>
            </Box>

            <TableContainer component={Paper} sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', borderRadius: 2 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>NAME</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>COMPANY</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>TYPE</TableCell>
                            <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>ACTIONS</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {contacts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 5, fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>
                                    NO_CONTACTS_FOUND
                                </TableCell>
                            </TableRow>
                        )}
                        {contacts.map((c) => (
                            <TableRow key={c.id} hover>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>{c.name}</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.company}</TableCell>
                                <TableCell>
                                    <Chip label={c.type} size="small" color={getTypeColor(c.type)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 'bold' }} />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" color="primary" onClick={() => handleOpenDialog(c)}><EditIcon fontSize="small" /></IconButton>
                                    <IconButton size="small" color="error" onClick={() => handleDeleteContact(c.id)}><DeleteIcon fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* ADD / EDIT DIALOG */}
            <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                    {editId ? "EDIT_CONTACT" : "ADD_NEW_CONTACT"}
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Grid container spacing={2} sx={{ pt: 1 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Company" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField fullWidth label="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField select fullWidth label="Relationship Type" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                <MenuItem value="Client">Client</MenuItem>
                                <MenuItem value="Lead">Lead</MenuItem>
                                <MenuItem value="Subcontractor">Subcontractor</MenuItem>
                                <MenuItem value="Supplier">Supplier</MenuItem>
                            </TextField>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', p: 2 }}>
                    <Button onClick={() => setIsDialogOpen(false)} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={handleSaveContact} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        SAVE_CONTACT
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}