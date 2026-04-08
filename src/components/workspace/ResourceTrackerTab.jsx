import React, { useMemo } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { tableInputActiveStyle } from '../../styles';

export default function ResourceTrackerTab({ project, renderedProjectBoq, resources, updateProject }) {
    // Crunch the numbers to group resources by phase
    const resourceTracker = useMemo(() => {
        const tracker = {};
        const actuals = project.actualResources || {};

        renderedProjectBoq.forEach(item => {
            const phase = item.phase || "General";
            if (!tracker[phase]) tracker[phase] = {};

            if (item.masterBoq && item.masterBoq.components) {
                item.masterBoq.components.forEach(comp => {
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
                                    actualQty: actuals[`${phase}_${resId}`] || 0
                                };
                            }
                            tracker[phase][resId].estimatedQty += totalRequired;
                        }
                    }
                });
            }
        });
        return tracker;
    }, [renderedProjectBoq, resources, project.actualResources]);

    const updateActualResource = async (phase, resourceId, val) => {
        const currentActuals = project.actualResources || {};
        currentActuals[`${phase}_${resourceId}`] = Number(val);
        await updateProject("actualResources", currentActuals);
    };

    if (Object.keys(resourceTracker).length === 0) {
        return (
            <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2, bgcolor: 'rgba(13, 31, 60, 0.5)' }}>
                <Typography color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    No resources found. Add Databook Items to the BOQ first.
                </Typography>
            </Paper>
        );
    }

    return (
        <Box display="flex" flexDirection="column" gap={4}>
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
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'warning.main' }}>ACTUAL_CONSUMED</TableCell>
                                    <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>VARIANCE</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.entries(resourceTracker[phase]).map(([resId, data]) => {
                                    const variance = data.estimatedQty - data.actualQty;
                                    return (
                                        <TableRow key={resId}>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{data.code}</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{data.description}</TableCell>
                                            <TableCell sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{data.unit}</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{data.estimatedQty.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <input
                                                    type="number"
                                                    value={data.actualQty || ""}
                                                    onChange={(e) => updateActualResource(phase, resId, e.target.value)}
                                                    style={tableInputActiveStyle}
                                                />
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