import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Paper, Button, IconButton, Dialog, DialogContent } from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import DeleteIcon from '@mui/icons-material/Delete';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

export default function SiteGalleryTab({ projectId }) {
    const [photos, setPhotos] = useState([]);
    const [selectedImg, setSelectedImg] = useState(null);

    const loadPhotos = async () => {
        const docs = await window.api.db.getProjectDocuments(projectId);
        // Look for images or specifically items tagged 'site_gallery'
        const images = docs.filter(d => d.category === 'site_gallery' || /\.(jpg|jpeg|png|webp)$/i.test(d.name));
        setPhotos(images);
    };

    useEffect(() => { loadPhotos(); }, [projectId]);

    const handleUpload = async () => {
        if (window.api?.os?.pickFile && !window.api.os.pickFile.isPolyfill) {
            const filePath = await window.api.os.pickFile();
            if (!filePath) return;
            const fileName = filePath.split('\\').pop().split('/').pop();

            await window.api.db.saveProjectDocument({
                id: crypto.randomUUID(),
                projectId,
                name: fileName,
                category: 'site_gallery',
                filePath: filePath,
                fileType: 'image',
                addedAt: Date.now()
            });
            loadPhotos();
        } else {
            alert("Mobile uploads restricted. Please use the Desktop Host to upload site photos.");
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Permanently delete this site photo?")) {
            await window.api.db.deleteProjectDocument(id);
            loadPhotos();
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>
                    // SITE_VISUAL_LOG ({photos.length})
                </Typography>
                <Button variant="contained" startIcon={<AddAPhotoIcon />} onClick={handleUpload} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                    UPLOAD_SITE_PHOTO
                </Button>
            </Box>

            <Grid container spacing={2}>
                {photos.map((photo) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={photo.id}>
                        <Paper sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2, border: '1px solid', borderColor: 'divider', height: 200, bgcolor: 'rgba(0,0,0,0.2)', '&:hover .overlay': { opacity: 1 } }}>
                            <img
                                src={`/api/download?path=${encodeURIComponent(photo.filePath)}`}
                                alt={photo.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <Box className="overlay" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, opacity: 0, transition: '0.2s' }}>
                                <IconButton color="primary" onClick={() => setSelectedImg(photo)}><FullscreenIcon /></IconButton>
                                <IconButton color="error" onClick={(e) => handleDelete(photo.id, e)}><DeleteIcon /></IconButton>
                            </Box>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={Boolean(selectedImg)} onClose={() => setSelectedImg(null)} maxWidth="lg">
                <DialogContent sx={{ p: 0, bgcolor: '#000', display: 'flex', justifyContent: 'center' }}>
                    {selectedImg && (
                        <img
                            src={`/api/download?path=${encodeURIComponent(selectedImg.filePath)}`}
                            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}