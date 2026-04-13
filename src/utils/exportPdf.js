import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * REUSABLE BRANDING HEADER
 */
const drawHeader = (doc, company, title) => {
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    const rightEdge = pageWidth - 25; // 25mm safe zone for right-aligned text

    // 1. Draw Company Logo
    if (company?.logo) {
        try {
            doc.addImage(company.logo, 'PNG', margin, 10, 25, 25);
        } catch (e) {
            console.error("PDF Logo Error:", e);
        }
    }

    // 2. Draw Company Info (Top Right)
    doc.setTextColor(11, 23, 45);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    // Use rightEdge for the anchor
    doc.text(company?.name || 'OPENPRIX CONSTRUCTIONS', rightEdge, 16, { align: 'right' });

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    const address = company?.address || "Registered Office Address Not Set";
    const contactInfo = `Email: ${company?.email || '-'} | Ph: ${company?.phone || '-'}`;
    const taxInfo = `GSTIN/TAX ID: ${company?.taxId || 'N/A'}`;

    doc.text(address, rightEdge, 21, { align: 'right', maxWidth: 100 });
    doc.text(contactInfo, rightEdge, 29, { align: 'right' });
    doc.text(taxInfo, rightEdge, 33, { align: 'right' });

    // 3. Branding Separator Line
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, rightEdge, 38);

    // 4. Report Title
    doc.setFontSize(18);
    doc.setTextColor(11, 23, 45);
    doc.setFont(undefined, 'bold');
    doc.text(title.toUpperCase(), margin, 48);

    return 52;
};

/**
 * 01. EXPORT PROJECT ESTIMATE REPORT
 */
export const exportProjectPdf = async (project, boqItems, totalAmount) => {
    const company = await window.api.db.getSettings('company_info');
    // Force units to mm to ensure consistency
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const startY = drawHeader(doc, company, `Project Estimate: ${project.name}`);
    const rightEdge = doc.internal.pageSize.width - 25; 

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont(undefined, 'normal');
    doc.text(`Code: ${project.code || 'N/A'}  |  Client: ${project.clientName || 'N/A'}`, 14, startY + 2);
    
    doc.setFont(undefined, 'bold');
    doc.setTextColor(16, 185, 129); 
    // Switched ₹ to Rs. to fix width/alignment calculation bug
    doc.text(`Estimated Total: Rs. ${totalAmount.toLocaleString('en-IN')}`, rightEdge, startY + 2, { align: 'right' });

    autoTable(doc, {
        head: [["Sl No", "Item Code", "Description", "Unit", "Total Qty", "Rate (Rs)", "Amount (Rs)"]],
        body: boqItems.map(i => [i.slNo, i.displayCode || '-', i.displayDesc, i.displayUnit, Number(i.computedQty).toFixed(2), Number(i.rate).toFixed(2), Number(i.amount).toFixed(2)]),
        startY: startY + 8,
        margin: { left: 14, right: 25 },
        theme: 'grid',
        headStyles: { fillColor: [13, 31, 60] },
        columnStyles: { 0: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } }
    });

    doc.save(`${project.code || 'Project'}_Estimate.pdf`);
};

/**
 * 02. EXPORT RA BILL (INVOICE)
 */
export const exportRaBillPdf = async (project, bill, boqItems) => {
    const company = await window.api.db.getSettings('company_info');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const startY = drawHeader(doc, company, `RA Bill: ${bill.billNo}`);
    const rightEdge = doc.internal.pageSize.width - 25;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Project: ${project.name} (${project.code})  |  Date: ${bill.date}`, 14, startY + 2);

    autoTable(doc, {
        head: [["Sl No", "Description", "Unit", "Rate (Rs)", "Prev Qty", "Curr Qty", "Amount (Rs)"]],
        body: bill.items.map((item, idx) => {
            const boq = boqItems.find(b => b.id === item.boqId) || {};
            return [idx + 1, boq.displayDesc, boq.displayUnit, Number(item.rate).toFixed(2), Number(item.prevQty).toFixed(2), Number(item.currentQty).toFixed(2), Number(item.amount).toFixed(2)];
        }),
        startY: startY + 8,
        margin: { left: 14, right: 25 },
        theme: 'grid',
        headStyles: { fillColor: [13, 31, 60] },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, 6: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Subtotal: Rs. ${bill.subTotal.toLocaleString('en-IN')}`, rightEdge, finalY, { align: 'right' });
    doc.text(`Tax (${bill.taxPercent}%): Rs. ${bill.taxAmount.toLocaleString('en-IN')}`, rightEdge, finalY + 6, { align: 'right' });
    
    doc.setFontSize(12);
    doc.setTextColor(13, 31, 60);
    doc.setFont(undefined, 'bold');
    doc.text(`Grand Total: Rs. ${bill.grandTotal.toLocaleString('en-IN')}`, rightEdge, finalY + 14, { align: 'right' });

    doc.save(`${project.code}_${bill.billNo}.pdf`);
};

/**
 * 03. EXPORT PURCHASE ORDER
 */
export const exportPoPdf = async (project, po) => {
    const company = await window.api.db.getSettings('company_info');
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const startY = drawHeader(doc, company, `Purchase Order: ${po.poNumber}`);
    const rightEdge = doc.internal.pageSize.width - 25;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("VENDOR / SUPPLIER:", 14, startY + 5);
    doc.text("SHIP TO SITE:", 110, startY + 5);

    doc.setFont(undefined, 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(po.supplierName || 'N/A', 14, startY + 10);
    doc.text(`${project.name}\n${project.region || ''}`, 110, startY + 10);

    autoTable(doc, {
        head: [["Sl No", "Code", "Description", "Unit", "Qty", "Rate (Rs)", "Amount (Rs)"]],
        body: po.items.map((item, idx) => [idx + 1, item.code, item.description, item.unit, Number(item.qty).toFixed(2), Number(item.rate).toFixed(2), Number(item.amount).toFixed(2)]),
        startY: startY + 25,
        margin: { left: 14, right: 25 },
        theme: 'grid',
        headStyles: { fillColor: [13, 31, 60] },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 23, 45); 
    doc.text(`TOTAL PAYABLE: Rs. ${po.grandTotal.toLocaleString('en-IN')}`, rightEdge, finalY + 5, { align: 'right' });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Terms: 1. Subject to verification. 2. Quality check required. 3. System generated.", 14, finalY + 20);

    doc.save(`${project.code}_PO_${po.poNumber}.pdf`);
};