import React, { useState, useEffect, useRef, useMemo } from "react";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { exportProjectExcel } from "../utils/exportExcel";
import { exportProjectPdf } from "../utils/exportPdf";

import { useProjectCalculations } from "../hooks/useProjectCalculations";
import MasterBoqEditor from "./workspace/MasterBoqEditor";

import ProjectDetailsTab from "./workspace/ProjectDetailsTab";
import BoqBuilderTab from "./workspace/BoqBuilderTab";
import MeasurementBookTab from "./workspace/MeasurementBookTab";
import GanttScheduleTab from "./workspace/GanttScheduleTab";
import SubcontractorBidTab from "./workspace/SubcontractorBidTab";
import DailyLogTab from "./workspace/DailyLogTab";
import ResourceTrackerTab from "./workspace/ResourceTrackerTab";
import ProcurementTab from "./workspace/ProcurementTab";
import ClientBillingTab from "./workspace/ClientBillingTab";
import KanbanBoardTab from "./workspace/KanbanBoardTab";
import FormulaGuideDialog from "./workspace/FormulaGuideDialog";
import InventoryTab from "./workspace/InventoryTab";
import DocumentsTab from "./workspace/DocumentsTab";
import SiteGalleryTab from "./workspace/SiteGalleryTab";
import ChatModule from "./workspace/ChatModule";

import { 
    Box, Typography, Button, Paper, Dialog, DialogTitle, DialogContent, 
    DialogActions, FormControlLabel, Checkbox, IconButton, Tooltip,
    List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Chip
} from "@mui/material";

// 🔥 Workspace Navigation Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import LockIcon from '@mui/icons-material/Lock';
import SyncIcon from '@mui/icons-material/Sync';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import SquareFootOutlinedIcon from '@mui/icons-material/SquareFootOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';

import { useAuth } from "../context/AuthContext";

// 🔥 UPDATED WORKFLOW SEQUENCE WITH ICONS & COLORS
const RAW_CATEGORIES = {
    planning: {
        id: "planning", label: "PLANNING & SETUP", minClearance: 1, color: '#3b82f6',
        children: [
            { id: "details", label: "Project Details", minClearance: 1, icon: <InfoOutlinedIcon /> },
            { id: "documents", label: "Docs & Drawings", minClearance: 1, icon: <FolderCopyOutlinedIcon /> },
            { id: "boq", label: "Master BOQ", minClearance: 3, icon: <ListAltOutlinedIcon /> },
            { id: "schedule", label: "Gantt Schedule", minClearance: 2, icon: <CalendarTodayOutlinedIcon /> },
            { id: "subcontractors", label: "Subcontractors", minClearance: 3, icon: <HandshakeOutlinedIcon /> }
        ]
    },
    execution: {
        id: "execution", label: "SITE EXECUTION", minClearance: 2, color: '#f59e0b',
        children: [
            { id: "kanban", label: "Task Board", minClearance: 2, icon: <ViewKanbanOutlinedIcon /> },
            { id: "gallery", label: "Site Photo Gallery", minClearance: 2, icon: <PhotoLibraryOutlinedIcon /> },
            { id: "daily_log", label: "Daily Log", minClearance: 2, icon: <MenuBookOutlinedIcon /> },
            { id: "mbook", label: "Measurement Book", minClearance: 2, icon: <SquareFootOutlinedIcon /> }
        ]
    },
    supply_chain: {
        id: "supply_chain", label: "SUPPLY CHAIN", minClearance: 2, color: '#10b981',
        children: [
            { id: "resources", label: "Resource Deficits", minClearance: 3, icon: <PrecisionManufacturingOutlinedIcon /> },
            { id: "procurement", label: "Procurement (POs)", minClearance: 3, icon: <ShoppingCartOutlinedIcon /> },
            { id: "inventory", label: "Stock Inventory", minClearance: 2, icon: <Inventory2OutlinedIcon /> }
        ]
    },
    financials: {
        id: "financials", label: "FINANCIALS", minClearance: 4, color: '#8b5cf6',
        children: [
            { id: "billing", label: "Client RA Billing", minClearance: 4, icon: <ReceiptLongOutlinedIcon /> }
        ]
    },
    communication: {
        id: "communication", label: "COMMUNICATION", minClearance: 1, color: '#ec4899',
        children: [
            { id: "chat", label: "Project CommLink", minClearance: 1, icon: <ForumOutlinedIcon /> }
        ]
    }
};

