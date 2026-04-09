import React from 'react';
import { Box, Typography, Grid, Divider, Link, Paper } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import GavelIcon from '@mui/icons-material/Gavel';

export default function About({ isPopup }) {
    return (
        <Box sx={{ p: isPopup ? 1 : 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    SYSTEM_INFO: v2.0.0
                </Typography>
                <Link 
                    href="https://github.com/gokuldc/OpenPrix" 
                    target="_blank" 
                    rel="noopener"
                    sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1, 
                        color: 'text.secondary', 
                        textDecoration: 'none',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px',
                        '&:hover': { color: 'primary.main' }
                    }}
                >
                    <GitHubIcon fontSize="small" />
                </Link>
            </Box>

            <Typography variant="body1" color="text.secondary" paragraph sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                OpenPrix is a Open Source Tool for Estimation and Management of Construction Projects. 
            </Typography>
            
            <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" color="secondary.main" gutterBottom sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>
                        CORE_ENGINE
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: 1.8 }}>
                        • Multi-Region Pricing Logic<br/>
                        • Dynamic BOQ Formula Parsing Engine<br/>
                        • Dexie.js IndexedDB Offline Architecture<br/>
                        • React 18 / Material-UI Blueprint UI
                    </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <GavelIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                        <Typography variant="h6" color="secondary.main" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>
                            LEGAL_LICENSE
                        </Typography>
                    </Box>
                    <Paper 
                        variant="outlined" 
                        sx={{ 
                            p: 1.5, 
                            bgcolor: 'rgba(0,0,0,0.2)', 
                            borderColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 1 
                        }}
                    >
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                            Licensed under the **MIT License**. <br/>
                            Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files.
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            <Box mt={4} textAlign="center">
                <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.disabled', fontSize: '12px' }}>
                    © 2026 Gokul DC
                </Typography>
            </Box>
        </Box>
    );
}