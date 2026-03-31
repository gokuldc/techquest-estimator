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

    if (!project) return <Box p={5} textAlign="center"><Typography>Loading Workspace...</Typography></Box>;

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

    // Shared input style for tables to adapt to dark/light mode natively
    const tableInputStyle = { width: "100%", padding: "8px", boxSizing: "border-box", border: "1px solid var(--mui-palette-divider)", borderRadius: "4px", background: "var(--mui-palette-background-default)", color: "var(--mui-palette-text-primary)" };

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 3 }}>Back to Home</Button>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" fontWeight="bold">Workspace: {project.name}</Typography>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={triggerExport} disableElevation>
                    Export Estimate
                </Button>
            </Box>

            <Paper sx={{ mb: 4 }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="fullWidth">
                    <Tab value="details" label="1. Project Details" sx={{ fontWeight: 'bold' }} />
                    <Tab value="boq" label="2. Build BOQ" sx={{ fontWeight: 'bold' }} />
                    <Tab value="mbook" label="3. Measurement Book" sx={{ fontWeight: 'bold' }} />
                </Tabs>
            </Paper>

            {tab === "details" && (
                <Paper sx={{ p: 4, maxWidth: 600 }}>
                    <Box display="flex" flexDirection="column" gap={3}>
                        <TextField label="Project Name" value={project.name} onChange={e => updateProject("name", e.target.value)} fullWidth />
                        <TextField label="Client Name" value={project.clientName} onChange={e => updateProject("clientName", e.target.value)} fullWidth />
                        <TextField select label="Rates Region" value={project.region} onChange={e => updateProject("region", e.target.value)} fullWidth helperText="Leave empty to use default rates">
                            <MenuItem value="">-- Auto-Detect First Rate --</MenuItem>
                            {regions.map(r => <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>)}
                        </TextField>
                    </Box>
                </Paper>
            )}

            {tab === "boq" && (
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
                        <Button variant={addMode === "master" ? "contained" : "outlined"} onClick={() => setAddMode("master")}>From Master Database</Button>
                        <Button variant={addMode === "custom" ? "contained" : "outlined"} onClick={() => setAddMode("custom")} color="secondary">Custom Ad-Hoc Item</Button>
                    </Box>

                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                        {addMode === "master" ? (
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <TextField size="small" label="Search Code" value={searchCode} onChange={e => setSearchCode(e.target.value)} sx={{ flex: 1, minWidth: 120 }} />
                                <TextField size="small" label="Search Description" value={searchDesc} onChange={e => setSearchDesc(e.target.value)} sx={{ flex: 1.5, minWidth: 150 }} />
                                <TextField select size="small" label="Select Item" value={addBoqId} onChange={e => setAddBoqId(e.target.value)} sx={{ flex: 2, minWidth: 250 }}>
                                    <MenuItem value="">-- Choose Master BOQ Item --</MenuItem>
                                    {filteredMasterBoqs.map(b => <MenuItem key={b.id} value={b.id}>{b.itemCode ? `[${b.itemCode}] ` : ''}{b.description}</MenuItem>)}
                                </TextField>
                                <TextField size="small" type="number" label="Qty" value={addBoqQty} onChange={e => setAddBoqQty(e.target.value)} sx={{ width: 100 }} />
                                <Button variant="contained" onClick={addBoqItemToProject} startIcon={<AddIcon />} sx={{ height: 40 }}>Add</Button>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <TextField size="small" label="Code" value={customCode} onChange={e => setCustomCode(e.target.value)} sx={{ width: 120 }} />
                                <TextField size="small" label="Description" value={customDesc} onChange={e => setCustomDesc(e.target.value)} sx={{ flex: 2, minWidth: 200 }} />
                                <TextField size="small" label="Unit" value={customUnit} onChange={e => setCustomUnit(e.target.value)} sx={{ width: 100 }} />
                                <TextField size="small" type="number" label="Rate (₹)" value={customRate} onChange={e => setCustomRate(e.target.value)} sx={{ width: 120 }} />
                                <TextField size="small" type="number" label="Qty" value={customQty} onChange={e => setCustomQty(e.target.value)} sx={{ width: 100 }} />
                                <Button variant="contained" color="secondary" onClick={addBoqItemToProject} startIcon={<AddIcon />} sx={{ height: 40 }}>Add Custom</Button>
                            </Box>
                        )}
                    </Box>

                    <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'action.hover' }}>
                                <TableRow>
                                    <TableCell>SL.No</TableCell>
                                    <TableCell>Code</TableCell>
                                    <TableCell sx={{ width: '35%' }}>Description</TableCell>
                                    <TableCell>Quantity</TableCell>
                                    <TableCell>Unit</TableCell>
                                    <TableCell>Unit Rate</TableCell>
                                    <TableCell>Total Amount</TableCell>
                                    <TableCell align="center">Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {renderedProjectBoq.map(item => {
                                    const hasMBook = item.measurements && item.measurements.length > 0;
                                    return (
                                        <TableRow key={item.id} sx={{ bgcolor: item.isCustom ? 'action.hover' : 'inherit' }}>
                                            <TableCell>{item.slNo}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', color: item.isCustom ? 'secondary.main' : 'inherit' }}>{item.displayCode || "-"}</TableCell>
                                            <TableCell>{item.displayDesc}</TableCell>
                                            <TableCell>
                                                <input 
                                                    type="number" 
                                                    value={item.qty} 
                                                    onChange={e => updateBoqQtyManual(item.id, e.target.value)} 
                                                    disabled={hasMBook} 
                                                    style={{ ...tableInputStyle, background: hasMBook ? "var(--mui-palette-action-disabledBackground)" : tableInputStyle.background }} 
                                                />
                                                {hasMBook && <Typography variant="caption" color="success.main" display="block" mt={0.5} fontWeight="bold">Auto from MBook</Typography>}
                                            </TableCell>
                                            <TableCell color="text.secondary">{item.displayUnit}</TableCell>
                                            <TableCell color="text.secondary">₹ {item.rate.toFixed(2)}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>₹ {item.amount.toFixed(2)}</TableCell>
                                            <TableCell align="center">
                                                <IconButton color="error" onClick={() => deleteProjectBoq(item.id)} size="small"><DeleteIcon fontSize="small"/></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {renderedProjectBoq.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No items added to BOQ yet.</TableCell></TableRow>}
                                <TableRow sx={{ bgcolor: 'background.default' }}>
                                    <TableCell colSpan={6} align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>TOTAL ESTIMATE:</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'success.main' }}>₹ {totalAmount.toFixed(2)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {tab === "mbook" && (
                <Box display="flex" flexDirection="column" gap={4}>
                    {renderedProjectBoq.length === 0 && <Paper sx={{ p: 4, textAlign: "center" }}>Please add items to your BOQ first.</Paper>}
                    
                    {renderedProjectBoq.map(item => (
                        <Paper key={item.id} elevation={2} sx={{ overflow: "hidden" }}>
                            <Box sx={{ bgcolor: "action.hover", p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">{item.slNo}. {item.displayCode ? `[${item.displayCode}]` : ''} {item.displayDesc}</Typography>
                                    <Typography variant="body2" color="text.secondary">Total Quantity: <Box component="span" color="success.main" fontWeight="bold" fontSize="1.1rem">{item.qty.toFixed(2)} {item.displayUnit}</Box></Typography>
                                </Box>
                            </Box>
                            
                            <TableContainer>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: 'background.default' }}>
                                        <TableRow>
                                            <TableCell sx={{ width: '30%' }}>Location / Details</TableCell>
                                            <TableCell>No.</TableCell><TableCell>L</TableCell><TableCell>B</TableCell><TableCell>D/H</TableCell>
                                            <TableCell>Qty</TableCell>
                                            <TableCell align="center">Action</TableCell>
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
                                                <TableCell sx={{ fontWeight: 'bold' }}>{m.qty.toFixed(2)}</TableCell>
                                                <TableCell align="center"><Button color="error" size="small" onClick={() => deleteMeasurementRow(item, m.id)}>Delete</Button></TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell><input placeholder="e.g. Ground Floor Room 1" value={mbInputs[item.id]?.details || ""} onChange={e => handleMbInputChange(item.id, 'details', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="number" placeholder="No." value={mbInputs[item.id]?.no || ""} onChange={e => handleMbInputChange(item.id, 'no', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="number" placeholder="L" value={mbInputs[item.id]?.l || ""} onChange={e => handleMbInputChange(item.id, 'l', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="number" placeholder="B" value={mbInputs[item.id]?.b || ""} onChange={e => handleMbInputChange(item.id, 'b', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell><input type="number" placeholder="D/H" value={mbInputs[item.id]?.d || ""} onChange={e => handleMbInputChange(item.id, 'd', e.target.value)} style={tableInputStyle} /></TableCell>
                                            <TableCell color="text.secondary">-</TableCell>
                                            <TableCell align="center"><Button variant="contained" size="small" onClick={() => addMeasurementRow(item)} fullWidth>Add</Button></TableCell>
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