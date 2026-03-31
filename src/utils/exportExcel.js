import * as XLSX from "xlsx";
import { calculateMasterBoqRate, getResourceRate } from "../engines/calculationEngine";

export function exportProjectExcel(project, projectBoqItems, masterBoqs, resources) {
    const wb = XLSX.utils.book_new();

    let totalAmount = 0;
    const sortedBoqItems = [...projectBoqItems].sort((a, b) => a.slNo - b.slNo);

    // 1. GENERATE BOQ SHEET
    const boqData = sortedBoqItems.map(item => {
        let rate = 0, amount = 0, description = "", unit = "", itemCode = "";

        if (item.isCustom) {
            rate = item.rate; amount = item.qty * rate; description = item.description; unit = item.unit; itemCode = item.itemCode || "";
        } else {
            const master = masterBoqs.find(m => m.id === item.masterBoqId);
            if (!master) return null;
            rate = calculateMasterBoqRate(master, resources, masterBoqs, project.region);
            amount = item.qty * rate; description = master.description; unit = master.unit; itemCode = master.itemCode || "";
        }
        totalAmount += amount;

        return {
            "SL.No": item.slNo, "Item Code": itemCode, "Item Description": description,
            "Quantity": item.qty, "Unit": unit, "Rate": rate.toFixed(2), "Amount": amount.toFixed(2)
        };
    }).filter(Boolean);

    boqData.push({ "SL.No": "", "Item Code": "", "Item Description": "GRAND TOTAL", "Quantity": "", "Unit": "", "Rate": "", "Amount": totalAmount.toFixed(2) });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(boqData), "BOQ");

    // 2. GENERATE MEASUREMENT BOOK SHEET
    const mbookRows = [["SL.No", "Item Description", "Measurement Details", "No.", "L", "B", "D/H", "Quantity", "Unit"]];

    sortedBoqItems.forEach(item => {
        const desc = item.isCustom ? item.description : masterBoqs.find(m => m.id === item.masterBoqId)?.description;
        const unit = item.isCustom ? item.unit : masterBoqs.find(m => m.id === item.masterBoqId)?.unit;

        mbookRows.push([item.slNo, desc, "", "", "", "", "", "", ""]); // Header Row for Item

        if (item.measurements && item.measurements.length > 0) {
            item.measurements.forEach(m => {
                mbookRows.push(["", "", m.details, m.no, m.l, m.b, m.d, m.qty.toFixed(2), unit]);
            });
            mbookRows.push(["", "", "", "", "", "", "TOTAL:", item.qty.toFixed(2), unit]);
        } else {
            mbookRows.push(["", "", "Manual Entry", "", "", "", "", item.qty.toFixed(2), unit]);
        }
        mbookRows.push([]); // Empty row for spacing
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mbookRows), "Measurement Book");

    // 3. GENERATE RATE ANALYSIS SHEETS
    sortedBoqItems.forEach(item => {
        if (item.isCustom) return; // Skip rate analysis for custom hardcoded items
        const master = masterBoqs.find(m => m.id === item.masterBoqId);
        if (!master) return;

        let baseCost = 0;
        const rows = [["Type", "Code", "Description", "Unit", "Quantity", "Rate", "Amount"]];

        master.components.forEach(comp => {
            if (comp.itemType === 'resource') {
                const res = resources.find(r => r.id === comp.itemId);
                if (!res) return;
                const rate = getResourceRate(res, project.region);
                const amt = comp.qty * rate; baseCost += amt;
                rows.push(["Resource", res.code, res.description, res.unit, comp.qty, rate.toFixed(2), amt.toFixed(2)]);
            }
            else if (comp.itemType === 'boq') {
                const nestedBoq = masterBoqs.find(b => b.id === comp.itemId);
                if (!nestedBoq) return;
                const rate = calculateMasterBoqRate(nestedBoq, resources, masterBoqs, project.region);
                const amt = comp.qty * rate; baseCost += amt;
                rows.push(["Sub-Item", nestedBoq.itemCode, nestedBoq.description, nestedBoq.unit, comp.qty, rate.toFixed(2), amt.toFixed(2)]);
            }
        });

        const ohAmt = baseCost * ((master.overhead || 0) / 100);
        const profitAmt = baseCost * ((master.profit || 0) / 100);

        rows.push([]);
        rows.push(["", "", "", "", "", "Base Cost:", baseCost.toFixed(2)]);
        rows.push(["", "", "", "", "", `Overhead (${master.overhead}%)`, ohAmt.toFixed(2)]);
        rows.push(["", "", "", "", "", `Profit (${master.profit}%)`, profitAmt.toFixed(2)]);
        rows.push(["", "", "", "", "", "Final Unit Rate:", (baseCost + ohAmt + profitAmt).toFixed(2)]);

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `Analysis_${item.slNo}`.substring(0, 31));
    });

    XLSX.writeFile(wb, `${project.name}_Estimate.xlsx`);
}