import { parseFlexibleDate } from './date-utils';

export type SortConfig = { key: string; dir: 'asc' | 'desc' };

export function sortOrders<T>(
    orders: T[],
    columns: string[],
    sortConfigs: SortConfig[],
    getVal: (item: T, key: string) => string
): T[] {
    const result = [...orders];

    // Resolve absolute priorities and logic boundaries
    const priorityColName = columns.find(c => c.toUpperCase().includes('PRIORITY'));
    // Find if user specifically toggled a direction for priority anywhere in stack
    const explicitPrioritySort = sortConfigs.find(s => s.key === priorityColName);

    if (sortConfigs.length > 0 || priorityColName) {
        result.sort((a, b) => {
            // 1. PINNED PRIMARY SORT: Priority always dominates
            if (priorityColName) {
                const aPri = getVal(a, priorityColName).trim();
                const bPri = getVal(b, priorityColName).trim();
                
                if (aPri !== bPri) {
                    const aEmpty = !aPri;
                    const bEmpty = !bPri;
                    
                    if (aEmpty && !bEmpty) return 1;
                    if (!aEmpty && bEmpty) return -1;
                    
                    const countExclam = (str: string) => {
                        if (/^!+$/.test(str)) return str.length;
                        return 0;
                    };
                    const aExclamCount = countExclam(aPri);
                    const bExclamCount = countExclam(bPri);

                    let pCmp = 0;
                    if (aExclamCount > 0 || bExclamCount > 0) {
                        pCmp = aExclamCount - bExclamCount;
                    } else {
                        const aNum = parseFloat(aPri);
                        const bNum = parseFloat(bPri);
                        if (!isNaN(aNum) && !isNaN(bNum)) {
                            pCmp = aNum - bNum; // Standard 1, 2, 3...
                        } else {
                            pCmp = aPri.localeCompare(bPri, undefined, { numeric: true });
                        }
                    }
                    
                    // Default to 'desc' (3 > 2 > 1) if untoggled
                    const pDir = explicitPrioritySort ? explicitPrioritySort.dir : 'desc';
                    return pDir === 'asc' ? pCmp : -pCmp;
                }
            }

            // 2. USER'S SECONDARY CLICKS
            for (const config of sortConfigs) {
                const { key: sKey, dir: sDir } = config;
                if (sKey === priorityColName) continue;

                const aVal = getVal(a, sKey).trim();
                const bVal = getVal(b, sKey).trim();

                if (aVal === bVal) continue;

                const aIsEmpty = !aVal;
                const bIsEmpty = !bVal;
                if (aIsEmpty && !bIsEmpty) return 1;
                if (!aIsEmpty && bIsEmpty) return -1;

                const isPureNumber = (str: string) => /^-?\d+(\.\d+)?$/.test(str);
                const isPriorityMark = (str: string) => /^!+$/.test(str);

                const canParseA = !isPureNumber(aVal) && !isPriorityMark(aVal);
                const canParseB = !isPureNumber(bVal) && !isPriorityMark(bVal);

                const aDate = canParseA ? parseFlexibleDate(aVal) : null;
                const bDate = canParseB ? parseFlexibleDate(bVal) : null;

                const aValid = aDate && !isNaN(aDate.getTime());
                const bValid = bDate && !isNaN(bDate.getTime());

                let cmp = 0;
                if (aValid && bValid) {
                    cmp = aDate.getTime() - bDate.getTime();
                } else if (aValid && !bValid) {
                    cmp = -1;
                } else if (!aValid && bValid) {
                    cmp = 1;
                } else {
                    const countExclam = (str: string) => {
                        if (/^!+$/.test(str)) return str.length;
                        return 0;
                    };
                    const aExclamCount = countExclam(aVal);
                    const bExclamCount = countExclam(bVal);

                    if (aExclamCount > 0 || bExclamCount > 0) {
                        cmp = aExclamCount - bExclamCount;
                    } else {
                        const aNum = parseFloat(aVal);
                        const bNum = parseFloat(bVal);
                        if (!isNaN(aNum) && !isNaN(bNum)) {
                            cmp = aNum - bNum;
                        } else {
                            cmp = aVal.localeCompare(bVal);
                        }
                    }
                }

                if (cmp !== 0) {
                    return sDir === 'asc' ? cmp : -cmp;
                }
            }

            // 3. FACTORY FALLBACK: Due Date (Earliest First)
            const dueColName = columns.find(c => c.toUpperCase().includes('DUE'));
            if (dueColName && !sortConfigs.find(s => s.key === dueColName)) {
                const aDue = getVal(a, dueColName).trim();
                const bDue = getVal(b, dueColName).trim();
                
                if (aDue !== bDue) {
                    const aIsEmpty = !aDue;
                    const bIsEmpty = !bDue;
                    if (aIsEmpty && !bIsEmpty) return 1;
                    if (!aIsEmpty && bIsEmpty) return -1;

                    const aDate = parseFlexibleDate(aDue);
                    const bDate = parseFlexibleDate(bDue);
                    
                    const aValid = aDate && !isNaN(aDate.getTime());
                    const bValid = bDate && !isNaN(bDate.getTime());

                    if (aValid && bValid) {
                        return aDate.getTime() - bDate.getTime();
                    } else if (aValid && !bValid) {
                        return -1;
                    } else if (!aValid && bValid) {
                        return 1;
                    } else {
                        const cmp = aDue.localeCompare(bDue);
                        if (cmp !== 0) return cmp;
                    }
                }
            }

            return 0;
        });
    }

    return result;
}
