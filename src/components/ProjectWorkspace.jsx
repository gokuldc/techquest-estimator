import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { getResourceRate, calculateMasterBoqRate } from "../engines/calculationEngine";
import { exportProjectExcel } from "../utils/exportExcel";
import { tableInputStyle, tableInputActiveStyle } from "../styles";

// --- MODULAR TAB COMPONENTS ---
import BoqBuilderTab from "./workspace/BoqBuilderTab";
import ResourceTrackerTab from "./workspace/ResourceTrackerTab";
import SubcontractorBidTab from "./workspace/SubcontractorBidTab";

import {
    Box, Typography, Button, Paper, Tabs, Tab, TextField, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Alert, Dialog, DialogTitle, DialogContent, DialogActions, Divider
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

export default function ProjectWorkspace({ projectId, onBack }) {
    const [tab, setTab] = useState("details");

    // --- DATABASE QUERIES ---
    const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
    const regions = useLiveQuery(() => db.regions.toArray()) || [];
    const resources = useLiveQuery(() => db.resources.toArray()) || [];
    const masterBoqs = useLiveQuery(() => db.masterBoq.toArray()) || [];
    const projectBoqItems = useLiveQuery(() => db.projectBoq.where({ projectId }).toArray(), [projectId]) || [];

    // --- SHARED UI STATE ---
    const [mbInputs, setMbInputs] = useState({});
    const [draggedId, setDraggedId] = useState(null);
    const [focusedMbCell, setFocusedMbCell] = useState(null);
    const [formulaHelpOpen, setFormulaHelpOpen] = useState(false);

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

        if (!str.startsWith('=')) {
            const num = Number(str);
            return isNaN(num) ? 0 : num;
        }

        let expr = str.substring(1);
        expr = expr.replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");

        expr = expr.replace(/#(\d+)(?:\.(\d+))?(?:\.([a-z]+))?/g, (match, slNoStr, rowStr, prop) => {
            const slNo = parseInt(slNoStr, 10);
            const rowIndex = rowStr ? parseInt(rowStr, 10) - 1 : 0;
            const property = prop || 'qty';

            let targetItem;
            let targetMeasurements;

            if (slNo === currentItemSlNo) {
                targetMeasurements = currentMeasurements;
                if (property === 'qty' && !rowStr) {
                    return currentMeasurements.reduce((sum, m) => sum + (m.computedQty || 0), 0);
                }
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

        try {
            if (/[^0-9+\-*/().\seE]/.test(expr)) return 0;
            const res = new Function(`return ${expr}`)();
            return isFinite(res) ? res : 0;
        } catch {
            return 0;
        }
    };

    const computeMasterQty = (formulaStr, currentRows) => {
        if (formulaStr === undefined || formulaStr === null) return 0;
        const str = String(formulaStr).trim().toLowerCase();
        if (str === "") return 0;

        if (!str.startsWith('=')) {
            const num = Number(str);
            return isNaN(num) ? 0 : num;
        }

        let expr = str.substring(1);
        expr = expr.replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");

        expr = expr.replace(/#(\d+)/g, (match, slNoStr) => {
            const idx = parseInt(slNoStr, 10) - 1;
            const refItem = currentRows[idx];
            return refItem ? (refItem.computedQty || 0) : 0;
        });

        try {
            if (/[^0-9+\-*/().\seE]/.test(expr)) return 0;
            const res = new Function(`return ${expr}`)();
            return isFinite(res) ? res : 0;
        } catch {
            return 0;
        }
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
                    rate = calculateMasterBoqRate(masterBoq, resources, masterBoqs, project?.region);
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
    }, [projectBoqItems, masterBoqs, resources, project?.region]);

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

    // --- DB ACTION HANDLERS ---
    const handleAddMasterItem = async (addBoqId, addBoqQty, phase) => {
        const nextSlNo = projectBoqItems.length + 1;
        await db.projectBoq.add({ id: crypto.randomUUID(), projectId, masterBoqId: addBoqId, slNo: nextSlNo, formulaStr: String(addBoqQty), qty: 0, measurements: [], phase });
    };

    const handleAddCustomItem = async (customCode, customDesc, customUnit, customRate, customQty, phase) => {
        const nextSlNo = projectBoqItems.length + 1;
        await db.projectBoq.add({ id: crypto.randomUUID(), projectId, slNo: nextSlNo, isCustom: true, measurements: [], itemCode: customCode, description: customDesc, unit: customUnit, rate: Number(customRate), formulaStr: String(customQty), qty: 0, phase });
    };

    const updateBoqQtyManual = async (id, val) => await db.projectBoq.update(id, { formulaStr: val });
    const deleteProjectBoq = async (id) => await db.projectBoq.delete(id);

    const triggerExport = () => {
        const exportItems = renderedProjectBoq.map(i => ({
            ...i,
            qty: i.computedQty,
            measurements: (i.computedMeasurements || []).map(m => ({
                ...m,
                no: m.no && String(m.no).startsWith("=") ? m.computedNo.toFixed(2) : m.no,
                l: m.l && String(m.l).startsWith("=") ? m.computedL.toFixed(2) : m.l,
                b: m.b && String(m.b).startsWith("=") ? m.computedB.toFixed(2) : m.b,
                d: m.d && String(m.d).startsWith("=") ? m.computedD.toFixed(2) : m.d,
                qty: m.computedQty
            }))
        }));
        exportProjectExcel(project, exportItems, masterBoqs, resources);
    };

    // --- MBOOK HANDLERS ---
    const handleMbInputChange = (itemId, field, value) => setMbInputs(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));

    const addMeasurementRow = async (item) => {
        const inputs = mbInputs[item.id] || {};
        if (!inputs.details) return alert("Please enter a location/detail description.");
        const newRow = { id: crypto.randomUUID(), details: inputs.details, no: String(inputs.no || 1), l: String(inputs.l || ""), b: String(inputs.b || ""), d: String(inputs.d || "") };
        const updatedMeasurements = [...(item.measurements || []), newRow];
        await db.projectBoq.update(item.id, { measurements: updatedMeasurements });
        setMbInputs(prev => ({ ...prev, [item.id]: { details: "", no: "", l: "", b: "", d: "" } }));
    };

    const deleteMeasurementRow = async (item, measurementId) => {
        const updatedMeasurements = (item.measurements || []).filter(m => m.id !== measurementId);
        await db.projectBoq.update(item.id, { measurements: updatedMeasurements });
    };

    const updateMeasurementInline = async (item, measurementId, field, value) => {
        const updatedMeasurements = (item.measurements || []).map(m => {
            if (m.id === measurementId) return { ...m, [field]: value };
            return m;
        });
        await db.projectBoq.update(item.id, { measurements: updatedMeasurements });
    };

    // --- DRAG AND DROP ---
    const handleDragStart = (e, id) => { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; };
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
    const handleDrop = async (e, targetId) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) return;
        const items = [...projectBoqItems].sort((a, b) => a.slNo - b.slNo);
        const draggedIdx = items.findIndex(i => i.id === draggedId);
        const targetIdx = items.findIndex(i => i.id === targetId);
        if (draggedIdx === -1 || targetIdx === -1) return;
        const [draggedItem] = items.splice(draggedIdx, 1);
        items.splice(targetIdx, 0, draggedItem);
        const updates = items.map((item, idx) => ({ ...item, slNo: idx + 1 }));
        await db.projectBoq.bulkPut(updates);
        setDraggedId(null);
    };

    // --- EDITOR DIALOG HANDLERS ---
    const openEditDialog = (item) => {
        setEditingProjectBoqId(item.id);

        if (item.isCustom) {
            setEditingCustomId(item.id);
            setEditingMasterBoqId(null);
            setEditCustomCode(item.itemCode || "");
            setEditCustomDesc(item.description || "");
            setEditCustomUnit(item.unit || "cum");
            setEditCustomRate(item.rate || 0);

            setEditBoqOH(15);
            setEditBoqProfit(15);
            setEditBoqRows([]);
        } else {
            const master = masterBoqs.find(m => m.id === item.masterBoqId);
            if (!master) return alert("Master Databook Item not found.");
            setEditingMasterBoqId(master.id);
            setEditBoqCode(master.itemCode || "");
            setEditBoqDesc(master.description || "");
            setEditBoqUnit(master.unit || "cum");
            setEditBoqOH(master.overhead || 0);
            setEditBoqProfit(master.profit || 0);
            setEditPreviewRegion(project?.region || "");

            setEditBoqRows((master.components || []).map(c => ({
                id: crypto.randomUUID(), itemType: c.itemType || 'resource', itemId: c.itemId, qty: c.qty, formulaStr: c.formulaStr || String(c.qty)
            })));
            setIsMasterEditorOpen(true);
        }
    };

    const saveEditedCustomBoq = async () => {
        if (!editCustomDesc || !editCustomRate) return alert("Description and Rate are required.");
        await db.projectBoq.update(editingCustomId, {
            itemCode: editCustomCode, description: editCustomDesc, unit: editCustomUnit, rate: Number(editCustomRate)
        });
        setEditingCustomId(null);
        setEditingProjectBoqId(null);
    };

    const addEditSpreadsheetRow = () => setEditBoqRows([...editBoqRows, { id: crypto.randomUUID(), itemType: "resource", itemId: "", formulaStr: "1", qty: 1 }]);
    const updateEditSpreadsheetRow = (id, field, value) => setEditBoqRows(editBoqRows.map(row => row.id === id ? { ...row, [field]: value, ...(field === 'itemType' ? { itemId: "", tempCode: undefined, tempDesc: undefined } : {}) } : row));
    const removeEditSpreadsheetRow = (id) => setEditBoqRows(editBoqRows.filter(row => row.id !== id));

    const saveEditedMasterBoq = async (isSaveAsNew = false) => {
        if (!editBoqCode || !editBoqDesc) return alert("Please enter a Code and Description.");
        const validComponents = editRenderedRows.filter(r => r.itemId && r.computedQty !== 0).map(r => ({
            itemType: r.itemType,
            itemId: r.itemId,
            qty: Number(r.computedQty),
            formulaStr: r.formulaStr || String(r.computedQty)
        }));

        if (validComponents.length === 0) return alert("Add at least one valid component to generate a valid rate.");
        const payload = { itemCode: editBoqCode, description: editBoqDesc, unit: editBoqUnit, overhead: Number(editBoqOH), profit: Number(editBoqProfit), components: validComponents };

        if (isSaveAsNew || !editingMasterBoqId) {
            const newId = crypto.randomUUID();
            await db.masterBoq.add({ id: newId, ...payload });
            if (editingProjectBoqId) {
                await db.projectBoq.update(editingProjectBoqId, { masterBoqId: newId, isCustom: false });
            }
            alert(editingMasterBoqId ? "Saved as a New Databook Item and applied to project!" : "Custom Item successfully converted into Master Databook Item!");
        } else {
            await db.masterBoq.update(editingMasterBoqId, payload);
            alert("Master Databook Item Updated globally!");
        }
        setIsMasterEditorOpen(false);
        setEditingMasterBoqId(null);
        setEditingProjectBoqId(null);
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" sx={{ mb: 3, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}>
                {'< '}BACK_TO_HOME
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '18px', md: '22px' } }}>
                    WORKSPACE: <span style={{ color: '#3b82f6' }}>{project.name}</span>
                </Typography>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={triggerExport} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>
                    EXPORT_ESTIMATE
                </Button>
            </Box>

            <Paper sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
                    <Tab value="details" label="01_PROJECT_DETAILS" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="boq" label="02_BUILD_BOQ" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="mbook" label="03_MEASUREMENT_BOOK" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="resources" label="04_RESOURCE_TRACKER" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="subcontractors" label="05_SUB_BIDS" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                </Tabs>
            </Paper>

            {tab === "details" && (
                <Paper sx={{ p: 4, maxWidth: 600, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Box display="flex" flexDirection="column" gap={3}>
                        <TextField label="PROJECT_NAME" value={project.name} onChange={e => updateProject("name", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        <TextField label="PROJECT_CODE" value={project.code || ""} onChange={e => updateProject("code", e.target.value)} fullWidth helperText="Unique code for this project (e.g., OP-2026-001)" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} FormHelperTextProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} />
                        <TextField label="CLIENT_NAME" value={project.clientName} onChange={e => updateProject("clientName", e.target.value)} fullWidth InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        <TextField select label="RATES_REGION" value={regions.some(r => r.name === project.region) ? project.region : ""} onChange={e => updateProject("region", e.target.value)} fullWidth helperText="Leave empty to use default rates" InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} FormHelperTextProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}>
                            <MenuItem value="">-- AUTO_DETECT_FIRST_RATE --</MenuItem>
                            {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', textAlign: 'left' }}>{r.name}</MenuItem>)}
                        </TextField>
                    </Box>
                </Paper>
            )}

            {/* --- MODULARIZED TABS RENDERED HERE --- */}

            {tab === "boq" && (
                <BoqBuilderTab
                    projectId={projectId}
                    projectBoqItems={projectBoqItems}
                    masterBoqs={masterBoqs}
                    renderedProjectBoq={renderedProjectBoq}
                    totalAmount={totalAmount}
                    handleAddMasterItem={handleAddMasterItem}
                    handleAddCustomItem={handleAddCustomItem}
                    updateBoqQtyManual={updateBoqQtyManual}
                    deleteProjectBoq={deleteProjectBoq}
                    openEditDialog={openEditDialog}
                    setFormulaHelpOpen={setFormulaHelpOpen}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDrop={handleDrop}
                    draggedId={draggedId}
                />
            )}

            {tab === "resources" && (
                <ResourceTrackerTab
                    project={project}
                    renderedProjectBoq={renderedProjectBoq}
                    resources={resources}
                    updateProject={updateProject}
                />
            )}

            {tab === "subcontractors" && (
                <SubcontractorBidTab
                    project={project}
                    renderedProjectBoq={renderedProjectBoq}
                    updateProject={updateProject}
                />
            )}

            {tab === "mbook" && (
                <Box display="flex" flexDirection="column" gap={4}>
                    {renderedProjectBoq.length === 0 && <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>ADD_ITEMS_TO_BOQ_FIRST</Typography></Paper>}

                    {renderedProjectBoq.map(item => (
                        <Paper key={item.id} elevation={0} sx={{ overflow: "hidden", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                            <Box sx={{ bgcolor: "rgba(0,0,0,0.2)", p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '14px' }}>{item.slNo}. {item.displayCode ? `[${item.displayCode}]` : ''} {item.displayDesc}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>TOTAL_QTY: <Box component="span" color="success.main" fontWeight="bold" fontSize="1rem">{Number(item.computedQty || 0).toFixed(2)} {item.displayUnit}</Box></Typography>
                                </Box>
                                <Button variant="outlined" size="small" startIcon={<HelpOutlineIcon />} onClick={() => setFormulaHelpOpen(true)} sx={{ py: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                                    FORMULA GUIDE
                                </Button>
                            </Box>

                            <TableContainer>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                                        <TableRow>
                                            <TableCell sx={{ width: '30%', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>LOCATION_DETAILS</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>NO.</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>L</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>B</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>D/H</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY</TableCell>
                                            <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>ACTION</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(item.computedMeasurements || []).map((m, idx) => {
                                            const isNoFocused = focusedMbCell === `${m.id}-no`;
                                            const isLFocused = focusedMbCell === `${m.id}-l`;
                                            const isBFocused = focusedMbCell === `${m.id}-b`;
                                            const isDFocused = focusedMbCell === `${m.id}-d`;

                                            return (
                                                <TableRow key={m.id}>
                                                    <TableCell>
                                                        <input value={m.details} onChange={e => updateMeasurementInline(item, m.id, 'details', e.target.value)} style={tableInputStyle} />
                                                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>Row Index: {idx + 1}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <input
                                                            type="text"
                                                            value={isNoFocused ? (m.no !== undefined ? m.no : "") : ((m.no === "" || m.no === undefined) ? "" : Number(m.computedNo || 0).toFixed(2))}
                                                            onFocus={() => setFocusedMbCell(`${m.id}-no`)} onBlur={() => setFocusedMbCell(null)}
                                                            onChange={e => updateMeasurementInline(item, m.id, 'no', e.target.value)} style={tableInputStyle}
                                                        />
                                                        {isNoFocused && String(m.no || "").startsWith("=") && <Typography variant="caption" color="info.main" display="block">={Number(m.computedNo || 0).toFixed(2)}</Typography>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <input
                                                            type="text"
                                                            value={isLFocused ? (m.l !== undefined ? m.l : "") : ((m.l === "" || m.l === undefined) ? "" : Number(m.computedL || 0).toFixed(2))}
                                                            onFocus={() => setFocusedMbCell(`${m.id}-l`)} onBlur={() => setFocusedMbCell(null)}
                                                            onChange={e => updateMeasurementInline(item, m.id, 'l', e.target.value)} style={tableInputStyle}
                                                        />
                                                        {isLFocused && String(m.l || "").startsWith("=") && <Typography variant="caption" color="info.main" display="block">={Number(m.computedL || 0).toFixed(2)}</Typography>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <input
                                                            type="text"
                                                            value={isBFocused ? (m.b !== undefined ? m.b : "") : ((m.b === "" || m.b === undefined) ? "" : Number(m.computedB || 0).toFixed(2))}
                                                            onFocus={() => setFocusedMbCell(`${m.id}-b`)} onBlur={() => setFocusedMbCell(null)}
                                                            onChange={e => updateMeasurementInline(item, m.id, 'b', e.target.value)} style={tableInputStyle}
                                                        />
                                                        {isBFocused && String(m.b || "").startsWith("=") && <Typography variant="caption" color="info.main" display="block">={Number(m.computedB || 0).toFixed(2)}</Typography>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <input
                                                            type="text"
                                                            value={isDFocused ? (m.d !== undefined ? m.d : "") : ((m.d === "" || m.d === undefined) ? "" : Number(m.computedD || 0).toFixed(2))}
                                                            onFocus={() => setFocusedMbCell(`${m.id}-d`)} onBlur={() => setFocusedMbCell(null)}
                                                            onChange={e => updateMeasurementInline(item, m.id, 'd', e.target.value)} style={tableInputStyle}
                                                        />
                                                        {isDFocused && String(m.d || "").startsWith("=") && <Typography variant="caption" color="info.main" display="block">={Number(m.computedD || 0).toFixed(2)}</Typography>}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{Number(m.computedQty || 0).toFixed(2)}</TableCell>
                                                    <TableCell align="center"><Button color="error" size="small" onClick={() => deleteMeasurementRow(item, m.id)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DELETE</Button></TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.15)' }}>
                                            <TableCell><input placeholder="e.g. Ground Floor Room 1" value={mbInputs[item.id]?.details || ""} onChange={e => handleMbInputChange(item.id, 'details', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="text" placeholder="No. or =" value={mbInputs[item.id]?.no || ""} onChange={e => handleMbInputChange(item.id, 'no', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="text" placeholder="L or =" value={mbInputs[item.id]?.l || ""} onChange={e => handleMbInputChange(item.id, 'l', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="text" placeholder="B or =" value={mbInputs[item.id]?.b || ""} onChange={e => handleMbInputChange(item.id, 'b', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="text" placeholder="D/H or =" value={mbInputs[item.id]?.d || ""} onChange={e => handleMbInputChange(item.id, 'd', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell color="text.secondary">-</TableCell>
                                            <TableCell align="center"><Button variant="contained" size="small" onClick={() => addMeasurementRow(item)} fullWidth sx={{ borderRadius: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }}>ADD</Button></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    ))}
                </Box>
            )}

            {/* --- MASTER BOQ EDITOR DIALOG --- */}
            <Dialog open={isMasterEditorOpen} onClose={() => { setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null); }} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>
                    {editingMasterBoqId ? "EDIT_DATABOOK_ITEM" : "CONVERT_TO_MASTER_ITEM"}
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    {!editingMasterBoqId && (
                        <Alert severity="warning" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                            You are converting a Custom Ad-Hoc item into a Master Databook Item. You must define its components below to generate its rate.
                        </Alert>
                    )}
                    <Box display="flex" gap={3} flexWrap="wrap" mb={4}>
                        <TextField label="ITEM_CODE" value={editBoqCode} onChange={e => setEditBoqCode(e.target.value)} sx={{ flex: 1, minWidth: 150 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        <TextField label="DESCRIPTION" value={editBoqDesc} onChange={e => setEditBoqDesc(e.target.value)} sx={{ flex: 2, minWidth: 300 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                        <TextField label="UNIT" value={editBoqUnit} onChange={e => setEditBoqUnit(e.target.value)} sx={{ width: 100 }} InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }} InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }} />
                    </Box>

                    <Alert severity="info" sx={{ mb: 3, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                        💡 <strong>TIPS:</strong> Start with <code>=</code> for formulas. Use <code>ceil()</code>, <code>floor()</code>, <code>round()</code>. Reference components by row index using <code>#</code> (e.g. <code>=#1 * 1.5</code>).
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
                                    const isFormula = String(row.formulaStr || "").trim().startsWith("=");
                                    const isFocused = false; // Focused row state is minimal in master editor

                                    return (
                                        <TableRow key={row.id}>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{idx + 1}</TableCell>
                                            <TableCell>
                                                <select value={row.itemType} onChange={e => updateEditSpreadsheetRow(row.id, 'itemType', e.target.value)} style={tableInputActiveStyle}>
                                                    <option value="resource">RESOURCE</option><option value="boq">DATABOOK_ITEM</option>
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    list={`edit-codes-${row.id}`}
                                                    value={row.tempCode !== undefined ? row.tempCode : (sourceList.find(s => s.id === row.itemId)?.code || sourceList.find(s => s.id === row.itemId)?.itemCode || "")}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const matched = sourceList.find(s => (s.code || s.itemCode) === val);
                                                        setEditBoqRows(prev => prev.map(r => {
                                                            if (r.id === row.id) {
                                                                if (matched) return { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined };
                                                                return { ...r, itemId: "", tempCode: val, tempDesc: r.tempDesc };
                                                            }
                                                            return r;
                                                        }));
                                                    }}
                                                    placeholder="Type code..." style={tableInputActiveStyle}
                                                />
                                                <datalist id={`edit-codes-${row.id}`}>
                                                    {sourceList.filter(s => s.code || s.itemCode).map(s => <option key={s.id} value={s.code || s.itemCode} />)}
                                                </datalist>
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    list={`edit-descs-${row.id}`}
                                                    value={row.tempDesc !== undefined ? row.tempDesc : (sourceList.find(s => s.id === row.itemId)?.description || "")}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const matched = sourceList.find(s => s.description === val);
                                                        setEditBoqRows(prev => prev.map(r => {
                                                            if (r.id === row.id) {
                                                                if (matched) return { ...r, itemId: matched.id, tempCode: undefined, tempDesc: undefined };
                                                                return { ...r, itemId: "", tempCode: r.tempCode, tempDesc: val };
                                                            }
                                                            return r;
                                                        }));
                                                    }}
                                                    placeholder="Type description..." style={tableInputActiveStyle}
                                                />
                                                <datalist id={`edit-descs-${row.id}`}>
                                                    {sourceList.filter(s => s.description).map(s => <option key={s.id} value={s.description} />)}
                                                </datalist>
                                            </TableCell>
                                            <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{row.unit}</TableCell>
                                            <TableCell>
                                                <input
                                                    type="text"
                                                    value={isFocused ? (row.formulaStr !== undefined ? row.formulaStr : row.qty) : Number(row.computedQty || 0).toFixed(4)}
                                                    onChange={e => updateEditSpreadsheetRow(row.id, 'formulaStr', e.target.value)}
                                                    placeholder="e.g. =#1 * 0.05"
                                                    style={tableInputActiveStyle}
                                                />
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

                    <Button variant="outlined" disableElevation onClick={addEditSpreadsheetRow} sx={{ mb: 4, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}>
                        + ADD_COMPONENT
                    </Button>

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
                            <Box display="flex" justifyContent="space-between" mb={3} color="success.main">
                                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>FINAL_RATE/{editBoqUnit}:</Typography>
                                <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>₹ {Number(editGrandTotal || 0).toFixed(2)}</Typography>
                            </Box>
                        </Paper>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: 'rgba(13, 31, 60, 0.5)', gap: 2 }}>
                    <Button onClick={() => { setIsMasterEditorOpen(false); setEditingMasterBoqId(null); setEditingProjectBoqId(null); }} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Box display="flex" gap={2}>
                        {editingMasterBoqId ? (
                            <>
                                <Button variant="outlined" color="info" onClick={() => saveEditedMasterBoq(true)} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                                    SAVE_AS_NEW
                                </Button>
                                <Button variant="contained" color="success" onClick={() => saveEditedMasterBoq(false)} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                                    UPDATE_ORIGINAL
                                </Button>
                            </>
                        ) : (
                            <Button variant="contained" color="success" onClick={() => saveEditedMasterBoq(true)} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                                SAVE_TO_MASTER_DB
                            </Button>
                        )}
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
                    <Button variant="contained" color="success" onClick={saveEditedCustomBoq} startIcon={<SaveIcon />} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>
                        SAVE
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}