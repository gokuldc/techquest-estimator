import React, { useState } from 'react';
import { Box, Typography, Paper, Button, TextField, Grid } from '@mui/material';
import CastConnectedIcon from '@mui/icons-material/CastConnected';

export default function ServerManager() {
    const [remoteUrl, setRemoteUrl] = useState(sessionStorage.getItem('openprix_server_url') || "http://127.0.0.1:3000");

    const handleConnectRemote = () => {
        let finalUrl = remoteUrl.trim();
        if (!finalUrl) return alert("Please enter a valid URL or IP address.");
        
        // Auto-prepend http:// if the user just types an IP like "192.168.1.5:3000"
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = `http://${finalUrl}`;
        }

        // Save the target to sessionStorage and reload the app to re-initialize the API bridge
        sessionStorage.setItem('openprix_server_url', finalUrl);
        alert(`Client successfully configured to target Host: ${finalUrl}\n\nPlease log in again.`);
        window.location.href = '/'; 
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', p: { xs: 2, md: 3 } }}>
            <Box sx={{ mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                    NETWORK_MANAGER
                </Typography>
            </Box>

            <Grid container spacing={4}>
                <Grid item xs={12} md={8} lg={6}>
                    <Paper sx={{ p: { xs: 3, md: 4 }, bgcolor: 'rgba(59, 130, 246, 0.05)', border: '1px solid', borderColor: 'primary.dark', borderRadius: 2 }}>
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <CastConnectedIcon color="primary" sx={{ fontSize: 32 }} />
                            <Box>
                                <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: 'primary.light' }}>
                                    CLIENT MODE (TARGET HOST)
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                    Point this Client UI to a running Rust Daemon on your network.
                                </Typography>
                            </Box>
                        </Box>

                        <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} mt={3}>
                            <TextField
                                fullWidth
                                size="small"
                                label="HOST IP ADDRESS OR URL"
                                placeholder="e.g. 127.0.0.1:3000"
                                value={remoteUrl}
                                onChange={e => setRemoteUrl(e.target.value)}
                                InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}
                            />
                            <Button 
                                variant="contained" 
                                color="primary" 
                                onClick={handleConnectRemote}
                                sx={{ fontFamily: "'JetBrains Mono', monospace", minWidth: 140 }}
                            >
                                CONNECT
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}