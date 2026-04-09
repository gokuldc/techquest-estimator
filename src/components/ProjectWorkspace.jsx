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
    
    // --- CRM DATA FETCH INJECTED HERE ---
    const crmContacts = useLiveQuery(() => db.crmContacts.toArray()) || [];

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

    // --- CORE MATH ENGINES ---
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

    // --- SYNC EXPORT / IMPORT LOGIC ---
    const handleExportData = () => {
        const payload = {
            metadata: { app: "OpenPrix", version: "1.0", type: "ProjectSync" },
            projectId: project.id,
            projectDetails: {
                name: project.name, code: project.code, clientName: project.clientName,
                status: project.status, region: project.region, projectLead: project.projectLead,
                siteSupervisor: project.siteSupervisor, isPriceLocked: project.isPriceLocked,
                pmc: project.pmc, architect: project.architect, structuralEngineer: project.structuralEngineer,
                ...(exportOpts.bids && { subcontractors: project.subcontractors, phaseAssignments: project.phaseAssignments }),
                ...(exportOpts.logs && { dailyLogs: project.dailyLogs, actualResources: project.actualResources }),
                ...(exportOpts.schedule && { ganttTasks: project.ganttTasks })
            },
            projectBoq: exportOpts.boq ? projectBoqItems.map(item => ({
                ...item, measurements: exportOpts.mbook ? item.measurements : []
            })) : undefined
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
                if (data.metadata?.app !== "OpenPrix") throw new Error("Invalid file format");

                if (data.projectId !== project.id) {
                    const isProjectEmpty = projectBoqItems.length === 0 && !(project.dailyLogs?.length) && !(project.ganttTasks?.length);
                    if (isProjectEmpty) {
                        const adopt = window.confirm(`This sync file belongs to another project (${data.projectDetails?.name || 'Unknown'}). Since your current project is empty, do you want to adopt this data?`);
                        if (!adopt) return;
                        if (data.projectBoq) data.projectBoq = data.projectBoq.map(b => ({ ...b, projectId: project.id }));
                    } else {
                        alert("ID Mismatch! This file belongs to a different active project. Import rejected to protect your current workspace data.");
                        return;
                    }
                }

                const updatedProject = { ...project };
                const safeKeys = [
                    'name', 'code', 'clientName', 'status', 'region', 'projectLead', 'siteSupervisor',
                    'pmc', 'architect', 'structuralEngineer', 'isPriceLocked',
                    'subcontractors', 'phaseAssignments', 'dailyLogs', 'actualResources', 'ganttTasks'
                ];
                for (const key of safeKeys) {
                    if (data.projectDetails[key] !== undefined) updatedProject[key] = data.projectDetails[key];
                }
                await db.projects.put(updatedProject);

                if (data.projectBoq) {
                    await db.projectBoq.where({ projectId: project.id }).delete();
                    await db.projectBoq.bulkPut(data.projectBoq);
                }
                alert("Project data synchronized successfully!");
            } catch (err) {
                alert("Failed to read project sync file.");
                console.error(err);
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    // --- STANDARD UI HANDLERS ---
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

    const triggerExport = () => {
        const exportItems = renderedProjectBoq.map(i => ({
            ...i, qty: i.computedQty,
            measurements: (i.computedMeasurements || []).map(m => ({
                ...m, no: m.no && String(m.no).startsWith("=") ? m.computedNo.toFixed(2) : m.no,
                l: m.l && String(m.l).startsWith("=") ? m.computedL.toFixed(2) : m.l,
                b: m.b && String(m.b).startsWith("=") ? m.computedB.toFixed(2) : m.b,
                d: m.d && String(m.d).startsWith("=") ? m.computedD.toFixed(2) : m.d,
                qty: m.computedQty
            }))
        }));
        exportProjectExcel(project, exportItems, masterBoqs, resources);
    };

    const handleDragStart = (e, id) => { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; };
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
    const handleDrop = async (e, targetId) => { e.preventDefault(); if (!draggedId || draggedId === targetId) return; const items = [...projectBoqItems].sort((a, b) => a.slNo - b.slNo); const draggedIdx = items.findIndex(i => i.id === draggedId); const targetIdx = items.findIndex(i => i.id === targetId); if (draggedIdx === -1 || targetIdx === -1) return; const [draggedItem] = items.splice(draggedIdx, 1); items.splice(targetIdx, 0, draggedItem); const updates = items.map((item, idx) => ({ ...item, slNo: idx + 1 })); await db.projectBoq.bulkPut(updates); setDraggedId(null); };

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
            alert(editingMasterBoqId ? "Saved as a New Databook Item and applied to project!" : "Custom Item successfully converted into Master Databook Item!");
        } else {
            await db.masterBoq.update(editingMasterBoqId, payload);
            alert("Master Databook Item Updated globally! (Note: if this project's price is locked, it will not reflect the changes here).");
        }
        setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null);
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" sx={{ mb: 3, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}>
                {'< '}BACK_TO_HOME
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '18px', md: '22px' } }}>
                        WORKSPACE: <span style={{ color: '#3b82f6' }}>{project.name}</span>
                    </Typography>
                    {project.isPriceLocked && (
                        <Typography variant="body2" color="success.main" sx={{ mt: 0.5, fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LockIcon fontSize="small" /> PROJECT PRICE IS LOCKED
                        </Typography>
                    )}
                </Box>

                {/* --- SYNC ACTION BAR --- */}
                <Box display="flex" gap={2} flexWrap="wrap">
                    <input type="file" accept=".json" ref={importFileRef} style={{ display: 'none' }} onChange={handleImportData} />
                    <Button variant="outlined" color="primary" startIcon={<UploadIcon />} onClick={() => importFileRef.current.click()} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '11px' }}>
                        IMPORT DATA
                    </Button>
                    <Button variant="outlined" color="primary" startIcon={<SyncIcon />} onClick={() => setIsExportOpen(true)} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '11px' }}>
                        EXPORT DATA
                    </Button>
                    <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} onClick={() => exportProjectPdf(project, renderedProjectBoq, totalAmount)} sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '11px' }}>
                        PDF REPORT
                    </Button>
                    <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={triggerExport} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '11px' }}>
                        EXCEL ESTIMATE
                    </Button>
                </Box>
            </Box>

            {/* --- ORDERED TAB NAVIGATION --- */}
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

            {/* --- MODULAR TABS RENDERED IN ORDER --- */}
            {/* INJECTED CRM CONTACTS HERE */}
            {tab === "details" && (<ProjectDetailsTab project={project} updateProject={updateProject} regions={regions} totalAmount={totalAmount} projectBoqItems={projectBoqItems} togglePriceLock={togglePriceLock} crmContacts={crmContacts} />)}

            {tab === "boq" && (<BoqBuilderTab projectId={projectId} projectBoqItems={projectBoqItems} masterBoqs={masterBoqs} renderedProjectBoq={renderedProjectBoq} totalAmount={totalAmount} handleAddMasterItem={handleAddMasterItem} handleAddCustomItem={handleAddCustomItem} updateBoqQtyManual={updateBoqQtyManual} deleteProjectBoq={deleteProjectBoq} openEditDialog={openEditDialog} setFormulaHelpOpen={setFormulaHelpOpen} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} draggedId={draggedId} />)}

            {tab === "mbook" && (<MeasurementBookTab renderedProjectBoq={renderedProjectBoq} setFormulaHelpOpen={setFormulaHelpOpen} />)}

            {tab === "schedule" && (<GanttScheduleTab project={project} projectBoqItems={projectBoqItems} updateProject={updateProject} />)}

            {/* INJECTED CRM CONTACTS HERE */}
            {tab === "subcontractors" && (<SubcontractorBidTab project={project} renderedProjectBoq={renderedProjectBoq} updateProject={updateProject} crmContacts={crmContacts} />)}

            {tab === "daily_log" && (<DailyLogTab project={project} projectBoqItems={projectBoqItems} resources={resources} updateProject={updateProject} />)}

            {tab === "resources" && (<ResourceTrackerTab project={project} renderedProjectBoq={renderedProjectBoq} resources={resources} updateProject={updateProject} />)}

            {/* --- EXPORT SELECTION DIALOG --- */}
            <Dialog open={isExportOpen} onClose={() => setIsExportOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>EXPORT_DATA_SYNC</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="info" sx={{ mb: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        Basic Project details (Name, Code, Client, Status, Roles) are always exported. Select which specific data modules to include below.
                    </Alert>

                    <FormControlLabel control={<Checkbox checked={exportOpts.boq} onChange={e => setExportOpts({ ...exportOpts, boq: e.target.checked })} color="primary" />} label={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>BOQ Items & Formulas</Typography>} />
                    <FormControlLabel control={<Checkbox checked={exportOpts.mbook} onChange={e => setExportOpts({ ...exportOpts, mbook: e.target.checked })} color="primary" disabled={!exportOpts.boq} />} label={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>Measurement Book Details</Typography>} sx={{ ml: 4 }} />
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                    <FormControlLabel control={<Checkbox checked={exportOpts.schedule} onChange={e => setExportOpts({ ...exportOpts, schedule: e.target.checked })} color="primary" />} label={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>Gantt Schedule & Tasks</Typography>} />
                    <FormControlLabel control={<Checkbox checked={exportOpts.bids} onChange={e => setExportOpts({ ...exportOpts, bids: e.target.checked })} color="primary" />} label={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>Subcontractor Bids & Assignments</Typography>} />
                    <FormControlLabel control={<Checkbox checked={exportOpts.logs} onChange={e => setExportOpts({ ...exportOpts, logs: e.target.checked })} color="primary" />} label={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>Daily Site Logs & Actual Consumption</Typography>} />
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setIsExportOpen(false)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="primary" onClick={handleExportData} startIcon={<DownloadIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>GENERATE SYNC FILE</Button>
                </DialogActions>
            </Dialog>

            {/* --- MASTER BOQ EDITOR DIALOG --- */}
            <Dialog open={isMasterEditorOpen} onClose={() => { setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null); }} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>{editingMasterBoqId ? "EDIT_DATABOOK_ITEM" : "CONVERT_TO_MASTER_ITEM"}</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    {!editingMasterBoqId && <Alert severity="warning" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>You are converting a Custom Ad-Hoc item into a Master Databook Item. You must define its components below to generate its rate.</Alert>}
                    <Box display="flex" gap={3} flexWrap="wrap" mb={4}>
                        <TextField label="ITEM_CODE" value={editBoqCode} onChange={e => setEditBoqCode(e.target.value)} sx={{ flex: 1, minWidth: 150 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        <TextField label="DESCRIPTION" value={editBoqDesc} onChange={e => setEditBoqDesc(e.target.value)} sx={{ flex: 2, minWidth: 300 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        <TextField label="UNIT" value={editBoqUnit} onChange={e => setEditBoqUnit(e.target.value)} sx={{ width: 100 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                    </Box>
                    <Alert severity="info" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>💡 <strong>TIPS:</strong> Start with <code>=</code> for formulas. Reference components by row index using <code>#</code> (e.g. <code>=#1 * 1.5</code>).</Alert>

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
                                    return (
                                        <TableRow key={row.id}>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{idx + 1}</TableCell>
                                            <TableCell><select value={row.itemType} onChange={e => updateEditSpreadsheetRow(row.id, 'itemType', e.target.value)} style={tableInputActiveStyle}><option value="resource">RESOURCE</option><option value="boq">DATABOOK_ITEM</option></select></TableCell>
                                            <TableCell>
                                                <input list={`edit-codes-${row.id}`} value={row.tempCode !== undefined ? row.tempCode : (sourceList.find(s => s.id === row.itemId)?.code || sourceList.find(s => s.id === row.itemId)?.itemCode || "")} onChange={e => { const val = e.target.value; const matched = sourceList.find(s => (s.code || s.itemCode) === val); setEditBoqRows(prev => prev.map(r => { if (r.id === row.id) { if (matched) return { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined }; return { ...r, itemId: "", tempCode: val, tempDesc: r.tempDesc }; } return r; })); }} style={tableInputActiveStyle} />
                                                <datalist id={`edit-codes-${row.id}`}>{sourceList.filter(s => s.code || s.itemCode).map(s => <option key={s.id} value={s.code || s.itemCode} />)}</datalist>
                                            </TableCell>
                                            <TableCell>
                                                <input list={`edit-descs-${row.id}`} value={row.tempDesc !== undefined ? row.tempDesc : (sourceList.find(s => s.id === row.itemId)?.description || "")} onChange={e => { const val = e.target.value; const matched = sourceList.find(s => s.description === val); setEditBoqRows(prev => prev.map(r => { if (r.id === row.id) { if (matched) return { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined }; return { ...r, itemId: "", tempCode: r.tempCode, tempDesc: val }; } return r; })); }} style={tableInputActiveStyle} />
                                                <datalist id={`edit-descs-${row.id}`}>{sourceList.filter(s => s.description).map(s => <option key={s.id} value={s.description} />)}</datalist>
                                            </TableCell>
                                            <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{row.unit}</TableCell>
                                            <TableCell><input type="text" value={row.formulaStr !== undefined ? row.formulaStr : row.qty} onChange={e => updateEditSpreadsheetRow(row.id, 'formulaStr', e.target.value)} style={tableInputActiveStyle} /></TableCell>
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
                            <Box display="flex" justifyContent="space-between" mb={2}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>SUBTOTAL:</Typography><Typography fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(editSubTotal || 0).toFixed(2)}</Typography></Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}><Box display="flex" alignItems="center" gap={1}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>OVERHEAD (%):</Typography><input type="number" value={editBoqOH} onChange={e => setEditBoqOH(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} /></Box><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(editOhAmount || 0).toFixed(2)}</Typography></Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={2} borderBottom="2px solid" borderColor="divider"><Box display="flex" alignItems="center" gap={1}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>PROFIT (%):</Typography><input type="number" value={editBoqProfit} onChange={e => setEditBoqProfit(e.target.value)} style={{ ...tableInputActiveStyle, width: 60 }} /></Box><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {Number(editProfitAmount || 0).toFixed(2)}</Typography></Box>
                            <Box display="flex" justifyContent="space-between" mb={3} color="success.main"><Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>FINAL_RATE/{editBoqUnit}:</Typography><Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>₹ {Number(editGrandTotal || 0).toFixed(2)}</Typography></Box>
                        </Paper>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)', gap: 2 }}>
                    <Button onClick={() => { setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null); }} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Box display="flex" gap={2}>
                        {editingMasterBoqId ? (<> <Button variant="outlined" color="info" onClick={() => saveEditedMasterBoq(true)} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>SAVE_AS_NEW</Button> <Button variant="contained" color="success" onClick={() => saveEditedMasterBoq(false)} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>UPDATE_ORIGINAL</Button> </>) : (<Button variant="contained" color="success" onClick={() => saveEditedMasterBoq(true)} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>SAVE_TO_MASTER_DB</Button>)}
                    </Box>
                </DialogActions>
            </Dialog>

            {/* --- CUSTOM BOQ EDITOR DIALOG --- */}
            <Dialog open={!!editingCustomId} onClose={() => { setEditingCustomId(null); setEditingProjectBoqId(null); }} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>EDIT_CUSTOM_ITEM</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <TextField label="CODE" value={editCustomCode} onChange={e => setEditCustomCode(e.target.value)} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                    <TextField label="DESCRIPTION" value={editCustomDesc} onChange={e => setEditCustomDesc(e.target.value)} multiline rows={2} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                    <Box display="flex" gap={2}>
                        <TextField label="UNIT" value={editCustomUnit} onChange={e => setEditCustomUnit(e.target.value)} sx={{ flex: 1 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                        <TextField label="RATE" type="number" value={editCustomRate} onChange={e => setEditCustomRate(e.target.value)} sx={{ flex: 1 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }} />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => { setEditingCustomId(null); setEditingProjectBoqId(null); }} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={saveEditedCustomBoq} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>SAVE</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}