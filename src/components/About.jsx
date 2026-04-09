import React, { useState } from "react";
import { Box, Typography, Button, Paper, Tabs, Tab, IconButton } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import licenseText from '../../LICENSE?raw';

export default function About({ onBack }) {
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
    };

    const openExternalLink = (url) => {
        if (typeof window !== 'undefined' && window.open) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <Box sx={{ maxWidth: 800, margin: "40px auto", padding: "20px" }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={onBack}
                    variant="outlined"
                    color="inherit"
                    sx={{
                        borderRadius: 2,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '1px',
                        fontSize: '12px',
                        borderColor: 'divider',
                        color: 'text.secondary',
                        '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                    }}
                >
                    {'< '}HOME
                </Button>
                <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '1px',
                        fontSize: { xs: '18px', md: '22px' },
                    }}
                >
                    ABOUT_OPENPRIX
                </Typography>
            </Box>

            <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box sx={{
                    p: 4,
                    bgcolor: 'rgba(59, 130, 246, 0.08)',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    position: 'relative',
                }}>
                    <Typography
                        variant="h3"
                        gutterBottom
                        fontWeight="bold"
                        sx={{
                            fontFamily: "'JetBrains Mono', monospace",
                            letterSpacing: '2px',
                            fontSize: { xs: '24px', md: '32px' },
                            color: 'primary.main',
                        }}
                    >
                        OPENPRIX
                    </Typography>
                    <Typography
                        variant="subtitle1"
                        sx={{
                            opacity: 0.7,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '12px',
                            letterSpacing: '1px',
                        }}
                    >
                        VERSION 1.2.3 // PROFESSIONAL CIVIL ENGINEERING SOLUTION
                    </Typography>

                    <IconButton
                        onClick={() => openExternalLink('https://github.com/gokuldc/openprix')}
                        sx={{
                            position: 'absolute', top: 24, right: 24,
                            color: 'primary.main',
                            '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' },
                        }}
                        title="View Source on GitHub"
                    >
                        <GitHubIcon fontSize="large" />
                    </IconButton>
                </Box>

                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: 'rgba(0,0,0,0.15)' }}>
                    <Tabs value={tabIndex} onChange={handleTabChange} aria-label="about tabs">
                        <Tab label="01_ABOUT" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                        <Tab label="02_LICENSE" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    </Tabs>
                </Box>

                {tabIndex === 0 && (
                    <Box sx={{ p: 4 }}>
                        <Typography
                            variant="h5"
                            gutterBottom
                            fontWeight="medium"
                            color="primary.main"
                            sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}
                        >
                            ARCHITECTURE_AND_PURPOSE
                        </Typography>
                        <Typography variant="body1" paragraph lineHeight={1.8} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary' }}>
                            This application is an advanced, offline-first desktop tool designed to streamline the civil engineering and construction estimation process. It bridges the gap between raw master databases, Local Market Rates (LMR), and project-specific Bill of Quantities (BOQ).
                        </Typography>
                        <Typography variant="body1" paragraph lineHeight={1.8} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary' }}>
                            By supporting nested assemblies, recursive rate calculations, and dynamic measurement books (MBook), it ensures that every project is priced accurately based on regional variables and live market data.
                        </Typography>
                        <Typography variant="body1" paragraph lineHeight={1.8} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'text.secondary' }}>
                            Built completely offline using IndexedDB, your master templates and sensitive client data never leave your local machine unless manually exported.
                        </Typography>

                        <Box sx={{ mt: 5, pt: 3, borderTop: 1, borderColor: "divider", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="body1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                    DEVELOPED_BY: GOKUL_DC
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', mt: 0.5 }}>
                                    [gokuldc@proton.me]
                                </Typography>
                            </Box>
                            <Button
                                variant="outlined"
                                startIcon={<GitHubIcon />}
                                endIcon={<OpenInNewIcon fontSize="small" />}
                                onClick={() => openExternalLink('https://github.com/gokuldc/openprix')}
                                sx={{
                                    borderRadius: 2,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    letterSpacing: '1px',
                                    fontSize: '12px',
                                }}
                            >
                                GITHUB
                            </Button>
                        </Box>
                    </Box>
                )}

                {tabIndex === 1 && (
                    <Box sx={{ p: 4 }}>
                        <Typography
                            variant="h5"
                            gutterBottom
                            fontWeight="medium"
                            color="primary.main"
                            sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '16px' }}
                        >
                            SOFTWARE_LICENSE
                        </Typography>

                        <Paper
                            elevation={0}
                            variant="outlined"
                            sx={{
                                p: 3,
                                bgcolor: 'rgba(0,0,0,0.2)',
                                borderRadius: 2,
                                mt: 2,
                                maxHeight: '400px',
                                overflowY: 'auto',
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Typography
                                variant="body2"
                                fontFamily="'JetBrains Mono', monospace"
                                sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '12px', color: 'text.secondary' }}
                            >
                                {licenseText || "License file not found. Please ensure a LICENSE file exists in the repository root."}
                            </Typography>
                        </Paper>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
