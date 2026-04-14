import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, TextField, Button, Typography, Avatar, IconButton,
    MenuItem, Divider // 🔥 Added MenuItem and Divider
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';

// 🔥 Import the global settings hook
import { useSettings } from '../context/SettingsContext';

export default function CompanySettingsDialog({ open, onClose }) {
    // 1. Grab the refresh function from our global context
    const { refreshSettings } = useSettings();

    // 2. Add the new regional fields to the default state
    const [info, setInfo] = useState({
        name: "", address: "", email: "", phone: "", taxId: "", logo: "",
        currencySymbol: "₹",
        currencyLocale: "en-IN",
        unitSystem: "Metric"
    });

    useEffect(() => {
        if (open) {
            window.api.db.getSettings('company_info').then(data => {
                if (data) {
                    setInfo(prev => ({
                        ...prev,
                        ...data,
                        // Ensure fallbacks if older DB doesn't have these fields yet
                        currencySymbol: data.currencySymbol || "₹",
                        currencyLocale: data.currencyLocale || "en-IN",
                        unitSystem: data.unitSystem || "Metric"
                    }));
                }
            });
        }
    }, [open]);

    const handleLogoUpload = async () => {
        const path = await window.api.os.pickFile();
        if (!path) return;

        const base64Data = await window.api.os.getBase64(path);

        if (base64Data) {
            setInfo(prev => ({ ...prev, logo: base64Data }));
        } else {
            alert("Could not process image file. Make sure it's a valid PNG/JPG.");
        }
    };

    const handleSave = async () => {
        // Save to SQLite
        await window.api.db.saveSettings('company_info', info);
        // 🔥 Tell the whole app to re-render with the new currency!
        await refreshSettings();
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider' } }}>
            <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon /> SETTINGS
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
                            <IconButton color="error" onClick={() => setInfo({ ...info, logo: "" })}><DeleteIcon /></IconButton>
                        )}
                    </Box>

                    <TextField fullWidth label="COMPANY / FIRM NAME" value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} size="small" />
                    <TextField fullWidth multiline rows={2} label="OFFICE ADDRESS" value={info.address} onChange={e => setInfo({ ...info, address: e.target.value })} size="small" />
                    <Box display="flex" gap={2}>
                        <TextField fullWidth label="OFFICIAL EMAIL" value={info.email} onChange={e => setInfo({ ...info, email: e.target.value })} size="small" />
                        <TextField fullWidth label="CONTACT NO." value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value })} size="small" />
                    </Box>
                    <TextField fullWidth label="TAX ID / GSTIN" value={info.taxId} onChange={e => setInfo({ ...info, taxId: e.target.value })} size="small" />

                    {/* 🔥 NEW: REGIONAL PREFERENCES SECTION */}
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mt: 1 }} />
                    <Typography variant="caption" color="secondary.main" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        REGIONAL_PREFERENCES
                    </Typography>

                    <Box display="flex" gap={2}>
                        <TextField select fullWidth label="CURRENCY SYMBOL" value={info.currencySymbol} onChange={e => setInfo({ ...info, currencySymbol: e.target.value })} size="small">
                            <MenuItem value="₹">INR (₹)</MenuItem>
                            <MenuItem value="Rs.">INR (Rs.)</MenuItem>
                            <MenuItem value="$">USD ($)</MenuItem>
                            <MenuItem value="AED">AED</MenuItem>
                            <MenuItem value="€">EUR (€)</MenuItem>
                        </TextField>

                        <TextField select fullWidth label="NUMBER FORMAT" value={info.currencyLocale} onChange={e => setInfo({ ...info, currencyLocale: e.target.value })} size="small">
                            <MenuItem value="en-IN">Indian (1,00,000.00)</MenuItem>
                            <MenuItem value="en-US">Western (100,000.00)</MenuItem>
                            <MenuItem value="de-DE">European (100.000,00)</MenuItem>
                        </TextField>

                        <TextField select fullWidth label="UNIT SYSTEM" value={info.unitSystem} onChange={e => setInfo({ ...info, unitSystem: e.target.value })} size="small">
                            <MenuItem value="Metric">Metric (m, kg)</MenuItem>
                            <MenuItem value="Imperial">Imperial (ft, lb)</MenuItem>
                        </TextField>
                    </Box>

                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                <Button onClick={handleSave} variant="contained" color="primary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>SAVE SETTINGS</Button>
            </DialogActions>
        </Dialog>
    );
}