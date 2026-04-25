import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Chip, Divider, IconButton, Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RouterIcon from '@mui/icons-material/Router';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function ServerManager({ onBack }) {
    const [isRunning, setIsRunning] = useState(false);
    const [port, setPort] = useState("3000");
    const [serverUrl, setServerUrl] = useState("");
    const [localIp, setLocalIp] = useState("Loading...");

    useEffect(() => {
        if (window.api && window.api.server) {
            window.api.server.getIp().then(ip => setLocalIp(ip));
        }

        // 🔥 THE FIX: Check memory for active server on mount
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

            // 🔥 THE FIX: Save the state to memory
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

            // 🔥 THE FIX: Wipe the memory
            sessionStorage.removeItem('openprix_server_url');
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(serverUrl);
        alert("Copied to clipboard!");
    };

    return (
        <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={4}>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" color="inherit" sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    {'< '}HOME
                </Button>
                <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                    NETWORK_HOSTING
                </Typography>
            </Box>

            <Paper sx={{ p: 4, bgcolor: 'rgba(13, 31, 60, 0.5)', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <RouterIcon color={isRunning ? "success" : "disabled"} sx={{ fontSize: 40 }} />
                        <Box>
                            <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>EXPRESS WEB SERVER</Typography>
                            <Chip
                                label={isRunning ? "ONLINE & LISTENING" : "OFFLINE"}
                                color={isRunning ? "success" : "default"}
                                size="small"
                                variant={isRunning ? "filled" : "outlined"}
                                sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', mt: 0.5 }}
                            />
                        </Box>
                    </Box>

                    <Box>
                        {!isRunning ? (
                            <Button variant="contained" color="success" size="large" startIcon={<PlayArrowIcon />} onClick={handleStart} sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                                START SERVER
                            </Button>
                        ) : (
                            <Button variant="contained" color="error" size="large" startIcon={<StopIcon />} onClick={handleStop} sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
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
                        <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '56px' }}>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: isRunning ? 'info.main' : 'text.secondary', fontWeight: 'bold' }}>
                                {serverUrl || "---"}
                            </Typography>
                            {isRunning && (
                                <IconButton size="small" color="info" onClick={handleCopy}><ContentCopyIcon fontSize="small" /></IconButton>
                            )}
                        </Paper>
                    </Grid>
                </Grid>

                {isRunning && (
                    <Box mt={4} p={2} bgcolor="rgba(16, 185, 129, 0.1)" border="1px solid rgba(16, 185, 129, 0.3)" borderRadius={2}>
                        <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>
                            <strong>Server is Live!</strong> Anyone on your local Wi-Fi network can now access OPENPRIX by navigating to <strong>{serverUrl}</strong> in their web browser. Do not close this application window while hosting.
                        </Typography>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}