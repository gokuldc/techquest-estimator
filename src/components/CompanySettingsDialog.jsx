import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Box, TextField, Button, Typography, Avatar, IconButton 
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';

export default function CompanySettingsDialog({ open, onClose }) {
    const [info, setInfo] = useState({
        name: "", address: "", email: "", phone: "", taxId: "", logo: ""
    });

    useEffect(() => {
        if (open) {
            window.api.db.getSettings('company_info').then(data => {
                if (data) setInfo(data);
            });
        }
    }, [open]);

    const handleLogoUpload = async () => {
        const path = await window.api.os.pickFile();
        if (!path) return;

        try {
            // Read the local file and convert to Base64 for SQLite storage
            const response = await fetch(`file://${path}`);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                setInfo(prev => ({ ...prev, logo: reader.result }));
            };
            reader.readAsDataURL(blob);
        } catch (err) {
            alert("Error loading logo. Ensure it is a valid image file.");
        }
    };

    const handleSave = async () => {
        await window.api.db.saveSettings('company_info', info);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider' } }}>
            <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon /> FIRM_IDENTITY_CONFIG
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <Box display="flex" flexDirection="column" gap={2.5} pt={2}>
                    <Box display="flex" alignItems="center" gap={3}>
                        <Avatar 
                            src={info.logo} 
                            variant="rounded" 
                            sx={{ width: 80, height: 80, bgcolor: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(255,255,255,0.2)' }}
                        >
                            <BusinessIcon sx={{ fontSize: 40, opacity: 0.2 }} />
                        </Avatar>
                        <Box>
                            <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={handleLogoUpload} size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                UPLOAD LOGO
                            </Button>
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                                Required for professional PDF headers.
                            </Typography>
                        </Box>
                        {info.logo && (
                            <IconButton color="error" onClick={() => setInfo({...info, logo: ""})}><DeleteIcon /></IconButton>
                        )}
                    </Box>

                    <TextField fullWidth label="COMPANY / FIRM NAME" value={info.name} onChange={e => setInfo({...info, name: e.target.value})} size="small" />
                    <TextField fullWidth multiline rows={2} label="OFFICE ADDRESS" value={info.address} onChange={e => setInfo({...info, address: e.target.value})} size="small" />
                    <Box display="flex" gap={2}>
                        <TextField fullWidth label="OFFICIAL EMAIL" value={info.email} onChange={e => setInfo({...info, email: e.target.value})} size="small" />
                        <TextField fullWidth label="CONTACT NO." value={info.phone} onChange={e => setInfo({...info, phone: e.target.value})} size="small" />
                    </Box>
                    <TextField fullWidth label="TAX ID / GSTIN" value={info.taxId} onChange={e => setInfo({...info, taxId: e.target.value})} size="small" />
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                <Button onClick={handleSave} variant="contained" color="primary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>SAVE SETTINGS</Button>
            </DialogActions>
        </Dialog>
    );
}