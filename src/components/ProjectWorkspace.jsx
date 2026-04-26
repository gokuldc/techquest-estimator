import { useState, useEffect, useRef, useMemo } from "react";
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

// 🔥 1. Import the new Chat Module
import ChatModule from "./workspace/ChatModule";

import { Box, Typography, Button, Paper, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import LockIcon from '@mui/icons-material/Lock';
import SyncIcon from '@mui/icons-material/Sync';

// 🔥 Import the Auth Hook
import { useAuth } from "../context/AuthContext";

// 🔥 CORRECTED WORKFLOW SEQUENCE
const RAW_CATEGORIES = {
    planning: {
        id: "planning", label: "01_PLANNING_&_SETUP", minClearance: 1,
        children: [
            { id: "details", label: "Project Details", minClearance: 1 },
            { id: "documents", label: "Docs & Drawings", minClearance: 1 },
            { id: "boq", label: "Master BOQ", minClearance: 3 },
            { id: "schedule", label: "Gantt Schedule", minClearance: 2 },
            { id: "subcontractors", label: "Subcontractors", minClearance: 3 }
        ]
    },
    execution: {
        id: "execution", label: "02_SITE_EXECUTION", minClearance: 2,
        children: [
            { id: "kanban", label: "Task Board", minClearance: 2 },
            { id: "gallery", label: "Site Photo Gallery", minClearance: 2 },
            { id: "daily_log", label: "Daily Log", minClearance: 2 },
            { id: "mbook", label: "Measurement Book", minClearance: 2 }
        ]
    },
    supply_chain: {
        id: "supply_chain", label: "03_SUPPLY_CHAIN", minClearance: 2,
        children: [
            { id: "resources", label: "Resource Deficits", minClearance: 3 },
            { id: "procurement", label: "Procurement (POs)", minClearance: 3 },
            { id: "inventory", label: "Stock Inventory", minClearance: 2 }
        ]
    },
    financials: {
        id: "financials", label: "04_FINANCIALS", minClearance: 4,
        children: [
            { id: "billing", label: "Client RA Billing", minClearance: 4 }
        ]
    },
    communication: {
        id: "communication", label: "05_COMMUNICATION", minClearance: 1,
        children: [
            { id: "chat", label: "Project CommLink", minClearance: 1 }
        ]
    }
};

export default function ProjectWorkspace({ projectId, onBack }) {
    const { hasClearance, currentUser } = useAuth();

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

    const [activeCategory, setActiveCategory] = useState(defaultCategory);
    const [activeTab, setActiveTab] = useState(defaultTab);

    useEffect(() => {
        if (!ALLOWED_CATEGORIES[activeCategory]) {
            setActiveCategory(defaultCategory);
            setActiveTab(defaultTab);
        } else if (!ALLOWED_CATEGORIES[activeCategory].children.find(c => c.id === activeTab)) {
            setActiveTab(ALLOWED_CATEGORIES[activeCategory].children[0].id);
        }
    }, [ALLOWED_CATEGORIES, activeCategory, activeTab, defaultCategory, defaultTab]);

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
                window.api.db.getProject(projectId),
                window.api.db.getRegions(),
                window.api.db.getResources(),
                window.api.db.getMasterBoqs(),
                window.api.db.getProjectBoqs(projectId),
                window.api.db.getCrmContacts(),
                window.api.db.getOrgStaff()
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
                dailyLogs: parseSafe(p.dailyLogs, []),
                dailySchedules: parseSafe(p.dailySchedules, []),
                actualResources: parseSafe(p.actualResources, {}),
                ganttTasks: parseSafe(p.ganttTasks, []),
                subcontractors: parseSafe(p.subcontractors, []),
                purchaseOrders: parseSafe(p.purchaseOrders, []),
                raBills: parseSafe(p.raBills, []),
                phaseAssignments: parseSafe(p.phaseAssignments, {}),
                materialRequests: parseSafe(p.materialRequests, []),
                grns: parseSafe(p.grns, [])
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
    if (project === null) return <Box p={5} textAlign="center"><Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'error.main', mb: 2 }}>Error: Project Not Found</Typography><Button variant="outlined" onClick={onBack} startIcon={<ArrowBackIcon />}>Return to Dashboard</Button></Box>;

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
            // 🔥 WE ARE LOCKING: Take a snapshot of today's live rates and freeze them in the DB
            const updates = renderedProjectBoq.map(item => window.api.db.updateProjectBoq(item.id, { 
                lockedRate: item.rate // This grabs the live rate we just calculated!
            }));
            await Promise.all(updates);
        } else {
            // 🔓 WE ARE UNLOCKING: Erase the snapshots so it goes back to live market rates
            const updates = renderedProjectBoq.map(item => window.api.db.updateProjectBoq(item.id, { 
                lockedRate: null 
            }));
            await Promise.all(updates);
        }

        // Finally, toggle the master lock switch on the project itself
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

    const handleCategoryChange = (e, newCategory) => {
        setActiveCategory(newCategory);
        setActiveTab(ALLOWED_CATEGORIES[newCategory].children[0].id);
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: "auto", p: { xs: 1, sm: 2, md: 3 } }}>
            {/* 🔥 RESPONSIVE HEADER */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', md: 'center' },
                mb: 4, pb: 3,
                borderBottom: '1px solid', borderColor: 'divider',
                gap: { xs: 3, md: 0 }
            }}>
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    textAlign: { xs: 'center', sm: 'left' },
                    gap: 3
                }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '11px', alignSelf: { xs: 'center', sm: 'auto' } }}>BACK</Button>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '18px', md: '24px' } }}>
                            WORKSPACE: <span style={{ color: '#3b82f6' }}>{project?.name?.toUpperCase() || "UNTITLED"}</span>
                        </Typography>
                        {Boolean(project.isPriceLocked) && (<Typography variant="caption" color="success.main" sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' }, gap: 0.5, mt: 0.5 }}><LockIcon sx={{ fontSize: 12 }} /> PRICING_LOCKED</Typography>)}
                    </Box>
                </Box>
                <Box display="flex" gap={1.5} flexWrap="wrap" justifyContent={{ xs: 'center', md: 'flex-end' }}>
                    {hasClearance(3) && (
                        <>
                            <input type="file" accept=".json" ref={importFileRef} style={{ display: 'none' }} onChange={handleImportData} />
                            <Button variant="outlined" color="primary" startIcon={<UploadIcon />} onClick={() => importFileRef.current.click()} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>IMPORT</Button>
                            <Button variant="outlined" color="primary" startIcon={<SyncIcon />} onClick={() => setIsExportOpen(true)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>SYNC</Button>
                        </>
                    )}
                    <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} onClick={() => exportProjectPdf(project, renderedProjectBoq, totalAmount)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>PDF</Button>
                    <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={() => exportProjectExcel(project, renderedProjectBoq, masterBoqs, resources)} disableElevation sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>EXCEL</Button>
                </Box>
            </Box>

            {/* 🔥 RESPONSIVE CATEGORY TABS */}
            <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.8)', mb: 1, overflow: 'hidden' }}>
                <Tabs value={activeCategory} onChange={handleCategoryChange} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
                    {Object.values(ALLOWED_CATEGORIES).map((cat) => (
                        <Tab key={cat.id} value={cat.id} label={cat.label} sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', py: 2 }} />
                    ))}
                </Tabs>
            </Paper>

            {/* 🔥 RESPONSIVE SUB-TABS */}
            <Box sx={{ mb: 4, px: { xs: 0, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} indicatorColor="secondary" textColor="inherit" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
                    {ALLOWED_CATEGORIES[activeCategory]?.children.map((child) => (
                        <Tab key={child.id} value={child.id} label={child.label} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', minHeight: '48px', color: activeTab === child.id ? '#3b82f6' : 'text.secondary' }} />
                    ))}
                </Tabs>
            </Box>

            <Box sx={{ minHeight: '60vh' }}>
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

                {/* 🔥 3. RENDER THE CHAT MODULE */}
                {activeTab === "chat" && (<ChatModule projectId={projectId} orgStaff={orgStaff} />)}
            </Box>

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