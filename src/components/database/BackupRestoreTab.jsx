import { useState } from "react";
import { Box, Button, Typography, Paper, Grid, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

export default function BackupRestoreTab({ loadData }) {
    const [isRestoreOpen, setIsRestoreOpen] = useState(false);

    const handleBackup = async () => {
        const res = await window.api.db.backupDatabase();
        if (res.success) alert("Database backup saved successfully!");
        else if (!res.canceled) alert("Backup failed: " + res.error);
    };

    const handleRestore = async (mode) => {
        setIsRestoreOpen(false);
        const res = await window.api.db.restoreDatabase(mode);
        if (res.success) {
            alert(`Master Database restored successfully (${mode.toUpperCase()})! Active projects were safely preserved.`);
            loadData();
        } else if (!res.canceled) {
            alert("Restore failed: " + res.error);
        }
    };

    const purgeMasterDatabase = async () => {
        if (window.confirm("CRITICAL WARNING: This will permanently delete ALL Regions, Resources, and Databook items.")) {
            if (window.confirm("Are you absolutely sure? Active projects may lose their master reference data. Type 'OK' to proceed:")) {
                await window.api.db.purgeDatabase();
                alert("Master Database has been completely purged.");
                loadData();
            }
        }
    };

    return (
        <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
            <Alert severity="info" sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                <strong>MASTER_DATABASE_FILE (.sqlite)</strong> — Regions, Resources, Databook Items, and Projects.
                This handles your entire core database. Store this file securely as a backup!
            </Alert>
            <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center', height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                        <CloudDownloadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '14px' }}>EXPORT_DB</Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>Create a safe .sqlite copy of your active database.</Typography>
                        <Button variant="contained" disableElevation size="large" onClick={handleBackup} sx={{ mt: 2, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>
                            CREATE BACKUP
                        </Button>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center', height: '100%', borderStyle: 'dashed', borderColor: 'error.main', borderRadius: 2, bgcolor: 'rgba(239, 68, 68, 0.03)' }}>
                        <CloudUploadIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
                        <Typography variant="h6" color="error.main" gutterBottom sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '14px' }}>RESTORE_DB</Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>Select a backup .sqlite file to import Master Data.</Typography>
                        <Button variant="outlined" color="error" size="large" onClick={() => setIsRestoreOpen(true)} sx={{ mt: 2, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>
                            RESTORE MASTER DATA
                        </Button>
                    </Paper>
                </Grid>
                <Grid item xs={12}>
                    <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'solid', borderColor: 'error.main', borderRadius: 2, bgcolor: 'rgba(239, 68, 68, 0.05)' }}>
                        <DeleteForeverIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
                        <Typography variant="h6" color="error.main" gutterBottom sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '14px' }}>PURGE_MASTER_DATABASE</Typography>
                        <Typography variant="body2" color="error.light" paragraph>
                            <strong>DANGER:</strong> Erase all Databook items, LMR Rates, and Resources. This cannot be undone.
                        </Typography>
                        <Button variant="contained" color="error" size="large" onClick={purgeMasterDatabase} sx={{ mt: 2, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', fontWeight: 'bold' }}>
                            NUKE DATABASE
                        </Button>
                    </Paper>
                </Grid>
            </Grid>

            <Dialog open={isRestoreOpen} onClose={() => setIsRestoreOpen(false)} PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider', minWidth: '400px' } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '14px' }}>
                    MASTER DATA RESTORE RESOLUTION
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 3, color: '#ccc', fontSize: '12px' }}>
                        How would you like to process the Master Data (Regions, Resources, Databook) from this backup file? <strong>Your active projects will not be affected.</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button variant="outlined" color="info" onClick={() => handleRestore('append')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px', textAlign: 'left' }}>
                            <strong>[APPEND]</strong>&nbsp;&nbsp;Add newly discovered items only. Existing items are strictly preserved.
                        </Button>
                        <Button variant="outlined" color="warning" onClick={() => handleRestore('merge')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px', textAlign: 'left' }}>
                            <strong>[MERGE]</strong>&nbsp;&nbsp;&nbsp;Update existing items with backup data, and add new ones.
                        </Button>
                        <Button variant="outlined" color="error" onClick={() => handleRestore('replace')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px', textAlign: 'left' }}>
                            <strong>[REPLACE]</strong>&nbsp;Wipe current master data entirely and use backup data.
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
                    <Button onClick={() => setIsRestoreOpen(false)} sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '12px' }}>CANCEL</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}