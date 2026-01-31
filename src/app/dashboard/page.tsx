'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { parseShortTimestamp } from '@/lib/date-utils';
import {
    Settings, LogOut,
    Maximize, Minimize, ScanBarcode, ArrowRight,
    Ban, PauseCircle, Eraser, Info, HardHat, Upload,
    ChevronDown, Table2, Pencil, Eye, EyeOff, ClipboardList,
    RefreshCw, X, FileSpreadsheet, Check, Clock, CheckCircle2, Layers, AlertTriangle, Sparkles,
    History, Loader2, BarChart2, ZoomIn, ZoomOut,
    LayoutGrid, List
} from 'lucide-react';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { useTranslations } from 'next-intl';
import PlannerTable from '@/components/PlannerTable';
import MobilePlannerCards from '@/components/MobilePlannerCards';
import DraggableMenu from '@/components/DraggableMenu';
import { APP_VERSION } from '@/lib/version';
import type { Order } from '@/lib/excel';
import dynamic from 'next/dynamic';
import AIChatPanel from '@/components/AIChatPanel';
import KanbanBoard from '@/components/KanbanBoard'; // Import Kanban Board
import { MessageNotification } from '@/components/MessageNotification';
import { StructuredCommentDialog } from '@/components/StructuredCommentDialog';
import { SmartSchedulerDialog } from '@/components/SmartSchedulerDialog';
import { calculateECD } from '@/lib/ecd';
import { useLocaleDetection } from '@/hooks/useLocaleDetection';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useRealtime } from '@/hooks/useRealtime';

// Dynamic import for barcode scanner (client-only)
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });

interface OperationLog {
    id: string;
    timestamp: string;
    productId: string;
    productName: string;
    woId: string;
    step: string;
    action: string;
    previousValue: string;
    newValue: string;
    operatorId: string;
}

interface Product {
    id: string;
    name: string;
    excelPath: string;
    detailColumns: string[];
    steps: string[];
    stepQuantities?: Record<string, number>;
    stepDurations?: Record<string, number>;
    monthlyTarget?: number;
    includeSaturday?: boolean;
    includeSunday?: boolean;
}

interface ImportPreviewData {
    newOrders: number;
    existingOrders: number;
    totalRows: number;
    missingColumns?: string[];
    validationErrors?: Array<{ row: number; error: string }>;
}

