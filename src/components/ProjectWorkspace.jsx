import { useState, useEffect, useRef } from "react";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { exportProjectExcel } from "../utils/exportExcel";
import { exportProjectPdf } from "../utils/exportPdf";

// --- IMPORT OUR NEW EXTRACTED FILES ---
import { useProjectCalculations } from "../hooks/useProjectCalculations";
import MasterBoqEditor from "./workspace/MasterBoqEditor";

// --- MODULAR TAB COMPONENTS ---
import ProjectDetailsTab from "./workspace/ProjectDetailsTab";
import BoqBuilderTab from "./workspace/BoqBuilderTab";
import MeasurementBookTab from "./workspace/MeasurementBookTab";
import GanttScheduleTab from "./workspace/GanttScheduleTab";
import SubcontractorBidTab from "./workspace/SubcontractorBidTab";
import DailyLogTab from "./workspace/DailyLogTab";
import ResourceTrackerTab from "./workspace/ResourceTrackerTab";
import KanbanBoardTab from "./workspace/KanbanBoardTab";

// --- MUI COMPONENTS ---
import { Box, Typography, Button, Paper, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import LockIcon from '@mui/icons-material/Lock';
import SyncIcon from '@mui/icons-material/Sync';

export default function ProjectWorkspace({ projectId, onBack }) {
    const [tab, setTab] = useState("details");
    const importFileRef = useRef(null);

    // --- NATIVE SYNC & EXPORT STATE ---
    const [syncFilePath, setSyncFilePath] = useState(null);
    const [syncProjectName, setSyncProjectName] = useState("");
    const [isSyncResolveOpen, setIsSyncResolveOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportOpts, setExportOpts] = useState({ details: true, boq: true, kanban: true, dailyLogs: true, subcontractors: true, gantt: true });

    // --- SQLITE STATE MANAGEMENT ---
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

            const parseSafe = (str, fallback = []) => {
                if (!str) return fallback;
                if (typeof str !== 'string') return str;
                try { return JSON.parse(str); } catch { return fallback; }
            };

            const safeRes = (res || []).map(r => ({ ...r, rates: parseSafe(r.rates, {}) }));
            const safeMBoqs = (mBoqs || []).map(b => ({ ...b, components: parseSafe(b.components, []) }));
            const safePBoqs = (pBoqs || []).map(b => ({ ...b, measurements: parseSafe(b.measurements, []) }));

            const safeProject = p ? {
                ...p,
                dailyLogs: parseSafe(p.dailyLogs, []),
                dailySchedules: parseSafe(p.dailySchedules, []),
                actualResources: parseSafe(p.actualResources, {}),
                ganttTasks: parseSafe(p.ganttTasks, []),
                subcontractors: parseSafe(p.subcontractors, []),
                phaseAssignments: parseSafe(p.phaseAssignments, {})
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

    // --- IMPORT OUR CUSTOM HOOK FOR MATH ---
    const { renderedProjectBoq, totalAmount, projectResourceMap } = useProjectCalculations(projectBoqItems, masterBoqs, resources, project);

    // --- UI STATE ---
    const [draggedId, setDraggedId] = useState(null);
    const [formulaHelpOpen, setFormulaHelpOpen] = useState(false);

    // 🔥 NEW: Editor Dialog State is now just a single object!
    const [editorItem, setEditorItem] = useState(null);

    if (project === "loading") return <Box p={5} textAlign="center"><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>Loading workspace...</Typography></Box>;
    if (project === null) return <Box p={5} textAlign="center"><Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'error.main', mb: 2 }}>Error: Project Not Found</Typography><Button variant="outlined" onClick={onBack} startIcon={<ArrowBackIcon />}>Return to Dashboard</Button></Box>;

    // --- DB MUTATION HANDLERS ---
    const updateProject = async (field, value) => {
        const valToSave = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : value;
        await window.api.db.updateProject(projectId, { [field]: valToSave });
        loadData();
    };

    const togglePriceLock = async () => {
        await window.api.db.updateProject(projectId, { isPriceLocked: !(project.isPriceLocked || false) });
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
        <Box sx={{ maxWidth: 1400, mx: "auto", p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '11px' }}>BACK</Button>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                            WORKSPACE: <span style={{ color: '#3b82f6' }}>{project?.name?.toUpperCase() || "UNTITLED"}</span>
                        </Typography>
                        {project.isPriceLocked && (<Typography variant="caption" color="success.main" sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}><LockIcon sx={{ fontSize: 12 }} /> PRICING_LOCKED</Typography>)}
                    </Box>
                </Box>
                <Box display="flex" gap={1.5} flexWrap="wrap">
                    <input type="file" accept=".json" ref={importFileRef} style={{ display: 'none' }} onChange={handleImportData} />
                    <Button variant="outlined" color="primary" startIcon={<UploadIcon />} onClick={() => importFileRef.current.click()} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>IMPORT</Button>
                    <Button variant="outlined" color="primary" startIcon={<SyncIcon />} onClick={() => setIsExportOpen(true)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>SYNC</Button>
                    <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} onClick={() => exportProjectPdf(project, renderedProjectBoq, totalAmount)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>PDF</Button>
                    <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={() => exportProjectExcel(project, renderedProjectBoq, masterBoqs, resources)} disableElevation sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>EXCEL</Button>
                </Box>
            </Box>

            <Paper sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
                    {["details", "boq", "mbook", "schedule", "subcontractors", "daily_log", "resources", "kanban"].map((v, i) => (
                        <Tab key={v} value={v} label={`${String(i + 1).padStart(2, '0')}_${v.toUpperCase()}`} sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }} />
                    ))}
                </Tabs>
            </Paper>

            <Box sx={{ minHeight: '60vh' }}>
                {tab === "details" && (<ProjectDetailsTab project={project} updateProject={updateProject} regions={regions} totalAmount={totalAmount} projectBoqItems={projectBoqItems} togglePriceLock={togglePriceLock} crmContacts={crmContacts} orgStaff={orgStaff} />)}
                {tab === "boq" && (<BoqBuilderTab projectId={projectId} projectBoqItems={projectBoqItems} masterBoqs={masterBoqs} renderedProjectBoq={renderedProjectBoq} totalAmount={totalAmount} handleAddMasterItem={handleAddMasterItem} handleAddCustomItem={handleAddCustomItem} updateBoqQtyManual={updateBoqQtyManual} deleteProjectBoq={deleteProjectBoq} openEditDialog={(item) => setEditorItem(item)} setFormulaHelpOpen={setFormulaHelpOpen} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} draggedId={draggedId} />)}
                {tab === "mbook" && (<MeasurementBookTab renderedProjectBoq={renderedProjectBoq} setFormulaHelpOpen={setFormulaHelpOpen} loadData={loadData} />)}
                {tab === "schedule" && (<GanttScheduleTab project={project} projectBoqItems={projectBoqItems} updateProject={updateProject} />)}
                {tab === "subcontractors" && (<SubcontractorBidTab project={project} renderedProjectBoq={renderedProjectBoq} updateProject={updateProject} crmContacts={crmContacts} loadData={loadData} />)}
                {tab === "daily_log" && (<DailyLogTab project={project} projectBoqItems={projectBoqItems} resources={resources} updateProject={updateProject} loadData={loadData} />)}
                {tab === "resources" && (<ResourceTrackerTab project={project} renderedProjectBoq={renderedProjectBoq} projectResourceMap={projectResourceMap} resources={resources} updateProject={updateProject} />)}
                {tab === "kanban" && (<KanbanBoardTab project={project} renderedProjectBoq={renderedProjectBoq} orgStaff={orgStaff} />)}
            </Box>

            {/* EXTRACTED EDITOR COMPONENT */}
            <MasterBoqEditor
                editorItem={editorItem}
                onClose={() => setEditorItem(null)}
                onSaveSuccess={() => { setEditorItem(null); loadData(); }}
                project={project}
                regions={regions}
                resources={resources}
                masterBoqs={masterBoqs}
                setFormulaHelpOpen={setFormulaHelpOpen}
            />

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

            <Dialog open={formulaHelpOpen} onClose={() => setFormulaHelpOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>FORMULA_GUIDE</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 2 }}>Start any quantity with <code>=</code> to evaluate math.</Typography>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, color: "primary.main" }}><strong>Basic Math:</strong> <code>= 10 * 2.5 + 4</code></Typography>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, color: "success.main" }}><strong>Reference Rows:</strong> <code>= #1 * 2</code></Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: 'rgba(13, 31, 60, 0.5)' }}><Button onClick={() => setFormulaHelpOpen(false)}>CLOSE</Button></DialogActions>
            </Dialog>

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