export default function ProjectWorkspace({ projectId, onBack }) {
    const { hasClearance, currentUser } = useAuth();

    // --- SIDEBAR STATE ---
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const SIDEBAR_CLOSED_WIDTH = 68;
    const SIDEBAR_OPEN_WIDTH = 260;

    const ALLOWED_CATEGORIES = useMemo(() => {
        const filtered = {};
        for (const [key, cat] of Object.entries(RAW_CATEGORIES)) {
            if (hasClearance(cat.minClearance)) {
                const allowedChildren = cat.children.filter(child => hasClearance(child.minClearance));
                if (allowedChildren.length > 0) {
                    filtered[key] = { ...cat, children: allowedChildren };
                }
            }
        }
        return filtered;
    }, [hasClearance]);

    const defaultCategory = Object.keys(ALLOWED_CATEGORIES)[0] || "planning";
    const defaultTab = ALLOWED_CATEGORIES[defaultCategory]?.children[0]?.id || "details";

    const [activeTab, setActiveTab] = useState(defaultTab);

    // Ensure valid tab selection
    useEffect(() => {
        let found = false;
        for (const cat of Object.values(ALLOWED_CATEGORIES)) {
            if (cat.children.find(c => c.id === activeTab)) found = true;
        }
        if (!found) setActiveTab(defaultTab);
    }, [ALLOWED_CATEGORIES, activeTab, defaultTab]);

    const importFileRef = useRef(null);

    const [syncFilePath, setSyncFilePath] = useState(null);
    const [syncProjectName, setSyncProjectName] = useState("");
    const [isSyncResolveOpen, setIsSyncResolveOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportOpts, setExportOpts] = useState({
        details: true, boq: true, schedule_and_tasks: true, dailyLogs: true,
        subcontractors: true, inventory_grns: true, procurement_pos: true, financial_billing: true
    });

    const [project, setProject] = useState("loading");
    const [regions, setRegions] = useState([]);
    const [resources, setResources] = useState([]);
    const [masterBoqs, setMasterBoqs] = useState([]);
    const [projectBoqItems, setProjectBoqItems] = useState([]);
    const [crmContacts, setCrmContacts] = useState([]);
    const [orgStaff, setOrgStaff] = useState([]);

    const loadData = async () => {
        try {
            const [p, reg, res, mBoqs, pBoqs, contacts, staff] = await Promise.all([
                window.api.db.getProject(projectId), window.api.db.getRegions(), window.api.db.getResources(),
                window.api.db.getMasterBoqs(), window.api.db.getProjectBoqs(projectId),
                window.api.db.getCrmContacts(), window.api.db.getOrgStaff()
            ]);

            if (p && !hasClearance(4)) {
                const assigned = JSON.parse(p.assignedStaff || '[]');
                if (!assigned.includes(currentUser.id)) {
                    alert("ACCESS DENIED: You are not assigned to this project's team.");
                    onBack();
                    return;
                }
            }

            const parseSafe = (str, fallback = []) => {
                if (!str) return fallback;
                if (typeof str !== 'string') return str;
                try { return JSON.parse(str); } catch { return fallback; }
            };

            const safeRes = (res || []).map(r => ({ ...r, rates: parseSafe(r.rates, {}), rateHistory: parseSafe(r.rateHistory, []) }));
            const safeMBoqs = (mBoqs || []).map(b => ({ ...b, components: parseSafe(b.components, []) }));
            const safePBoqs = (pBoqs || []).map(b => ({ ...b, measurements: parseSafe(b.measurements, []) }));

            const safeProject = p ? {
                ...p,
                dailyLogs: parseSafe(p.dailyLogs, []), dailySchedules: parseSafe(p.dailySchedules, []),
                actualResources: parseSafe(p.actualResources, {}), ganttTasks: parseSafe(p.ganttTasks, []),
                subcontractors: parseSafe(p.subcontractors, []), purchaseOrders: parseSafe(p.purchaseOrders, []),
                raBills: parseSafe(p.raBills, []), phaseAssignments: parseSafe(p.phaseAssignments, {}),
                materialRequests: parseSafe(p.materialRequests, []), grns: parseSafe(p.grns, [])
            } : null;

            setProject(safeProject || null);
            setRegions(reg || []);
            setResources(safeRes);
            setMasterBoqs(safeMBoqs);
            setProjectBoqItems(safePBoqs);
            setCrmContacts(contacts || []);
            setOrgStaff(staff || []);
        } catch (error) {
            console.error("Failed to load workspace data:", error);
            setProject(null);
        }
    };

    useEffect(() => { loadData(); }, [projectId]);

    const { renderedProjectBoq, totalAmount, projectResourceMap } = useProjectCalculations(projectBoqItems, masterBoqs, resources, project);

    const [draggedId, setDraggedId] = useState(null);
    const [formulaHelpOpen, setFormulaHelpOpen] = useState(false);
    const [editorItem, setEditorItem] = useState(null);

    if (project === "loading") return <Box p={5} textAlign="center"><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>Loading workspace...</Typography></Box>;
    if (project === null) return <Box p={5} textAlign="center"><Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'error.main', mb: 2 }}>Error: Project Not Found</Typography><Button variant="outlined" onClick={onBack}>Return to Dashboard</Button></Box>;

    const updateProject = async (field, value) => {
        const valToSave = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : value;
        await window.api.db.updateProject(projectId, { [field]: valToSave });
        loadData();
    };

    const togglePriceLock = async () => {
        if (!hasClearance(4)) return alert("Access Denied: Level 4 Clearance required to lock project pricing.");
        const isCurrentlyLocked = project.isPriceLocked || false;
        const willBeLocked = !isCurrentlyLocked;

        if (willBeLocked) {
            const updates = renderedProjectBoq.map(item => window.api.db.updateProjectBoq(item.id, { lockedRate: item.rate }));
            await Promise.all(updates);
        } else {
            const updates = renderedProjectBoq.map(item => window.api.db.updateProjectBoq(item.id, { lockedRate: null }));
            await Promise.all(updates);
        }

        await window.api.db.updateProject(projectId, { isPriceLocked: willBeLocked ? 1 : 0 });
        loadData();
    };

    const handleDragStart = (e, id) => setDraggedId(id);
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = async (e, targetId) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) { setDraggedId(null); return; }
        const items = [...projectBoqItems].sort((a, b) => a.slNo - b.slNo);
        const draggedIndex = items.findIndex(item => item.id === draggedId);
        const targetIndex = items.findIndex(item => item.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [draggedItem] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, draggedItem);
        const updates = items.map((item, index) => ({ id: item.id, slNo: index + 1 }));

        await Promise.all(updates.map(u => window.api.db.updateProjectBoq(u.id, { slNo: u.slNo })));
        setDraggedId(null);
        loadData();
    };

    const deleteProjectBoq = async (id) => {
        await window.api.db.deleteProjectBoq(id);
        const remaining = projectBoqItems.filter(item => item.id !== id).sort((a, b) => a.slNo - b.slNo);
        const updates = remaining.map((item, index) => ({ id: item.id, slNo: index + 1 }));
        await Promise.all(updates.map(u => window.api.db.updateProjectBoq(u.id, { slNo: u.slNo })));
        loadData();
    };

    const handleExportData = async () => {
        const res = await window.api.db.exportProjectSqlite(project.id, exportOpts);
        if (res.success) { alert("Customized Sync file exported successfully!"); setIsExportOpen(false); }
        else if (!res.canceled) { alert("Export failed: " + res.error); }
    };

    const handleImportData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                await window.api.db.syncProjectData(project.id, data);
                alert("Project data synchronized successfully!");
                loadData();
            } catch (err) { alert("Failed to read project sync file."); }
        };
        reader.readAsText(file);
    };

    const processSyncImport = async (mode) => {
        if (!syncFilePath) return;
        try {
            const res = await window.api.db.executeProjectSync(project.id, syncFilePath, mode);
            if (res.success) { alert(`Sync successful!`); loadData(); }
            else { alert(`Failed to sync: ${res.error}`); }
        } catch (err) { alert(`Failed to sync: ${err.message}`); }
        finally { setIsSyncResolveOpen(false); setSyncFilePath(null); }
    };

    const handleAddMasterItem = async (addBoqId, addBoqQty, phase) => {
        await window.api.db.addProjectBoq({ projectId, masterBoqId: addBoqId, slNo: projectBoqItems.length + 1, formulaStr: String(addBoqQty), qty: 0, measurements: JSON.stringify([]), phase, lockedRate: null });
        loadData();
    };

    const handleAddCustomItem = async (customCode, customDesc, customUnit, customRate, customQty, phase) => {
        await window.api.db.addProjectBoq({ projectId, slNo: projectBoqItems.length + 1, isCustom: true, measurements: JSON.stringify([]), itemCode: customCode, description: customDesc, unit: customUnit, rate: Number(customRate), formulaStr: String(customQty), qty: 0, phase });
        loadData();
    };

    const updateBoqQtyManual = async (id, val) => { await window.api.db.updateProjectBoq(id, { formulaStr: val }); loadData(); };

    return (
        <Box sx={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
            
            {/* 🔥 OPTIMIZED INTERNAL PROJECT SIDEBAR */}
            <Paper 
                elevation={0}
                sx={{ 
                    width: sidebarOpen ? SIDEBAR_OPEN_WIDTH : { xs: 0, md: SIDEBAR_CLOSED_WIDTH },
                    flexShrink: 0,
                    bgcolor: 'rgba(13, 31, 60, 0.5)',
                    borderRight: '1px solid', borderColor: 'divider',
                    // Smooth cubic-bezier transition
                    transition: 'width 0.225s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflowX: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    position: { xs: 'fixed', md: 'relative' },
                    height: '100%',
                    zIndex: { xs: 1100, md: 1 },
                    left: 0, top: 0
                }}
            >
                <Box sx={{ p: 1, display: 'flex', justifyContent: sidebarOpen ? 'flex-end' : 'center', alignItems: 'center', height: 60 }}>
                    <IconButton onClick={() => setSidebarOpen(!sidebarOpen)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }}}>
                        {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
                    </IconButton>
                </Box>
                
                {/* 🔥 FIXED SCROLLBAR HIDING */}
                <Box sx={{ 
                    flexGrow: 1, 
                    overflowY: 'auto', 
                    overflowX: 'hidden', 
                    pb: 2,
                    scrollbarWidth: 'none', // Firefox
                    '&::-webkit-scrollbar': { display: 'none' } // Chrome, Safari, Edge
                }}>
                    <List sx={{ px: 1 }}>
                        {Object.entries(ALLOWED_CATEGORIES).map(([catKey, cat]) => (
                            <React.Fragment key={cat.id}>
                                {sidebarOpen ? (
                                    <Typography variant="caption" sx={{ px: 2, pt: 2, pb: 1, display: 'block', fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: cat.color, letterSpacing: '1px', opacity: 0.8 }}>
                                        {cat.label}
                                    </Typography>
                                ) : (
                                    <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
                                )}

                                {cat.children.map(child => (
                                    <Tooltip key={child.id} title={!sidebarOpen ? child.label : ""} placement="right" disableInteractive>
                                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                                            <ListItemButton 
                                                onClick={() => { setActiveTab(child.id); if (window.innerWidth < 900) setSidebarOpen(false); }} 
                                                selected={activeTab === child.id}
                                                sx={{ 
                                                    borderRadius: 1.5, minHeight: 40, justifyContent: sidebarOpen ? 'initial' : 'center', px: 2.5,
                                                    '&.Mui-selected': { bgcolor: `rgba(${parseInt(cat.color.slice(1, 3), 16)}, ${parseInt(cat.color.slice(3, 5), 16)}, ${parseInt(cat.color.slice(5, 7), 16)}, 0.15)` },
                                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } 
                                                }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 0, mr: sidebarOpen ? 2 : 'auto', justifyContent: 'center', color: activeTab === child.id ? cat.color : 'text.secondary' }}>
                                                    {child.icon}
                                                </ListItemIcon>
                                                <ListItemText 
                                                    primary={child.label} 
                                                    sx={{ opacity: sidebarOpen ? 1 : 0, transition: 'opacity 0.2s ease-in-out', m: 0 }}
                                                    primaryTypographyProps={{ sx: { fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: activeTab === child.id ? 'bold' : 'normal', color: activeTab === child.id ? cat.color : 'text.primary', whiteSpace: 'nowrap' } }} 
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    </Tooltip>
                                ))}
                            </React.Fragment>
                        ))}
                    </List>
                </Box>
            </Paper>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <Box onClick={() => setSidebarOpen(false)} sx={{ display: { xs: 'block', md: 'none' }, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
            )}

            {/* 🔥 OPTIMIZED MAIN WORKSPACE CONTENT AREA */}
            <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overflowX: 'hidden', p: { xs: 2, md: 3 } }}>
                
                {/* HEADER */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', lg: 'center' }, mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider', gap: { xs: 2, lg: 0 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton onClick={() => setSidebarOpen(true)} sx={{ display: { xs: 'block', md: 'none' }, color: 'text.secondary' }}>
                            <MenuIcon />
                        </IconButton>
                        <Box>
                            <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '16px', md: '20px' }, display: 'flex', alignItems: 'center', gap: 1 }}>
                                {project?.name?.toUpperCase() || "UNTITLED"}
                                {Boolean(project.isPriceLocked) && (<Chip icon={<LockIcon sx={{ fontSize: 10 }} />} label="LOCKED" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '9px', fontFamily: "'JetBrains Mono', monospace" }} />)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>{project?.code || 'NO_CODE'} | {project?.region || 'NO_REGION'}</Typography>
                        </Box>
                    </Box>

                    <Box display="flex" gap={1.5} flexWrap="wrap" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
                        {hasClearance(3) && (
                            <>
                                <input type="file" accept=".json" ref={importFileRef} style={{ display: 'none' }} onChange={handleImportData} />
                                <Button variant="outlined" color="primary" startIcon={<UploadIcon />} onClick={() => importFileRef.current.click()} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', height: '32px' }}>IMPORT</Button>
                                <Button variant="outlined" color="primary" startIcon={<SyncIcon />} onClick={() => setIsExportOpen(true)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', height: '32px' }}>SYNC</Button>
                            </>
                        )}
                        <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} onClick={() => exportProjectPdf(project, renderedProjectBoq, totalAmount)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', height: '32px' }}>PDF</Button>
                        <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={() => exportProjectExcel(project, renderedProjectBoq, masterBoqs, resources)} disableElevation sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', height: '32px' }}>EXCEL</Button>
                    </Box>
                </Box>

                {/* DYNAMIC TAB CONTENT */}
                <Box sx={{ flexGrow: 1 }}>
                    {activeTab === "details" && (<ProjectDetailsTab project={project} updateProject={updateProject} regions={regions} totalAmount={totalAmount} projectBoqItems={renderedProjectBoq} togglePriceLock={togglePriceLock} crmContacts={crmContacts} orgStaff={orgStaff} />)}
                    {activeTab === "documents" && (<DocumentsTab projectId={projectId} />)}
                    {activeTab === "gallery" && (<SiteGalleryTab projectId={projectId} />)}
                    {activeTab === "boq" && (<BoqBuilderTab projectId={projectId} projectBoqItems={projectBoqItems} masterBoqs={masterBoqs} renderedProjectBoq={renderedProjectBoq} totalAmount={totalAmount} handleAddMasterItem={handleAddMasterItem} handleAddCustomItem={handleAddCustomItem} updateBoqQtyManual={updateBoqQtyManual} deleteProjectBoq={deleteProjectBoq} openEditDialog={(item) => setEditorItem(item)} setFormulaHelpOpen={setFormulaHelpOpen} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} draggedId={draggedId} />)}
                    {activeTab === "mbook" && (<MeasurementBookTab renderedProjectBoq={renderedProjectBoq} setFormulaHelpOpen={setFormulaHelpOpen} loadData={loadData} />)}
                    {activeTab === "schedule" && (<GanttScheduleTab project={project} projectBoqItems={projectBoqItems} updateProject={updateProject} />)}
                    {activeTab === "subcontractors" && (<SubcontractorBidTab project={project} renderedProjectBoq={renderedProjectBoq} updateProject={updateProject} crmContacts={crmContacts} loadData={loadData} />)}
                    {activeTab === "daily_log" && (<DailyLogTab project={project} projectBoqItems={projectBoqItems} resources={resources} updateProject={updateProject} loadData={loadData} />)}
                    {activeTab === "resources" && (<ResourceTrackerTab project={project} renderedProjectBoq={renderedProjectBoq} projectResourceMap={projectResourceMap} resources={resources} updateProject={updateProject} />)}
                    {activeTab === "procurement" && (<ProcurementTab project={project} projectResourceMap={projectResourceMap} resources={resources} updateProject={updateProject} crmContacts={crmContacts} />)}
                    {activeTab === "billing" && (<ClientBillingTab project={project} renderedProjectBoq={renderedProjectBoq} updateProject={updateProject} />)}
                    {activeTab === "kanban" && (<KanbanBoardTab project={project} renderedProjectBoq={renderedProjectBoq} orgStaff={orgStaff} updateProject={updateProject} />)}
                    {activeTab === "inventory" && (<InventoryTab project={project} resources={resources} updateProject={updateProject} />)}
                    {activeTab === "chat" && (<ChatModule projectId={projectId} orgStaff={orgStaff} />)}
                </Box>

            </Box>

            {/* MODALS */}
            <MasterBoqEditor editorItem={editorItem} onClose={() => setEditorItem(null)} onSaveSuccess={() => { setEditorItem(null); loadData(); }} project={project} regions={regions} resources={resources} masterBoqs={masterBoqs} setFormulaHelpOpen={setFormulaHelpOpen} />

            <Dialog open={isExportOpen} onClose={() => setIsExportOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>EXPORT_CONFIG</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Box display="flex" flexDirection="column" gap={1}>
                        {Object.keys(exportOpts).map(key => (
                            <FormControlLabel key={key} control={<Checkbox checked={exportOpts[key]} onChange={(e) => setExportOpts({ ...exportOpts, [key]: e.target.checked })} size="small" />} label={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{key.toUpperCase()}</Typography>} />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsExportOpen(false)} color="inherit">CANCEL</Button>
                    <Button variant="contained" color="primary" onClick={handleExportData}>GENERATE SYNC</Button>
                </DialogActions>
            </Dialog>

            <FormulaGuideDialog open={formulaHelpOpen} onClose={() => setFormulaHelpOpen(false)} />

            <Dialog open={isSyncResolveOpen} onClose={() => setIsSyncResolveOpen(false)} PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider', minWidth: '400px' } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#fff', fontSize: '14px' }}>SYNC IMPORT RESOLUTION</DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 2, color: 'info.main', fontSize: '13px', fontWeight: 'bold' }}>Incoming Data: {syncProjectName}</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button variant="outlined" color="info" onClick={() => processSyncImport('append')}>[APPEND] New items only</Button>
                        <Button variant="outlined" color="warning" onClick={() => processSyncImport('merge')}>[MERGE] Update existing</Button>
                        <Button variant="outlined" color="error" onClick={() => processSyncImport('replace')}>[REPLACE] Overwrite everything</Button>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}><Button onClick={() => setIsSyncResolveOpen(false)} sx={{ color: '#ccc' }}>CANCEL</Button></DialogActions>
            </Dialog>
        </Box>
    );
}