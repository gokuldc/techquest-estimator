import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Paper, Button, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, IconButton, TextField, MenuItem, Chip 
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArchitectureIcon from '@mui/icons-material/Architecture';

export default function DocumentsTab({ projectId }) {
    const [docs, setDocs] = useState([]);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("Drawing");

    const loadDocs = async () => {
        const data = await window.api.db.getProjectDocuments(projectId);
        setDocs(data || []);
    };

    useEffect(() => { loadDocs(); }, [projectId]);

    const handleLinkFile = async () => {
        const path = await window.api.os.pickFile();
        if (!path) return;

        const extension = path.split('.').pop().toLowerCase();
        
        const newDoc = {
            id: crypto.randomUUID(),
            projectId,
            name: name || path.split('\\').pop().split('/').pop(),
            category,
            filePath: path,
            fileType: extension,
            addedAt: Date.now()
        };

        await window.api.db.saveProjectDocument(newDoc);
        setName("");
        loadDocs();
    };

    const handleOpenFile = async (path) => {
        const result = await window.api.os.openFile(path);
        if (!result.success) alert("Could not open file. It may have been moved or deleted.");
    };

    const handleDeleteDoc = async (id) => {
        if (window.confirm("Remove this link? (The actual file will not be deleted)")) {
            await window.api.db.deleteProjectDocument(id);
            loadDocs();
        }
    };

    const getIcon = (type) => {
        if (['pdf'].includes(type)) return <PictureAsPdfIcon color="error" />;
        if (['jpg', 'png', 'jpeg'].includes(type)) return <ImageIcon color="info" />;
        if (['dwg', 'dxf'].includes(type)) return <ArchitectureIcon color="warning" />;
        return <DescriptionIcon />;
    };

    return (
        <Box display="flex" flexDirection="column" gap={3}>
            {/* ADD DOCUMENT BAR */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography variant="subtitle2" fontWeight="bold" mb={2} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>LINK_NEW_DOCUMENT</Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                    <TextField size="small" label="DOCUMENT NAME" value={name} onChange={e => setName(e.target.value)} sx={{ flex: 2 }} />
                    <TextField select size="small" label="CATEGORY" value={category} onChange={e => setCategory(e.target.value)} sx={{ width: 180 }}>
                        <MenuItem value="Drawing">Drawing / Blueprint</MenuItem>
                        <MenuItem value="Contract">Legal / Contract</MenuItem>
                        <MenuItem value="Photo">Site Photo</MenuItem>
                        <MenuItem value="Invoice">Supplier Invoice</MenuItem>
                    </TextField>
                    <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={handleLinkFile} sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                        SELECT & LINK FILE
                    </Button>
                </Box>
            </Paper>

            {/* DOCUMENT LIST */}
            <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ bgcolor: 'transparent' }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                        <TableRow>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>TYPE</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DOC_NAME</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CATEGORY</TableCell>
                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DATE_ADDED</TableCell>
                            <TableCell align="right" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTIONS</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {docs.map((doc) => (
                            <TableRow key={doc.id} hover>
                                <TableCell>{getIcon(doc.fileType)}</TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight="bold">{doc.name}</Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300, display: 'block' }}>{doc.filePath}</Typography>
                                </TableCell>
                                <TableCell><Chip label={doc.category} size="small" sx={{ fontSize: '10px' }} /></TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{new Date(doc.addedAt).toLocaleDateString()}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" color="primary" onClick={() => handleOpenFile(doc.filePath)} title="Open in System Viewer">
                                        <LaunchIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" color="error" onClick={() => handleDeleteDoc(doc.id)}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {docs.length === 0 && (
                            <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>NO DOCUMENTS LINKED</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}