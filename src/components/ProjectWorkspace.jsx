import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { calculateMasterBoqRate } from "../engines/calculationEngine";
import { calcRowQty, calcTotalQty } from "../engines/measurementEngine";
import { exportProjectExcel } from "../utils/exportExcel";
import {
    Box, Typography, Button, Paper, Tabs, Tab, TextField, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

export default function ProjectWorkspace({ projectId, onBack }) {
    const [tab, setTab] = useState("details");
    const [addMode, setAddMode] = useState("master");

    const project = useLiveQuery(() => db.projects.get(projectId));
    const regions = useLiveQuery(() => db.regions.toArray()) || [];
    const resources = useLiveQuery(() => db.resources.toArray()) || [];
    const masterBoqs = useLiveQuery(() => db.masterBoq.toArray()) || [];
    const projectBoqItems = useLiveQuery(() => db.projectBoq.where({ projectId }).toArray()) || [];

    const [searchCode, setSearchCode] = useState("");
    const [searchDesc, setSearchDesc] = useState("");
    const [addBoqId, setAddBoqId] = useState("");
    const [addBoqQty, setAddBoqQty] = useState("");
    const [customCode, setCustomCode] = useState("");
    const [customDesc, setCustomDesc] = useState("");
    const [customUnit, setCustomUnit] = useState("cum");
    const [customRate, setCustomRate] = useState("");
    const [customQty, setCustomQty] = useState("");
    const [mbInputs, setMbInputs] = useState({});

    const { renderedProjectBoq, totalAmount } = useMemo(() => {
        let total = 0;
        const items = [...projectBoqItems].sort((a, b) => a.slNo - b.slNo).map(item => {
            if (item.isCustom) {
                const amount = item.qty * item.rate;
                total += amount;
                return { ...item, amount, displayCode: item.itemCode, displayDesc: item.description, displayUnit: item.unit };
            } else {
                const masterBoq = masterBoqs.find(m => m.id === item.masterBoqId);
                if (!masterBoq) return null;
                const rate = calculateMasterBoqRate(masterBoq, resources, masterBoqs, project?.region);
                const amount = item.qty * rate;
                total += amount;
                return { ...item, masterBoq, rate, amount, displayCode: masterBoq.itemCode, displayDesc: masterBoq.description, displayUnit: masterBoq.unit };
            }
        }).filter(Boolean);
        return { renderedProjectBoq: items, totalAmount: total };
    }, [projectBoqItems, masterBoqs, resources, project?.region]);

    if (!project) return <Box p={5} textAlign="center"><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>Loading workspace...</Typography></Box>;

    const updateProject = (field, value) => db.projects.update(projectId, { [field]: value });

    const addBoqItemToProject = async () => {
        const nextSlNo = projectBoqItems.length + 1;
        if (addMode === "master") {
            if (!addBoqId || !addBoqQty) return alert("Select an item and enter quantity.");
            await db.projectBoq.add({ id: crypto.randomUUID(), projectId, masterBoqId: addBoqId, slNo: nextSlNo, qty: Number(addBoqQty), measurements: [] });
            setAddBoqId(""); setAddBoqQty("");
        } else {
            if (!customDesc || !customRate || !customQty) return alert("Description, Rate, and Quantity required.");
            await db.projectBoq.add({
                id: crypto.randomUUID(), projectId, slNo: nextSlNo, isCustom: true, measurements: [],
                itemCode: customCode, description: customDesc, unit: customUnit, rate: Number(customRate), qty: Number(customQty)
            });
            setCustomCode(""); setCustomDesc(""); setCustomRate(""); setCustomQty("");
        }
    };

    const updateBoqQtyManual = async (id, newQty) => await db.projectBoq.update(id, { qty: Number(newQty) });
    const deleteProjectBoq = async (id) => await db.projectBoq.delete(id);
    const triggerExport = () => exportProjectExcel(project, projectBoqItems, masterBoqs, resources);

    const filteredMasterBoqs = masterBoqs.filter(b =>
        (b.itemCode || "").toLowerCase().includes(searchCode.toLowerCase()) &&
        (b.description || "").toLowerCase().includes(searchDesc.toLowerCase())
    );

    const handleMbInputChange = (itemId, field, value) => setMbInputs(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));

    const addMeasurementRow = async (item) => {
        const inputs = mbInputs[item.id] || {};
        if (!inputs.details) return alert("Please enter a location/detail description.");
        const newRow = { id: crypto.randomUUID(), details: inputs.details, no: inputs.no || 1, l: inputs.l || "", b: inputs.b || "", d: inputs.d || "", qty: calcRowQty(inputs, item.displayUnit) };
        const updatedMeasurements = [...(item.measurements || []), newRow];
        await db.projectBoq.update(item.id, { measurements: updatedMeasurements, qty: calcTotalQty(updatedMeasurements) });
        setMbInputs(prev => ({ ...prev, [item.id]: { details: "", no: "", l: "", b: "", d: "" } }));
    };

    const deleteMeasurementRow = async (item, measurementId) => {
        const updatedMeasurements = (item.measurements || []).filter(m => m.id !== measurementId);
        await db.projectBoq.update(item.id, { measurements: updatedMeasurements, qty: calcTotalQty(updatedMeasurements) });
    };

    const updateMeasurementInline = async (item, measurementId, field, value) => {
        const updatedMeasurements = (item.measurements || []).map(m => {
            if (m.id === measurementId) {
                const updatedRow = { ...m, [field]: value };
                updatedRow.qty = calcRowQty(updatedRow, item.displayUnit);
                return updatedRow;
            }
            return m;
        });
        await db.projectBoq.update(item.id, { measurements: updatedMeasurements, qty: calcTotalQty(updatedMeasurements) });
    };

    const tableInputStyle = { width: "100%", padding: "8px", boxSizing: "border-box", border: "1px solid var(--mui-palette-divider)", borderRadius: "4px", background: "var(--mui-palette-background-default)", color: "var(--mui-palette-text-primary)", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" };

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={onBack}
                variant="outlined"
                sx={{
                    mb: 3,
                    borderRadius: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '1px',
                    fontSize: '12px',
                    borderColor: 'divider',
                    color: 'text.secondary',
                    '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                }}
            >
                {'< '}BACK_TO_HOME
            </Button>

            <Box sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4,
                flexWrap: 'wrap', gap: 2,
                pb: 3, borderBottom: '1px solid', borderColor: 'divider',
            }}>
                <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '1px',
                        fontSize: { xs: '18px', md: '22px' },
                    }}
                >
                    WORKSPACE: <span style={{ color: '#3b82f6' }}>{project.name}</span>
                </Typography>
                <Button
                    variant="contained"
                    color="success"
                    startIcon={<DownloadIcon />}
                    onClick={triggerExport}
                    disableElevation
                    sx={{
                        borderRadius: 2,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '1px',
                        fontSize: '12px',
                    }}
                >
                    EXPORT_ESTIMATE
                </Button>
            </Box>

            <Paper sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="fullWidth">
                    <Tab value="details" label="01_PROJECT_DETAILS" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="boq" label="02_BUILD_BOQ" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    <Tab value="mbook" label="03_MEASUREMENT_BOOK" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                </Tabs>
            </Paper>

            {tab === "details" && (
                <Paper sx={{ p: 4, maxWidth: 600, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Box display="flex" flexDirection="column" gap={3}>
                        <TextField
                            label="PROJECT_NAME"
                            value={project.name}
                            onChange={e => updateProject("name", e.target.value)}
                            fullWidth
                            InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', letterSpacing: '0.5px' } }}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}
                        />
                        <TextField
                            label="CLIENT_NAME"
                            value={project.clientName}
                            onChange={e => updateProject("clientName", e.target.value)}
                            fullWidth
                            InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', letterSpacing: '0.5px' } }}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}
                        />
                        <TextField
                            select
                            label="RATES_REGION"
                            value={project.region}
                            onChange={e => updateProject("region", e.target.value)}
                            fullWidth
                            helperText="Leave empty to use default rates"
                            InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', letterSpacing: '0.5px' } }}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' } }}
                            FormHelperTextProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                        >
                            <MenuItem value="">-- AUTO_DETECT_FIRST_RATE --</MenuItem>
                            {regions.map(r => <MenuItem key={r.id} value={r.name} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{r.name}</MenuItem>)}
                        </TextField>
                    </Box>
                </Paper>
            )}

            {tab === "boq" && (
                <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
                        <Button
                            variant={addMode === "master" ? "contained" : "outlined"}
                            onClick={() => setAddMode("master")}
                            sx={{
                                borderRadius: 2,
                                fontFamily: "'JetBrains Mono', monospace",
                                letterSpacing: '0.5px',
                                fontSize: '12px',
                            }}
                        >
                            MASTER_DATABASE
                        </Button>
                        <Button
                            variant={addMode === "custom" ? "contained" : "outlined"}
                            onClick={() => setAddMode("custom")}
                            color="secondary"
                            sx={{
                                borderRadius: 2,
                                fontFamily: "'JetBrains Mono', monospace",
                                letterSpacing: '0.5px',
                                fontSize: '12px',
                            }}
                        >
                            CUSTOM_AD_HOC
                        </Button>
                    </Box>

                    <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                        {addMode === "master" ? (
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <TextField
                                    size="small"
                                    label="SEARCH_CODE"
                                    value={searchCode}
                                    onChange={e => setSearchCode(e.target.value)}
                                    sx={{ flex: 1, minWidth: 120 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                />
                                <TextField
                                    size="small"
                                    label="SEARCH_DESC"
                                    value={searchDesc}
                                    onChange={e => setSearchDesc(e.target.value)}
                                    sx={{ flex: 1.5, minWidth: 150 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                />
                                <TextField
                                    select
                                    size="small"
                                    label="SELECT_ITEM"
                                    value={addBoqId}
                                    onChange={e => setAddBoqId(e.target.value)}
                                    sx={{ flex: 2, minWidth: 250 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                >
                                    <MenuItem value="">-- CHOOSE_MASTER_BOQ --</MenuItem>
                                    {filteredMasterBoqs.map(b => <MenuItem key={b.id} value={b.id} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{b.itemCode ? `[${b.itemCode}] ` : ''}{b.description}</MenuItem>)}
                                </TextField>
                                <TextField
                                    size="small"
                                    type="number"
                                    label="QTY"
                                    value={addBoqQty}
                                    onChange={e => setAddBoqQty(e.target.value)}
                                    sx={{ width: 100 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={addBoqItemToProject}
                                    startIcon={<AddIcon />}
                                    sx={{ height: 40, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}
                                >
                                    ADD
                                </Button>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <TextField
                                    size="small"
                                    label="CODE"
                                    value={customCode}
                                    onChange={e => setCustomCode(e.target.value)}
                                    sx={{ width: 120 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                />
                                <TextField
                                    size="small"
                                    label="DESCRIPTION"
                                    value={customDesc}
                                    onChange={e => setCustomDesc(e.target.value)}
                                    sx={{ flex: 2, minWidth: 200 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                />
                                <TextField
                                    size="small"
                                    label="UNIT"
                                    value={customUnit}
                                    onChange={e => setCustomUnit(e.target.value)}
                                    sx={{ width: 100 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                />
                                <TextField
                                    size="small"
                                    type="number"
                                    label="RATE"
                                    value={customRate}
                                    onChange={e => setCustomRate(e.target.value)}
                                    sx={{ width: 120 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                />
                                <TextField
                                    size="small"
                                    type="number"
                                    label="QTY"
                                    value={customQty}
                                    onChange={e => setCustomQty(e.target.value)}
                                    sx={{ width: 100 }}
                                    InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                                />
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    onClick={addBoqItemToProject}
                                    startIcon={<AddIcon />}
                                    sx={{ height: 40, borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px' }}
                                >
                                    ADD_CUSTOM
                                </Button>
                            </Box>
                        )}
                    </Box>

                    <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                                <TableRow>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>SL.NO</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CODE</TableCell>
                                    <TableCell sx={{ width: '35%', fontFamily: "'JetBrains Mono', monospace" }}>DESCRIPTION</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>QUANTITY</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>UNIT</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>UNIT_RATE</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace" }}>TOTAL_AMOUNT</TableCell>
                                    <TableCell align="center" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>ACTION</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {renderedProjectBoq.map(item => {
                                    const hasMBook = item.measurements && item.measurements.length > 0;
                                    return (
                                        <TableRow key={item.id} sx={{ bgcolor: item.isCustom ? 'rgba(34, 211, 238, 0.03)' : 'inherit' }}>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.slNo}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', color: item.isCustom ? 'secondary.main' : 'inherit', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.displayCode || "-"}</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.displayDesc}</TableCell>
                                            <TableCell>
                                                <input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={e => updateBoqQtyManual(item.id, e.target.value)}
                                                    disabled={hasMBook}
                                                    style={{ ...tableInputStyle, background: hasMBook ? "var(--mui-palette-action-disabledBackground)" : tableInputStyle.background }}
                                                />
                                                {hasMBook && <Typography variant="caption" color="success.main" display="block" mt={0.5} fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>AUTO_FROM_MBOOK</Typography>}
                                            </TableCell>
                                            <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{item.displayUnit}</TableCell>
                                            <TableCell color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {item.rate.toFixed(2)}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹ {item.amount.toFixed(2)}</TableCell>
                                            <TableCell align="center">
                                                <IconButton color="error" onClick={() => deleteProjectBoq(item.id)} size="small"><DeleteIcon fontSize="small"/></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {renderedProjectBoq.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>NO_ITEMS_IN_BOQ</TableCell></TableRow>}
                                <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                                    <TableCell colSpan={6} align="right" sx={{ fontWeight: 'bold', fontSize: '1rem', fontFamily: "'JetBrains Mono', monospace" }}>TOTAL_ESTIMATE:</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'success.main', fontFamily: "'JetBrains Mono', monospace" }}>₹ {totalAmount.toFixed(2)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {tab === "mbook" && (
                <Box display="flex" flexDirection="column" gap={4}>
                    {renderedProjectBoq.length === 0 && <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}><Typography sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary' }}>ADD_ITEMS_TO_BOQ_FIRST</Typography></Paper>}

                    {renderedProjectBoq.map(item => (
                        <Paper key={item.id} elevation={0} sx={{ overflow: "hidden", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                            <Box sx={{ bgcolor: "rgba(0,0,0,0.2)", p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', fontSize: '14px' }}>{item.slNo}. {item.displayCode ? `[${item.displayCode}]` : ''} {item.displayDesc}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>TOTAL_QTY: <Box component="span" color="success.main" fontWeight="bold" fontSize="1rem">{item.qty.toFixed(2)} {item.displayUnit}</Box></Typography>
                                </Box>
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
                                        {(item.measurements || []).map(m => (
                                            <TableRow key={m.id}>
                                                <TableCell><input value={m.details} onChange={e => updateMeasurementInline(item, m.id, 'details', e.target.value)} style={tableInputStyle} /></TableCell>
                                                <TableCell><input type="number" value={m.no} onChange={e => updateMeasurementInline(item, m.id, 'no', e.target.value)} style={tableInputStyle} /></TableCell>
                                                <TableCell><input type="number" value={m.l} onChange={e => updateMeasurementInline(item, m.id, 'l', e.target.value)} style={tableInputStyle} /></TableCell>
                                                <TableCell><input type="number" value={m.b} onChange={e => updateMeasurementInline(item, m.id, 'b', e.target.value)} style={tableInputStyle} /></TableCell>
                                                <TableCell><input type="number" value={m.d} onChange={e => updateMeasurementInline(item, m.id, 'd', e.target.value)} style={tableInputStyle} /></TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{m.qty.toFixed(2)}</TableCell>
                                                <TableCell align="center"><Button color="error" size="small" onClick={() => deleteMeasurementRow(item, m.id)} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DELETE</Button></TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.15)' }}>
                                            <TableCell><input placeholder="e.g. Ground Floor Room 1" value={mbInputs[item.id]?.details || ""} onChange={e => handleMbInputChange(item.id, 'details', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="number" placeholder="No." value={mbInputs[item.id]?.no || ""} onChange={e => handleMbInputChange(item.id, 'no', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="number" placeholder="L" value={mbInputs[item.id]?.l || ""} onChange={e => handleMbInputChange(item.id, 'l', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="number" placeholder="B" value={mbInputs[item.id]?.b || ""} onChange={e => handleMbInputChange(item.id, 'b', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="number" placeholder="D/H" value={mbInputs[item.id]?.d || ""} onChange={e => handleMbInputChange(item.id, 'd', e.target.value)} style={tableInputStyle} /></TableCell>
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
        </Box>
    );
}
