import { useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import {
    Box, Typography, Button, Card, CardContent, CardActions,
    Grid, IconButton, Tooltip, Paper, Divider, Container, SvgIcon
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import StorageIcon from '@mui/icons-material/Storage';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';

const TechQuestLogo = (props) => (
    <SvgIcon viewBox="0 0 48 48" {...props}>
        <path d="M4 44H44" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M12 44V16L24 4L36 16V44" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <path d="M24 4V44" stroke="currentColor" strokeWidth="4" strokeDasharray="4 4" />
        <circle cx="24" cy="24" r="4" fill="currentColor" />
    </SvgIcon>
);

export default function Home({ onOpenProject, onOpenDb, onOpenAbout }) {
    const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray());
    const fileInputRef = useRef(null);

    const createProject = async () => {
        const newProject = {
            id: crypto.randomUUID(),
            name: "New Project",
            clientName: "",
            region: "",
            createdAt: Date.now()
        };
        await db.projects.add(newProject);
        onOpenProject(newProject.id);
    };

    const deleteProject = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("CRITICAL WARNING: Are you sure you want to delete this project?")) {
            await db.projects.delete(id);
            await db.projectBoq.where({ projectId: id }).delete();
        }
    };

    const exportProjects = async () => {
        const allProjects = await db.projects.toArray();
        const allProjectBoqs = await db.projectBoq.toArray();

        const data = {
            projects: allProjects,
            projectBoq: allProjectBoqs,
            exportDate: new Date().toISOString(),
            type: "ProjectData"
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `My_Projects_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importProjects = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm("This will merge the uploaded projects with your current ones. Conflicting IDs will be skipped. Proceed?")) {
            e.target.value = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.type !== "ProjectData" && !data.projects) throw new Error("Invalid file format");

                let addedProjects = 0;
                await db.transaction('rw', db.projects, db.projectBoq, async () => {
                    const existingProjectIds = new Set((await db.projects.toArray()).map(p => p.id));
                    const newProjects = (data.projects || []).filter(p => !existingProjectIds.has(p.id));
                    const newProjectIds = new Set(newProjects.map(p => p.id));
                    const newBoqs = (data.projectBoq || []).filter(b => newProjectIds.has(b.projectId));

                    if (newProjects.length > 0) {
                        await db.projects.bulkAdd(newProjects);
                        await db.projectBoq.bulkAdd(newBoqs);
                        addedProjects = newProjects.length;
                    }
                });
                alert(`Successfully imported ${addedProjects} new projects!`);
            } catch (err) {
                console.error("Import failed", err);
                alert("Failed to import. Please ensure this is a Project Backup file.");
            }
            e.target.value = null;
        };
        reader.readAsText(file);
    };

    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', md: 'center' },
                mb: 6,
                gap: 3,
                pb: 4,
                borderBottom: '1px solid',
                borderColor: 'divider',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{
                        p: 2,
                        border: '2px solid',
                        borderColor: 'primary.main',
                        borderRadius: 2,
                        color: 'primary.main',
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
                    }}>
                        <TechQuestLogo sx={{ fontSize: 48 }} />
                    </Box>
                    <Box>
                        <Typography
                            variant="h3"
                            component="h1"
                            color="text.primary"
                            sx={{
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                fontSize: { xs: '28px', md: '36px' },
                                letterSpacing: '2px',
                            }}
                        >
                            TECHQUEST
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            color="secondary.main"
                            fontWeight="bold"
                            sx={{
                                letterSpacing: 3,
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                fontSize: '12px',
                            }}
                        >
                            {/* CONSTRUCTION ESTIMATOR v1.0 */}
                        </Typography>
                    </Box>
                </Box>
                <Button
                    startIcon={<InfoIcon />}
                    onClick={onOpenAbout}
                    variant="outlined"
                    color="inherit"
                    sx={{
                        borderRadius: 2,
                        borderColor: 'divider',
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontSize: '12px',
                        letterSpacing: '1px',
                    }}
                >
                    ABOUT
                </Button>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, mb: 8 }}>
                <Card elevation={0} sx={{
                    display: 'flex', flexDirection: 'column',
                    border: '1px solid', borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: 'linear-gradient(135deg, rgba(13, 31, 60, 0.8) 0%, rgba(10, 22, 40, 0.9) 100%)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 32px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1)',
                    }
                }}>
                    <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 5 }}>
                        <Box sx={{
                            width: 64, height: 64, mx: 'auto', mb: 3,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid', borderColor: 'primary.main',
                            borderRadius: 2, color: 'primary.main',
                            boxShadow: '0 0 16px rgba(59, 130, 246, 0.15)',
                        }}>
                            <StorageIcon sx={{ fontSize: 32 }} />
                        </Box>
                        <Typography
                            variant="h5"
                            gutterBottom
                            sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '1px' }}
                        >
                            MASTER_DATABASE
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ px: 2, lineHeight: 1.8 }}>
                            Configure regional market rates, upload supplier Excel sheets, and construct recursive BOQ assemblies.
                        </Typography>
                    </CardContent>
                    <Divider sx={{ borderColor: 'divider' }} />
                    <CardActions sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.15)' }}>
                        <Button
                            fullWidth
                            size="large"
                            onClick={onOpenDb}
                            variant="outlined"
                            sx={{
                                borderRadius: 2,
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                letterSpacing: '1px',
                                fontSize: '13px',
                            }}
                        >
                            {'> '}OPEN_MANAGER
                        </Button>
                    </CardActions>
                </Card>

                <Card elevation={0} sx={{
                    display: 'flex', flexDirection: 'column',
                    border: '1px solid', borderColor: 'primary.main',
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(13, 31, 60, 0.9) 100%)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        borderColor: 'primary.light',
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 32px rgba(59, 130, 246, 0.25)',
                    }
                }}>
                    <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 5 }}>
                        <Box sx={{
                            width: 64, height: 64, mx: 'auto', mb: 3,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid', borderColor: 'secondary.main',
                            borderRadius: 2, color: 'secondary.main',
                            boxShadow: '0 0 16px rgba(34, 211, 238, 0.15)',
                        }}>
                            <AddCircleOutlineIcon sx={{ fontSize: 32 }} />
                        </Box>
                        <Typography
                            variant="h5"
                            gutterBottom
                            sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '1px' }}
                        >
                            NEW_PROJECT
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.75, px: 2, lineHeight: 1.8 }}>
                            Initialize a new client workspace to generate estimates and track measurement books based on live data.
                        </Typography>
                    </CardContent>
                    <Divider sx={{ borderColor: 'rgba(59, 130, 246, 0.2)' }} />
                    <CardActions sx={{ p: 2, bgcolor: 'rgba(59, 130, 246, 0.05)' }}>
                        <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={createProject}
                            sx={{
                                borderRadius: 2,
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                letterSpacing: '1px',
                                fontSize: '13px',
                                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)',
                            }}
                        >
                            {'+ '}CREATE_WORKSPACE
                        </Button>
                    </CardActions>
                </Card>
            </Box>

            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Typography
                    variant="h5"
                    fontWeight="700"
                    sx={{
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        letterSpacing: '1px',
                        fontSize: '16px',
                    }}
                >
                    PROJECT_ARCHIVE
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        size="small"
                        variant="text"
                        startIcon={<DownloadIcon />}
                        onClick={exportProjects}
                        sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '11px', letterSpacing: '0.5px' }}
                    >
                        EXPORT
                    </Button>
                    <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={importProjects} />
                    <Button
                        size="small"
                        variant="text"
                        startIcon={<UploadIcon />}
                        onClick={() => fileInputRef.current.click()}
                        sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '11px', letterSpacing: '0.5px' }}
                    >
                        IMPORT
                    </Button>
                </Box>
            </Box>
            <Divider sx={{ mb: 4, borderColor: 'divider' }} />

            <Grid container spacing={3}>
                {projects?.length === 0 ? (
                    <Grid item xs={12}>
                        <Box sx={{
                            py: 10, textAlign: 'center',
                            border: '2px dashed', borderColor: 'divider',
                            borderRadius: 2,
                            bgcolor: 'rgba(0,0,0,0.15)',
                        }}>
                            <FolderOpenIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                            <Typography color="text.secondary" variant="h6" sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '1px', fontSize: '14px' }}>NO_ACTIVE_PROJECTS</Typography>
                            <Typography color="text.disabled" variant="body2" sx={{ mt: 1 }}>Click 'Create Workspace' to begin.</Typography>
                        </Box>
                    </Grid>
                ) : (
                    projects?.map(p => (
                        <Grid item xs={12} key={p.id}>
                            <Paper elevation={0} sx={{
                                p: 3, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center',
                                border: '1px solid', borderColor: 'divider', borderRadius: 2,
                                transition: '0.2s',
                                background: 'rgba(13, 31, 60, 0.5)',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: 'rgba(59, 130, 246, 0.05)',
                                    boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.1)',
                                }
                            }}>
                                <Box sx={{ minWidth: '200px' }}>
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            lineHeight: 1.2, mb: 0.5,
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            fontSize: '15px',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        {p.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '12px' }}>
                                        {p.clientName ? `CLIENT: ${p.clientName} | ` : ''}REGION: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{p.region || "STANDARD"}</span>
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Tooltip title="Permanently Delete">
                                        <IconButton
                                            color="error"
                                            onClick={(e) => deleteProject(p.id, e)}
                                            size="small"
                                            sx={{
                                                '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' }
                                            }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Button
                                        variant="contained"
                                        disableElevation
                                        onClick={() => onOpenProject(p.id)}
                                        sx={{
                                            borderRadius: 2,
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            letterSpacing: '1px',
                                            fontSize: '12px',
                                        }}
                                    >
                                        OPEN
                                    </Button>
                                </Box>
                            </Paper>
                        </Grid>
                    ))
                )}
            </Grid>
        </Container>
    );
}
