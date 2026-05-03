import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Grid, Paper, Button, IconButton, Dialog, DialogContent, Checkbox } from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import DeleteIcon from '@mui/icons-material/Delete';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

const SmartImage = ({ filePath, alt, style }) => {
    const [src, setSrc] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const resolveImage = async () => {
            const isDesktop = navigator.userAgent.toLowerCase().includes('electron');

            if (isDesktop && window.api?.os?.getBase64) {
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

            if (isMounted) {
                const targetUrl = sessionStorage.getItem('openprix_server_url') || 'http://127.0.0.1:3000';
                setSrc(`${targetUrl}/api/os/download?path=${encodeURIComponent(filePath)}`);
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
    const [uploadProgress, setUploadProgress] = useState({ uploading: false, current: 0, total: 0 });
    
    // 🔥 NEW: State to track selected photos for bulk deletion
    const [selectedIds, setSelectedIds] = useState([]);
    
    const fileInputRef = useRef(null);

    const loadPhotos = async () => {
        const docs = await window.api.db.getProjectDocuments(projectId);
        const images = docs.filter(d => d.category === 'site_gallery' || /\.(jpg|jpeg|png|webp)$/i.test(d.name));
        setPhotos(images);
    };

    useEffect(() => { loadPhotos(); }, [projectId]);

    useEffect(() => {
        if (!selectedImg) return;

        const handleKeyDown = (e) => {
            const currentIndex = photos.findIndex(p => p.id === selectedImg.id);
            if (e.key === 'ArrowRight') {
                setSelectedImg(currentIndex < photos.length - 1 ? photos[currentIndex + 1] : photos[0]);
            }
            if (e.key === 'ArrowLeft') {
                setSelectedImg(currentIndex > 0 ? photos[currentIndex - 1] : photos[photos.length - 1]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImg, photos]);

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploadProgress({ uploading: true, current: 0, total: files.length });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            const base64Data = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (evt) => resolve(evt.target.result);
                reader.readAsDataURL(file);
            });

            try {
                const res = await window.api.os.uploadFileWeb(file.name, base64Data, projectId);
                const filePath = (res && typeof res === 'string') ? res : null;
                
                if (filePath) {
                    await window.api.db.saveProjectDocument({
                        id: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
                        projectId,
                        name: file.name,
                        category: 'site_gallery',
                        filePath,
                        fileType: 'image',
                        addedAt: Date.now()
                    });
                } else {
                    console.error("Upload failed for:", file.name, res);
                }
            } catch (err) {
                console.error("Upload error for:", file.name, err);
            }

            setUploadProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setUploadProgress({ uploading: false, current: 0, total: 0 });
        loadPhotos();
        e.target.value = '';
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Permanently delete this site photo?")) {
            await window.api.db.deleteProjectDocument(id);
            // Clear from selection if it was selected
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
            loadPhotos();
        }
    };

    // 🔥 NEW: Toggle selection for a single photo
    const toggleSelect = (id, e) => {
        e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // 🔥 NEW: Bulk delete handler
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Permanently delete ${selectedIds.length} selected photos?`)) {
            // Delete sequentially to prevent locking the SQLite database
            for (const id of selectedIds) {
                await window.api.db.deleteProjectDocument(id);
            }
            setSelectedIds([]);
            loadPhotos();
        }
    };

    const handleNext = () => {
        const currentIndex = photos.findIndex(p => p.id === selectedImg.id);
        setSelectedImg(currentIndex < photos.length - 1 ? photos[currentIndex + 1] : photos[0]);
    };

    const handlePrev = () => {
        const currentIndex = photos.findIndex(p => p.id === selectedImg.id);
        setSelectedImg(currentIndex > 0 ? photos[currentIndex - 1] : photos[photos.length - 1]);
    };

    return (
        <Box>
            <input
                type="file"
                accept="image/*"
                multiple 
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>
                    // SITE_VISUAL_LOG ({photos.length})
                </Typography>
                
                {/* 🔥 UPGRADED: Contextual Action Button (Upload vs Delete Selected) */}
                <Box>
                    {selectedIds.length > 0 ? (
                        <Button 
                            variant="contained" 
                            color="error"
                            startIcon={<DeleteIcon />} 
                            onClick={handleBulkDelete} 
                            sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', mr: 1 }}
                        >
                            DELETE SELECTED ({selectedIds.length})
                        </Button>
                    ) : null}

                    <Button 
                        variant="contained" 
                        startIcon={<AddAPhotoIcon />} 
                        onClick={() => fileInputRef.current.click()} 
                        disabled={uploadProgress.uploading}
                        sx={{ 
                            borderRadius: 50, 
                            fontFamily: "'JetBrains Mono', monospace", 
                            fontSize: '11px',
                            transition: 'all 0.3s'
                        }}
                    >
                        {uploadProgress.uploading 
                            ? `UPLOADING (${uploadProgress.current} / ${uploadProgress.total})...` 
                            : "UPLOAD_SITE_PHOTOS"
                        }
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={2}>
                {photos.map((photo) => {
                    const isSelected = selectedIds.includes(photo.id);
                    return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={photo.id}>
                            <Paper 
                                onClick={(e) => toggleSelect(photo.id, e)} // Clicking the card toggles selection
                                sx={{ 
                                    position: 'relative', 
                                    overflow: 'hidden', 
                                    borderRadius: 2, 
                                    border: isSelected ? '2px solid #3b82f6' : '1px solid', 
                                    borderColor: isSelected ? '#3b82f6' : 'divider', 
                                    height: 200, 
                                    bgcolor: 'rgba(0,0,0,0.2)', 
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover .overlay': { opacity: 1 },
                                    transform: isSelected ? 'scale(0.98)' : 'scale(1)'
                                }}
                            >
                                {/* 🔥 NEW: The Selection Checkbox */}
                                <Checkbox
                                    icon={<RadioButtonUncheckedIcon sx={{ color: 'rgba(255,255,255,0.7)' }}/>}
                                    checkedIcon={<CheckCircleIcon sx={{ color: '#3b82f6' }}/>}
                                    checked={isSelected}
                                    onChange={(e) => toggleSelect(photo.id, e)}
                                    sx={{ position: 'absolute', top: 8, left: 8, zIndex: 10, bgcolor: isSelected ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)', borderRadius: 1, p: 0.5, '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
                                />

                                <SmartImage
                                    filePath={photo.filePath}
                                    alt={photo.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                
                                <Box className="overlay" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, opacity: isSelected ? 1 : 0, transition: '0.2s' }}>
                                    <IconButton color="primary" sx={{ bgcolor: 'rgba(0,0,0,0.7)', '&:hover': { bgcolor: '#000' } }} onClick={(e) => { e.stopPropagation(); setSelectedImg(photo); }}>
                                        <FullscreenIcon />
                                    </IconButton>
                                    <IconButton color="error" sx={{ bgcolor: 'rgba(0,0,0,0.7)', '&:hover': { bgcolor: '#000' } }} onClick={(e) => handleDelete(photo.id, e)}>
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>

            <Dialog 
                open={Boolean(selectedImg)} 
                onClose={() => setSelectedImg(null)} 
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { bgcolor: 'transparent', boxShadow: 'none', backgroundImage: 'none' }
                }}
            >
                <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', position: 'relative', overflow: 'hidden' }}>
                    
                    {selectedImg && (
                        <>
                            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
                                <SmartImage
                                    filePath={selectedImg.filePath}
                                    alt={selectedImg.name}
                                    style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
                                />
                            </Box>

                            <IconButton 
                                onClick={() => setSelectedImg(null)} 
                                sx={{ position: 'absolute', top: 16, right: 16, color: 'white', bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(255,0,0,0.8)' } }}
                            >
                                <CloseIcon />
                            </IconButton>

                            {photos.length > 1 && (
                                <IconButton 
                                    onClick={handlePrev} 
                                    sx={{ position: 'absolute', left: 16, color: 'white', bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.8)' } }}
                                >
                                    <ChevronLeftIcon fontSize="large" />
                                </IconButton>
                            )}

                            {photos.length > 1 && (
                                <IconButton 
                                    onClick={handleNext} 
                                    sx={{ position: 'absolute', right: 16, color: 'white', bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.8)' } }}
                                >
                                    <ChevronRightIcon fontSize="large" />
                                </IconButton>
                            )}
                        </>
                    )}

                </DialogContent>
            </Dialog>
        </Box>
    );
}