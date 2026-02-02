'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Lock, Unlock, Trash2 } from 'lucide-react';
import { format, isValid } from 'date-fns';

import type { Order } from '@/lib/excel';

interface Props {
    orders: Order[];
    steps: string[];
    detailColumns?: string[];  // Dynamic detail columns from config
    onNavigate: (woId: string) => void;

    // Batch Operations
    activeBatchMode: string | null;
    onBatchUpdate: (woId: string, step: string, status: string) => void;
    onBulkBatchUpdate?: (step: string, mode: string) => void;

    highlightedWos: string[];
    extraColumns?: string[];
    role?: string;
    onUpdateDetail?: (woId: string, field: string, value: string) => Promise<void>;
    onDeleteOrder?: (woId: string) => Promise<void>;
    fontSizeScale?: number;
}

type SortDir = 'asc' | 'desc' | null;

// Abbreviation mapping for long step names
const STEP_ABBREV: Record<string, string> = {
    'WO Released': 'WO Rel',
    'Housing Readiness': 'Housing',
    'Shaft Readiness': 'Shaft',
    'MTR Material Received': 'MTR Mat',
    'Lam Pressing': 'Lam',
    '1st Straigtening': '1st Str',
    'Flush & Dry': 'F&D',
    'ENCAP Flush & Dry': 'ENC F&D',
    'Mag Wire Cutting': 'MagWire',
    'Winding': 'Wind',
    'Epoxy': 'Epoxy',
    'GT ENCAP LEAD': 'GT ENC',
    'ENCAP': 'ENCAP',
    'Shaft Straighten': 'Sh Str',
    'PICKING': 'PICK',
    'Lead': 'Lead',
    'Motor ASSY': 'Mtr Assy',
    'WELDING': 'WELD',
    'Dye Pen': 'DyePen',
    'Painting': 'Paint',
    'MIST': 'MIST',
    'Outgoing': 'Outgo',
    'Receipt': 'Receipt',
};

// Get abbreviated step name or use original if not mapped
function getStepAbbrev(step: string): string {
    return STEP_ABBREV[step] || step;
}

// Column name alias mapping - maps config names to possible data key names
// This handles the case where column mapping standardizes names during import
// e.g., "Due date" in config -> data key might be "WO DUE" after normalization
const COLUMN_ALIASES: Record<string, string[]> = {
    'Due date': ['WO DUE', 'Due Date', 'due date', 'DUE DATE'],
    'Release date': ['WO Rel', 'Release Date', 'release date', 'RELEASE DATE'],
    'WO DUE': ['Due date', 'Due Date', 'due date'],
    'WO Rel': ['Release date', 'Release Date', 'release date'],
    'WO ID': ['WO_ID', 'WOID', 'Order ID', 'OrderID', 'Work Order', 'WorkOrder', 'wo id', '工单号'],
};

// Get the WO ID from order data - handles various column name formats
function getWoId(order: Record<string, unknown>): string {
    // Try exact match first
    if (order['WO ID']) return String(order['WO ID']);

    // Try aliases
    const woIdAliases = ['WO_ID', 'WOID', 'Order ID', 'OrderID', 'Work Order', 'WorkOrder', 'wo id', '工单号'];
    for (const alias of woIdAliases) {
        if (order[alias]) return String(order[alias]);
    }

    // Try case-insensitive match for keys containing 'wo' and 'id'
    for (const key of Object.keys(order)) {
        const keyLower = key.toLowerCase().replace(/[_\s]/g, '');
        if (keyLower === 'woid' || keyLower === 'orderid') {
            return String(order[key] || '');
        }
    }

    // Last resort: use the first column value (often the ID)
    const firstKey = Object.keys(order).find(k => !['id', 'productId', 'data', 'createdAt', 'updatedAt'].includes(k));
    if (firstKey && order[firstKey]) {
        return String(order[firstKey]);
    }

    return '';
}

// Get the value from order using column name or its aliases
function getOrderValue(order: Record<string, unknown>, colName: string): string {
    // Direct match first
    if (order[colName] !== undefined && order[colName] !== null && order[colName] !== '') {
        return String(order[colName]);
    }

    // Try aliases
    const aliases = COLUMN_ALIASES[colName];
    if (aliases) {
        for (const alias of aliases) {
            if (order[alias] !== undefined && order[alias] !== null && order[alias] !== '') {
                return String(order[alias]);
            }
        }
    }

    // Try case-insensitive match
    const colLower = colName.toLowerCase();
    for (const key of Object.keys(order)) {
        if (key.toLowerCase() === colLower) {
            return String(order[key] || '');
        }
    }

    return '';
}

