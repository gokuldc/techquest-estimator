import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Chip, Divider, IconButton, Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RouterIcon from '@mui/icons-material/Router';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CastConnectedIcon from '@mui/icons-material/CastConnected';
import LinkIcon from '@mui/icons-material/Link';

export default function ServerManager({ onBack }) {
    // --- HOST STATE ---
    const [isRunning, setIsRunning] = useState(false);
    const [port, setPort] = useState("3000");
    const [serverUrl, setServerUrl] = useState("");
    const [localIp, setLocalIp] = useState("Loading...");

    // --- CLIENT STATE ---
    const [remoteUrl, setRemoteUrl] = useState("");

    useEffect(() => {
        if (window.api && window.api.server) {
            window.api.server.getIp().then(ip => setLocalIp(ip));
        }

        // Check memory for active server on mount
        const activeUrl = sessionStorage.getItem('openprix_server_url');
        if (activeUrl) {
            setIsRunning(true);
            setServerUrl(activeUrl);
        }
    }, []);

    const handleStart = async () => {
        const parsedPort = parseInt(port, 10);
        if (isNaN(parsedPort) || parsedPort < 1024 || parsedPort > 65535) {
            return alert("Please enter a valid port between 1024 and 65535.");
        }

        const res = await window.api.server.start(parsedPort);
        if (res.success) {
            setIsRunning(true);
            setServerUrl(res.url);
            sessionStorage.setItem('openprix_server_url', res.url);
        } else {
            alert(`Failed to start server: ${res.error}`);
        }
    };

    const handleStop = async () => {
        const res = await window.api.server.stop();
        if (res.success) {
            setIsRunning(false);
            setServerUrl("");
            sessionStorage.removeItem('openprix_server_url');
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(serverUrl);
        alert("Copied to clipboard!");
    };

    // Connect to Remote Host
    const handleConnectRemote = () => {
        let finalUrl = remoteUrl.trim();
        if (!finalUrl) return alert("Please enter a valid URL or IP address.");
        
        // Auto-prepend http:// if the user just types "192.168.1.5:3000"
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = `http://${finalUrl}`;
        }

        if (window.confirm(`Connect to remote host at ${finalUrl}?\n\nThis will switch your app into Client Mode. To return to your local database, simply restart the application.`)) {
            window.location.href = finalUrl;
        }
    };

    return (
        <Box sx={{ maxWidth: 900, mx: "auto", p: { xs: 2, md: 3 } }}>
            {/* MOBILE RESPONSIVE HEADER */}
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={4}>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" color="inherit" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
                    {'< '}HOME
                </Button>
                <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                    NETWORK_MANAGER
                </Typography>
            </Box>

            <Grid container spacing={4}>
                {/* ---------------------------------------------------- */}
                {/* CARD 1: HOST MODE (Run Server)                       */}
                {/* ---------------------------------------------------- */}
                <Grid item xs={12}>
                    <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, bgcolor: 'rgba(13, 31, 60, 0.5)', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} gap={3}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <RouterIcon color={isRunning ? "success" : "disabled"} sx={{ fontSize: { xs: 32, sm: 40 } }} />
                                <Box>
                                    <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                                        HOST MODE (LOCAL SERVER)
                                    </Typography>
                                    <Chip
                                        label={isRunning ? "ONLINE & LISTENING" : "OFFLINE"}
                                        color={isRunning ? "success" : "default"}
                                        size="small"
                                        variant={isRunning ? "filled" : "outlined"}
                                        sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', mt: 0.5 }}
                                    />
                                </Box>
                            </Box>

                            <Box width={{ xs: '100%', md: 'auto' }}>
                                {!isRunning ? (
                                    <Button fullWidth variant="contained" color="success" size="large" startIcon={<PlayArrowIcon />} onClick={handleStart} sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                                        START SERVER
                                    </Button>
                                ) : (
                                    <Button fullWidth variant="contained" color="error" size="large" startIcon={<StopIcon />} onClick={handleStop} sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                                        STOP SERVER
                                    </Button>
                                )}
                            </Box>
                        </Box>

                        <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

                        <Grid container spacing={4}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, display: 'block' }}>ENVIRONMENT CONFIG</Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="NETWORK PORT"
                                    value={port}
                                    onChange={e => setPort(e.target.value)}
                                    disabled={isRunning}
                                    helperText={`Default: 3000. Your local IP is ${localIp}`}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, display: 'block' }}>ACTIVE ENDPOINT</Typography>
                                <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '56px', overflow: 'hidden' }}>
                                    <Typography noWrap sx={{ fontFamily: "'JetBrains Mono', monospace", color: isRunning ? 'info.main' : 'text.secondary', fontWeight: 'bold', fontSize: { xs: '11px', sm: '14px' }, flexGrow: 1, mr: 1 }}>
                                        {serverUrl || "---"}
                                    </Typography>
                                    {isRunning && (
                                        <IconButton size="small" color="info" onClick={handleCopy} sx={{ flexShrink: 0 }}>
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>

                        {isRunning && (
                            <Box mt={4} p={2} bgcolor="rgba(16, 185, 129, 0.1)" border="1px solid rgba(16, 185, 129, 0.3)" borderRadius={2}>
                                <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#10b981', fontSize: { xs: '12px', sm: '14px' } }}>
                                    <strong>Server is Live!</strong> Anyone on your local Wi-Fi network can now access OPENPRIX by navigating to <strong>{serverUrl}</strong> in their web browser. Do not close this application window while hosting.
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* ---------------------------------------------------- */}
                {/* CARD 2: CLIENT MODE (Connect to existing)            */}
                {/* ---------------------------------------------------- */}
                <Grid item xs={12}>
                    <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, bgcolor: 'rgba(59, 130, 246, 0.05)', border: '1px solid', borderColor: 'primary.dark', borderRadius: 2 }}>
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <CastConnectedIcon color="primary" sx={{ fontSize: { xs: 28, sm: 32 } }} />
                            <Box>
                                <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: 'primary.light', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                                    CLIENT MODE (CONNECT TO HOST)
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'block', mt: 0.5 }}>
                                    Connect this PC to an existing OpenPrix server on your network.
                                </Typography>
                            </Box>
                        </Box>

                        <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} mt={3}>
                            <TextField
                                fullWidth
                                size="small"
                                label="HOST IP ADDRESS OR URL"
                                placeholder="e.g. 192.168.1.5:3000"
                                value={remoteUrl}
                                onChange={e => setRemoteUrl(e.target.value)}
                                InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                                InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                            />
                            <Button 
                                variant="contained" 
                                color="primary" 
                                size="large"
                                onClick={handleConnectRemote}
                                startIcon={<LinkIcon />}
                                sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', whiteSpace: 'nowrap', height: { sm: '40px' } }}
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