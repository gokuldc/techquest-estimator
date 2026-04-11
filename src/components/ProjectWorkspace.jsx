import { useState, useMemo, useEffect, useRef } from "react";
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
import KanbanBoardTab from "./workspace/KanbanBoardTab";

// --- MUI COMPONENTS ---
import {
    Box, Typography, Button, Paper, Tabs, Tab, TextField, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Alert, Dialog, DialogTitle, DialogContent, DialogActions,
    FormControlLabel, Checkbox, Grid, Divider
} from "@mui/material";

// --- MUI ICONS ---
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import LockIcon from '@mui/icons-material/Lock';
import SyncIcon from '@mui/icons-material/Sync';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

export default function ProjectWorkspace({ projectId, onBack }) {
    // ==========================================
    // 1. ALL STATE DECLARATIONS (STRICTLY AT TOP)
    // ==========================================
    const [tab, setTab] = useState("details");

    // --- NATIVE SYNC & EXPORT STATE ---
    const [syncFilePath, setSyncFilePath] = useState(null);
    const [syncProjectName, setSyncProjectName] = useState("");
    const [isSyncResolveOpen, setIsSyncResolveOpen] = useState(false); 
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportOpts, setExportOpts] = useState({ 
        details: true, boq: true, dailyLogs: true, subcontractors: true, gantt: true, kanban: true 
    });

    // --- SQLITE STATE MANAGEMENT ---
    const [project, setProject] = useState("loading");
    const [regions, setRegions] = useState([]);
    const [resources, setResources] = useState([]);
    const [masterBoqs, setMasterBoqs] = useState([]);
    const [projectBoqItems, setProjectBoqItems] = useState([]);
    const [crmContacts, setCrmContacts] = useState([]);
    const [orgStaff, setOrgStaff] = useState([]);

    // --- UI INTERACTION STATE ---
    const [draggedId, setDraggedId] = useState(null);
    const [formulaHelpOpen, setFormulaHelpOpen] = useState(false);
    const [focusedQtyId, setFocusedQtyId] = useState(null);

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

    // ==========================================
    // 2. DATA LOADING
    // ==========================================
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

    // ==========================================
    // 3. MATH ENGINES
    // ==========================================
    const computeQty = (formulaStr, currentItems, currentItemSlNo = null, currentMeasurements = []) => {
        if (!formulaStr) return 0;
        const str = String(formulaStr).trim().toLowerCase();
        if (str === "") return 0;
        if (!str.startsWith('=')) { const num = Number(str); return isNaN(num) ? 0 : num; }
        let expr = str.substring(1).replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");
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
        try { return /[^0-9+\-*/().\seE]/.test(expr) ? 0 : (isFinite(new Function(`return ${expr}`)()) ? new Function(`return ${expr}`)() : 0); } catch { return 0; }
    };

    const computeMasterQty = (formulaStr, currentRows) => {
        if (!formulaStr) return 0;
        const str = String(formulaStr).trim().toLowerCase();
        if (str === "") return 0;
        if (!str.startsWith('=')) { const num = Number(str); return isNaN(num) ? 0 : num; }
        let expr = str.substring(1).replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");
        expr = expr.replace(/#(\d+)/g, (match, slNoStr) => {
            const idx = parseInt(slNoStr, 10) - 1;
            return currentRows[idx] ? (currentRows[idx].computedQty || 0) : 0;
        });
        try { return /[^0-9+\-*/().\seE]/.test(expr) ? 0 : (isFinite(new Function(`return ${expr}`)()) ? new Function(`return ${expr}`)() : 0); } catch { return 0; }
    };

    // ==========================================
    // 4. DATA COMPUTATION HOOKS (Dependent on State)
    // ==========================================
    const { renderedProjectBoq, totalAmount } = useMemo(() => {
        let total = 0;
        const sortedItems = [...projectBoqItems].sort((a, b) => a.slNo - b.slNo);
        const computedItems = [];
        for (const item of sortedItems) {
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
                    if (project?.isPriceLocked && item.lockedRate !== null && item.lockedRate !== undefined) { rate = item.lockedRate; }
                    else { rate = calculateMasterBoqRate(masterBoq, resources, masterBoqs, project?.region); }
                    displayCode = masterBoq.itemCode || "";
                    displayDesc = masterBoq.description || "";
                    displayUnit = masterBoq.unit || "";
                }
            }
            const hasMBook = item.measurements && item.measurements.length > 0;
            let computedQty = 0;
            let computedMeasurements = [];
            if (hasMBook) {
                let mbookTotal = 0;
                const u = (displayUnit || "").toLowerCase();
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

    const projectResourceMap = useMemo(() => {
        const map = {};
        renderedProjectBoq.forEach(item => {
            if (item.isCustom) return;
            const master = masterBoqs.find(m => m.id === item.masterBoqId);
            if (!master || !master.components) return;
            master.components.forEach(comp => {
                if (comp.itemType === 'resource') {
                    const res = resources.find(r => r.id === comp.itemId);
                    if (!res) return;
                    if (!map[res.id]) map[res.id] = { code: res.code, description: res.description, unit: res.unit, estimatedQty: 0 };
                    map[res.id].estimatedQty += (Number(comp.qty) * (item.computedQty || 0));
                }
            });
        });
        return map;
    }, [renderedProjectBoq, masterBoqs, resources]);

    // ==========================================
    // 5. EARLY RETURNS
    // ==========================================
    if (project === "loading") return <Box p={5} textAlign="center"><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>Loading workspace...</Typography></Box>;
    if (project === null) return ( <Box p={5} textAlign="center"><Typography variant="h6" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'error.main', mb: 2 }}>Error: Project Not Found</Typography><Button variant="outlined" onClick={onBack} startIcon={<ArrowBackIcon />}>Return to Dashboard</Button></Box> );

    // ==========================================
    // 6. DB MUTATION HANDLERS
    // ==========================================
    const updateProject = async (field, value) => { 
        const valToSave = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : value;
        await window.api.db.updateProject(projectId, { [field]: valToSave }); 
        loadData(); 
    };

    const togglePriceLock = async () => {
        const isCurrentlyLocked = project.isPriceLocked || false;
        if (!isCurrentlyLocked) {
            const updates = projectBoqItems.map(item => {
                if (item.isCustom) return { ...item, measurements: JSON.stringify(item.measurements || []) };
                const masterBoq = masterBoqs.find(m => m.id === item.masterBoqId);
                let currentRate = 0;
                if (masterBoq) currentRate = calculateMasterBoqRate(masterBoq, resources, masterBoqs, project.region);
                return { ...item, lockedRate: currentRate, measurements: JSON.stringify(item.measurements || []) };
            });
            await window.api.db.bulkPutProjectBoqs(updates);
            await window.api.db.updateProject(projectId, { isPriceLocked: true });
        } else {
            await window.api.db.updateProject(projectId, { isPriceLocked: false });
        }
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

    const handleImportDataClick = async () => {
        const res = await window.api.db.selectSyncFile();
        if (res.success) { setSyncFilePath(res.filePath); setSyncProjectName(`${res.projectName} (${res.projectCode})`); setIsSyncResolveOpen(true); } 
        else if (!res.canceled) { alert("Failed to load sync file: " + res.error); }
    };

    const processSyncImport = async (mode) => {
        if (!syncFilePath) return;
        try {
            const res = await window.api.db.executeProjectSync(project.id, syncFilePath, mode);
            if (res.success) { alert(`Project data synchronized successfully (${mode.toUpperCase()})!`); loadData(); } 
            else { alert(`Failed to sync: ${res.error}`); }
        } catch (err) { alert(`Failed to sync: ${err.message}`); } 
        finally { setIsSyncResolveOpen(false); setSyncFilePath(null); }
    };

    const handleAddMasterItem = async (addBoqId, addBoqQty, phase) => {
        const nextSlNo = projectBoqItems.length + 1;
        let lockedRate = null; 
        if (project.isPriceLocked) {
            const masterBoq = masterBoqs.find(m => m.id === addBoqId);
            if (masterBoq) lockedRate = calculateMasterBoqRate(masterBoq, resources, masterBoqs, project.region);
        }
        await window.api.db.addProjectBoq({ projectId, masterBoqId: addBoqId, slNo: nextSlNo, formulaStr: String(addBoqQty), qty: 0, measurements: JSON.stringify([]), phase, lockedRate });
        loadData();
    };

    const handleAddCustomItem = async (customCode, customDesc, customUnit, customRate, customQty, phase) => {
        const nextSlNo = projectBoqItems.length + 1;
        await window.api.db.addProjectBoq({ projectId, slNo: nextSlNo, isCustom: true, measurements: JSON.stringify([]), itemCode: customCode, description: customDesc, unit: customUnit, rate: Number(customRate), formulaStr: String(customQty), qty: 0, phase });
        loadData();
    };

    const updateBoqQtyManual = async (id, val) => { await window.api.db.updateProjectBoq(id, { formulaStr: val }); loadData(); };

    const openEditDialog = (item) => {
        setEditingProjectBoqId(item.id);
        if (item.isCustom) {
            setEditingCustomId(item.id); setEditingMasterBoqId(null); setEditCustomCode(item.itemCode || ""); setEditCustomDesc(item.description || ""); setEditCustomUnit(item.unit || "cum"); setEditCustomRate(item.rate || 0);
            setIsMasterEditorOpen(true);
        } else {
            const master = masterBoqs.find(m => m.id === item.masterBoqId);
            if (!master) return alert("Master Databook Item not found.");
            setEditingCustomId(null); setEditingMasterBoqId(master.id); setEditBoqCode(master.itemCode || ""); setEditBoqDesc(master.description || ""); setEditBoqUnit(master.unit || "cum"); setEditBoqOH(master.overhead || 0); setEditBoqProfit(master.profit || 0); setEditPreviewRegion(project?.region || "");
            setEditBoqRows((master.components || []).map(c => ({ id: crypto.randomUUID(), itemType: c.itemType || 'resource', itemId: c.itemId, qty: c.qty, formulaStr: c.formulaStr || String(c.qty) })));
            setIsMasterEditorOpen(true);
        }
    };

    const convertToMaster = () => {
        setEditingCustomId(null); setEditingMasterBoqId(null); 
        setEditBoqCode(editCustomCode); setEditBoqDesc(editCustomDesc); setEditBoqUnit(editCustomUnit);
        setEditBoqOH(15); setEditBoqProfit(15); setEditBoqRows([]); 
    };

    const saveEditedCustomBoq = async () => {
        if (!editCustomDesc || !editCustomRate) { alert("Description and Rate are required."); return; }
        await window.api.db.updateProjectBoq(editingCustomId, { itemCode: editCustomCode, description: editCustomDesc, unit: editCustomUnit, rate: Number(editCustomRate) });
        await loadData(); 
        setEditingCustomId(null); setEditingProjectBoqId(null); setIsMasterEditorOpen(false); 
    };

    const addEditSpreadsheetRow = () => setEditBoqRows([...editBoqRows, { id: crypto.randomUUID(), itemType: "resource", itemId: "", formulaStr: "1", qty: 1 }]);
    const updateEditSpreadsheetRow = (id, field, value) => setEditBoqRows(editBoqRows.map(row => row.id === id ? { ...row, [field]: value, ...(field === 'itemType' ? { itemId: "", tempCode: undefined, tempDesc: undefined } : {}) } : row));
    const removeEditSpreadsheetRow = (id) => setEditBoqRows(editBoqRows.filter(row => row.id !== id));

    const saveEditedMasterBoq = async (isSaveAsNew = false) => {
        if (!editBoqCode || !editBoqDesc) { alert("Please enter a Code and Description."); return; }
        const validComponents = editRenderedRows.filter(r => r.itemId && r.computedQty !== 0).map(r => ({ itemType: r.itemType, itemId: r.itemId, qty: Number(r.computedQty), formulaStr: r.formulaStr || String(r.computedQty) }));
        if (validComponents.length === 0) { alert("Add at least one valid component to generate a valid rate."); return; }
        
        const payload = { itemCode: editBoqCode, description: editBoqDesc, unit: editBoqUnit, overhead: Number(editBoqOH), profit: Number(editBoqProfit), components: JSON.stringify(validComponents) };

        let newMasterId = crypto.randomUUID();
        
        if (isSaveAsNew || !editingMasterBoqId) {
            await window.api.db.saveMasterBoq(payload, newMasterId, true);
            if (editingProjectBoqId) {
                let lockedRate = null;
                if (project.isPriceLocked) {
                    lockedRate = calculateMasterBoqRate(payload, resources, masterBoqs, project.region);
                }
                await window.api.db.updateProjectBoq(editingProjectBoqId, { 
                    masterBoqId: newMasterId, isCustom: false, lockedRate: lockedRate, itemCode: "", description: "", unit: "", rate: 0
                });
            }
        } else {
            await window.api.db.saveMasterBoq(payload, editingMasterBoqId, false);
            if (editingProjectBoqId && project.isPriceLocked) {
                let lockedRate = calculateMasterBoqRate(payload, resources, masterBoqs, project.region);
                await window.api.db.updateProjectBoq(editingProjectBoqId, { lockedRate: lockedRate });
            }
        }
        
        await loadData(); 
        setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null); 
    };

    // ==========================================
    // 7. RENDER COMPONENT
    // ==========================================
    return (
        <Box sx={{ maxWidth: 1400, mx: "auto", p: 3 }}>
            {/* --- HEADER --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '11px', borderColor: 'divider', color: 'text.secondary', px: 3, '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}>{'< '}BACK</Button>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                            WORKSPACE: <span style={{ color: '#3b82f6' }}>{project?.name?.toUpperCase() || "UNTITLED PROJECT"}</span>
                        </Typography>
                        {project.isPriceLocked && (<Typography variant="caption" color="success.main" sx={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}><LockIcon sx={{ fontSize: 12 }} /> PROJECT_PRICING_LOCKED</Typography>)}
                    </Box>
                </Box>
                <Box display="flex" gap={1.5} flexWrap="wrap">
                    <Button variant="outlined" color="primary" startIcon={<UploadIcon />} onClick={handleImportDataClick} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>IMPORT SYNC</Button>
                    <Button variant="outlined" color="primary" startIcon={<SyncIcon />} onClick={() => setIsExportOpen(true)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>EXPORT SYNC</Button>
                    <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} onClick={() => exportProjectPdf(project, renderedProjectBoq, totalAmount)} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>PDF</Button>
                    <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={() => exportProjectExcel(project, renderedProjectBoq, masterBoqs, resources)} disableElevation sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', height: '36px', px: 3 }}>ESTIMATE_EXCEL_SHEET</Button>
                </Box>
            </Box>

            {/* --- TABS --- */}
            <Paper sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
                    <Tab value="details" label="01_DASHBOARD" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="boq" label="02_BUILD_BOQ" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="mbook" label="03_MEASUREMENT_BOOK" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="schedule" label="04_SCHEDULE_GANTT" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="subcontractors" label="05_SUB_BIDS" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="daily_log" label="06_DAILY_LOG" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="resources" label="07_RESOURCE_TRACKER" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="kanban" label="08_KANBAN" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                </Tabs>
            </Paper>

            {/* --- CONTENT --- */}
            <Box sx={{ minHeight: '60vh' }}>
                {tab === "details" && (<ProjectDetailsTab project={project} updateProject={updateProject} regions={regions} totalAmount={totalAmount} projectBoqItems={projectBoqItems} togglePriceLock={togglePriceLock} crmContacts={crmContacts} orgStaff={orgStaff} />)}
                {tab === "boq" && (
                    <BoqBuilderTab 
                        projectId={projectId} projectBoqItems={projectBoqItems} masterBoqs={masterBoqs} renderedProjectBoq={renderedProjectBoq} totalAmount={totalAmount} 
                        handleAddMasterItem={handleAddMasterItem} handleAddCustomItem={handleAddCustomItem} updateBoqQtyManual={updateBoqQtyManual} deleteProjectBoq={deleteProjectBoq} 
                        openEditDialog={openEditDialog} setFormulaHelpOpen={setFormulaHelpOpen} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} draggedId={draggedId} 
                    />
                )}
                {tab === "mbook" && (<MeasurementBookTab renderedProjectBoq={renderedProjectBoq} setFormulaHelpOpen={setFormulaHelpOpen} loadData={loadData} />)}
                {tab === "schedule" && (<GanttScheduleTab project={project} projectBoqItems={projectBoqItems} updateProject={updateProject} />)}
                {tab === "subcontractors" && (<SubcontractorBidTab project={project} renderedProjectBoq={renderedProjectBoq} updateProject={updateProject} crmContacts={crmContacts} loadData={loadData} />)}
                {tab === "daily_log" && (<DailyLogTab project={project} projectBoqItems={projectBoqItems} resources={resources} updateProject={updateProject} loadData={loadData} />)}
                {tab === "resources" && (<ResourceTrackerTab project={project} renderedProjectBoq={renderedProjectBoq} projectResourceMap={projectResourceMap} resources={resources} updateProject={updateProject} />)}
                {tab === "kanban" && (<KanbanBoardTab project={project} renderedProjectBoq={renderedProjectBoq} orgStaff={orgStaff} />)}
            </Box>

            {/* --- DIALOGS --- */}
            <Dialog open={isExportOpen} onClose={() => setIsExportOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>EXPORT_CONFIG: <span style={{ color: '#3b82f6' }}>SYNC_GEN</span></DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', pt: 2 }}>
                    <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 2, display: 'block', opacity: 0.7 }}>SELECT_MODULES_TO_INCLUDE_IN_SYNC_FILE:</Typography>
                    <Box display="flex" flexDirection="column" gap={1}>
                        {[{ key: 'details', label: 'PROJECT_METADATA_&_STAKEHOLDERS' }, { key: 'boq', label: 'BILL_OF_QUANTITIES_&_MEASUREMENTS' }, { key: 'kanban', label: 'AGILE_KANBAN_TASKS' }, { key: 'dailyLogs', label: 'SITE_LOGS_&_RESOURCE_CONSUMPTION' }, { key: 'gantt', label: 'GANTT_SCHEDULE_DATA' }, { key: 'subcontractors', label: 'SUBCONTRACTOR_BID_DATA' }].map((opt) => (
                            <FormControlLabel key={opt.key} control={<Checkbox checked={exportOpts[opt.key]} onChange={(e) => setExportOpts({ ...exportOpts, [opt.key]: e.target.checked })} size="small" sx={{ color: 'primary.main' }} />} label={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{opt.label}</Typography>} />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsExportOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="primary" onClick={handleExportData} sx={{ borderRadius: 50, fontFamily: "'JetBrains Mono', monospace", px: 3 }}>GENERATE_SYNC_FILE</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={isMasterEditorOpen} onClose={() => { setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null); setEditingCustomId(null); }} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                    {editingCustomId ? "EDIT_CUSTOM_ITEM" : (editingMasterBoqId ? "EDIT_DATABOOK_ITEM" : "CONVERT_TO_MASTER_ITEM")}
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    {editingCustomId ? (
                        <Box display='flex' flexDirection='column' gap={3}>
                            <Alert severity="info" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                Ad-Hoc items use a fixed flat rate. Convert to a Master Item to calculate based on resources, overhead, and profit.
                            </Alert>
                            <TextField label="CODE" value={editCustomCode} onChange={e => setEditCustomCode(e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                            <TextField label="DESCRIPTION" value={editCustomDesc} onChange={e => setEditCustomDesc(e.target.value)} multiline rows={2} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                            <Box display="flex" gap={2}>
                                <TextField label="UNIT" value={editCustomUnit} onChange={e => setEditCustomUnit(e.target.value)} sx={{ flex: 1 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                                <TextField label="FLAT RATE" type="number" value={editCustomRate} onChange={e => setEditCustomRate(e.target.value)} sx={{ flex: 1 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                            </Box>
                            
                            <Box display="flex" justifyContent="flex-end" mt={2} pt={2} borderTop="1px dashed" borderColor="divider">
                                <Button variant="outlined" color="info" onClick={convertToMaster} startIcon={<AutoFixHighIcon />} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }}>
                                    CONVERT_TO_MASTER_DATABOOK_ITEM
                                </Button>
                            </Box>
                        </Box>
                    ) : (
                        <>
                            <Box display="flex" gap={3} flexWrap="wrap" mb={4}>
                                <TextField label="ITEM_CODE" value={editBoqCode} onChange={e => setEditBoqCode(e.target.value)} sx={{ flex: 1, minWidth: 150 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                <TextField label="DESCRIPTION" value={editBoqDesc} onChange={e => setEditBoqDesc(e.target.value)} sx={{ flex: 2, minWidth: 300 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                <TextField label="UNIT" value={editBoqUnit} onChange={e => setEditBoqUnit(e.target.value)} sx={{ width: 100 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                                <TextField select label="REGION" value={editPreviewRegion} onChange={e => setEditPreviewRegion(e.target.value)} sx={{ width: 200 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}>
                                    {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                                </TextField>
                            </Box>

                            <Alert severity="info" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                                <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                    💡 <strong>Formula engine:</strong> Use math (<code>= 10 * 2.5</code>) or reference rows (<code>= #1 * 0.45</code>) to automatically calculate mixture ratios.
                                </Typography>
                                <Button variant="outlined" size="small" startIcon={<HelpOutlineIcon />} onClick={() => setFormulaHelpOpen(true)} sx={{ ml: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                    FORMULA_GUIDE
                                </Button>
                            </Alert>
                            
                            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                                        <TableRow>
                                            <TableCell sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>SL.NO</TableCell>
                                            <TableCell sx={{ width: '12%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>TYPE</TableCell>
                                            <TableCell sx={{ width: '15%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CODE_SEARCH</TableCell>
                                            <TableCell sx={{ width: '30%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DESC_SEARCH</TableCell>
                                            <TableCell sx={{ width: '8%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UNIT</TableCell>
                                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY/FORMULA</TableCell>
                                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RATE</TableCell>
                                            <TableCell sx={{ width: '10%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>AMOUNT</TableCell>
                                            <TableCell align="center" sx={{ width: '5%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {editRenderedRows.map((row, idx) => {
                                            const sourceList = row.itemType === 'boq' ? masterBoqs : resources;
                                            const isFocused = focusedQtyId === row.id;
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{idx + 1}</TableCell>
                                                    <TableCell><select value={row.itemType} onChange={e => updateEditSpreadsheetRow(row.id, 'itemType', e.target.value)} style={tableInputActiveStyle}><option value="resource">RESOURCE</option><option value="boq">DATABOOK_ITEM</option></select></TableCell>
                                                    <TableCell>
                                                        <input list={`ws-codes-${row.id}`} value={row.tempCode !== undefined ? row.tempCode : (sourceList.find(s => s.id === row.itemId)?.code || sourceList.find(s => s.id === row.itemId)?.itemCode || "")} onChange={e => { const matched = sourceList.find(s => (s.code || s.itemCode) === e.target.value); setEditBoqRows(prev => prev.map(r => r.id === row.id ? (matched ? { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined } : { ...r, itemId: "", tempCode: e.target.value, tempDesc: r.tempDesc }) : r)); }} style={tableInputActiveStyle} />
                                                        <datalist id={`ws-codes-${row.id}`}>{sourceList.filter(s => s.code || s.itemCode).map(s => <option key={s.id} value={s.code || s.itemCode} />)}</datalist>
                                                    </TableCell>
                                                    <TableCell>
                                                        <input list={`ws-descs-${row.id}`} value={row.tempDesc !== undefined ? row.tempDesc : (sourceList.find(s => s.id === row.itemId)?.description || "")} onChange={e => { const matched = sourceList.find(s => s.description === e.target.value); setEditBoqRows(prev => prev.map(r => r.id === row.id ? (matched ? { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined } : { ...r, itemId: "", tempCode: r.tempCode, tempDesc: e.target.value }) : r)); }} style={tableInputActiveStyle} />
                                                        <datalist id={`ws-descs-${row.id}`}>{sourceList.filter(s => s.description).map(s => <option key={s.id} value={s.description} />)}</datalist>
                                                    </TableCell>
                                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{row.unit}</TableCell>
                                                    <TableCell>
                                                        <input type="text" value={isFocused ? (row.formulaStr !== undefined ? row.formulaStr : row.qty || "") : Number(row.computedQty || 0).toFixed(4)} onFocus={() => setFocusedQtyId(row.id)} onBlur={() => setFocusedQtyId(null)} onChange={e => updateEditSpreadsheetRow(row.id, 'formulaStr', e.target.value)} style={tableInputActiveStyle} />
                                                    </TableCell>
                                                    <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(row.rate || 0).toFixed(2)}</TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(row.amount || 0).toFixed(2)}</TableCell>
                                                    <TableCell align="center"><IconButton size="small" color="error" onClick={() => removeEditSpreadsheetRow(row.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <Button variant="outlined" disableElevation onClick={addEditSpreadsheetRow} sx={{ mb: 4, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>+ ADD_COMPONENT</Button>
                            
                            <Box display="flex" justifyContent="flex-end">
                                <Paper elevation={0} variant="outlined" sx={{ width: 400, p: 3, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                    <Box display="flex" justifyContent="space-between" mb={2}>
                                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>SUBTOTAL:</Typography>
                                        <Typography fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(editSubTotal || 0).toFixed(2)}</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>OVERHEAD (%):</Typography>
                                            <input type="number" value={editBoqOH} onChange={e => setEditBoqOH(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} />
                                        </Box>
                                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(editOhAmount || 0).toFixed(2)}</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} borderBottom="2px solid" borderColor="divider">
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>PROFIT (%):</Typography>
                                            <input type="number" value={editBoqProfit} onChange={e => setEditBoqProfit(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} />
                                        </Box>
                                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(editProfitAmount || 0).toFixed(2)}</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between" mb={1} color="success.main">
                                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>FINAL_RATE/{editBoqUnit}:</Typography>
                                        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>₹ {Number(editGrandTotal || 0).toFixed(2)}</Typography>
                                    </Box>
                                </Paper>
                            </Box>
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)', gap: 2 }}>
                    <Button onClick={() => { setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null); setEditingCustomId(null); }} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Box display="flex" gap={2}>
                        {editingCustomId ? (
                            <Button variant="contained" color="success" onClick={saveEditedCustomBoq} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>SAVE</Button>
                        ) : editingMasterBoqId ? (
                            <>
                                <Button variant="outlined" color="info" onClick={() => saveEditedMasterBoq(true)} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>SAVE_AS_NEW</Button>
                                <Button variant="contained" color="success" onClick={() => saveEditedMasterBoq(false)} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>UPDATE_ORIGINAL</Button>
                            </>
                        ) : (
                            <Button variant="contained" color="success" onClick={() => saveEditedMasterBoq(true)} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>SAVE_TO_MASTER_DB</Button>
                        )}
                    </Box>
                </DialogActions>
            </Dialog>

            <Dialog open={formulaHelpOpen} onClose={() => setFormulaHelpOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>FORMULA_GUIDE</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 2 }}>Start any quantity with <code>=</code> to evaluate math.</Typography>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, color: "primary.main" }}><strong>Basic Math:</strong> <code>= 10 * 2.5 + 4</code></Typography>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, color: "success.main" }}><strong>Reference Rows:</strong> <code>= #1 * 2</code> (Multiplies Qty of SL.NO 1 by 2)</Typography>
                    <Typography variant="body2" sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 1, color: "info.main" }}><strong>Math Functions:</strong> <code>= round(#1)</code>, <code>= ceil(5.5)</code>, <code>= pi * 2</code></Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setFormulaHelpOpen(false)} variant="contained" color="primary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CLOSE</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={isSyncResolveOpen} onClose={() => setIsSyncResolveOpen(false)} PaperProps={{ sx: { bgcolor: '#0d1f3c', border: '1px solid', borderColor: 'divider', minWidth: '400px' } }}>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '14px' }}>
                    SYNC IMPORT RESOLUTION
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 2, color: 'info.main', fontSize: '13px', fontWeight: 'bold' }}>
                        Incoming Data: {syncProjectName}
                    </Typography>
                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", mb: 3, color: '#ccc', fontSize: '12px' }}>
                        How would you like to process the incoming sync data for this project?
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button variant="outlined" color="info" onClick={() => processSyncImport('append')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px', textAlign: 'left' }}>
                            <strong>[APPEND]</strong>&nbsp;&nbsp;Add newly discovered items only. Existing items are strictly preserved.
                        </Button>
                        <Button variant="outlined" color="warning" onClick={() => processSyncImport('merge')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px', textAlign: 'left' }}>
                            <strong>[MERGE]</strong>&nbsp;&nbsp;&nbsp;Update existing items with sync data, and add new ones.
                        </Button>
                        <Button variant="outlined" color="error" onClick={() => processSyncImport('replace')} sx={{ fontFamily: "'JetBrains Mono', monospace", justifyContent: 'flex-start', textTransform: 'none', py: 1.5, fontSize: '12px', textAlign: 'left' }}>
                            <strong>[REPLACE]</strong>&nbsp;Wipe current project data entirely and use sync data.
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
                    <Button onClick={() => setIsSyncResolveOpen(false)} sx={{ fontFamily: "'JetBrains Mono', monospace", color: '#ccc', fontSize: '12px' }}>CANCEL</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}