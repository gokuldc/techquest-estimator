export function getResourceRate(resource, regionName) {
    if (!resource || !resource.rates) return 0;

    // Force rates to be an object
    let ratesObj = resource.rates;
    if (typeof ratesObj === 'string') {
        try { ratesObj = JSON.parse(ratesObj); } catch { return 0; }
    }

    // Try Exact Match
    if (regionName && ratesObj[regionName] !== undefined) {
        const rate = Number(ratesObj[regionName]);
        if (rate > 0) return rate;
    }

    // Try Case-Insensitive Match
    if (regionName) {
        const normalizedRegion = String(regionName).toLowerCase().trim();
        for (const [key, value] of Object.entries(ratesObj)) {
            if (String(key).toLowerCase().trim() === normalizedRegion) {
                const rate = Number(value);
                if (rate > 0) return rate;
            }
        }
    }

    // Ultimate Fallback: Return the first available price
    const availableRates = Object.values(ratesObj)
        .map(r => Number(r))
        .filter(r => !isNaN(r) && r > 0);
        
    return availableRates.length > 0 ? availableRates[0] : 0;
}

// 🔥 UPGRADED: Now processes formulas chronologically like the UI Editor!
export function calculateMasterBoqRate(masterBoq, allResources, allMasterBoqs, regionName, visited = new Set()) {
    if (!masterBoq || !masterBoq.components) return 0;

    let components = masterBoq.components;
    if (typeof components === 'string') {
        try { components = JSON.parse(components); } catch { return 0; }
    }
    if (!Array.isArray(components)) return 0;

    // Safety check to prevent infinite loops in nested BOQs
    if (visited.has(masterBoq.id)) return 0;
    visited.add(masterBoq.id);

    let computedRows = [];
    let baseCost = 0;

    // Calculate chronologically so Row 2 can reference Row 1
    for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        
        let computedQty = 0;
        const formula = comp.formulaStr !== undefined ? comp.formulaStr : comp.qty;
        
        if (!formula) {
            computedQty = 0;
        } else {
            const str = String(formula).trim().toLowerCase();
            if (!str.startsWith('=')) {
                computedQty = Number(str) || 0;
            } else {
                let expr = str.substring(1).replace(/\b(ceil|floor|round|abs|max|min|pi|sqrt)\b/g, "Math.$1");
                
                // 🔥 THE FIX: Look back at previously computed rows for #1, #2 references
                expr = expr.replace(/#(\d+)/g, (match, slNoStr) => {
                    const idx = parseInt(slNoStr, 10) - 1;
                    return computedRows[idx] ? (computedRows[idx].computedQty || 0) : 0;
                });
                
                try { 
                    computedQty = /[^0-9+\-*/().\seE]/.test(expr) ? 0 : (isFinite(new Function(`return ${expr}`)()) ? new Function(`return ${expr}`)() : 0); 
                } catch { 
                    computedQty = 0; 
                }
            }
        }

        if (computedQty !== 0) {
            let rate = 0;
            if (comp.itemType === 'resource') {
                const resource = allResources.find(r => String(r.id) === String(comp.itemId));
                rate = getResourceRate(resource, regionName);
            } else if (comp.itemType === 'boq') {
                const nestedBoq = allMasterBoqs.find(b => String(b.id) === String(comp.itemId));
                rate = calculateMasterBoqRate(nestedBoq, allResources, allMasterBoqs, regionName, new Set(visited));
            }

            const amount = computedQty * rate;
            baseCost += amount;
            
            // Store the result so the next row can reference it!
            computedRows.push({ ...comp, computedQty, rate, amount });
        } else {
            // Push a zero-row to maintain the # index order
            computedRows.push({ ...comp, computedQty: 0, rate: 0, amount: 0 });
        }
    }

    const overheadAmt = baseCost * ((Number(masterBoq.overhead) || 0) / 100);
    const profitAmt = baseCost * ((Number(masterBoq.profit) || 0) / 100);

    return baseCost + overheadAmt + profitAmt;
}