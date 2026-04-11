import React, { useMemo } from 'react';
import {
    Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Switch, FormControlLabel
} from '@mui/material';
import { tableInputActiveStyle } from '../../styles';

export default function ResourceTrackerTab({ project, renderedProjectBoq, resources, updateProject }) {
    // Safely parse tracking mode
    const trackingMode = project?.resourceTrackingMode || 'manual';

    const toggleMode = async () => {
        await updateProject("resourceTrackingMode", trackingMode === 'manual' ? 'auto' : 'manual');
    };

    // Safely parse daily logs to ensure we don't try to loop over a string
    const safeDailyLogs = useMemo(() => {
        if (!project?.dailyLogs) return [];
        if (typeof project.dailyLogs === 'string') {
            try { return JSON.parse(project.dailyLogs); } catch { return []; }
        }
        return project.dailyLogs;
    }, [project?.dailyLogs]);

    const autoActuals = useMemo(() => {
        const totals = {};
        safeDailyLogs.forEach(log => {
            if (!log.resourceId) return; // Skip invalid logs
            const key = `${log.phase || 'General'}_${log.resourceId}`;
            totals[key] = (totals[key] || 0) + Number(log.qty || 0);
        });
        return totals;
    }, [safeDailyLogs]);

    const resourceTracker = useMemo(() => {
        const tracker = {};
        
        // Safely parse actualResources
        let manualActuals = {};
        if (typeof project?.actualResources === 'string') {
            try { manualActuals = JSON.parse(project.actualResources); } catch { }
        } else if (project?.actualResources) {
            manualActuals = project.actualResources;
        }

        // Pass 1: Add all estimated resources from the BOQ recipes
        renderedProjectBoq.forEach(item => {
            const phase = item.phase || "General";
            if (!tracker[phase]) tracker[phase] = {};

            if (item.masterBoq && item.masterBoq.components) {
                const components = typeof item.masterBoq.components === 'string' 
                    ? JSON.parse(item.masterBoq.components) 
                    : item.masterBoq.components;

                components.forEach(comp => {
                    if (comp.itemType === 'resource') {
                        const resId = comp.itemId;
                        const resourceData = resources.find(r => r.id === resId);

                        if (resourceData) {
                            const totalRequired = Number(comp.qty) * Number(item.computedQty || 0);

                            if (!tracker[phase][resId]) {
                                tracker[phase][resId] = {
                                    code: resourceData.code,
                                    description: resourceData.description,
                                    unit: resourceData.unit,
                                    estimatedQty: 0,
                                    actualQty: trackingMode === 'auto' ? (autoActuals[`${phase}_${resId}`] || 0) : (manualActuals[`${phase}_${resId}`] || 0)
                                };
                            }
                            tracker[phase][resId].estimatedQty += totalRequired;
                        }
                    }
                });
            }
        });

        // Pass 2: Inject any custom resources added via Daily Logs that were NOT in the BOQ
        safeDailyLogs.forEach(log => {
            if (!log.resourceId) return;
            const phase = log.phase || "General";
            const resId = log.resourceId;
            if (!tracker[phase]) tracker[phase] = {};

            if (!tracker[phase][resId]) {
                const resourceData = resources.find(r => r.id === resId);
                if (resourceData) {
                    tracker[phase][resId] = {
                        code: resourceData.code,
                        description: resourceData.description,
                        unit: resourceData.unit,
                        estimatedQty: 0, // Zero estimate because it was not in the original BOQ
                        actualQty: trackingMode === 'auto' ? (autoActuals[`${phase}_${resId}`] || 0) : (manualActuals[`${phase}_${resId}`] || 0)
                    };
                }
            }
        });

        return tracker;
    }, [renderedProjectBoq, resources, project?.actualResources, trackingMode, autoActuals, safeDailyLogs]);

    const updateActualResource = async (phase, resourceId, val) => {
        if (trackingMode === 'auto') return;
        
        let currentActuals = {};
        if (typeof project?.actualResources === 'string') {
            try { currentActuals = JSON.parse(project.actualResources); } catch { }
        } else if (project?.actualResources) {
            currentActuals = { ...project.actualResources };
        }

        currentActuals[`${phase}_${resourceId}`] = Number(val);
        await updateProject("actualResources", currentActuals);
    };

    if (Object.keys(resourceTracker).length === 0) {
        return (
            <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    No resources found. Add Databook Items to the BOQ or submit Daily Logs first.
                </Typography>
            </Paper>
        );
    }

    return (
        <Box display="flex" flexDirection="column" gap={4}>
            {/* MODE TOGGLE BANNER */}
            <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Box>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        TRACKING_MODE: {trackingMode.toUpperCase()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        {trackingMode === 'auto'
                            ? "Actual quantities are automatically synced from the Daily Site Logs."
                            : "Actual quantities are entered manually in the table below."}
                    </Typography>
                </Box>
                <FormControlLabel
                    control={<Switch checked={trackingMode === 'auto'} onChange={toggleMode} color="success" />}
                    label={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold' }}>AUTO_SYNC</Typography>}
                    labelPlacement="start"
                />
            </Paper>

            {Object.keys(resourceTracker).map(phase => (
                <Paper key={phase} elevation={0} sx={{ overflow: "hidden", borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                    <Box sx={{ bgcolor: "rgba(0,0,0,0.2)", p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>
                            PHASE: {phase.toUpperCase()}
                        </Typography>
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                                <TableRow>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>CODE</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>RESOURCE_DESCRIPTION</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>UNIT</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'info.main' }}>ESTIMATED_QTY</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: trackingMode === 'auto' ? 'success.main' : 'warning.main' }}>ACTUAL_CONSUMED</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>VARIANCE</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.entries(resourceTracker[phase]).map(([resId, data]) => {
                                    const variance = data.estimatedQty - data.actualQty;
                                    return (
                                        <TableRow key={resId}>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{data.code}</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                                {data.description}
                                                {data.estimatedQty === 0 && <Typography component="span" variant="caption" color="error.main" ml={1}>(Unplanned)</Typography>}
                                            </TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{data.unit}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{data.estimatedQty.toFixed(2)}</TableCell>
                                            <TableCell>
                                                {trackingMode === 'auto' ? (
                                                    <Typography sx={{ fontWeight: 'bold', color: 'success.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', px: 1 }}>
                                                        {data.actualQty.toFixed(2)}
                                                    </Typography>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        value={data.actualQty || ""}
                                                        onChange={(e) => updateActualResource(phase, resId, e.target.value)}
                                                        style={tableInputActiveStyle}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', color: variance < 0 ? 'error.main' : 'success.main', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                                {variance > 0 ? "+" : ""}{variance.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            ))}
        </Box>
    );
}