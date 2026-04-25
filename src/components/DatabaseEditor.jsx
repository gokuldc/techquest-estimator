import { useState, useEffect } from "react";
import { Box, Button, Typography, Paper, Tabs, Tab } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Components
import ResourcesTab from "./database/ResourcesTab";
import CreateBoqTab from "./database/CreateBoqTab";
import ViewBoqTab from "./database/ViewBoqTab";
import BackupRestoreTab from "./database/BackupRestoreTab";

// 🔥 1. Import the Auth Hook
import { useAuth } from "../context/AuthContext";

export default function DatabaseEditor({ onBack }) {
    // 🔥 2. Grab the Clearance Checker
    const { hasClearance } = useAuth();

    const [tab, setTab] = useState("resources");

    const [regions, setRegions] = useState([]);
    const [resources, setResources] = useState([]);
    const [masterBoqs, setMasterBoqs] = useState([]);

    // Shared state to tell CreateBoqTab what to edit
    const [editingBoq, setEditingBoq] = useState(null);

    const loadData = async () => {
        try {
            const [reg, res, boqs] = await Promise.all([
                window.api.db.getRegions(),
                window.api.db.getResources(),
                window.api.db.getMasterBoqs()
            ]);

            const parseSafe = (str, fallback = []) => {
                if (!str) return fallback;
                if (typeof str !== 'string') return str;
                try { return JSON.parse(str); } catch { return fallback; }
            };

            const safeRes = (res || []).map(r => ({ ...r, rates: parseSafe(r.rates, {}), rateHistory: parseSafe(r.rateHistory, []) }));
            const safeMBoqs = (boqs || []).map(b => ({ ...b, components: parseSafe(b.components, []) }));

            setRegions(reg || []);
            setResources(safeRes);
            setMasterBoqs(safeMBoqs);
        } catch (error) {
            console.error("Failed to load SQLite data:", error);
        }
    };

    useEffect(() => { loadData(); }, []);

    const deleteMasterBoq = async (id) => {
        // 🔥 Extra security: Only L3+ can delete Master items
        if (!hasClearance(3)) return alert("Access Denied: Level 3 Clearance required to delete Master Databook items.");

        if (window.confirm("Delete this Databook item?")) {
            await window.api.db.deleteMasterBoq(id);
            loadData();
        }
    };

    const handleEditBoq = (boq) => {
        // 🔥 Extra security: Only L3+ can edit Master items
        if (!hasClearance(3)) return alert("Access Denied: Level 3 Clearance required to edit Master Databook items.");

        setEditingBoq(boq);
        setTab("createBoq");
    };

    const clearEdit = () => {
        setEditingBoq(null);
        setTab("viewBoq");
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 2, md: 3 } }}>
            {/* 🔥 RESPONSIVE HEADER: Stacks on mobile, row on tablet/desktop */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: { xs: 2, sm: 2 },
                    mb: 3
                }}
            >
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={onBack}
                    variant="outlined"
                    color="inherit"
                    sx={{ borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: '12px', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
                >
                    {'< '}HOME
                </Button>
                <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', fontSize: { xs: '18px', md: '22px' } }}>
                    DATABASE_MANAGER
                </Typography>
            </Box>

            <Paper elevation={0} variant="outlined" sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">

                    {/* 01: Everyone with DB access (L2+) gets LMR */}
                    <Tab value="resources" label="01_LOCAL_MARKET_RATES" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />

                    {/* 02: L3+ (Estimators/Leads) to build/edit Master BOQs */}
                    {hasClearance(3) && (
                        <Tab value="createBoq" label={`02_${editingBoq ? "EDIT_DATABOOK_ITEM" : "DATABOOK_BUILDER"}`} sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />
                    )}

                    {/* 03: Everyone with DB access gets Databook View */}
                    <Tab value="viewBoq" label="03_DATABOOK" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px' }} />

                    {/* 04: L5 (Root) to manage Backups and Purges */}
                    {hasClearance(5) && (
                        <Tab value="backup" label="04_BACKUP_&_RESTORE" sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.5px', color: 'error.main' }} />
                    )}

                </Tabs>
            </Paper>

            {tab === "resources" && <ResourcesTab regions={regions} resources={resources} loadData={loadData} />}
            {tab === "viewBoq" && <ViewBoqTab masterBoqs={masterBoqs} regions={regions} resources={resources} onEditBoq={handleEditBoq} deleteMasterBoq={deleteMasterBoq} loadData={loadData} />}

            {/* Component Level Security Blocks */}
            {hasClearance(3) && tab === "createBoq" && <CreateBoqTab regions={regions} resources={resources} masterBoqs={masterBoqs} loadData={loadData} editingBoq={editingBoq} clearEdit={clearEdit} />}
            {hasClearance(5) && tab === "backup" && <BackupRestoreTab loadData={loadData} />}
        </Box>
    );
}