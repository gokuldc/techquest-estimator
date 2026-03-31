export function getResourceRate(resource, regionName) {
    if (!resource || !resource.rates) return 0;

    if (regionName && resource.rates[regionName] > 0) {
        return resource.rates[regionName];
    }

    const availableRates = Object.values(resource.rates).filter(r => r > 0);
    return availableRates.length > 0 ? availableRates[0] : 0;
}

// Updated to handle both Resources AND Nested BOQs
export function calculateMasterBoqRate(masterBoq, allResources, allMasterBoqs, regionName, visited = new Set()) {
    if (!masterBoq || !masterBoq.components) return 0;

    // Safety check to prevent infinite loops in nested BOQs
    if (visited.has(masterBoq.id)) return 0;
    visited.add(masterBoq.id);

    const baseCost = masterBoq.components.reduce((sum, comp) => {
        if (comp.itemType === 'resource') {
            const resource = allResources.find(r => r.id === comp.itemId);
            const rate = getResourceRate(resource, regionName);
            return sum + (comp.qty * rate);
        }
        else if (comp.itemType === 'boq') {
            const nestedBoq = allMasterBoqs.find(b => b.id === comp.itemId);
            // Recursively calculate the nested BOQ's rate
            const nestedRate = calculateMasterBoqRate(nestedBoq, allResources, allMasterBoqs, regionName, new Set(visited));
            return sum + (comp.qty * nestedRate);
        }
        return sum;
    }, 0);

    const overheadAmt = baseCost * ((masterBoq.overhead || 0) / 100);
    const profitAmt = baseCost * ((masterBoq.profit || 0) / 100);

    return baseCost + overheadAmt + profitAmt;
}