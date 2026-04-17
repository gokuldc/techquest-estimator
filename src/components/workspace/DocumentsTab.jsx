import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Paper, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, TextField, MenuItem, Chip,
    Accordion, AccordionSummary, AccordionDetails, Dialog, DialogTitle, DialogContent
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import UploadFileIcon from '@mui/icons-material/UploadFile';

export default function DocumentsTab({ projectId }) {
    const [docs, setDocs] = useState([]);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("Drawing / Blueprint");

    // Version History Modal State
    const [historyOpen, setHistoryOpen] = useState(false);
    const [selectedDocGroup, setSelectedDocGroup] = useState([]);

    const loadDocs = async () => {
        const data = await window.api.db.getProjectDocuments(projectId);
        setDocs(data || []);
    };

    useEffect(() => { loadDocs(); }, [projectId]);

    // 🔥 THE VERSIONING ENGINE: Group by Category -> Group by Name -> Sort by Date
    const categorizedDocs = useMemo(() => {
        const groups = {};

        docs.forEach(doc => {
            if (!groups[doc.category]) groups[doc.category] = {};

            const nameKey = (doc.name || "Untitled").trim().toLowerCase();
            if (!groups[doc.category][nameKey]) groups[doc.category][nameKey] = [];

            groups[doc.category][nameKey].push(doc);
        });

        // Sort versions newest first so [0] is always the latest
        Object.keys(groups).forEach(cat => {
            Object.keys(groups[cat]).forEach(nameKey => {
                groups[cat][nameKey].sort((a, b) => b.addedAt - a.addedAt);
            });
        });

        return groups;
    }, [docs]);

    const handleLinkFile = async (explicitName = null, explicitCategory = null) => {
        const path = await window.api.os.pickFile();
        if (!path) return;

        const extension = path.split('.').pop().toLowerCase();

        // If updating a version, use the exact explicit name. Otherwise, use user input or filename.
        const finalName = explicitName || name || path.split('\\').pop().split('/').pop();
        const finalCategory = explicitCategory || category;

        const newDoc = {
            id: crypto.randomUUID(),
            projectId,
            name: finalName,
            category: finalCategory,
            filePath: path,
            fileType: extension,
            addedAt: Date.now()
        };

        await window.api.db.saveProjectDocument(newDoc);
        setName(""); // Clear input
        loadDocs();
    };

    const handleOpenFile = async (path) => {
        const result = await window.api.os.openFile(path);
        if (!result.success) alert("Could not open file. It may have been moved or deleted from the host system.");
    };

    const handleDeleteDoc = async (id, isGroupDelete = false) => {
        const msg = isGroupDelete
            ? "CRITICAL: Delete THIS ENTIRE DOCUMENT GROUP and all its versions?"
            : "Remove this specific version? (The actual file remains on your disk)";

        if (window.confirm(msg)) {
            await window.api.db.deleteProjectDocument(id);
            loadDocs();
            if (historyOpen) setHistoryOpen(false); // Close history if we deleted from it
        }
    };

    const getIcon = (type) => {
        if (['pdf'].includes(type)) return <PictureAsPdfIcon color="error" />;
        if (['jpg', 'png', 'jpeg'].includes(type)) return <ImageIcon color="info" />;
        if (['dwg', 'dxf'].includes(type)) return <ArchitectureIcon color="warning" />;
        return <DescriptionIcon />;
    };

    const CATEGORY_OPTIONS = [
        "Drawing / Blueprint",
        "Legal / Contract",
        "Site Photo",
        "Supplier Invoice",
        "Permit / Compliance",
        "Technical Spec",
        "Other"
    ];

    return (
        <Box display="flex" flexDirection="column" gap={3}>

            {/* ADD BRAND NEW DOCUMENT BAR */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'primary.main' }}>
                    // INITIALIZE_NEW_DOCUMENT_GROUP
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                    <TextField size="small" label="DOCUMENT MASTER NAME" value={name} onChange={e => setName(e.target.value)} sx={{ flex: 2 }} helperText="Uploading a file with the same name creates a new Version." />
                    <TextField select size="small" label="CATEGORY" value={category} onChange={e => setCategory(e.target.value)} sx={{ width: 220 }}>
                        {CATEGORY_OPTIONS.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
                    </TextField>
                    <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={() => handleLinkFile()} sx={{ borderRadius: 2, fontWeight: 'bold', height: 40 }}>
                        SELECT & INITIALIZE
                    </Button>
                </Box>
            </Paper>

            {/* DOCUMENT CATEGORIES ACCORDIONS */}
            <Box>
                {Object.keys(categorizedDocs).length === 0 ? (
                    <Paper sx={{ p: 5, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>NO DOCUMENTS ARCHIVED IN THIS WORKSPACE</Typography>
                    </Paper>
                ) : (
                    Object.entries(categorizedDocs).sort().map(([catName, docGroups]) => (
                        <Accordion key={catName} defaultExpanded disableGutters sx={{ mb: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.4)', '&:before': { display: 'none' } }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'rgba(0,0,0,0.2)', borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="subtitle2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {catName.toUpperCase()}
                                    <Chip label={`${Object.keys(docGroups).length} Docs`} size="small" color="primary" sx={{ height: 20, fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" }} />
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: 50 }}>TYPE</TableCell>
                                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DOCUMENT_NAME</TableCell>
                                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: 100 }}>VERSION</TableCell>
                                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: 150 }}>LAST_UPDATED</TableCell>
                                                <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', width: 220 }}>ACTIONS</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {Object.entries(docGroups).map(([nameKey, versions]) => {
                                                const latestDoc = versions[0]; // Guaranteed to be latest due to sorting
                                                const versionCount = versions.length;

                                                return (
                                                    <TableRow key={nameKey} hover sx={{ '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' } }}>
                                                        <TableCell>{getIcon(latestDoc.fileType)}</TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="bold">{latestDoc.name}</Typography>
                                                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 350, display: 'block', fontSize: '10px' }}>
                                                                {latestDoc.filePath}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={`v${versionCount}.0`}
                                                                size="small"
                                                                color={versionCount > 1 ? "success" : "default"}
                                                                variant={versionCount > 1 ? "filled" : "outlined"}
                                                                sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 'bold' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                                            {new Date(latestDoc.addedAt).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {/* OPEN LATEST */}
                                                            <IconButton size="small" color="primary" onClick={() => handleOpenFile(latestDoc.filePath)} title="Open Latest Version">
                                                                <LaunchIcon fontSize="small" />
                                                            </IconButton>

                                                            {/* ADD REVISION */}
                                                            <IconButton size="small" color="info" onClick={() => handleLinkFile(latestDoc.name, latestDoc.category)} title="Upload New Revision">
                                                                <UploadFileIcon fontSize="small" />
                                                            </IconButton>

                                                            {/* VIEW HISTORY */}
                                                            <IconButton size="small" color="secondary" disabled={versionCount <= 1} onClick={() => { setSelectedDocGroup(versions); setHistoryOpen(true); }} title="View Version History">
                                                                <HistoryIcon fontSize="small" />
                                                            </IconButton>

                                                            {/* DELETE ALL */}
                                                            <IconButton size="small" color="error" onClick={() => {
                                                                // Delete all versions iteratively
                                                                if (window.confirm("Delete this ENTIRE document group and all its versions?")) {
                                                                    versions.forEach(v => window.api.db.deleteProjectDocument(v.id));
                                                                    setTimeout(loadDocs, 500); // Hacky delay to wait for loop to finish
                                                                }
                                                            }} title="Delete Document Group">
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </AccordionDetails>
                        </Accordion>
                    ))
                )}
            </Box>

            {/* 🔥 VERSION HISTORY MODAL 🔥 */}
            <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider' } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    VERSION_HISTORY: <span style={{ color: '#3b82f6' }}>{selectedDocGroup[0]?.name}</span>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>VER</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>PATH / FILE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>DATE</TableCell>
                                <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>ACTIONS</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {selectedDocGroup.map((doc, index) => {
                                // Math to figure out version number (Latest is length, oldest is 1)
                                const vNum = selectedDocGroup.length - index;
                                const isLatest = index === 0;

                                return (
                                    <TableRow key={doc.id} sx={{ bgcolor: isLatest ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                                        <TableCell>
                                            <Chip label={`v${vNum}.0`} size="small" color={isLatest ? "success" : "default"} variant={isLatest ? "filled" : "outlined"} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }} />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{doc.filePath}</Typography>
                                            {isLatest && <Typography variant="caption" color="success.main" sx={{ ml: 2, fontWeight: 'bold' }}>(CURRENT_ACTIVE)</Typography>}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>{new Date(doc.addedAt).toLocaleString()}</TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" color="primary" onClick={() => handleOpenFile(doc.filePath)}><LaunchIcon fontSize="small" /></IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDeleteDoc(doc.id, false)}><DeleteIcon fontSize="small" /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </DialogContent>
            </Dialog>

        </Box>
    );
}