export default function DashboardPage() {
    const t = useTranslations('Dashboard');
    const tCommon = useTranslations('Common');
    const [currentDate, setCurrentDate] = useState('');
    const currentLocale = useLocaleDetection();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            setCurrentDate(`${date} · ${time}`);
        };
        updateDateTime();
        const timer = setInterval(updateDateTime, 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    const [orders, setOrders] = useState<Order[]>([]);
    const [steps, setSteps] = useState<string[]>([]);
    const [detailColumns, setDetailColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    const [role, setRole] = useState<'user' | 'supervisor' | 'admin'>('user');
    const [fontSizeScale, setFontSizeScale] = useState(1);

    // Batch Operations State - Single Source of Truth
    const [activeBatchMode, setActiveBatchMode] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [batchMenuOpen, setBatchMenuOpen] = useState(false);
    const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false);

    const [scannerOpen, setScannerOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'board'>('table'); // Add View Mode
    const [licenseInfo, setLicenseInfo] = useState<{
        customerName: string; type: string; expiresAt: string; isValid: boolean; error?: string;
    } | null>(null);

    // Load view mode preference
    useEffect(() => {
        const savedView = localStorage.getItem('plannerViewMode');
        if (savedView === 'table' || savedView === 'board') {
            setViewMode(savedView);
        }
    }, []);

    const toggleViewMode = () => {
        const newMode = viewMode === 'table' ? 'board' : 'table';
        setViewMode(newMode);
        localStorage.setItem('plannerViewMode', newMode);
    };

    // Load font size preference
    useEffect(() => {
        const savedScale = localStorage.getItem('plannerFontSizeScale');
        if (savedScale) {
            setFontSizeScale(parseFloat(savedScale));
        }
    }, []);

    // Fetch License Status
    useEffect(() => {
        fetch('/api/license/status').then(r => r.json()).then(setLicenseInfo).catch(console.error);
    }, []);

    // Comment Modal State
    const [commentModal, setCommentModal] = useState<{ step: string; orderId: string } | null>(null);
    const [showSmartScheduler, setShowSmartScheduler] = useState(false);

    const updateFontSize = (delta: number) => {
        const newScale = Math.max(0.8, Math.min(2.0, fontSizeScale + delta));
        setFontSizeScale(newScale);
        localStorage.setItem('plannerFontSizeScale', newScale.toString());
    };

    // Bulk Confirm Modal State
    const [bulkConfirmState, setBulkConfirmState] = useState<{
        isOpen: boolean;
        step: string;
        mode: string;
        count: number;
        targets: Order[];
    }>({ isOpen: false, step: '', mode: 'P', count: 0, targets: [] });

    // Product state
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [productMenuOpen, setProductMenuOpen] = useState(false);
    const productMenuRef = useRef<HTMLDivElement>(null);
    const batchMenuRef = useRef<HTMLDivElement>(null);

    // Logs state
    const [logs, setLogs] = useState<OperationLog[]>([]);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // ECD settings - separate Saturday/Sunday


    // Barcode Scanner
    const [searchQuery, setSearchQuery] = useState('');
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Removed old analytics data state
    // const [analyticsData, setAnalyticsData] = useState<{...}>();
    // const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // Import State
    const [isImporting, setIsImporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMsg, setImportMsg] = useState<{ type: string, text: string } | null>(null);



    // Monthly Target Edit State
    const [editingTarget, setEditingTarget] = useState(false);
    const [tempTarget, setTempTarget] = useState<string>('');
    const [savingTarget, setSavingTarget] = useState(false);

    const router = useRouter();

    const selectedProduct = products.find(p => p.id === selectedProductId);





    const saveTarget = async () => {
        if (!selectedProductId || !tempTarget) return;
        setSavingTarget(true);
        try {
            const res = await fetch(`/api/products/${selectedProductId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monthlyTarget: Number(tempTarget) })
            });

            if (res.ok) {
                // Update local state to reflect change immediately
                const updatedProducts = products.map(p =>
                    p.id === selectedProductId
                        ? { ...p, monthlyTarget: Number(tempTarget) }
                        : p
                );
                setProducts(updatedProducts);
                setEditingTarget(false);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update target');
            }
        } catch (error) {
            console.error('Save target error:', error);
            alert('Failed to save target');
        } finally {
            setSavingTarget(false);
        }
    };

    // --- BATCH OPERATIONS LOGIC ---

    const toggleBatchMode = (mode: string) => {
        // Close menu first for all modes
        setBatchMenuOpen(false);

        if (mode === 'Erase') {
            if (activeBatchMode === 'Erase') {
                setActiveBatchMode(null);
            } else {
                // Show React-based confirmation modal instead of window.confirm
                setEraseConfirmOpen(true);
            }
        } else {
            // Toggle off if same mode, otherwise switch to new mode
            setActiveBatchMode(prev => prev === mode ? null : mode);
        }
    };

    // Unified Batch Handler with Optimistic Updates
    const handleBatchUpdate = async (woId: string, step: string, status: string) => {
        // For Complete mode, generate a timestamp
        const timestamp = status === 'Complete' ? format(new Date(), 'yyyy-MM-dd HH:mm') : null;

        // Optimistic Update
        const originalOrders = [...orders];
        setOrders(prev => prev.map(o => {
            if (o['WO ID'] === woId) {
                // Determine new value
                // For Erase, we clear the cell
                if (status === 'Erase') {
                    return { ...o, [step]: '' };
                }
                // For toggling off the same status (e.g. removing 'P')
                if (String(o[step]).trim().toUpperCase() === status.toUpperCase() && status !== 'Complete') {
                    return { ...o, [step]: '' };
                }

                // For setting status
                // If status is 'Complete', we set today's date formatted
                if (status === 'Complete') {
                    return { ...o, [step]: format(new Date(), 'yyyy-MM-dd HH:mm') };
                }

                return { ...o, [step]: status };
            }
            return o;
        }));

        try {
            // Logic to determine if we are SETTING or CLEARING
            const currentVal = String(originalOrders.find(o => o['WO ID'] === woId)?.[step] || '');
            let apiValue: string = status;

            if (status === 'Erase') {
                apiValue = '';
            } else if (status === 'Complete') {
                // Always set timestamp for Complete
                apiValue = timestamp!;
            } else if (currentVal.trim().toUpperCase() === status.toUpperCase()) {
                // Toggling off
                apiValue = '';
            }

            const res = await fetch('/api/orders/update-detail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ woId, field: step, value: apiValue, productId: selectedProductId })
            });

            if (!res.ok) {
                // Revert on failure
                console.error('Update failed, reverting');
                setOrders(originalOrders);
                alert('Update failed');
            }
            // No need to fetchOrders for Complete anymore since we set the timestamp optimistically
        } catch (error) {
            console.error(error);
            setOrders(originalOrders);
        }
    };


    // Generic Status Change Handler for Kanban
    const handleStatusChange = async (woId: string, step: string, status: string) => {
        try {
            const res = await fetch(`/api/orders/${woId}/step`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step, status, productId: selectedProductId })
            });

            if (res.ok) {
                await fetchOrders();
            }
        } catch (err) {
            console.error('Status change error:', err);
        }
    };

    const handleSmartScheduleConfirm = async (recommendations: any[]) => {
        if (!selectedProductId) return;
        try {
            // Flatten all predicted steps from recommendations
            const updates: { woId: string; step: string; status: string }[] = [];
            for (const rec of recommendations) {
                if (rec.predictedFlow && rec.predictedFlow.length > 0) {
                    // Mark ALL predicted steps as 'P'
                    for (const flow of rec.predictedFlow) {
                        updates.push({
                            woId: rec.woId,
                            step: flow.stepName,
                            status: 'P'
                        });
                    }
                } else {
                    // Fallback to single step for backward compatibility
                    updates.push({
                        woId: rec.woId,
                        step: rec.stepName,
                        status: 'P'
                    });
                }
            }

            const res = await fetch('/api/orders/batch', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: selectedProductId,
                    updates
                })
            });

            if (res.ok) {
                await fetchOrders();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to apply schedule');
            }
        } catch (err) {
            console.error('Smart schedule commit error', err);
            alert('Failed to apply schedule');
        }
    };

    // Reset All P - finds all 'P' status cells and clears them
    const handleResetAllP = async () => {
        if (!selectedProductId) return;

        const updates: { woId: string; step: string; status: string }[] = [];

        // Find all cells with 'P' status
        orders.forEach(order => {
            steps.forEach(step => {
                if (order[step] === 'P') {
                    updates.push({
                        woId: order['WO ID'],
                        step,
                        status: 'Reset' // Use 'Reset' to properly clear the status via batch API
                    });
                }
            });
        });

        if (updates.length === 0) {
            return;
        }

        try {
            const res = await fetch('/api/orders/batch', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: selectedProductId,
                    updates,
                    operatorId: 'admin'
                })
            });

            if (res.ok) {
                await fetchOrders();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to reset P statuses');
            }
        } catch (err) {
            console.error('Reset All P error', err);
            alert('Failed to reset P statuses');
        }
    };




    const handleDeleteOrder = async (woId: string) => {
        try {
            const res = await fetch(`/api/orders/${woId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                // Optimistic update
                setOrders(prev => prev.filter(o => o.id !== woId));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete order');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('Failed to delete order');
        }
    };

    // Fetch products and auth

    // Fetch orders for selected product
    const fetchOrders = async () => {
        if (!selectedProductId) return;

        setRefreshing(true);
        const startTime = Date.now();
        try {
            const ordersRes = await fetch(`/api/orders?productId=${selectedProductId}`);
            if (!ordersRes.ok) {
                const errData = await ordersRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to fetch orders');
            }

            const ordersData = await ordersRes.json();
            setOrders(ordersData.orders || []);
            setSteps(ordersData.steps || []);
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            const elapsed = Date.now() - startTime;
            if (elapsed < 500) {
                await new Promise(r => setTimeout(r, 500 - elapsed));
            }
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fetch analytics data
    // Analytics Logic moved to AnalyticsDashboard component
    // Removed local fetchAnalyticsData and useEffect

    // Initial load - fetch config and orders
    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch auth and config
                const [authRes, configRes] = await Promise.all([
                    fetch('/api/auth', { cache: 'no-store' }),
                    fetch(`/api/config?t=${Date.now()}`, { cache: 'no-store' })
                ]);

                const authData = await authRes.json();
                if (authData.role) {
                    setRole(authData.role);
                }

                const configData = await configRes.json();
                let targetId = '';
                if (configData.products && configData.products.length > 0) {
                    setProducts(configData.products);

                    // Priority: Local Storage -> Active Product -> First Product
                    const savedId = localStorage.getItem('selectedProductId');
                    targetId = configData.activeProductId || configData.products[0].id;

                    if (savedId && configData.products.find((p: Product) => p.id === savedId)) {
                        targetId = savedId;
                    }

                    setSelectedProductId(targetId);
                }
                // Set weekend setting from config


                // Fetch orders for the product (using targetId)
                if (targetId) {
                    const activeProduct = configData.products.find((p: Product) => p.id === targetId);
                    if (activeProduct?.detailColumns) {
                        setDetailColumns(activeProduct.detailColumns);
                    }
                    const ordersRes = await fetch(`/api/orders?productId=${targetId}`);
                    if (ordersRes.ok) {
                        const ordersData = await ordersRes.json();
                        setOrders(ordersData.orders || []);
                        setSteps(ordersData.steps || []);
                        if (ordersData.detailColumns) {
                            setDetailColumns(ordersData.detailColumns);
                        }
                    }
                }

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Click outside to close menus
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productMenuRef.current && !productMenuRef.current.contains(event.target as Node)) {
                setProductMenuOpen(false);
            }
            if (batchMenuRef.current && !batchMenuRef.current.contains(event.target as Node)) {
                setBatchMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch orders when product changes (after initial load)
    const handleProductChange = async (productId: string) => {
        setSelectedProductId(productId);
        localStorage.setItem('selectedProductId', productId);
        setProductMenuOpen(false);
        setLoading(true);

        // Update global active product (Best Effort)
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activeProductId: productId })
            });
        } catch (e) {
            console.error('Failed to set active product', e);
        }

        // Set detailColumns from product
        const activeProduct = products.find(p => p.id === productId);
        if (activeProduct?.detailColumns) {
            setDetailColumns(activeProduct.detailColumns);
        }

        try {
            const ordersRes = await fetch(`/api/orders?productId=${productId}`);
            if (ordersRes.ok) {
                const ordersData = await ordersRes.json();
                setOrders(ordersData.orders || []);
                setSteps(ordersData.steps || []);
                if (ordersData.detailColumns) {
                    setDetailColumns(ordersData.detailColumns);
                }
                setError('');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresh
    // Real-time updates via SSE
    useRealtime(selectedProductId, fetchOrders);

    const handleLogout = async () => {
        await fetch('/api/auth', { method: 'DELETE' });
        router.push('/login');
        router.refresh();
    };

    const handleNavigate = (woId: string) => {
        router.push(`/dashboard/operation?wo=${woId}&product=${selectedProductId}`);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await fetch(`/api/logs?limit=100&productId=${selectedProductId}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const openLogsModal = () => {
        setShowLogsModal(true);
        fetchLogs();
    };


    const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedProductId) return;

        setImportFile(file);
        setIsImporting(true);
        setImportMsg(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('productId', selectedProductId);

        try {
            const res = await fetch('/api/import-excel/preview', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setImportPreview(data);
                setShowImportModal(true);
            } else {
                alert(data.error || 'Failed to analyze file');
            }
        } catch (error) {
            console.error('Preview error:', error);
            alert('Error analyzing file');
        } finally {
            setIsImporting(false);
            // Reset input
            e.target.value = '';
        }
    };

    const confirmImport = async () => {
        if (!importFile || !selectedProductId) return;
        setIsImporting(true);

        const formData = new FormData();
        formData.append('file', importFile);
        formData.append('productId', selectedProductId);
        formData.append('mode', 'skip-existing'); // Default for daily upload

        try {
            const res = await fetch('/api/import-excel', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                const p = [];
                if (data.imported > 0) p.push(`${data.imported} new`);
                if (data.skipped > 0) p.push(`${data.skipped} skipped`);

                alert(`✅ Import Successful: ${p.join(', ')}`);
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview(null);
                fetchOrders(); // Refresh table
            } else {
                setImportMsg({ type: 'error', text: data.error || 'Import failed' });
            }
        } catch {
            setImportMsg({ type: 'error', text: 'Network error during import' });
        } finally {
            setIsImporting(false);
        }
    };



    // Sort orders by priority (Red first, then Yellow, then normal)
    // Skip sorting when batch mode is active to prevent rows from jumping
    const sortedOrders = activeBatchMode
        ? [...orders] // Keep original order in batch mode for stable row positions
        : [...orders].sort((a, b) => {
            const getPriority = (order: any) => {
                if (order.priority === 'Red') return 3;
                if (order.priority === 'Yellow') return 2;
                return 1;
            };
            return getPriority(b) - getPriority(a);
        });

    const displayedOrders = showCompleted
        ? sortedOrders
        : sortedOrders.filter(order => {
            // Prioritize 'Receipt' as completion step
            let completionStep = steps.find(s => s.toLowerCase() === 'receipt');
            if (!completionStep) {
                completionStep = steps.find(s =>
                    s.toLowerCase() === 'outgoing' ||
                    s.toLowerCase() === 'completion'
                ) || steps[steps.length - 1];
            }

            const val = order[completionStep] || '';
            const hasDate = /\d{4}-\d{2}-\d{2}/.test(val) || /\d{2}[-\/]\w{3}/.test(val);
            const isNA = val.toUpperCase() === 'N/A';
            return !hasDate && !isNA;
        });


    // Calculate highlighted WOs based on search query (for Barcode Scanner)
    const highlightedWos = useMemo(() => {
        if (!searchQuery) return [];
        const lowerQuery = searchQuery.toLowerCase();
        return displayedOrders
            .filter(o => {
                const woId = o['WO ID']?.toString().toLowerCase() || '';
                const pn = o['PN']?.toString().toLowerCase() || '';
                return woId.includes(lowerQuery) || pn.includes(lowerQuery);
            })
            .map(o => o['WO ID']);
    }, [displayedOrders, searchQuery]);

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
                <div className="max-w-full mx-auto px-4 h-14 flex items-center justify-between">
                    {/* Left: Logo */}
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer shrink-0"
                        title="Return to Home"
                    >
                        <img src="/logo.png" alt="iProTraX" className="h-9 w-auto" />
                    </button>

                    <div className="flex-1 overflow-visible no-scrollbar flex items-center justify-end px-2">
                        <nav className="flex items-center gap-1 sm:gap-2">
                            {/* Product Selector - Outside overflow container to prevent clipping */}
                            <div className="relative shrink-0" ref={productMenuRef}>
                                <button
                                    onClick={() => setProductMenuOpen(!productMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 bg-white"
                                >
                                    <span className="max-w-[150px] truncate">{selectedProduct?.name || t('selectProduct')}</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${productMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {productMenuOpen && products.length > 0 && (
                                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[200px] z-50 max-h-[80vh] overflow-y-auto">
                                        {products.map(product => (
                                            <button
                                                key={product.id}
                                                onClick={() => handleProductChange(product.id)}
                                                className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${product.id === selectedProductId
                                                    ? 'bg-indigo-50 text-indigo-700 font-medium border-r-4 border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-400'
                                                    : 'text-slate-700 dark:text-slate-400'
                                                    }`}
                                            >
                                                {product.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {(role === 'admin' || role === 'supervisor') && (
                                <div className="shrink-0 ml-1 mr-2">
                                    <input
                                        type="file"
                                        id="dashboard-import-input"
                                        accept=".xlsx,.xls"
                                        className="hidden"
                                        onChange={handleImportFileSelect}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!selectedProductId) { alert('Select a product line first'); return; }
                                            document.getElementById('dashboard-import-input')?.click();
                                        }}
                                        disabled={isImporting}
                                        className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                        title={t('import')}
                                    >
                                        <Upload className="w-4 h-4" />
                                        {t('import')}
                                    </button>
                                </div>
                            )}

                            {(role === 'admin' || role === 'supervisor') && (
                                <button
                                    title={t('aiSmartScheduler')}
                                    onClick={() => setShowSmartScheduler(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                >
                                    <Sparkles className="w-4 h-4 animate-pulse" />
                                    <span className="hidden sm:inline">{t('smartScheduleBtn')}</span>
                                </button>
                            )}

                            <div className="hidden md:flex items-center gap-2 px-1">
                                <div className="w-px h-6 bg-slate-200" />

                                <button className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                                    <Table2 className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('home')}</span>
                                </button>



                                <button
                                    onClick={() => router.push(`/dashboard/operation?product=${selectedProductId}`)}
                                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"
                                    title={t('operation')}
                                >
                                    <HardHat className="w-5 h-5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">{t('operation')}</span>
                                </button>



                                {(role === 'supervisor' || role === 'admin') && (
                                    <button
                                        onClick={() => setShowAnalytics(!showAnalytics)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showAnalytics
                                            ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
                                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                                            }`}
                                        title={t('reports')}
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                        <span className="hidden sm:inline">{t('reports')}</span>
                                    </button>
                                )}

                                {/* Batch Operations Dropdown */}
                                {(role === 'admin' || role === 'supervisor') && (
                                    <div className="relative" ref={batchMenuRef}>
                                        <button
                                            onClick={() => setBatchMenuOpen(!batchMenuOpen)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeBatchMode
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'text-slate-700 hover:bg-slate-50 border border-slate-200'
                                                }`}
                                        >
                                            <Layers className="w-4 h-4" />
                                            <span className="hidden sm:inline">
                                                {activeBatchMode === 'P' ? t('batch.plan') : activeBatchMode === 'N/A' ? t('batch.na') : activeBatchMode === 'Hold' ? t('batch.hold') : activeBatchMode === 'QN' ? t('batch.qn') : activeBatchMode === 'WIP' ? t('batch.wip') : activeBatchMode === 'Complete' ? t('batch.complete') : activeBatchMode === 'Erase' ? t('batch.erase') : t('batch.edit')}
                                            </span>
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${batchMenuOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {batchMenuOpen && (
                                            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 min-w-[140px] z-[100]">
                                                <button onClick={(e) => { e.stopPropagation(); toggleBatchMode('P'); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${activeBatchMode === 'P' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white'}`}>
                                                    <Pencil className="w-4 h-4" /> Plan
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); toggleBatchMode('N/A'); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${activeBatchMode === 'N/A' ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white'}`}>
                                                    <Ban className="w-4 h-4" /> N/A
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); toggleBatchMode('Hold'); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${activeBatchMode === 'Hold' ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white'}`}>
                                                    <PauseCircle className="w-4 h-4" /> Hold
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); toggleBatchMode('QN'); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${activeBatchMode === 'QN' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white'}`}>
                                                    <AlertTriangle className="w-4 h-4" /> QN
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); toggleBatchMode('WIP'); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${activeBatchMode === 'WIP' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white'}`}>
                                                    <Clock className="w-4 h-4" /> WIP
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); toggleBatchMode('Complete'); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${activeBatchMode === 'Complete' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white'}`}>
                                                    <CheckCircle2 className="w-4 h-4" /> Complete
                                                </button>
                                                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                                                <button onClick={(e) => { e.stopPropagation(); toggleBatchMode('Erase'); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${activeBatchMode === 'Erase' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'text-red-500 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30 dark:hover:text-red-200'}`}>
                                                    <Eraser className="w-4 h-4" /> Erase
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Show/Hide Completed Toggle */}
                                <button
                                    onClick={() => setShowCompleted(!showCompleted)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${showCompleted
                                        ? 'bg-slate-600 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    title={showCompleted ? 'Hide Completed Orders' : 'Show Completed Orders'}
                                >
                                    {showCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Completed</span>
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-600">
                                        {orders.filter(o => {
                                            let completionStep = steps.find(s => s.toLowerCase() === 'receipt');
                                            if (!completionStep) {
                                                completionStep = steps.find(s =>
                                                    s.toLowerCase() === 'outgoing' ||
                                                    s.toLowerCase() === 'completion'
                                                ) || steps[steps.length - 1];
                                            }
                                            const val = o[completionStep] || '';
                                            return /\d{4}-\d{2}-\d{2}/.test(val) || /\d{2}[-\/]\w{3}/.test(val);
                                        }).length}
                                    </span>
                                </button>



                                <div className="w-px h-6 bg-slate-200 mx-1" />


                                <button
                                    onClick={openLogsModal}
                                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                                    title={t('modals.operationLogs')}
                                >
                                    <ClipboardList className="w-5 h-5" />
                                </button>

                                <button
                                    onClick={fetchOrders}
                                    disabled={refreshing}
                                    className={`p-2 rounded-lg transition-colors ${refreshing
                                        ? 'text-indigo-500 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-900/30'
                                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                        }`}
                                    title={t('refresh')}
                                >
                                    <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                                </button>

                                {/* Barcode Scanner - Mobile only */}
                                <button
                                    onClick={() => setScannerOpen(true)}
                                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden"
                                    title="Scan Barcode"
                                >
                                    <ScanBarcode className="w-6 h-6" />
                                </button>

                                <button
                                    onClick={toggleFullscreen}
                                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                                    title={t('fullscreen')}
                                >
                                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                                </button>

                                <div className="w-px h-6 bg-slate-200 mx-1" />


                                {/* View Toggle */}
                                <div className="flex bg-slate-100 rounded-lg p-1 hidden md:flex">
                                    <button
                                        onClick={() => toggleViewMode()}
                                        className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        title="Table View"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleViewMode()}
                                        className={`p-1.5 rounded transition-all ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        title="Kanban Board View"
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => updateFontSize(-0.1)}
                                        className="p-1 text-slate-500 hover:bg-white hover:text-indigo-600 rounded"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-mono w-8 text-center text-slate-500">{Math.round(fontSizeScale * 100)}%</span>
                                    <button
                                        onClick={() => updateFontSize(0.1)}
                                        className="p-1 text-slate-500 hover:bg-white hover:text-indigo-600 rounded"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Theme Switcher */}
                                {/* Theme Switcher - Desktop only */}
                                <ThemeSwitcher className="hidden md:flex text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700" />

                                {/* SVG Flag Language Switcher - Matching Login Page */}
                                <button
                                    suppressHydrationWarning
                                    onClick={() => {
                                        const locale = document.cookie
                                            .split('; ')
                                            .find(row => row.startsWith('NEXT_LOCALE='))
                                            ?.split('=')[1] || 'en';
                                        const newLocale = locale === 'en' ? 'zh' : 'en';
                                        document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
                                        window.location.reload();
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                                    title={currentLocale === 'en' ? '切换到中文' : 'Switch to English'}
                                >
                                    <div className="w-7 h-5 flex items-center justify-center" suppressHydrationWarning>
                                        {mounted ? (
                                            currentLocale === 'en' ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" className="w-7 h-5 rounded-sm shadow-sm">
                                                    <rect width="30" height="20" fill="#de2910" /><path fill="#ffde00" d="M5 5l-1.123.816.429-1.321-1.123-.816h1.388L5 2.358l.429 1.321h1.388l-1.123.816.429 1.321L5 5z" /><circle fill="#ffde00" cx="10" cy="2" r="0.4" /><circle fill="#ffde00" cx="12" cy="4" r="0.4" /><circle fill="#ffde00" cx="12" cy="7" r="0.4" /><circle fill="#ffde00" cx="10" cy="9" r="0.4" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 741 390" className="w-7 h-5 rounded-sm shadow-sm">
                                                    <path fill="#b22234" d="M0 0h741v30H0zM0 60h741v30H0zM0 120h741v30H0zM0 180h741v30H0zM0 240h741v30H0zM0 300h741v30H0zM0 360h741v30H0z" /><path fill="#fff" d="M0 30h741v30H0zM0 90h741v30H0zM0 150h741v30H0zM0 210h741v30H0zM0 270h741v30H0zM0 330h741v30H0z" /><path fill="#3c3b6e" d="M0 0h296.4v210H0z" /><g fill="#fff"><path d="M24.7 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M74.1 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M123.5 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M172.9 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M222.3 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M271.7 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /></g>
                                                </svg>
                                            )
                                        ) : null}
                                    </div>
                                </button>

                                <button
                                    onClick={() => router.push('/dashboard/settings')}
                                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"
                                >
                                    <Settings className="w-4 h-4" />
                                    <span className="hidden sm:inline">{t('settings')}</span>
                                </button>
                            </div>
                        </nav>
                    </div>

                    {/* Fixed Actions (Logout) */}
                    <div className="flex items-center shrink-0 ml-1 border-l border-slate-200 pl-2 gap-1">
                        <MessageNotification />
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        <button
                            onClick={handleLogout}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            title={t('logout')}
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Production Insights Section */}
            {/* Analytics Dashboard (Modal) */}
            <AnalyticsDashboard
                isOpen={showAnalytics}
                onClose={() => setShowAnalytics(false)}
                productId={selectedProductId}
            />

            {/* Main Content */}
            <main className="p-4">
                {loading ? (
                    <div className="text-center py-20 text-slate-500">{t('loadingOrders')}</div>
                ) : error ? (
                    <div className="text-center py-20 text-red-500">{error}</div>
                ) : (
                    <>
                        {/* Statistics Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
                            <div className="bg-white rounded-lg border border-slate-200 p-3">
                                <div className="text-xs text-slate-500">{t('stats.activeWOs')}</div>
                                <div className="text-xl font-bold text-slate-900">{displayedOrders.length}</div>
                            </div>
                            <div className={`rounded-lg border p-3 ${displayedOrders.filter(o => {
                                const due = o['WO DUE'];
                                if (!due) return false;
                                // Exclude completed orders (last step has date or N/A)
                                const lastStep = steps[steps.length - 1];
                                const lastStepValue = lastStep ? (o[lastStep] || '') : '';
                                if (/\d{4}-\d{2}-\d{2}/.test(lastStepValue) || /\d{2}[-\/]\w{3}/.test(lastStepValue) || lastStepValue.toUpperCase() === 'N/A') return false;
                                const dueDate = new Date(due);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                dueDate.setHours(0, 0, 0, 0);
                                return dueDate < today;
                            }).length > 0
                                ? 'bg-red-50 border-red-200'
                                : 'bg-white border-slate-200'
                                }`}>
                                <div className="text-xs text-slate-500">{t('stats.overdue')}</div>
                                <div className={`text-xl font-bold ${displayedOrders.filter(o => {
                                    const due = o['WO DUE'];
                                    if (!due) return false;
                                    const lastStep = steps[steps.length - 1];
                                    const lastStepValue = lastStep ? (o[lastStep] || '') : '';
                                    if (/\d{4}-\d{2}-\d{2}/.test(lastStepValue) || /\d{2}[-\/]\w{3}/.test(lastStepValue) || lastStepValue.toUpperCase() === 'N/A') return false;
                                    const dueDate = new Date(due);
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    dueDate.setHours(0, 0, 0, 0);
                                    return dueDate < today;
                                }).length > 0 ? 'text-red-600' : 'text-slate-900'
                                    }`}>
                                    {displayedOrders.filter(o => {
                                        const due = o['WO DUE'];
                                        if (!due) return false;
                                        const lastStep = steps[steps.length - 1];
                                        const lastStepValue = lastStep ? (o[lastStep] || '') : '';
                                        if (/\d{4}-\d{2}-\d{2}/.test(lastStepValue) || /\d{2}[-\/]\w{3}/.test(lastStepValue) || lastStepValue.toUpperCase() === 'N/A') return false;
                                        if (/\d{4}-\d{2}-\d{2}/.test(lastStepValue) || /\d{2}[-\/]\w{3}/.test(lastStepValue)) return false;
                                        const dueDate = new Date(due);
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        dueDate.setHours(0, 0, 0, 0);
                                        return dueDate < today;
                                    }).length}
                                </div>
                            </div>
                            <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                                <div className="text-xs text-slate-500">{t('stats.holdQn')}</div>
                                <div className="text-xl font-bold text-amber-700">
                                    {(() => {
                                        let count = 0;
                                        orders.forEach(o => {
                                            steps.forEach(step => {
                                                const val = String(o[step] || '').trim().toUpperCase();
                                                if (val === 'HOLD' || val === 'QN') count++;
                                            });
                                        });
                                        return count;
                                    })()}
                                </div>
                            </div>
                            <div className="bg-orange-50 rounded-lg border border-orange-200 p-3">
                                <div className="text-xs text-slate-500">{t('stats.dueToday')}</div>
                                <div className="text-xl font-bold text-orange-700">
                                    {displayedOrders.filter(o => {
                                        const due = o['WO DUE'];
                                        if (!due) return false;
                                        const dueDate = new Date(due);
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        dueDate.setHours(0, 0, 0, 0);
                                        return dueDate.getTime() === today.getTime();
                                    }).length}
                                </div>
                            </div>
                            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
                                <div className="text-xs text-slate-500">{t('stats.monthlyGoal')}</div>
                                <div className="text-xl font-bold text-blue-700">
                                    {(() => {
                                        const today = new Date();
                                        const currentMonth = today.getMonth();
                                        const currentYear = today.getFullYear();

                                        // Helper to get value case-insensitively
                                        const getStepValue = (o: any, stepName: string) => {
                                            if (o[stepName]) return o[stepName];
                                            const lower = stepName.toLowerCase();
                                            for (const key of Object.keys(o)) {
                                                if (key.toLowerCase() === lower) return o[key];
                                            }
                                            return '';
                                        };

                                        // Logic: The order is completed when the LAST step is finished (has a date)
                                        const receiptCol = steps.length > 0 ? steps[steps.length - 1] : '';

                                        let completed = 0;
                                        if (receiptCol) {
                                            completed = orders.filter(o => {
                                                const val = getStepValue(o, receiptCol);
                                                if (!val || val.toUpperCase() === 'N/A') return false;

                                                // Priority: Try our custom parser first (formats to Current Year), then fallback to native.
                                                // Now that we migrated data to YYYY-MM-DD, native parser works great too.
                                                // But keeping robustness is good.
                                                let d = parseShortTimestamp(val);
                                                if (!d) {
                                                    const native = new Date(val);
                                                    if (!isNaN(native.getTime())) {
                                                        d = native;
                                                    }
                                                }

                                                if (!d) return false;

                                                return d.getMonth() === currentMonth &&
                                                    d.getFullYear() === currentYear;
                                            }).length;
                                        }

                                        const target = (products.find(p => p.id === selectedProductId))?.monthlyTarget || 100;
                                        const percentage = Math.round((completed / target) * 100);

                                        if (editingTarget) {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl font-bold text-slate-900">{completed}</span>
                                                    <span className="text-sm text-slate-400">/</span>
                                                    <input
                                                        type="number"
                                                        value={tempTarget}
                                                        onChange={(e) => setTempTarget(e.target.value)}
                                                        className="w-20 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                                        autoFocus
                                                        onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
                                                    />
                                                    <div className="flex gap-1">
                                                        <button onClick={saveTarget} disabled={savingTarget} className="p-1 hover:bg-green-100 rounded text-green-600"><Check className="w-4 h-4" /></button>
                                                        <button onClick={() => setEditingTarget(false)} className="p-1 hover:bg-red-100 rounded text-red-500"><X className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="flex flex-col">
                                                <div className="flex items-baseline gap-2">
                                                    <span>{completed}</span>
                                                    <span
                                                        className={`text-xs font-normal text-slate-500 ${(role === 'admin' || role === 'supervisor') ? 'cursor-pointer hover:text-blue-600 hover:bg-blue-100 px-1 rounded transition-colors' : ''}`}
                                                        title={(role === 'admin' || role === 'supervisor') ? "Click to edit target" : ""}
                                                        onClick={() => {
                                                            if (role === 'admin' || role === 'supervisor') {
                                                                setTempTarget(target.toString());
                                                                setEditingTarget(true);
                                                            }
                                                        }}
                                                    >
                                                        / {target}
                                                    </span>
                                                    <span className={`text-xs ml-1 ${percentage >= 100 ? 'text-green-600' : 'text-slate-400'}`}>({percentage}%)</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>




                        {(() => {
                            // Use selectedProduct defined at component level or find it safely
                            const activeProd = products.find(p => p.id === selectedProductId);

                            // Empty State Handling
                            if (activeProd && steps.length === 0 && detailColumns.length === 0 && orders.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border-2 border-dashed border-slate-200 mx-4 mt-8">
                                        <div className="p-4 bg-slate-50 rounded-full mb-4">
                                            <Settings className="w-8 h-8 text-slate-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 mb-2">Setup Required</h3>
                                        <p className="text-slate-500 mb-6 text-center max-w-sm">
                                            This production line is empty. Please configure columns and steps in Settings to get started.
                                        </p>
                                        <button
                                            onClick={() => router.push('/dashboard/settings')}
                                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2"
                                        >
                                            <Settings className="w-4 h-4" />
                                            Go to Settings
                                        </button>
                                    </div>
                                );
                            }



                            const ordersToRender = displayedOrders.map(o => ({
                                ...o,
                                'ECD': calculateECD({
                                    order: o,
                                    steps,
                                    durations: activeProd?.stepDurations,
                                    includeSaturday: activeProd?.includeSaturday,
                                    includeSunday: activeProd?.includeSunday
                                })
                            })) as Order[];

                            return (
                                <>
                                    {/* Mobile Cards View */}
                                    <div className="md:hidden">
                                        <MobilePlannerCards
                                            orders={ordersToRender}
                                            steps={steps}
                                            onSetP={(woId, step) => handleBatchUpdate(woId, step, 'P')}
                                            onNavigate={handleNavigate}
                                        />
                                    </div>

                                    {/* Desktop Table View */}
                                    <div className="hidden md:block">
                                        {viewMode === 'board' && (
                                            <div className="flex-1 min-h-[600px] overflow-hidden bg-slate-100/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
                                                <KanbanBoard
                                                    orders={ordersToRender}
                                                    steps={steps}
                                                    selectedProductId={selectedProductId}
                                                    onStatusChange={handleStatusChange}
                                                    onOrderClick={handleNavigate}
                                                    stepQuantities={selectedProduct?.stepQuantities}
                                                />
                                            </div>
                                        )}
                                        <div className={viewMode === 'board' ? 'hidden' : 'block'}>
                                            <PlannerTable
                                                orders={ordersToRender}
                                                steps={steps}
                                                detailColumns={detailColumns}
                                                extraColumns={orders.length > 0 ? ['ECD'] : []}
                                                onNavigate={handleNavigate}

                                                // Batch Props
                                                activeBatchMode={activeBatchMode}
                                                onBatchUpdate={handleBatchUpdate}

                                                onBulkBatchUpdate={role !== 'user' ? (step, mode) => {
                                                    const targets = ordersToRender.filter(o => !o[step]);
                                                    if (targets.length === 0) {
                                                        alert('No empty cells to update in this column.');
                                                        return;
                                                    }
                                                    setBulkConfirmState({ isOpen: true, step, mode, count: targets.length, targets });
                                                } : undefined}

                                                highlightedWos={highlightedWos} // Pass highlighted WOs
                                                role={role}
                                                onUpdateDetail={async (woId, field, value) => {
                                                    try {
                                                        const res = await fetch('/api/orders/update-detail', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ woId, field, value, productId: selectedProductId })
                                                        });

                                                        if (res.ok) {
                                                            // Optimistic update
                                                            setOrders(prev => prev.map(o => {
                                                                if (o['WO ID'] === woId) {
                                                                    return { ...o, [field]: value };
                                                                }
                                                                return o;
                                                            }));
                                                        } else {
                                                            alert('Failed to update detail');
                                                            fetchOrders();
                                                        }
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert('Error updating detail');
                                                    }
                                                }}

                                                onDeleteOrder={handleDeleteOrder}
                                                fontSizeScale={fontSizeScale}
                                            />
                                        </div>
                                    </div>
                                </>
                            );
                        })()}

                        {/* Comment Modal */}
                        {commentModal && (
                            <StructuredCommentDialog
                                orderId={commentModal.orderId}
                                stepName={commentModal.step}
                                onClose={() => setCommentModal(null)}
                                onSubmit={async (data) => {
                                    try {
                                        const res = await fetch('/api/comments', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                orderId: data.orderId,
                                                stepName: data.stepName,
                                                category: data.category,
                                                content: data.note,
                                                structuredData: data.structuredData,
                                                triggeredStatus: data.triggeredStatus
                                            })
                                        });
                                        if (res.ok) {
                                            alert('Comment sent successfully');
                                            // Refresh orders to show updated status if triggered
                                            fetchOrders();
                                        } else {
                                            const err = await res.json();
                                            alert('Failed to send comment: ' + (err.error || 'Unknown error'));
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        alert('Error sending comment');
                                    }
                                }}
                            />
                        )}
                    </>
                )
                }

                {/* Footer Info Icon */}
                <div className="fixed bottom-4 left-4 z-50">
                    <div className="relative group">
                        <button className="p-1.5 text-slate-300 hover:text-indigo-400 hover:bg-slate-800/50 rounded-full transition-all cursor-help opacity-50 hover:opacity-100">
                            <Info className="w-3 h-3" />
                        </button>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-0 mb-2 w-auto min-w-[160px] bg-[#4e80ff] text-white text-[10px] p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 animate-in slide-in-from-bottom-2">
                            <div className="font-bold text-xs mb-1 whitespace-nowrap">iProTraX</div>
                            <div className="space-y-0.5 text-white/80">
                                <div className="flex justify-between gap-3"><span>Version:</span> <span>{APP_VERSION}</span></div>
                                <div className="flex justify-between gap-3"><span>License:</span> <span className={licenseInfo?.isValid ? 'text-green-300' : 'text-red-300'}>{licenseInfo?.type || 'Unknown'}</span></div>
                                {licenseInfo?.customerName && <div className="flex justify-between gap-3"><span>Customer:</span> <span className="truncate max-w-[100px]">{licenseInfo.customerName}</span></div>}
                                <div className="flex justify-between gap-3"><span>Expires:</span> <span className={licenseInfo?.isValid ? '' : 'text-red-300'}>{licenseInfo?.expiresAt ? new Date(licenseInfo.expiresAt).toLocaleDateString() : 'N/A'}</span></div>
                                {licenseInfo?.error && <div className="text-red-300 mt-1 text-[9px]">{licenseInfo.error}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bulk Confirmation Modal */}
            {
                bulkConfirmState.isOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{t('modals.confirmBulkAction')}</h3>
                            <p className="text-slate-600 mb-4">
                                {t('modals.bulkConfirmMessage', {
                                    count: bulkConfirmState.count,
                                    status: bulkConfirmState.mode === 'P' ? 'P' : bulkConfirmState.mode === 'Hold' ? 'Hold' : bulkConfirmState.mode === 'QN' ? 'QN' : bulkConfirmState.mode === 'WIP' ? 'WIP' : bulkConfirmState.mode === 'Complete' ? 'Complete (Today)' : 'N/A',
                                    step: bulkConfirmState.step
                                })}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setBulkConfirmState({ ...bulkConfirmState, isOpen: false })}
                                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        const { step, mode, targets } = bulkConfirmState;
                                        let status = 'N/A';
                                        if (mode === 'P') status = 'P';
                                        else if (mode === 'Hold') status = 'Hold';
                                        else if (mode === 'QN') status = 'QN';
                                        else if (mode === 'WIP') status = 'WIP';
                                        else if (mode === 'Complete') status = format(new Date(), 'dd-MMM, HH:mm');
                                        try {

                                            const updates = targets.map((o: any) => ({
                                                woId: o['WO ID'],
                                                step,
                                                status
                                            }));

                                            const res = await fetch('/api/orders/batch', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ updates, operatorId: 'admin', productId: selectedProductId })
                                            });

                                            if (res.ok) {
                                                await fetchOrders();
                                                setBulkConfirmState({ ...bulkConfirmState, isOpen: false });
                                            } else {
                                                alert('Batch update failed');
                                            }
                                        } catch (err) {
                                            console.error(err);
                                            alert('Batch update failed');
                                        }
                                    }}
                                    className={`flex-1 py-2 text-white rounded-lg font-medium ${bulkConfirmState.mode === 'P' ? 'bg-indigo-600 hover:bg-indigo-500' : bulkConfirmState.mode === 'Complete' ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-600 hover:bg-slate-500'}`}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Erase Mode Confirmation Modal */}
            {
                eraseConfirmOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
                            <h3 className="text-lg font-bold text-red-600 mb-2">{t('mobileMenu.eraseMode')}</h3>
                            <p className="text-slate-600 mb-4">
                                {t('modals.eraseModeDesc')}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEraseConfirmOpen(false)}
                                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveBatchMode('Erase');
                                        setEraseConfirmOpen(false);
                                    }}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {
                showLogsModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 max-w-5xl w-full mx-4 shadow-xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <History className="w-6 h-6 text-indigo-600" />
                                    {t('modals.operationLogs')}
                                </h3>
                                <div className="flex items-center gap-2">

                                    <button onClick={() => setShowLogsModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Notification */}

                            {loadingLogs ? (
                                <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                    <span>Loading history...</span>
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    No operation logs found
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">Time</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">Operator</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">WO ID</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">Step</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">Action</th>
                                                <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">Change</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {logs.map(log => (
                                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                                                        {new Date(log.timestamp).toLocaleString('en-US', {
                                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-indigo-600">{log.operatorId}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-900">{log.woId}</td>
                                                    <td className="px-4 py-3 truncate max-w-[150px] text-slate-600" title={log.step}>{log.step}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${log.action === 'Done' ? 'bg-green-50 text-green-700 border-green-100' :
                                                            log.action === 'WIP' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                                                log.action === 'P' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                    log.action === 'Reset' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                                                        'bg-slate-50 text-slate-600 border-slate-100'
                                                            }`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 text-sm">
                                                        {log.previousValue ? (
                                                            <span className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="line-through text-slate-400 text-xs">{log.previousValue}</span>
                                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                <span className="font-medium text-slate-900">{log.newValue || '-'}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="font-medium text-slate-900">{log.newValue || '-'}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Barcode Scanner Modal */}
            <BarcodeScanner
                isOpen={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={(code) => {
                    setSearchQuery(code);
                    // Find order matching barcode (check WO ID, PN, etc.)
                    const matchedOrder = orders.find(o =>
                        o['WO ID']?.includes(code) ||
                        o['PN']?.includes(code) ||
                        Object.values(o).some(v => typeof v === 'string' && v.includes(code))
                    );
                    if (matchedOrder) {
                        // Play beep sound
                        try {

                            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                            if (AudioContext) {
                                const ctx = new AudioContext();
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.frequency.value = 1000; // 1000Hz beep
                                osc.type = 'sine';
                                gain.gain.value = 0.1;
                                osc.start();
                                setTimeout(() => {
                                    osc.stop();
                                    ctx.close();
                                }, 150);
                            }
                        } catch (e) {
                            console.error('Audio play failed', e);
                        }

                        // Redirect to operation view
                        setScannerOpen(false);
                        router.push(`/dashboard/operation?wo=${matchedOrder['WO ID']}&product=${selectedProductId}`);
                    } else {
                        alert(`No order found for barcode: ${code}`);
                    }
                }}
            />

            {/* Draggable Menu (Mobile Only) */}
            <div className="md:hidden">
                <DraggableMenu
                    products={products}
                    selectedProductId={selectedProductId}
                    role={role}
                    onNavigate={(path) => router.push(path)}

                    activeBatchMode={activeBatchMode}
                    toggleBatchMode={toggleBatchMode}

                    onImport={() => {
                        if (!selectedProductId) { alert('Select a product line first'); return; }
                        document.getElementById('dashboard-import-input')?.click();
                    }}
                    onScan={() => setScannerOpen(true)}
                    onShowAnalytics={() => setShowAnalytics(true)}
                    onRefresh={fetchOrders}
                    onLogout={handleLogout}
                />
            </div>

            {/* Import Orders Modal */}
            {
                showImportModal && importPreview && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                    {t('modals.importOrders')}
                                </h3>
                                <button onClick={() => { setShowImportModal(false); setImportFile(null); }} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                        <div className="text-2xl font-bold text-green-700">{importPreview.newOrders}</div>
                                        <div className="text-xs text-green-600 font-medium uppercase tracking-wide">{t('modals.new')}</div>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                        <div className="text-2xl font-bold text-blue-700">{importPreview.existingOrders}</div>
                                        <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">{t('modals.skipped')}</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                        <div className="text-2xl font-bold text-slate-700">{importPreview.totalRows}</div>
                                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('modals.totalRows')}</div>
                                    </div>
                                </div>

                                {/* Missing Columns Warning */}
                                {importPreview.missingColumns && importPreview.missingColumns.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                        <div className="flex items-start gap-2">
                                            <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                                            <div>
                                                <div className="text-sm font-bold text-amber-800 mb-1">
                                                    ⚠️ {t('modals.missingColumns')}
                                                </div>
                                                <div className="text-xs text-amber-700 mb-2">
                                                    {t('modals.missingColumnsDesc')}
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {importPreview.missingColumns.map((col: string, i: number) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-medium border border-amber-200">
                                                            {col}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Success State if no missing columns and no errors */}
                                {(!importPreview.missingColumns || importPreview.missingColumns.length === 0) && (!importPreview.validationErrors || importPreview.validationErrors.length === 0) && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                                        <Check className="w-5 h-5 text-green-600" />
                                        <span className="text-sm text-green-700 font-medium">{t('modals.allColumnsFound')}</span>
                                    </div>
                                )}

                                {(importPreview.validationErrors?.length ?? 0) > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                                        <div className="text-xs font-bold text-red-800 mb-1">{t('modals.errorsFound')}</div>
                                        {importPreview.validationErrors?.map((err, i) => (
                                            <div key={i} className="text-xs text-red-600">Row {err.row}: {err.error}</div>
                                        ))}
                                    </div>
                                )}

                                {importMsg && (
                                    <div className={`p-3 rounded-lg text-sm ${importMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                        {importMsg.text}
                                    </div>
                                )}

                                <p className="text-sm text-slate-500 text-center">
                                    {t('modals.importingTo', { product: selectedProduct?.name ?? '' })}
                                    <br />{t('modals.existingWillBeSkipped')}
                                </p>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50">
                                <button
                                    onClick={() => { setShowImportModal(false); setImportFile(null); }}
                                    className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                                >
                                    {tCommon('cancel')}
                                </button>
                                <button
                                    onClick={confirmImport}
                                    disabled={isImporting || importPreview.newOrders === 0}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    {isImporting ? tCommon('loading') : t('modals.confirmImport')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {selectedProduct && orders.length > 0 && (
                <SmartSchedulerDialog
                    isOpen={showSmartScheduler}
                    onClose={() => setShowSmartScheduler(false)}
                    product={selectedProduct as any}
                    orders={orders}
                    onConfirm={handleSmartScheduleConfirm}
                    onResetAllP={handleResetAllP}
                />
            )}

            {/* AI Chat Panel */}
            <AIChatPanel
                productId={selectedProductId}
                role={role}
                onNavigate={(woId) => {
                    // Navigate to operation view for this order
                    if (selectedProductId) {
                        router.push(`/dashboard/operation?wo=${woId}&product=${selectedProductId}`);
                    }
                }}
            />

            {/* Footer with DateTime */}
            <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-slate-200 py-2 z-40">
                <div className="text-center text-xs text-slate-400 font-mono">
                    {currentDate}
                </div>
            </footer>
        </div>
    );
}
