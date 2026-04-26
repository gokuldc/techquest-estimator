import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, TextField, Button, Typography, Avatar, IconButton,
    MenuItem, Divider, Tabs, Tab, Paper
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import PublicIcon from '@mui/icons-material/Public';

import { useSettings } from '../context/SettingsContext';

export default function CompanySettingsDialog({ open, onClose }) {
    const { refreshSettings } = useSettings();
    const [tab, setTab] = useState(0);

    const [info, setInfo] = useState({
        name: "", address: "", email: "", phone: "", taxId: "", logo: "",
        currencySymbol: "₹", currencyLocale: "en-IN", unitSystem: "Metric",
        
        // Project Automation Settings
        scaffoldRoot: "", 
        scaffoldPathTemplate: "./{TYPE}/{CODE}_{NAME}", // 🔥 Default dynamic path
        templateFolders: ["01_Drawings", "02_Permits", "03_Site_Photos", "04_Invoices", "05_Communications"]
    });

    // Visual Tree State
    const [newFolderName, setNewFolderName] = useState("");
    const [selectedParent, setSelectedParent] = useState("");

    useEffect(() => {
        if (open) {
            window.api.db.getSettings('company_info').then(data => {
                if (data) {
                    let parsedFolders = data.templateFolders || ["01_Drawings", "02_Permits", "03_Site_Photos", "04_Invoices", "05_Communications"];
                    if (typeof parsedFolders === 'string') parsedFolders = parsedFolders.split(',').map(s => s.trim());

                    setInfo(prev => ({ 
                        ...prev, 
                        ...data,
                        templateFolders: parsedFolders,
                        currencySymbol: data.currencySymbol || "₹",
                        currencyLocale: data.currencyLocale || "en-IN",
                        unitSystem: data.unitSystem || "Metric",
                        scaffoldPathTemplate: data.scaffoldPathTemplate || "./{TYPE}/{CODE}_{NAME}"
                    }));
                }
            });
        }
    }, [open]);

    const handlePickRoot = async () => {
        if (window.api?.os?.pickDirectory) {
            const path = await window.api.os.pickDirectory(); 
            if (path) setInfo({ ...info, scaffoldRoot: path });
        } else {
            alert("This feature requires the Desktop Host application.");
        }
    };

    const handleLogoUpload = async () => {
        const path = await window.api.os.pickFile();
        if (!path) return;
        const base64Data = await window.api.os.getBase64(path);
        if (base64Data) setInfo(prev => ({ ...prev, logo: base64Data }));
    };

    const handleAddFolder = () => {
        if (!newFolderName.trim()) return;
        const cleanName = newFolderName.trim().replace(/[\/\\]/g, ''); 
        const fullPath = selectedParent ? `${selectedParent}/${cleanName}` : cleanName;
        
        if (!info.templateFolders.includes(fullPath)) {
            setInfo({ ...info, templateFolders: [...info.templateFolders, fullPath].sort() });
        }
        setNewFolderName("");
    };

    const handleRemoveFolder = (pathToRemove) => {
        const updated = info.templateFolders.filter(f => f !== pathToRemove && !f.startsWith(`${pathToRemove}/`));
        setInfo({ ...info, templateFolders: updated });
        if (selectedParent === pathToRemove || selectedParent.startsWith(`${pathToRemove}/`)) {
            setSelectedParent("");
        }
    };

    const handleSave = async () => {
        await window.api.db.saveSettings('company_info', info);
        await refreshSettings();
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider' } }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.2)' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth">
                    <Tab icon={<BusinessIcon sx={{ fontSize: 18 }}/>} label="COMPANY" sx={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }} />
                    <Tab icon={<PublicIcon sx={{ fontSize: 18 }}/>} label="REGIONAL" sx={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }} />
                    <Tab icon={<FolderSpecialIcon sx={{ fontSize: 18 }}/>} label="AUTOMATION" sx={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }} />
                </Tabs>
            </Box>

            <DialogContent sx={{ minHeight: '420px', borderColor: 'rgba(255,255,255,0.1)' }}>
                {tab === 0 && (
                    <Box display="flex" flexDirection="column" gap={2.5} pt={1}>
                        <Box display="flex" alignItems="center" gap={3}>
                            <Avatar src={info.logo} variant="rounded" sx={{ width: 80, height: 80, bgcolor: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(255,255,255,0.2)' }}>
                                <BusinessIcon sx={{ fontSize: 40, opacity: 0.2 }} />
                            </Avatar>
                            <Box>
                                <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={handleLogoUpload} size="small" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UPLOAD LOGO</Button>
                                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, fontFamily: "'JetBrains Mono', monospace" }}>Required for PDF headers.</Typography>
                            </Box>
                            {info.logo && <IconButton color="error" onClick={() => setInfo({ ...info, logo: "" })}><DeleteIcon /></IconButton>}
                        </Box>
                        <TextField fullWidth label="COMPANY / FIRM NAME" value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} size="small" />
                        <TextField fullWidth multiline rows={2} label="OFFICE ADDRESS" value={info.address} onChange={e => setInfo({ ...info, address: e.target.value })} size="small" />
                        <Box display="flex" gap={2}>
                            <TextField fullWidth label="OFFICIAL EMAIL" value={info.email} onChange={e => setInfo({ ...info, email: e.target.value })} size="small" />
                            <TextField fullWidth label="CONTACT NO." value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value })} size="small" />
                        </Box>
                        <TextField fullWidth label="TAX ID / GSTIN" value={info.taxId} onChange={e => setInfo({ ...info, taxId: e.target.value })} size="small" />
                    </Box>
                )}

                {tab === 1 && (
                    <Box display="flex" flexDirection="column" gap={3} pt={1}>
                        <Typography variant="caption" color="secondary.main" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>GLOBAL UNITS & CURRENCY</Typography>
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
                )}

                {tab === 2 && (
                    <Box display="flex" flexDirection="column" gap={3} pt={1}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 2 }}>
                            <Typography variant="caption" color="primary.main" fontWeight="bold" sx={{ display: 'block', mb: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                                HOST_SCAFFOLD_ROOT
                            </Typography>
                            <Box display="flex" gap={1}>
                                <TextField fullWidth size="small" placeholder="Select host machine location..." value={info.scaffoldRoot} disabled InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}} />
                                <Button variant="contained" size="small" onClick={handlePickRoot} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>BROWSE</Button>
                            </Box>
                        </Paper>

                        {/* 🔥 NEW: DYNAMIC PATH TEMPLATE */}
                        <TextField 
                            fullWidth 
                            label="SCAFFOLD PATH TEMPLATE" 
                            value={info.scaffoldPathTemplate} 
                            onChange={e => setInfo({ ...info, scaffoldPathTemplate: e.target.value })} 
                            helperText="Example: ./{type}/{status}/{code}_{name}/" 
                            size="small" 
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}} 
                        />

                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                        
                        {/* VISUAL TREE BUILDER */}
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>SCAFFOLD TEMPLATE BUILDER</Typography>
                        <Box display="flex" gap={1}>
                            <TextField select fullWidth size="small" label="Parent Folder" value={selectedParent} onChange={(e) => setSelectedParent(e.target.value)} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}}>
                                <MenuItem value="" sx={{ fontStyle: 'italic' }}>-- Root --</MenuItem>
                                {info.templateFolders.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                            </TextField>
                            <TextField fullWidth size="small" label="New Folder Name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}} />
                            <Button variant="outlined" onClick={handleAddFolder} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>ADD</Button>
                        </Box>

                        <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 200, overflowY: 'auto' }}>
                            {info.templateFolders.length === 0 && <Typography variant="caption" color="text.secondary">No folders defined.</Typography>}
                            {info.templateFolders.map(path => {
                                const depth = (path.match(/\//g) || []).length;
                                const folderName = path.split('/').pop();
                                return (
                                    <Box key={path} display="flex" alignItems="center" justifyContent="space-between" sx={{ ml: depth * 3, mb: 0.5, p: 0.5, borderLeft: '2px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                                        <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: depth === 0 ? 'primary.light' : 'text.primary' }}>
                                            {depth > 0 ? '↳ ' : '📁 '}{folderName}
                                        </Typography>
                                        <IconButton size="small" color="error" onClick={() => handleRemoveFolder(path)} sx={{ p: 0.2 }}>
                                            <DeleteIcon sx={{ fontSize: '14px' }} />
                                        </IconButton>
                                    </Box>
                                )
                            })}
                        </Paper>
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)' }}>
                <Button onClick={onClose} sx={{ color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                <Button onClick={handleSave} variant="contained" color="primary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>SAVE SETTINGS</Button>
            </DialogActions>
        </Dialog>
    );
}