export default function PlannerTable({
    orders,
    steps: orderedSteps, // Renamed to avoid conflict with local 'steps' variable
    detailColumns = [], // Default to empty array if not provided
    onNavigate,
    activeBatchMode,
    onBatchUpdate,
    onBulkBatchUpdate,
    highlightedWos = [],
    extraColumns = [],
    role,


    onUpdateDetail,
    onDeleteOrder,
    fontSizeScale = 1
}: Props) {

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>(null);
    // sortVersion increments only when user clicks to sort - this prevents re-sorting on data changes
    const [sortVersion, setSortVersion] = useState(0);

    // --- MANUAL RESIZING LOGIC ---
    const [detailWidths, setDetailWidths] = useState<Record<string, number>>({});
    const [manualStepWidth, setManualStepWidth] = useState<number | null>(null);

    // --- PERSISTENCE LOGIC ---
    // Load from localStorage on mount
    useEffect(() => {
        try {
            const savedDetailWidths = localStorage.getItem('ipro_table_detail_widths');
            if (savedDetailWidths) {
                setDetailWidths(JSON.parse(savedDetailWidths));
            }

            const savedStepWidth = localStorage.getItem('ipro_table_step_width');
            if (savedStepWidth) {
                setManualStepWidth(Number(savedStepWidth));
            }
        } catch (e) {
            console.error('Failed to load table widths from localStorage', e);
        }
    }, []);

    // Save to localStorage when widths change (Debounced to avoid excessive writes during drag)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (Object.keys(detailWidths).length > 0) {
                localStorage.setItem('ipro_table_detail_widths', JSON.stringify(detailWidths));
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [detailWidths]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (manualStepWidth !== null) {
                localStorage.setItem('ipro_table_step_width', String(manualStepWidth));
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [manualStepWidth]);

    const [resizing, setResizing] = useState<{
        colKey: string;
        startX: number;
        startWidth: number;
        isStep: boolean;
    } | null>(null);
    const [isSuperEditing, setIsSuperEditing] = useState(false);
    // Delete confirmation state - prevents dialog flashing due to React re-renders
    const [deleteConfirm, setDeleteConfirm] = useState<{ orderId: string; woId: string } | null>(null);

    useEffect(() => {
        if (!resizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - resizing.startX;
            const newWidth = Math.max(20, resizing.startWidth + diff); // Min 20px

            if (resizing.isStep) {
                setManualStepWidth(newWidth); // Synchronized!
            } else {
                setDetailWidths(prev => ({ ...prev, [resizing.colKey]: newWidth }));
            }
        };

        const handleMouseUp = () => {
            setResizing(null);
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [resizing]);

    const handleResizeStart = (e: React.MouseEvent, colKey: string, isStep: boolean, currentWidthStr: string) => {
        e.preventDefault();
        e.stopPropagation();
        const startWidth = parseInt(currentWidthStr) || (isStep ? 50 : 70);
        setResizing({
            colKey,
            startX: e.clientX,
            startWidth,
            isStep
        });
    };
    // -----------------------------
    const [filters, setFilters] = useState<Record<string, string>>({});

    // Calculate optimal column width based on content length
    const calculateColumnWidth = (col: string, orders: Order[], isStep: boolean): string => {
        // Sample content from first 20 orders for performance
        const sampleOrders = orders.slice(0, Math.min(20, orders.length));
        const contents = sampleOrders.map(o => String(o[col] || '')).filter(c => c);

        // Get max content length (including header)
        const maxLength = Math.max(
            col.length,
            ...contents.map(c => c.length)
        );

        // Different sizing strategies for steps vs detail columns
        if (isStep) {
            // Step columns: compact sizing (36-80px)
            const baseWidth = Math.max(36, Math.min(80, maxLength * 8));
            return `${baseWidth}px`;
        } else {
            // Detail columns: compact, tight fit
            // Multiplier 6 is sufficient for text-[9px] (very compact)
            // Min 25px allows short data (like '1') to be very narrow
            const baseWidth = Math.max(25, maxLength * 6);
            return `${baseWidth}px`;
        }
    };

    const handleSort = (key: string) => {
        if (sortKey === key) {
            if (sortDir === 'asc') {
                setSortDir('desc');
            } else if (sortDir === 'desc') {
                setSortKey(null);
                setSortDir(null);
            }
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
        // Increment sortVersion to trigger re-sort only on explicit user action
        setSortVersion(v => v + 1);
    };

    const formatDate = (val: string, fmt = 'dd-MMM') => {
        if (!val) return '';
        try {
            const date = new Date(val);
            if (isValid(date)) return format(date, fmt);
        } catch { }
        return val.split('T')[0] || val;
    };

    const getCellStyle = (val: string): React.CSSProperties => {
        if (!val) return {};
        const v = val.toUpperCase();
        if (v.startsWith('P,') || v === 'P') return { backgroundColor: '#0014DC', color: 'white' };
        if (v === 'HOLD') return { backgroundColor: '#FDBA74', color: '#9A3412', fontWeight: 'bold' };
        if (v === 'WIP') return { backgroundColor: '#FEF9C3', color: '#854D0E', fontWeight: 'bold' }; // Yellow for WIP
        if (v === 'QN' || v === 'DIFA') return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
        if (v === 'N/A') return { backgroundColor: '#E5E7EB', color: '#6B7280' };
        if (/\d{4}-\d{2}-\d{2}/.test(val) || /\d{2}[-\/]\w{3}/.test(val)) {
            return { backgroundColor: '#D1FAE5', color: '#065F46' };
        }
        return {};
    };

    const getPriorityStyle = (val: string): React.CSSProperties => {
        if (val === '!!!') return { backgroundColor: '#FEE2E2', color: '#B91C1C', fontWeight: 'bold' };
        if (val === '!!') return { backgroundColor: '#FED7AA', color: '#9A3412', fontWeight: 'bold' };
        if (val === '!') return { backgroundColor: '#D9F99D', color: '#3F6212', fontWeight: 'bold' };
        return {};
    };

    // Identify completion column once
    const completionStep = useMemo(() => {
        return orderedSteps.find(s =>
            s.toLowerCase() === 'receipt' ||
            s.toLowerCase() === 'outgoing' ||
            s.toLowerCase() === 'completion'
        ) || orderedSteps[orderedSteps.length - 1];
    }, [orderedSteps]);

    const isOrderCompleted = (order: Order) => {
        if (!completionStep) return false;
        const val = order[completionStep] as string; // Type assertion
        if (!val) return false;
        return /\d{4}-\d{2}-\d{2}/.test(val) || /\d{2}[-\/]\w{3}/.test(val);
    };

    // Due date warning - returns style and countdown text
    const getDueDateInfo = (val: string, order: Order): { style: React.CSSProperties; countdown: string } => {
        if (!val) return { style: {}, countdown: '' };

        // If completed, do not show overdue warning
        if (isOrderCompleted(order)) return { style: {}, countdown: '' };

        try {
            const dueDate = new Date(val);
            if (!isValid(dueDate)) return { style: {}, countdown: '' };

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);

            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                // Overdue = light red
                return {
                    style: { backgroundColor: '#FEE2E2', color: '#B91C1C', fontWeight: 'bold' },
                    countdown: `${Math.abs(diffDays)}d late!`
                };
            }
            if (diffDays === 0) {
                // Today = yellow
                return {
                    style: { backgroundColor: '#FBBF24', color: '#78350F', fontWeight: 'bold' },
                    countdown: 'TODAY!'
                };
            }
            if (diffDays <= 3) {
                // ≤3 days = light yellow
                return {
                    style: { backgroundColor: '#FEF3C7', color: '#92400E' },
                    countdown: `${diffDays}d`
                };
            }
            if (diffDays <= 7) {
                // ≤7 days = no color, just show countdown
                return {
                    style: {},
                    countdown: `${diffDays}d`
                };
            }
            return { style: {}, countdown: '' };
        } catch {
            return { style: {}, countdown: '' };
        }
    };

    const formatCellValue = (val: string) => {
        if (!val) return '';
        if (val.toUpperCase().startsWith('P,')) return 'P';

        // Check for date-like content (ISO or human formatted)
        if (/\d{4}-\d{2}-\d{2}/.test(val) || /\d{2}[-\/]\w{3}/.test(val)) {
            try {
                // If it looks like a date and has a time component
                if (val.includes(':')) {
                    const date = new Date(val);
                    // Handle "21-Jan, 22:00" style which new Date might parse correctly or not depending on browser
                    // But if it's already in the desired string format, we might want to keep it?
                    // Actually, let's normalize everything to Date object then format back if possible.

                    if (isValid(date)) {
                        return format(date, 'dd-MMM, HH:mm');
                    }

                    // Fallback for custom strings that new Date() might miss but are already formatted
                    // e.g. "21-Jan, 22:46"
                    if (val.includes(',')) return val;
                }
            } catch { }

            // Fallback to just date if time parsing failed or no time present
            return formatDate(val);
        }
        return val;
    };

    // Calculate P + WIP counts for summary row
    const pCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        orderedSteps.forEach(step => {
            counts[step] = orders.filter(o => {
                const v = (o[step] || '').toUpperCase();
                // Count both P and WIP (WIP is also a type of P)
                return v === 'P' || v.startsWith('P,') || v === 'WIP' || v.startsWith('WIP,');
            }).length;
        });
        return counts;
    }, [orders, orderedSteps]);

    // Apply filters and sorting
    const processedOrders = useMemo(() => {
        let result = [...orders];

        // Filter
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                result = result.filter(o =>
                    String(o[key] || '').toLowerCase().includes(value.toLowerCase())
                );
            }
        });

        // Sort - only re-sort when sortVersion changes (user clicked to sort)
        // This prevents the table from jumping when data changes during editing
        if (sortKey && sortDir) {
            result.sort((a, b) => {
                const aVal = String(a[sortKey] || '');
                const bVal = String(b[sortKey] || '');

                // Try to parse both values as dates (value-based detection, works for any column)
                const aDate = new Date(aVal);
                const bDate = new Date(bVal);
                const aValid = aVal && isValid(aDate) && !isNaN(aDate.getTime());
                const bValid = bVal && isValid(bDate) && !isNaN(bDate.getTime());

                // If BOTH values are valid dates, use chronological comparison
                if (aValid && bValid) {
                    const cmp = aDate.getTime() - bDate.getTime();
                    return sortDir === 'asc' ? cmp : -cmp;
                }

                // If only one is a valid date, push invalid/empty ones to the end
                if (aValid && !bValid) return sortDir === 'asc' ? -1 : 1;
                if (!aValid && bValid) return sortDir === 'asc' ? 1 : -1;

                // Default: string comparison for non-date values
                const cmp = aVal.localeCompare(bVal);
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }

        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orders, filters, sortVersion]); // Use sortVersion instead of sortKey/sortDir to prevent re-sort on data changes

    // Use provided detail columns or fallback to defaults (NOW REMOVED)
    // Combine columns: Details + Steps
    // Integrate extraColumns (ECD) into details after WO DUE
    // Combine columns: Details + Steps
    // Integrate extraColumns (ECD) into details after WO DUE
    const effectiveDetailColumns = useMemo(() => {
        let cols = detailColumns.length > 0 ? detailColumns : [];
        if (cols.length === 0 && orders.length > 0) {
            cols = ['WO ID'];
        }
        if (extraColumns.length > 0) {
            cols = [...cols, ...extraColumns];
        }
        return cols;
    }, [detailColumns, orders.length, extraColumns]);

    const columns = [...effectiveDetailColumns, ...orderedSteps];

    // Memoize column widths for performance
    // AGGRESSIVE FIXED WIDTHS - ensure all steps visible without scrolling
    const columnWidths = useMemo(() => {
        const widths: Record<string, string> = {};

        // Calculate widths dynamically since columns are not known ahead of time
        effectiveDetailColumns.forEach((col, index) => {
            // First Column (ID Column): Usually critical, give it good space
            if (index === 0) {
                const dynamicWidth = calculateColumnWidth(col, processedOrders, false);
                const widthVal = Math.min(150, Math.max(70, parseInt(dynamicWidth)));
                widths[col] = `${widthVal}px`;
            } else {
                // Other detail columns: Auto-fit with reasonable bounds
                // Default: min 50, max 120
                const dynamicWidth = calculateColumnWidth(col, processedOrders, false);
                const widthVal = Math.min(150, Math.max(50, parseInt(dynamicWidth)));
                widths[col] = `${widthVal}px`;
            }
        });

        // Step columns: 'auto' so they share remaining space
        orderedSteps.forEach(step => {
            // If manual sync width is set, used THAT. Otherwise use auto.
            if (manualStepWidth !== null) {
                widths[step] = `${manualStepWidth}px`;
            } else {
                widths[step] = 'auto';
            }
        });

        // Apply Manual Detail Overrides (User Dragged)
        Object.keys(detailWidths).forEach(key => {
            if (widths[key]) {
                widths[key] = `${detailWidths[key]}px`;
            }
        });

        return widths;
    }, [effectiveDetailColumns, orderedSteps, processedOrders, detailWidths, manualStepWidth]);

    return (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200 max-h-[calc(100vh-200px)]">
            <table className="border-collapse w-full table-fixed" style={{ fontSize: `${12 * fontSizeScale}px` }}>
                <colgroup>
                    {/* Detail Columns */}
                    {effectiveDetailColumns.map((col) => (
                        <col key={col} style={{ width: columnWidths[col] }} />
                    ))}
                    {/* Step Columns */}
                    {orderedSteps.map((step) => (
                        <col key={step} style={{ width: columnWidths[step] }} />
                    ))}
                </colgroup>
                <thead className="sticky top-0 z-20 bg-white">
                    {/* Summary Row */}
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <td
                            style={{ width: columnWidths[effectiveDetailColumns[0]] }}
                            className="px-1 py-0.5 text-center font-bold text-amber-600 bg-slate-50 sticky left-0 z-30 group relative"
                        >
                            <div className="flex items-center justify-center gap-1">
                                <span>WO: {orders.length}</span>
                                {(role === 'admin' || role === 'supervisor') && (
                                    <button
                                        onClick={() => setIsSuperEditing(!isSuperEditing)}
                                        className={`p-0.5 rounded transition-colors ${isSuperEditing ? 'bg-red-100 text-red-600' : 'text-slate-300 hover:text-slate-500'}`}
                                        title={isSuperEditing ? "Lock Super Edit" : "Unlock Super Edit (Admin/Supervisor Only)"}
                                    >
                                        {isSuperEditing ? <Unlock size={10} /> : <Lock size={10} />}
                                    </button>
                                )}
                            </div>
                        </td>
                        {/* Detail Columns - Fixed 1:1 mapping (No colSpan to ensure perfect width control) */}
                        {effectiveDetailColumns.slice(1).map((col, i) => (
                            <td
                                key={`sum-${col}`}
                                style={{ width: columnWidths[col] }}
                                className="px-2 py-1 text-right font-medium text-slate-500 bg-slate-50 border-r border-slate-100"
                            >
                                {/* Only show P+WIP label in the last detail column to save space */}
                                {i === effectiveDetailColumns.length - 2 ? 'P+WIP:' : ''}
                            </td>
                        ))}

                        {orderedSteps.map(step => {
                            const count = pCounts[step] || 0;
                            return (
                                <td
                                    key={step}
                                    className={`px-1 py-1 text-center font-bold bg-slate-50 ${count === 0 ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50'
                                        }`}
                                >
                                    {count}
                                </td>
                            );
                        })}
                    </tr>

                    {/* Header Row */}
                    <tr className="bg-slate-100">
                        {effectiveDetailColumns.map((col, i) => (
                            <th
                                key={col}
                                style={{
                                    width: columnWidths[col],
                                    maxWidth: columnWidths[col] // Force max width
                                }}
                                className={`px-0.5 py-1 font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 relative group ${i === 0 ? 'sticky left-0 z-30' : ''
                                    } ${i >= 5 ? 'text-center' : 'text-left'}`}
                                title={col}
                            >
                                <div className="flex items-center gap-0.5 justify-center overflow-hidden">
                                    <span className="truncate">
                                        {i >= 5 ? getStepAbbrev(col) : col}
                                    </span>
                                    {/* Sort icon - click this to sort */}
                                    <button
                                        onClick={() => handleSort(col)}
                                        className={`shrink-0 p-0.5 rounded hover:bg-slate-300 transition-colors ${sortKey === col ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        title={`Sort by ${col}`}
                                    >
                                        {sortKey === col ? (
                                            sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3" />
                                        )}
                                    </button>
                                </div>
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/50 z-50 group-hover:bg-slate-300"
                                    onMouseDown={(e) => handleResizeStart(e, col, false, columnWidths[col])}
                                />
                            </th>
                        ))}

                        {orderedSteps.map(step => {
                            // Calculate step counts - only count dates as completed
                            const completeCount = processedOrders.filter(o => {
                                const val = o[step] || '';
                                return /\d{4}-\d{2}-\d{2}/.test(val) || /\d{2}[-\/]\w{3}/.test(val);
                            }).length;
                            const naCount = processedOrders.filter(o => o[step] === 'N/A').length;
                            const pendingCount = processedOrders.length - completeCount - naCount;

                            const isBulkMode = activeBatchMode && ['P', 'N/A', 'Hold', 'QN', 'WIP', 'Complete', 'Erase'].includes(activeBatchMode) && onBulkBatchUpdate;

                            const getBulkModeClass = () => {
                                if (!activeBatchMode || !onBulkBatchUpdate) return '';
                                switch (activeBatchMode) {
                                    case 'P': return 'cursor-pointer hover:bg-blue-100 ring-inset hover:ring-2 hover:ring-blue-300';
                                    case 'N/A': return 'cursor-pointer hover:bg-slate-200 ring-inset hover:ring-2 hover:ring-slate-400';
                                    case 'Hold': return 'cursor-pointer hover:bg-orange-100 ring-inset hover:ring-2 hover:ring-orange-300';
                                    case 'QN': return 'cursor-pointer hover:bg-red-100 ring-inset hover:ring-2 hover:ring-red-300';
                                    case 'WIP': return 'cursor-pointer hover:bg-yellow-100 ring-inset hover:ring-2 hover:ring-yellow-300';
                                    case 'Complete': return 'cursor-pointer hover:bg-green-100 ring-inset hover:ring-2 hover:ring-green-300';
                                    case 'Erase': return 'cursor-pointer hover:bg-red-50 ring-inset hover:ring-2 hover:ring-red-400';
                                    default: return '';
                                }
                            };


                            return (
                                <th
                                    key={step}
                                    style={{ width: columnWidths[step], fontSize: `${10 * fontSizeScale}px` }}
                                    className={`px-0.5 py-1 font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 relative group ${isBulkMode ? getBulkModeClass() : ''}`}
                                    onClick={() => {
                                        // Only handle bulk mode clicks on the header - sort is handled by the icon
                                        if (isBulkMode && onBulkBatchUpdate) {
                                            onBulkBatchUpdate(step, activeBatchMode);
                                        }
                                    }}
                                    title={isBulkMode ? `Click to Fill ${step} with ${activeBatchMode}` : step}
                                >
                                    <div className="flex flex-col items-center w-full">
                                        <div className="flex items-center gap-0.5 justify-center w-full">
                                            <span className="truncate text-center">{getStepAbbrev(step)}</span>
                                            {/* Sort icon - click this to sort */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Don't trigger bulk mode
                                                    handleSort(step);
                                                }}
                                                className={`shrink-0 p-0.5 rounded hover:bg-slate-300 transition-colors ${sortKey === step ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                title={`Sort by ${step}`}
                                            >
                                                {sortKey === step ? (
                                                    sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />
                                                ) : (
                                                    <ArrowUpDown className="w-2.5 h-2.5" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex gap-0.5 mt-1 font-normal text-[9px] opacity-70">
                                            <span className="text-green-600" title="Done (with dates)">{completeCount}</span>
                                            <span className="text-slate-400">/</span>
                                            <span className="text-amber-600" title="Empty or status">{pendingCount}</span>
                                        </div>
                                    </div>
                                    <div
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/50 z-50 group-hover:bg-slate-300 pointer-events-auto"
                                        onMouseDown={(e) => handleResizeStart(e, step, true, columnWidths[step])}
                                    />
                                </th>
                            );
                        })}
                    </tr>

                    {/* Filter Row */}
                    <tr className="bg-white">
                        {columns.map((col, i) => (
                            <th key={col} className={`px-0.5 py-0.5 bg-white border-r border-slate-200 border-b border-slate-200 ${i === 0 ? 'sticky left-0 z-30' : ''}`}>
                                <input
                                    type="text"
                                    placeholder=".."
                                    className="w-full px-0.5 py-0 text-[10px] text-black font-medium placeholder:text-slate-400 border border-slate-300 rounded focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                    value={filters[col] || ''}
                                    onChange={(e) => setFilters({ ...filters, [col]: e.target.value })}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {processedOrders.map((order, idx) => {
                        const isHighlighted = highlightedWos.includes(getWoId(order) || (order['WO ID'] as string));
                        return (
                            <tr key={order.id} className={`border-b border-slate-100 hover:bg-slate-50 ${isHighlighted ? 'bg-yellow-50/80 ring-2 ring-inset ring-yellow-400' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                {/* Detail Columns - Dynamic Rendering */}
                                {effectiveDetailColumns.map((col, colIdx) => {
                                    const value = getOrderValue(order, col);
                                    const colUpper = col.toUpperCase();

                                    // First column (WO ID) - Clickable, sticky
                                    if (colIdx === 0) {
                                        // Always use the actual WO ID for navigation (handles various column name formats)
                                        const woIdForNav = getWoId(order) || value;
                                        return (

                                            <td
                                                key={col}
                                                style={{ width: columnWidths[col], fontSize: `${10 * fontSizeScale}px` }}
                                                className="px-1 py-0.5 sticky left-0 bg-inherit z-10 font-medium border-r border-slate-200 group/cell"
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span
                                                        className="cursor-pointer text-indigo-600 dark:text-blue-400 hover:underline truncate"
                                                        onClick={() => onNavigate(String(woIdForNav))}
                                                    >
                                                        {value}
                                                    </span>
                                                    {isSuperEditing && onDeleteOrder && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                // Use state-controlled dialog instead of native confirm()
                                                                // to prevent flashing due to React re-renders
                                                                setDeleteConfirm({ orderId: order.id, woId: value });
                                                            }}
                                                            className="opacity-0 group-hover/cell:opacity-100 p-0.5 text-slate-400 hover:text-red-600 transition-opacity"
                                                            title="Delete Order"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        );

                                    }

                                    // Due Date - Fuzzy match "DUE"
                                    if (colUpper.includes('DUE')) {
                                        const { style, countdown } = getDueDateInfo(value, order);
                                        return (
                                            <td
                                                key={col}
                                                className="px-1 py-0.5 whitespace-nowrap border-r border-slate-200 text-center text-slate-700 relative group/due"
                                                style={{ ...style, width: columnWidths[col], fontSize: `${9 * fontSizeScale}px` }}
                                            >
                                                {isSuperEditing && onUpdateDetail ? (
                                                    <input
                                                        type="text"
                                                        defaultValue={formatDate(value, 'dd-MM-yyyy')}
                                                        className="w-full h-full bg-yellow-50 px-1 border border-yellow-200 rounded text-[9px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                        onBlur={(e) => {
                                                            const newVal = e.target.value.trim();
                                                            if (newVal !== formatDate(value, 'dd-MM-yyyy')) {
                                                                onUpdateDetail(order['WO ID'], col, newVal);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <>
                                                        {formatDate(value, 'dd-MM-yyyy')}
                                                        {countdown && (
                                                            <div className="hidden group-hover/due:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-slate-800 text-white text-[8px] rounded whitespace-nowrap z-50">
                                                                {countdown}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        );
                                    }

                                    // Priority - Fuzzy match "PRIORITY"
                                    if (colUpper.includes('PRIORITY')) {
                                        return (
                                            <td key={col} className="px-1 py-0.5 text-center border-r border-slate-200 text-slate-700" style={{ ...getPriorityStyle(value), width: columnWidths[col], fontSize: `${9 * fontSizeScale}px` }}>
                                                {isSuperEditing && onUpdateDetail ? (
                                                    <input
                                                        type="text"
                                                        defaultValue={value}
                                                        className="w-full h-full bg-yellow-50 px-1 border border-yellow-200 rounded text-[9px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                        onBlur={(e) => {
                                                            const newVal = e.target.value.trim();
                                                            if (newVal !== value) {
                                                                onUpdateDetail(order['WO ID'], col, newVal);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    value
                                                )}
                                            </td>
                                        );
                                    }

                                    // Description - With tooltip
                                    if (col === 'Description') {
                                        return (
                                            <td key={col} style={{ width: columnWidths[col], fontSize: `${9 * fontSizeScale}px` }} className="px-1 py-0.5 truncate text-slate-700 border-r border-slate-200" title={value}>
                                                {isSuperEditing && onUpdateDetail ? (
                                                    <input
                                                        type="text"
                                                        defaultValue={value}
                                                        className="w-full h-full bg-yellow-50 px-1 border border-yellow-200 rounded text-[9px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                        onBlur={(e) => {
                                                            const newVal = e.target.value.trim();
                                                            if (newVal !== value) {
                                                                onUpdateDetail(order['WO ID'], col, newVal);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    value
                                                )}
                                            </td>
                                        );
                                    }

                                    // Default rendering for other detail columns
                                    return (
                                        <td
                                            key={col}
                                            style={{ width: columnWidths[col], fontSize: `${9 * fontSizeScale}px` }}
                                            className={`px-1 py-0.5 text-slate-700 border-r border-slate-200 ${colIdx === 0 ? 'sticky left-0 bg-inherit z-10' : 'truncate'}`}
                                            title={value}
                                        >
                                            {isSuperEditing && onUpdateDetail && col !== 'ECD' ? (
                                                <input
                                                    type="text"
                                                    defaultValue={value}
                                                    className="w-full h-full bg-yellow-50 px-1 border border-yellow-200 rounded text-[9px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    onBlur={(e) => {
                                                        const newVal = e.target.value.trim();
                                                        if (newVal !== value) {
                                                            onUpdateDetail(order['WO ID'], col, newVal);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                value
                                            )}
                                        </td>
                                    );
                                })}



                                {/* Process Steps */}
                                {orderedSteps.map(step => {
                                    const cellValue = order[step] || '';
                                    const upperValue = cellValue.toUpperCase();

                                    // Unified logic based on activeBatchMode
                                    let isClickable = false;
                                    let isRemovable = false;
                                    let clickActionStr = '';

                                    if (activeBatchMode === 'P') {
                                        isClickable = !cellValue || upperValue === 'P';
                                        isRemovable = upperValue === 'P';
                                        clickActionStr = 'Plan';
                                    } else if (activeBatchMode === 'N/A') {
                                        isClickable = !cellValue || upperValue === 'N/A';
                                        isRemovable = upperValue === 'N/A';
                                        clickActionStr = 'N/A';
                                    } else if (activeBatchMode === 'Hold') {
                                        isClickable = !cellValue || upperValue === 'HOLD';
                                        isRemovable = upperValue === 'HOLD';
                                        clickActionStr = 'Hold';
                                    } else if (activeBatchMode === 'QN') {
                                        isClickable = !cellValue || upperValue === 'QN';
                                        isRemovable = upperValue === 'QN';
                                        clickActionStr = 'QN';
                                    } else if (activeBatchMode === 'WIP') {
                                        isClickable = !cellValue || upperValue === 'WIP';
                                        isRemovable = upperValue === 'WIP';
                                        clickActionStr = 'WIP';
                                    } else if (activeBatchMode === 'Complete') {
                                        isClickable = !cellValue;
                                        clickActionStr = 'Complete';
                                    } else if (activeBatchMode === 'Erase') {
                                        isClickable = !!cellValue; // Can erase anything
                                        clickActionStr = 'Erase';
                                    }

                                    return (
                                        <td
                                            key={step}
                                            style={{
                                                width: columnWidths[step],
                                                maxWidth: columnWidths[step],
                                                ...getCellStyle(cellValue)
                                            }}
                                            className={`px-0.5 py-0.5 text-center text-[9px] tracking-tighter font-medium whitespace-nowrap border-r border-slate-100 relative ${activeBatchMode === 'Erase' && isClickable
                                                ? 'cursor-pointer hover:bg-red-200 hover:ring-2 hover:ring-red-400'
                                                : isRemovable
                                                    ? 'cursor-pointer hover:bg-red-100 hover:ring-2 hover:ring-red-300' // General removal hint
                                                    : isClickable
                                                        ? activeBatchMode === 'P' ? 'cursor-pointer hover:bg-blue-100 hover:ring-2 hover:ring-blue-300'
                                                            : activeBatchMode === 'N/A' ? 'cursor-pointer hover:bg-slate-200 hover:ring-2 hover:ring-slate-400'
                                                                : activeBatchMode === 'Hold' ? 'cursor-pointer hover:bg-orange-100 hover:ring-2 hover:ring-orange-400'
                                                                    : activeBatchMode === 'QN' ? 'cursor-pointer hover:bg-red-100 hover:ring-2 hover:ring-red-300'
                                                                        : activeBatchMode === 'WIP' ? 'cursor-pointer hover:bg-yellow-100 hover:ring-2 hover:ring-yellow-300'
                                                                            : activeBatchMode === 'Complete' ? 'cursor-pointer hover:bg-green-100 hover:ring-2 hover:ring-green-300'
                                                                                : ''
                                                        : ''
                                                }`}
                                            onClick={() => {
                                                // Robust ID retrieval
                                                const woId = getWoId(order);
                                                if (isClickable && activeBatchMode) {
                                                    onBatchUpdate(woId, step, activeBatchMode);
                                                }
                                            }}
                                            title={
                                                activeBatchMode === 'Erase' ? 'Click to erase'
                                                    : isRemovable ? `Click to remove ${activeBatchMode}`
                                                        : isClickable ? `Click to set ${clickActionStr}` : ''
                                            }

                                        >
                                            <div className="relative w-full h-full flex items-center justify-center min-h-[14px]">
                                                {formatCellValue(cellValue)}
                                                {(order as any).commentStats?.[step]?.total > 0 && (() => {
                                                    const total = (order as any).commentStats?.[step]?.total || 0;
                                                    const unread = (order as any).userUnreadStats?.[step]?.unread || 0;
                                                    const previews = (order as any).commentPreviews?.[step] || [];

                                                    return (
                                                        <div className="group/tooltip absolute -top-0.5 -right-0.5">
                                                            <div className={`w-1.5 h-1.5 rounded-full border border-white cursor-pointer ${unread > 0 ? 'bg-red-500 animate-pulse' : 'bg-indigo-400'}`} />

                                                            {/* Instant tooltip - appears on hover with no delay */}
                                                            <div className="hidden group-hover/tooltip:block absolute bottom-full right-0 mb-1 z-[100] pointer-events-none">
                                                                <div className="bg-slate-800 text-white text-[10px] rounded-lg px-2 py-1.5 shadow-lg whitespace-pre-wrap max-w-[250px] min-w-[120px]">
                                                                    <div className="font-semibold text-slate-200 mb-1">
                                                                        {total} comment{total > 1 ? 's' : ''}{unread > 0 ? ` (${unread} unread)` : ''}
                                                                    </div>
                                                                    {previews.length > 0 && (
                                                                        <div className="border-t border-slate-600 pt-1 mt-1 space-y-1">
                                                                            {previews.slice(0, 3).map((p: any, idx: number) => (
                                                                                <div key={idx} className="text-slate-300">
                                                                                    <span className="text-slate-400">{p.username}:</span> {p.content.length > 40 ? p.content.substring(0, 40) + '...' : p.content}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Arrow */}
                                                                <div className="absolute bottom-0 right-1 transform translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800" />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {
                processedOrders.length === 0 && (
                    <div className="py-10 text-center text-slate-400">No orders found</div>
                )
            }

            {/* Delete Confirmation Modal - React controlled to prevent flashing */}
            {deleteConfirm && onDeleteOrder && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
                    onClick={() => setDeleteConfirm(null)}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 transform transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-slate-800 mb-2">⚠️ Confirm Delete</h3>
                        <p className="text-slate-600 mb-6">
                            Are you sure you want to <span className="font-bold text-red-600">PERMANENTLY DELETE</span> Order{' '}
                            <span className="font-mono bg-slate-100 px-1 rounded">{deleteConfirm.woId}</span>?
                        </p>
                        <p className="text-sm text-red-500 mb-6">This action cannot be undone!</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    const orderId = deleteConfirm.orderId;
                                    setDeleteConfirm(null);
                                    await onDeleteOrder(orderId);
                                }}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium"
                            >
                                Delete Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
