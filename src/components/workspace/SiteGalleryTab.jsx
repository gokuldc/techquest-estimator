import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Grid, Paper, Button, IconButton, Dialog, DialogContent } from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import DeleteIcon from '@mui/icons-material/Delete';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

// 🔥 SMART IMAGE COMPONENT: Routes image requests based on the hardware environment
const SmartImage = ({ filePath, alt, style }) => {
    const [src, setSrc] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const resolveImage = async () => {
            // 1. Detect if we are running natively inside the Electron Desktop App
            const isDesktop = navigator.userAgent.toLowerCase().includes('electron');

            if (isDesktop && window.api?.os?.getBase64) {
                // Desktop Mode: Bypass URLs and read the local file directly from the hard drive
                try {
                    const b64 = await window.api.os.getBase64(filePath);
                    if (b64 && isMounted) {
                        setSrc(b64);
                        return;
                    }
                } catch (e) {
                    console.error("Local image load failed:", e);
                }
            }

            // 2. Network Mode: Route through the Express Server API
            if (isMounted) {
                setSrc(`/api/download?path=${encodeURIComponent(filePath)}`);
            }
        };

        resolveImage();
        return () => { isMounted = false; };
    }, [filePath]);

    if (!src) return (
        <Box sx={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.5)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                LOADING_IMG...
            </Typography>
        </Box>
    );

    return <img src={src} alt={alt} style={style} />;
};


export default function SiteGalleryTab({ projectId }) {
    const [photos, setPhotos] = useState([]);
    const [selectedImg, setSelectedImg] = useState(null);
    const fileInputRef = useRef(null);

    const loadPhotos = async () => {
        const docs = await window.api.db.getProjectDocuments(projectId);
        const images = docs.filter(d => d.category === 'site_gallery' || /\.(jpg|jpeg|png|webp)$/i.test(d.name));
        setPhotos(images);
    };

    useEffect(() => { loadPhotos(); }, [projectId]);

    // UNIVERSAL UPLOAD SYSTEM
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const base64Data = evt.target.result;
            try {
                const res = await window.api.os.uploadFileWeb(file.name, base64Data, projectId);

                if (res.success) {
                    await window.api.db.saveProjectDocument({
                        id: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
                        projectId,
                        name: file.name,
                        category: 'site_gallery',
                        filePath: res.path,
                        fileType: 'image',
                        addedAt: Date.now()
                    });
                    loadPhotos();
                } else {
                    alert("Upload failed: " + (res.error || 'Unknown error'));
                }
            } catch (err) {
                console.error("Upload error:", err);
                alert("Upload process crashed.");
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
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
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>
                    // SITE_VISUAL_LOG ({photos.length})
                </Typography>
                <Button variant="contained" startIcon={<AddAPhotoIcon />} onClick={() => fileInputRef.current.click()} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                    UPLOAD_SITE_PHOTO
                </Button>
            </Box>

            <Grid container spacing={2}>
                {photos.map((photo) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={photo.id}>
                        <Paper sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2, border: '1px solid', borderColor: 'divider', height: 200, bgcolor: 'rgba(0,0,0,0.2)', '&:hover .overlay': { opacity: 1 } }}>

                            {/* 🔥 Rendered using the SmartImage Router */}
                            <SmartImage
                                filePath={photo.filePath}
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
                        /* 🔥 Rendered using the SmartImage Router */
                        <SmartImage
                            filePath={selectedImg.filePath}
                            alt={selectedImg.name}
                            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}