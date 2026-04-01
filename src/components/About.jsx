import React, { useState } from "react";
import { Box, Typography, Button, Paper, Tabs, Tab, IconButton } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

// Import the raw text of the LICENSE file from the project root using Vite's ?raw loader
import licenseText from '../../LICENSE?raw';

export default function About({ onBack }) {
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
    };

    // Electron-safe way to open external links
    const openExternalLink = (url) => {
        if (typeof window !== 'undefined' && window.open) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <Box sx={{ maxWidth: 800, margin: "40px auto", padding: "20px" }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" color="inherit" sx={{ borderRadius: 2 }}>
                    Home
                </Button>
                <Typography variant="h4" fontWeight="bold">System Info</Typography>
            </Box>

            <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                {/* Header Section */}
                <Box sx={{ p: 4, bgcolor: 'primary.main', color: 'primary.contrastText', position: 'relative' }}>
                    <Typography variant="h3" gutterBottom fontWeight="bold">
                        TechQuest Estimator
                    </Typography>
                    <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                        Version 1.0.0 | Professional Civil Engineering Solution
                    </Typography>

                    {/* GitHub Link Button */}
                    <IconButton
                        onClick={() => openExternalLink('https://github.com/gokuldc/techquest-estimator')}
                        sx={{ position: 'absolute', top: 24, right: 24, color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                        title="View Source on GitHub"
                    >
                        <GitHubIcon fontSize="large" />
                    </IconButton>
                </Box>

                {/* Tabs Navigation */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                    <Tabs value={tabIndex} onChange={handleTabChange} aria-label="about tabs">
                        <Tab label="About App" sx={{ fontWeight: 'bold' }} />
                        <Tab label="License" sx={{ fontWeight: 'bold' }} />
                    </Tabs>
                </Box>

                {/* Tab 0: About Content */}
                {tabIndex === 0 && (
                    <Box sx={{ p: 4 }}>
                        <Typography variant="h5" gutterBottom fontWeight="medium" color="primary.main">
                            Architecture & Purpose
                        </Typography>
                        <Typography variant="body1" paragraph lineHeight={1.8}>
                            This application is an advanced, offline-first desktop tool designed to streamline the civil engineering and construction estimation process. It bridges the gap between raw master databases, Local Market Rates (LMR), and project-specific Bill of Quantities (BOQ).
                        </Typography>
                        <Typography variant="body1" paragraph lineHeight={1.8}>
                            By supporting nested assemblies, recursive rate calculations, and dynamic measurement books (MBook), it ensures that every project is priced accurately based on regional variables and live market data.
                        </Typography>
                        <Typography variant="body1" paragraph lineHeight={1.8}>
                            Built completely offline using IndexedDB, your master templates and sensitive client data never leave your local machine unless manually exported.
                        </Typography>

                        <Box sx={{ mt: 5, pt: 3, borderTop: 1, borderColor: "divider", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="body1" fontWeight="bold">
                                    Developed by Gokul DC
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    For TechQuest Innovations Pvt. Ltd.
                                </Typography>
                            </Box>
                            <Button
                                variant="outlined"
                                startIcon={<GitHubIcon />}
                                endIcon={<OpenInNewIcon fontSize="small" />}
                                onClick={() => openExternalLink('https://github.com/gokuldc/techquest-estimator')}
                                sx={{ borderRadius: 2 }}
                            >
                                Github
                            </Button>
                        </Box>
                    </Box>
                )}

                {/* Tab 1: License Content */}
                {tabIndex === 1 && (
                    <Box sx={{ p: 4 }}>
                        <Typography variant="h5" gutterBottom fontWeight="medium" color="primary.main">
                            Software License
                        </Typography>

                        <Paper elevation={0} variant="outlined" sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 2, mt: 2, maxHeight: '400px', overflowY: 'auto' }}>
                            {/* Dynamically render the imported text */}
                            <Typography variant="body2" fontFamily="monospace" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {licenseText || "License file not found. Please ensure a LICENSE file exists in the repository root."}
                            </Typography>
                        </Paper>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}