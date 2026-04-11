import React, { useState, useRef, useMemo } from 'react';
import {
    Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TextField, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    Autocomplete
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { tableInputActiveStyle } from '../../styles';
import * as XLSX from 'xlsx';

export default function SubcontractorBidTab({ project, renderedProjectBoq, updateProject, crmContacts = [], loadData }) {
    const [newSubName, setNewSubName] = useState("");
    const fileInputRef = useRef(null);

    // Edit Subcontractor State
    const [editingSubId, setEditingSubId] = useState(null);
    const [editSubName, setEditSubName] = useState("");

    // --- CRM MAPPING ---
    const subOptions = useMemo(() => {
        return crmContacts
            .filter(c => {
                const type = c.type ? c.type.toLowerCase() : "";
                return type === 'subcontractor' || type === 'supplier';
            })
            .map(c => c.company ? `${c.company} (${c.name})` : c.name);
    }, [crmContacts]);

    const addSubcontractor = async () => {
        if (!newSubName) return;
        const cleanName = newSubName.trim();

        // Check if this subcontractor is already in the CRM Database
        const existsInCrm = crmContacts.some(c => 
            c.name?.toLowerCase().trim() === cleanName.toLowerCase() || 
            c.company?.toLowerCase().trim() === cleanName.toLowerCase() ||
            `${c.company} (${c.name})`.toLowerCase().trim() === cleanName.toLowerCase()
        );

        // If not in CRM, silently create a new profile in the Directory!
        if (!existsInCrm) {
            const newCrmContact = {
                id: crypto.randomUUID(),
                name: cleanName, 
                company: "", 
                type: "Subcontractor", 
                status: "Active", 
                email: "", 
                phone: "", 
                createdAt: Date.now()
            };
            await window.api.db.saveCrmContact(newCrmContact);
            if (loadData) await loadData(); // Refresh the workspace CRM lists instantly
        }

        // Add to Project Subcontractors list
        const subs = [...(project.subcontractors || []), { id: crypto.randomUUID(), name: cleanName, rates: {} }];
        await updateProject("subcontractors", subs);
        setNewSubName("");
    };

    const deleteSubcontractor = async (subId) => {
        if (!window.confirm("Are you sure you want to remove this Subcontractor? All their entered bids will be permanently deleted.")) return;
        const subs = (project.subcontractors || []).filter(s => s.id !== subId);
        await updateProject("subcontractors", subs);
    };

    const openEditSubDialog = (sub) => {
        setEditingSubId(sub.id);
        setEditSubName(sub.name);
    };

    const saveEditedSubcontractor = async () => {
        if (!editSubName) return alert("Subcontractor name cannot be empty.");
        const cleanEditName = editSubName.trim();
        const subs = (project.subcontractors || []).map(s =>
            s.id === editingSubId ? { ...s, name: cleanEditName } : s
        );
        await updateProject("subcontractors", subs);
        setEditingSubId(null);
        setEditSubName("");
    };

    const handleSubRateChange = async (subId, boqId, rate) => {
        const subs = [...(project.subcontractors || [])];
        const subIndex = subs.findIndex(s => s.id === subId);
        if (subIndex > -1) {
            subs[subIndex].rates[boqId] = Number(rate);
            await updateProject("subcontractors", subs);
        }
    };

    // Excel Export
    const exportTemplate = () => {
        const subs = project.subcontractors || [];
        const header = ["BOQ_ID", "Description", "Quantity", "Unit", "In-House Rate", ...subs.map(s => s.name)];

        const wsData = [header];
        renderedProjectBoq.forEach(item => {
            const row = [item.id, item.displayDesc, item.computedQty, item.displayUnit, item.rate];
            subs.forEach(sub => row.push(sub.rates[item.id] || 0));
            wsData.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SubcontractorBids");
        XLSX.writeFile(wb, `${project.name}_SubBids.xlsx`);
    };

    // Excel Import
    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                if (jsonData.length === 0) return;

                let subs = [...(project.subcontractors || [])];
                const existingSubNames = subs.map(s => s.name.trim().toLowerCase());

                const standardCols = ["BOQ_ID", "Description", "Quantity", "Unit", "In-House Rate"];
                const allCols = Object.keys(jsonData[0]);
                const subCols = allCols.filter(c => !standardCols.includes(c));

                let addedToCrm = false;

                // 🔥 THE FIX: Safe sequential loop + .trim() applied
                for (const rawSubName of subCols) {
                    const subName = rawSubName.trim();
                    if (!subName) continue;

                    // Add to Project List if missing
                    if (!existingSubNames.includes(subName.toLowerCase())) {
                        subs.push({ id: crypto.randomUUID(), name: subName, rates: {} });
                        existingSubNames.push(subName.toLowerCase()); // Cache to prevent duplicates
                    }
                        
                    // Add to Global CRM Directory if missing
                    const existsInCrm = crmContacts.some(c => 
                        c.name?.toLowerCase().trim() === subName.toLowerCase() || 
                        c.company?.toLowerCase().trim() === subName.toLowerCase() ||
                        `${c.company} (${c.name})`.toLowerCase().trim() === subName.toLowerCase()
                    );
                    
                    if (!existsInCrm) {
                        await window.api.db.saveCrmContact({
                            id: crypto.randomUUID(), 
                            name: subName, 
                            company: "", 
                            type: "Subcontractor", 
                            status: "Active", 
                            email: "", 
                            phone: "", 
                            createdAt: Date.now()
                        });
                        addedToCrm = true;
                    }
                }
                
                // Wait for all new CRM entries to be pulled from SQLite back to the UI
                if (addedToCrm && loadData) {
                    await loadData(); 
                }

                // Parse matrix rates
                jsonData.forEach(row => {
                    const boqId = row["BOQ_ID"];
                    if (boqId) {
                        subCols.forEach(rawSubName => {
                            const subName = rawSubName.trim();
                            const rate = Number(row[rawSubName]) || 0;
                            const subIndex = subs.findIndex(s => s.name.toLowerCase() === subName.toLowerCase());
                            if (subIndex > -1) {
                                subs[subIndex].rates[boqId] = rate;
                            }
                        });
                    }
                });

                await updateProject("subcontractors", subs);
                alert("Subcontractor bids imported successfully!");
            } catch (err) {
                console.error("Excel Parsing Error:", err);
                alert("Failed to parse Subcontractor Bid Excel.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    return (
        <Box display="flex" flexDirection="column" gap={4}>
            {/* ACTION BAR */}
            <Box display="flex" justifyContent="flex-end" gap={2}>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportTemplate} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                    EXPORT MATRIX TEMPLATE
                </Button>
                <input type="file" accept=".xls,.xlsx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
                <Button variant="contained" disableElevation startIcon={<UploadIcon />} onClick={() => fileInputRef.current.click()} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                    IMPORT MATRIX
                </Button>
            </Box>

            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box display="flex" gap={2} mb={3}>
                    {/* CRM SEARCHABLE AUTOCOMPLETE */}
                    <Autocomplete
                        freeSolo
                        openOnFocus
                        disablePortal
                        options={subOptions}
                        value={newSubName}
                        onInputChange={(e, newVal) => setNewSubName(newVal || "")}
                        sx={{ minWidth: 300 }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                size="small"
                                label="SUBCONTRACTOR_NAME (CRM)"
                                placeholder="Search Directory or type new..."
                                InputLabelProps={{ ...params.InputLabelProps, sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' } }}
                            />
                        )}
                    />
                    <Button variant="contained" disableElevation onClick={addSubcontractor} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        + ADD BIDDER
                    </Button>
                </Box>

                {/* HORIZONTAL SCROLLING CONTAINER */}
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 'max-content' }}>
                        <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.3)' }}>
                            <TableRow>
                                <TableCell rowSpan={2} sx={{ minWidth: 250, fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>DESCRIPTION</TableCell>
                                <TableCell rowSpan={2} sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>QTY</TableCell>
                                <TableCell colSpan={2} align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', borderRight: '2px solid rgba(255,255,255,0.1)' }}>ESTIMATED (IN-HOUSE)</TableCell>
                                {(project.subcontractors || []).map(sub => (
                                    <TableCell key={sub.id} colSpan={2} align="center" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'secondary.main', borderRight: '2px solid rgba(255,255,255,0.1)' }}>
                                        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                                            {sub.name.toUpperCase()}
                                            <IconButton size="small" onClick={() => openEditSubDialog(sub)} sx={{ color: 'text.secondary', p: 0.5 }}>
                                                <EditIcon sx={{ fontSize: '14px' }} />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={() => deleteSubcontractor(sub.id)} sx={{ p: 0.5 }}>
                                                <DeleteIcon sx={{ fontSize: '14px' }} />
                                            </IconButton>
                                        </Box>
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>RATE</TableCell>
                                <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', borderRight: '2px solid rgba(255,255,255,0.1)' }}>AMOUNT</TableCell>
                                {(project.subcontractors || []).map(sub => (
                                    <React.Fragment key={`${sub.id}-headers`}>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'secondary.main' }}>RATE</TableCell>
                                        <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'secondary.main', borderRight: '2px solid rgba(255,255,255,0.1)' }}>AMOUNT</TableCell>
                                    </React.Fragment>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {renderedProjectBoq.map(item => (
                                <TableRow key={item.id} hover>
                                    <TableCell sx={{ minWidth: 250, maxWidth: 400, whiteSpace: 'normal', wordWrap: 'break-word', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                        {item.displayDesc}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{Number(item.computedQty).toFixed(2)} {item.displayUnit}</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>₹{item.rate.toFixed(2)}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', borderRight: '2px solid rgba(255,255,255,0.05)' }}>₹{item.amount.toFixed(2)}</TableCell>

                                    {(project.subcontractors || []).map(sub => {
                                        const subRate = sub.rates[item.id] || 0;
                                        const subAmount = subRate * item.computedQty;
                                        return (
                                            <React.Fragment key={`${sub.id}-${item.id}`}>
                                                <TableCell>
                                                    <input type="number" value={sub.rates[item.id] || ""} onChange={(e) => handleSubRateChange(sub.id, item.id, e.target.value)} style={tableInputActiveStyle} />
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', color: subAmount > item.amount ? 'error.main' : 'success.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', borderRight: '2px solid rgba(255,255,255,0.05)' }}>
                                                    ₹{subAmount.toFixed(2)}
                                                </TableCell>
                                            </React.Fragment>
                                        )
                                    })}
                                </TableRow>
                            ))}
                            {renderedProjectBoq.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4 + (project.subcontractors?.length || 0) * 2} align="center" sx={{ py: 4, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                        NO_ITEMS_IN_BOQ
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* EDIT SUBCONTRACTOR DIALOG */}
            <Dialog open={!!editingSubId} onClose={() => setEditingSubId(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold' }}>EDIT_BIDDER_NAME</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <TextField
                        fullWidth
                        label="SUBCONTRACTOR_NAME"
                        value={editSubName}
                        onChange={e => setEditSubName(e.target.value)}
                        InputLabelProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                        InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace" } }}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Button onClick={() => setEditingSubId(null)} color="inherit" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>CANCEL</Button>
                    <Button variant="contained" color="success" onClick={saveEditedSubcontractor} disableElevation sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                        SAVE CHANGES
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}