import { useState, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { getResourceRate, calculateMasterBoqRate } from "../engines/calculationEngine";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { exportProjectExcel } from "../utils/exportExcel";
import { exportProjectPdf } from "../utils/exportPdf";
import { tableInputActiveStyle } from "../styles";

// --- MODULAR TAB COMPONENTS ---
import ProjectDetailsTab from "./workspace/ProjectDetailsTab";
import BoqBuilderTab from "./workspace/BoqBuilderTab";
import MeasurementBookTab from "./workspace/MeasurementBookTab";
import GanttScheduleTab from "./workspace/GanttScheduleTab";
import SubcontractorBidTab from "./workspace/SubcontractorBidTab";
import DailyLogTab from "./workspace/DailyLogTab";
import ResourceTrackerTab from "./workspace/ResourceTrackerTab";

import {
    Box, Typography, Button, Paper, Tabs, Tab, TextField, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Alert, Dialog, DialogTitle, DialogContent, DialogActions,
    FormControlLabel, Checkbox, Divider
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import LockIcon from '@mui/icons-material/Lock';
import SyncIcon from '@mui/icons-material/Sync';

export default function ProjectWorkspace({ projectId, onBack }) {
    const [tab, setTab] = useState("details");
    const importFileRef = useRef(null);

    // --- DATABASE QUERIES ---
    const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
    const regions = useLiveQuery(() => db.regions.toArray()) || [];
    const resources = useLiveQuery(() => db.resources.toArray()) || [];
    const masterBoqs = useLiveQuery(() => db.masterBoq.toArray()) || [];
    const projectBoqItems = useLiveQuery(() => db.projectBoq.where({ projectId }).toArray(), [projectId]) || [];
    const crmContacts = useLiveQuery(() => db.crmContacts.toArray()) || [];
    const orgStaff = useLiveQuery(() => db.orgStaff.toArray()) || [];

    // --- SHARED UI STATE ---
    const [draggedId, setDraggedId] = useState(null);
    const [formulaHelpOpen, setFormulaHelpOpen] = useState(false);

    // --- EXPORT/SYNC STATE ---
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportOpts, setExportOpts] = useState({
        boq: true, mbook: true, bids: true, logs: true, schedule: true
    });

    // --- MASTER BOQ EDITOR STATE ---
    const [isMasterEditorOpen, setIsMasterEditorOpen] = useState(false);
    const [editingProjectBoqId, setEditingProjectBoqId] = useState(null);
    const [editingMasterBoqId, setEditingMasterBoqId] = useState(null);
    const [editBoqCode, setEditBoqCode] = useState("");
    const [editBoqDesc, setEditBoqDesc] = useState("");
    const [editBoqUnit, setEditBoqUnit] = useState("cum");
    const [editBoqOH, setEditBoqOH] = useState(15);
    const [editBoqProfit, setEditBoqProfit] = useState(15);
    const [editPreviewRegion, setEditPreviewRegion] = useState("");
    const [editBoqRows, setEditBoqRows] = useState([]);

    // --- CUSTOM BOQ EDITOR STATE ---
    const [editingCustomId, setEditingCustomId] = useState(null);
    const [editCustomCode, setEditCustomCode] = useState("");
    const [editCustomDesc, setEditCustomDesc] = useState("");
    const [editCustomUnit, setEditCustomUnit] = useState("");
    const [editCustomRate, setEditCustomRate] = useState("");

    // --- MATH ENGINES ---
    const computeQty = (formulaStr, currentItems, currentItemSlNo = null, currentMeasurements = []) => {
        if (formulaStr === undefined || formulaStr === null) return 0;
        const str = String(formulaStr).trim().toLowerCase();
        if (str === "") return 0;
        if (!str.startsWith('=')) { const num = Number(str); return isNaN(num) ? 0 : num; }
        let expr = str.substring(1);
        expr = expr.replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");
        expr = expr.replace(/#(\d+)(?:\.(\d+))?(?:\.([a-z]+))?/g, (match, slNoStr, rowStr, prop) => {
            const slNo = parseInt(slNoStr, 10);
            const rowIndex = rowStr ? parseInt(rowStr, 10) - 1 : 0;
            const property = prop || 'qty';
            let targetItem, targetMeasurements;
            if (slNo === currentItemSlNo) {
                targetMeasurements = currentMeasurements;
                if (property === 'qty' && !rowStr) return currentMeasurements.reduce((sum, m) => sum + (m.computedQty || 0), 0);
            } else {
                targetItem = currentItems.find(i => i.slNo === slNo);
                if (!targetItem) return 0;
                targetMeasurements = targetItem.computedMeasurements || [];
                if (property === 'qty' && !rowStr) return targetItem.computedQty || 0;
            }
            const m = targetMeasurements[rowIndex];
            if (!m) return 0;
            if (property === 'l') return m.computedL || 0;
            if (property === 'b') return m.computedB || 0;
            if (property === 'd' || property === 'h') return m.computedD || 0;
            if (property === 'no') return m.computedNo || 0;
            if (property === 'qty') return m.computedQty || 0;
            return 0;
        });
        try { if (/[^0-9+\-*/().\seE]/.test(expr)) return 0; const res = new Function(`return ${expr}`)(); return isFinite(res) ? res : 0; } catch { return 0; }
    };

    const computeMasterQty = (formulaStr, currentRows) => {
        if (formulaStr === undefined || formulaStr === null) return 0;
        const str = String(formulaStr).trim().toLowerCase();
        if (str === "") return 0;
        if (!str.startsWith('=')) { const num = Number(str); return isNaN(num) ? 0 : num; }
        let expr = str.substring(1);
        expr = expr.replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");
        expr = expr.replace(/#(\d+)/g, (match, slNoStr) => {
            const idx = parseInt(slNoStr, 10) - 1;
            const refItem = currentRows[idx];
            return refItem ? (refItem.computedQty || 0) : 0;
        });
        try { if (/[^0-9+\-*/().\seE]/.test(expr)) return 0; const res = new Function(`return ${expr}`)(); return isFinite(res) ? res : 0; } catch { return 0; }
    };

    const { renderedProjectBoq, totalAmount } = useMemo(() => {
        let total = 0;
        const sortedItems = [...projectBoqItems].sort((a, b) => a.slNo - b.slNo);
        const computedItems = [];
        for (const item of sortedItems) {
            const hasMBook = item.measurements && item.measurements.length > 0;
            let computedQty = 0;
            let computedMeasurements = [];
            if (hasMBook) {
                let mbookTotal = 0;
                const u = (item.unit || "").toLowerCase();
                for (let i = 0; i < item.measurements.length; i++) {
                    const m = item.measurements[i];
                    const cNo = (m.no === "" || m.no === undefined) ? 1 : computeQty(m.no, computedItems, item.slNo, computedMeasurements);
                    const cL = (m.l === "" || m.l === undefined) ? 1 : computeQty(m.l, computedItems, item.slNo, computedMeasurements);
                    const cB = (m.b === "" || m.b === undefined) ? 1 : computeQty(m.b, computedItems, item.slNo, computedMeasurements);
                    const cD = (m.d === "" || m.d === undefined) ? 1 : computeQty(m.d, computedItems, item.slNo, computedMeasurements);
                    let rowQty = 0;
                    if (u.includes("cum") || u === "m3" || u === "m³") rowQty = cNo * cL * cB * cD;
                    else if (u.includes("sqm") || u === "m2" || u === "m²") rowQty = cNo * cL * cB;
                    else if (u.includes("rm") || u === "m" || u === "r.m") rowQty = cNo * cL;
                    else if (u.includes("nos") || u === "each") rowQty = cNo;
                    else rowQty = cNo * cL * cB * cD;
                    mbookTotal += rowQty;
                    computedMeasurements.push({ ...m, computedNo: cNo, computedL: cL, computedB: cB, computedD: cD, computedQty: rowQty });
                }
                computedQty = mbookTotal;
            } else {
                computedQty = computeQty(item.formulaStr !== undefined ? item.formulaStr : item.qty, computedItems, item.slNo, []);
            }
            let rate = 0, amount = 0, displayCode = "", displayDesc = "", displayUnit = "";
            let masterBoq = null;
            if (item.isCustom) {
                rate = item.rate || 0;
                displayCode = item.itemCode || "";
                displayDesc = item.description || "";
                displayUnit = item.unit || "";
            } else {
                masterBoq = masterBoqs.find(m => m.id === item.masterBoqId);
                if (masterBoq) {
                    if (project?.isPriceLocked && item.lockedRate !== undefined) { rate = item.lockedRate; }
                    else { rate = calculateMasterBoqRate(masterBoq, resources, masterBoqs, project?.region); }
                    displayCode = masterBoq.itemCode || "";
                    displayDesc = masterBoq.description || "";
                    displayUnit = masterBoq.unit || "";
                }
            }
            amount = computedQty * rate;
            total += amount;
            computedItems.push({ ...item, computedQty, computedMeasurements, rate, amount, displayCode, displayDesc, displayUnit, masterBoq, hasMBook });
        }
        return { renderedProjectBoq: computedItems, totalAmount: total };
    }, [projectBoqItems, masterBoqs, resources, project?.region, project?.isPriceLocked]);

    const { editRenderedRows, editSubTotal, editGrandTotal, editOhAmount, editProfitAmount } = useMemo(() => {
        let sub = 0;
        const rows = editBoqRows.map(row => {
            let rate = 0; let unit = "-";
            if (row.itemType === 'resource') { const resource = resources.find(r => r.id === row.itemId); if (resource) { rate = getResourceRate(resource, editPreviewRegion); unit = resource.unit; } }
            else if (row.itemType === 'boq') { const nestedBoq = masterBoqs.find(b => b.id === row.itemId); if (nestedBoq) { rate = calculateMasterBoqRate(nestedBoq, resources, masterBoqs, editPreviewRegion); unit = nestedBoq.unit; } }
            const computedQty = computeMasterQty(row.formulaStr !== undefined ? row.formulaStr : row.qty, editBoqRows);
            const amount = rate * computedQty;
            sub += amount;
            return { ...row, rate, unit, amount, computedQty };
        });
        const oh = sub * (Number(editBoqOH) / 100), prof = sub * (Number(editBoqProfit) / 100);
        return { editRenderedRows: rows, editSubTotal: sub, editOhAmount: oh, editProfitAmount: prof, editGrandTotal: sub + oh + prof };
    }, [editBoqRows, resources, masterBoqs, editPreviewRegion, editBoqOH, editBoqProfit]);

    if (!project) return <Box p={5} textAlign="center"><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>Loading workspace...</Typography></Box>;

    const updateProject = (field, value) => db.projects.update(projectId, { [field]: value });

    const togglePriceLock = async () => {
        const isCurrentlyLocked = project.isPriceLocked || false;
        if (!isCurrentlyLocked) {
            const updates = projectBoqItems.map(item => {
                if (item.isCustom) return item;
                const masterBoq = masterBoqs.find(m => m.id === item.masterBoqId);
                let currentRate = 0;
                if (masterBoq) currentRate = calculateMasterBoqRate(masterBoq, resources, masterBoqs, project.region);
                return { ...item, lockedRate: currentRate };
            });
            await db.projectBoq.bulkPut(updates);
            await updateProject("isPriceLocked", true);
        } else {
            await updateProject("isPriceLocked", false);
        }
    };

    const handleExportData = () => {
        const payload = {
            metadata: { app: "OpenPrix", version: "1.0", type: "ProjectSync" },
            projectId: project.id,
            projectDetails: {
                name: project.name, code: project.code, clientName: project.clientName,
                status: project.status, region: project.region, projectLead: project.projectLead,
                siteSupervisor: project.siteSupervisor, isPriceLocked: project.isPriceLocked,
                pmc: project.pmc, architect: project.architect, structuralEngineer: project.structuralEngineer,
                subcontractors: project.subcontractors, phaseAssignments: project.phaseAssignments,
                dailyLogs: project.dailyLogs, actualResources: project.actualResources, ganttTasks: project.ganttTasks
            },
            projectBoq: projectBoqItems
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `OpenPrix_Sync_${project.code || 'Project'}.json`;
        a.click();
        setIsExportOpen(false);
    };

    const handleImportData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.metadata?.app !== "OpenPrix") throw new Error("Invalid format");
                await db.projects.update(project.id, data.projectDetails);
                if (data.projectBoq) {
                    await db.projectBoq.where({ projectId: project.id }).delete();
                    await db.projectBoq.bulkPut(data.projectBoq.map(b => ({ ...b, projectId: project.id })));
                }
                alert("Project data synchronized successfully!");
            } catch (err) { alert("Failed to read project sync file."); }
        };
        reader.readAsText(file);
    };

    const handleAddMasterItem = async (addBoqId, addBoqQty, phase) => {
        const nextSlNo = projectBoqItems.length + 1;
        let lockedRate = undefined;
        if (project.isPriceLocked) {
            const masterBoq = masterBoqs.find(m => m.id === addBoqId);
            if (masterBoq) lockedRate = calculateMasterBoqRate(masterBoq, resources, masterBoqs, project.region);
        }
        await db.projectBoq.add({ id: crypto.randomUUID(), projectId, masterBoqId: addBoqId, slNo: nextSlNo, formulaStr: String(addBoqQty), qty: 0, measurements: [], phase, lockedRate });
    };

    const handleAddCustomItem = async (customCode, customDesc, customUnit, customRate, customQty, phase) => {
        const nextSlNo = projectBoqItems.length + 1;
        await db.projectBoq.add({ id: crypto.randomUUID(), projectId, slNo: nextSlNo, isCustom: true, measurements: [], itemCode: customCode, description: customDesc, unit: customUnit, rate: Number(customRate), formulaStr: String(customQty), qty: 0, phase });
    };

    const updateBoqQtyManual = async (id, val) => await db.projectBoq.update(id, { formulaStr: val });
    const deleteProjectBoq = async (id) => await db.projectBoq.delete(id);

    const openEditDialog = (item) => {
        setEditingProjectBoqId(item.id);
        if (item.isCustom) {
            setEditingCustomId(item.id); setEditingMasterBoqId(null); setEditCustomCode(item.itemCode || ""); setEditCustomDesc(item.description || ""); setEditCustomUnit(item.unit || "cum"); setEditCustomRate(item.rate || 0); setEditBoqOH(15); setEditBoqProfit(15); setEditBoqRows([]);
        } else {
            const master = masterBoqs.find(m => m.id === item.masterBoqId);
            if (!master) return alert("Master Databook Item not found.");
            setEditingMasterBoqId(master.id); setEditBoqCode(master.itemCode || ""); setEditBoqDesc(master.description || ""); setEditBoqUnit(master.unit || "cum"); setEditBoqOH(master.overhead || 0); setEditBoqProfit(master.profit || 0); setEditPreviewRegion(project?.region || "");
            setEditBoqRows((master.components || []).map(c => ({ id: crypto.randomUUID(), itemType: c.itemType || 'resource', itemId: c.itemId, qty: c.qty, formulaStr: c.formulaStr || String(c.qty) })));
            setIsMasterEditorOpen(true);
        }
    };

    const saveEditedCustomBoq = async () => { if (!editCustomDesc || !editCustomRate) return alert("Description and Rate are required."); await db.projectBoq.update(editingCustomId, { itemCode: editCustomCode, description: editCustomDesc, unit: editCustomUnit, rate: Number(editCustomRate) }); setEditingCustomId(null); setEditingProjectBoqId(null); };
    const addEditSpreadsheetRow = () => setEditBoqRows([...editBoqRows, { id: crypto.randomUUID(), itemType: "resource", itemId: "", formulaStr: "1", qty: 1 }]);
    const updateEditSpreadsheetRow = (id, field, value) => setEditBoqRows(editBoqRows.map(row => row.id === id ? { ...row, [field]: value, ...(field === 'itemType' ? { itemId: "", tempCode: undefined, tempDesc: undefined } : {}) } : row));
    const removeEditSpreadsheetRow = (id) => setEditBoqRows(editBoqRows.filter(row => row.id !== id));

    const saveEditedMasterBoq = async (isSaveAsNew = false) => {
        if (!editBoqCode || !editBoqDesc) return alert("Please enter a Code and Description.");
        const validComponents = editRenderedRows.filter(r => r.itemId && r.computedQty !== 0).map(r => ({ itemType: r.itemType, itemId: r.itemId, qty: Number(r.computedQty), formulaStr: r.formulaStr || String(r.computedQty) }));
        if (validComponents.length === 0) return alert("Add at least one valid component to generate a valid rate.");
        const payload = { itemCode: editBoqCode, description: editBoqDesc, unit: editBoqUnit, overhead: Number(editBoqOH), profit: Number(editBoqProfit), components: validComponents };
        if (isSaveAsNew || !editingMasterBoqId) {
            const newId = crypto.randomUUID();
            await db.masterBoq.add({ id: newId, ...payload });
            if (editingProjectBoqId) {
                let lockedRate = undefined;
                if (project.isPriceLocked) lockedRate = calculateMasterBoqRate(payload, resources, masterBoqs, project.region);
                await db.projectBoq.update(editingProjectBoqId, { masterBoqId: newId, isCustom: false, lockedRate });
            }
        } else { await db.masterBoq.update(editingMasterBoqId, payload); }
        setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null);
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: "auto", p: 3 }}>
            
            {/* --- NEXUS ALIGNED HEADER (REDUCED TITLE SIZE) --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Button 
                        startIcon={<ArrowBackIcon />} 
                        onClick={onBack} 
                        variant="outlined" 
                        sx={{ 
                            borderRadius: 50, // PILL SHAPE
                            fontFamily: "'JetBrains Mono', monospace", 
                            letterSpacing: '1px', 
                            fontSize: '11px', 
                            borderColor: 'divider', 
                            color: 'text.secondary', 
                            px: 3,
                            '&:hover': { borderColor: 'primary.main', color: 'primary.main' } 
                        }}
                    >
                        {'< '}BACK
                    </Button>
                    <Box>
                        {/* REDUCED FONT SIZE TO H5 */}
                        <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                            WORKSPACE: <span style={{ color: '#3b82f6' }}>{project.name.toUpperCase()}</span>
                        </Typography>
                        {project.isPriceLocked && (
                            <Typography variant="caption" color="success.main" sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <LockIcon sx={{ fontSize: 12 }} /> PROJECT_PRICING_LOCKED
                            </Typography>
                        )}
                    </Box>
                </Box>

                {/* ACTION TOOLS (PILL SHAPE) */}
                <Box display="flex" gap={1.5} flexWrap="wrap">
                    <input type="file" accept=".json" ref={importFileRef} style={{ display: 'none' }} onChange={handleImportData} />
                    <Button variant="outlined" color="primary" startIcon={<UploadIcon />} onClick={() => importFileRef.current.click()} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>IMPORT</Button>
                    <Button variant="outlined" color="primary" startIcon={<SyncIcon />} onClick={() => setIsExportOpen(true)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>SYNC</Button>
                    <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} onClick={() => exportProjectPdf(project, renderedProjectBoq, totalAmount)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>PDF</Button>
                    <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={() => exportProjectExcel(project, renderedProjectBoq, masterBoqs, resources)} disableElevation sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>EXCEL_ESTIMATE</Button>
                </Box>
            </Box>

            {/* --- TAB NAVIGATION --- */}
            <Paper sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
                    <Tab value="details" label="01_DASHBOARD" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="boq" label="02_BUILD_BOQ" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="mbook" label="03_MEASUREMENT_BOOK" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="schedule" label="04_SCHEDULE_GANTT" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="subcontractors" label="05_SUB_BIDS" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="daily_log" label="06_DAILY_LOG" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="resources" label="07_RESOURCE_TRACKER" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                </Tabs>
            </Paper>

            <Box sx={{ minHeight: '60vh' }}>
                {tab === "details" && (<ProjectDetailsTab project={project} updateProject={updateProject} regions={regions} totalAmount={totalAmount} projectBoqItems={projectBoqItems} togglePriceLock={togglePriceLock} crmContacts={crmContacts} orgStaff={orgStaff} />)}
                {tab === "boq" && (<BoqBuilderTab projectId={projectId} projectBoqItems={projectBoqItems} masterBoqs={masterBoqs} renderedProjectBoq={renderedProjectBoq} totalAmount={totalAmount} handleAddMasterItem={handleAddMasterItem} handleAddCustomItem={handleAddCustomItem} updateBoqQtyManual={updateBoqQtyManual} deleteProjectBoq={deleteProjectBoq} openEditDialog={openEditDialog} setFormulaHelpOpen={setFormulaHelpOpen} />)}
                {tab === "mbook" && (<MeasurementBookTab renderedProjectBoq={renderedProjectBoq} setFormulaHelpOpen={setFormulaHelpOpen} />)}
                {tab === "schedule" && (<GanttScheduleTab project={project} projectBoqItems={projectBoqItems} updateProject={updateProject} />)}
                {tab === "subcontractors" && (<SubcontractorBidTab project={project} renderedProjectBoq={renderedProjectBoq} updateProject={updateProject} crmContacts={crmContacts} />)}
                {tab === "daily_log" && (<DailyLogTab project={project} projectBoqItems={projectBoqItems} resources={resources} updateProject={updateProject} />)}
                {tab === "resources" && (<ResourceTrackerTab project={project} renderedProjectBoq={renderedProjectBoq} resources={resources} updateProject={updateProject} />)}
            </Box>

            <Dialog open={isExportOpen} onClose={() => setIsExportOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace" }}>EXPORT_DATA_SYNC</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                   <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>Generate a portable sync file for this project.</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsExportOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="primary" onClick={handleExportData} sx={{ fontFamily: "'JetBrains Mono', monospace", borderRadius: 50, px: 3 }}>GENERATE_SYNC_FILE</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}