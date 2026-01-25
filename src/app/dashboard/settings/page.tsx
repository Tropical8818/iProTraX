'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Table2, HardHat, Settings, LogOut, Save, FileSpreadsheet, Lock, Plus, Trash2, Edit2, X, ChevronUp, ChevronDown, Package, RefreshCw, Check, Eye, EyeOff, Clock, FilePlus, Info, User, Key, Users, Database, Download, Bot, Sparkles, Monitor, Play, Upload, Globe, Copy, ShieldCheck, BarChart2 } from 'lucide-react';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { APP_VERSION } from '@/lib/version';

import { Product, Config, WebhookConfig } from '@/lib/types/config';

function PasswordInput({
    label,
    value,
    onChange
}: {
    label: string,
    value: string,
    onChange: (val: string) => void
}) {
    const [visible, setVisible] = useState(false);
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <div className="relative">
                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono text-slate-800 pr-10"
                />
                <button
                    type="button"
                    onClick={() => setVisible(!visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
        </div>
    );
}



// Default new product template - start empty for user to define
const NEW_PRODUCT_TEMPLATE: Omit<Product, 'id'> = {
    name: 'New Product Line',
    excelPath: '',
    detailColumns: [],
    steps: [],
    monthlyTarget: 100,
    includeSaturday: false,
    includeSunday: false,
    aiVisibleColumns: [], // if empty, backward compatibility -> show all or none? 
    // Plan says: undefined/empty = show all (backward compat behavior to be handled in context.ts or explicit init here)
    // Let's assume undefined = show all. If user saves, we can init them.
    aiVisibleSteps: []
};

export default function SettingsPage() {
    const t = useTranslations('Settings');
    const tCommon = useTranslations('Common');
    const tDash = useTranslations('Dashboard');
    const router = useRouter();
    const [config, setConfig] = useState<Config>({ products: [], activeProductId: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // System Identity State (Enterprise)
    const [machineId, setMachineId] = useState<string>('');
    const [fingerprintHash, setFingerprintHash] = useState<string>('');
    const [copiedId, setCopiedId] = useState(false);

    // Product editing state
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [detecting, setDetecting] = useState(false);
    const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
    const [columnCategories, setColumnCategories] = useState<Record<string, 'detail' | 'step'>>({});
    const [showColumnsConfirm, setShowColumnsConfirm] = useState(false);

    // Manual column/step management
    const [newStepName, setNewStepName] = useState('');
    const [newDetailColumnName, setNewDetailColumnName] = useState('');

    // Inline column editing state
    const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);
    const [editingColumnValue, setEditingColumnValue] = useState('');
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
    const [editingStepValue, setEditingStepValue] = useState('');
    const [migrating, setMigrating] = useState(false);

    // Template creation state
    const [creatingTemplate, setCreatingTemplate] = useState(false);

    // Import preview state
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewData, setPreviewData] = useState<{ detectedHeaders?: string[] } | null>(null);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    // Current User State
    const [currentUser, setCurrentUser] = useState<{ id: string, username: string, role: string } | null>(null);
    const [currentPassword, setCurrentPass] = useState('');
    const [newPassword, setNewPass] = useState('');
    const [confirmNewPass, setConfirmNewPass] = useState('');
    const [passMsg, setPassMsg] = useState('');

    // AI Settings State
    const [aiApiKey, setAiApiKey] = useState('');
    const [aiApiKeyVisible, setAiApiKeyVisible] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
    const [savingAiKey, setSavingAiKey] = useState(false);

    // Split model lists
    const [cloudModels, setCloudModels] = useState<{ id: string }[]>([]);
    const [localModels, setLocalModels] = useState<{ id: string }[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    // Watcher state
    const [watcherLoading, setWatcherLoading] = useState(false);
    const [watcherRunning, setWatcherRunning] = useState(false);
    const [watcherPid, setWatcherPid] = useState<number | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<string>('');

    // Webhook State
    const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
    const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
    const [webhookTestStatus, setWebhookTestStatus] = useState<{ status: 'idle' | 'success' | 'error', message: string }>({ status: 'idle', message: '' });

    // Fetch Machine ID (Enterprise)
    useEffect(() => {
        const fetchSystemId = async () => {
            try {
                const res = await fetch('/api/system/id');
                if (res.ok) {
                    const data = await res.json();
                    setMachineId(data.machineId);
                    setFingerprintHash(data.fingerprintHash);
                }
            } catch (e) {
                // console.error('Failed to fetch system ID:', e);
            }
        };
        fetchSystemId();
    }, []);



    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/config');
                if (res.ok) {
                    const data = await res.json();
                    setConfig(data);
                    if (data.activeProductId) {
                        setSelectedProductId(data.activeProductId);
                    }
                    // Fetch both model lists initially
                    fetchModels();
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        const fetchUser = async () => {
            const res = await fetch('/api/auth');
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated) {
                    setCurrentUser({ id: data.id, username: data.username, role: data.role });
                }
            }
        };
        fetchConfig();
        fetchUser();
        fetchWatcherStatus(); // Check watcher status on mount
    }, []);

    // Auto-dismiss messages after 4 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const fetchModels = async (providerOverride?: string) => {
        setLoadingModels(true);
        try {
            // Fetch OpenAI Models
            if (!providerOverride || providerOverride === 'openai') {
                const resCloud = await fetch('/api/ai/models?provider=openai');
                if (resCloud.ok) {
                    const data = await resCloud.json();
                    setCloudModels(data.data || []);
                }
            }

            // Fetch Ollama Models
            if (!providerOverride || providerOverride === 'ollama') {
                const resLocal = await fetch('/api/ai/models?provider=ollama');
                if (resLocal.ok) {
                    const data = await resLocal.json();
                    setLocalModels(data.data || []);
                }
            }
        } catch (e) {
            console.error('Fetch models error:', e);
        } finally {
            setLoadingModels(false);
        }
    };

    // Fetch watcher status
    const fetchWatcherStatus = async () => {
        try {
            const res = await fetch('/api/watcher');
            if (res.ok) {
                const data = await res.json();
                setWatcherRunning(data.running);
                setWatcherPid(data.pid || null);
            }
        } catch (e) {
            console.error('Failed to fetch watcher status:', e);
        }
    };

    // Start watcher
    const startWatcher = async () => {
        setWatcherLoading(true);
        try {
            const res = await fetch('/api/watcher', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'File watcher started successfully!' });
                await fetchWatcherStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to start watcher' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to start watcher' });
        } finally {
            setWatcherLoading(false);
        }
    };

    // Stop watcher
    const stopWatcher = async () => {
        setWatcherLoading(true);
        try {
            const res = await fetch('/api/watcher', { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'File watcher stopped' });
                await fetchWatcherStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to stop watcher' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to stop watcher' });
        } finally {
            setWatcherLoading(false);
        }
    };


    const handleLogout = async () => {
        await fetch('/api/auth', { method: 'DELETE' });
        router.push('/login');
        router.refresh();
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully!' });
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to save settings.' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    const addPresetProduct = (preset: Omit<Product, 'id'>) => {
        if (config.license && config.products.length >= config.license.maxProductLines) {
            setMessage({ type: 'error', text: t('licenseLimitReached') });
            return;
        }

        const newId = `product_${Date.now()}`;
        const newProduct: Product = { id: newId, ...preset };
        const newProducts = [...config.products, newProduct];
        setConfig({
            ...config,
            products: newProducts,
            activeProductId: config.activeProductId || newId
        });
        setEditingProduct(newProduct);
    };

    const addCustomProduct = () => {
        if (config.license && config.products.length >= config.license.maxProductLines) {
            setMessage({ type: 'error', text: t('licenseLimitReached') });
            return;
        }

        const newId = `product_${Date.now()}`;
        const newProduct: Product = { id: newId, ...NEW_PRODUCT_TEMPLATE };
        const newProducts = [...config.products, newProduct];
        setConfig({
            ...config,
            products: newProducts,
            activeProductId: config.activeProductId || newId
        });
        setEditingProduct(newProduct);
    };

    // Manual column management functions
    const addManualDetailColumn = () => {
        if (!editingProduct || !newDetailColumnName.trim()) return;
        const colName = newDetailColumnName.trim();
        if (editingProduct.detailColumns.includes(colName)) {
            setMessage({ type: 'error', text: 'Detail column already exists!' });
            return;
        }
        const updated = {
            ...editingProduct,
            detailColumns: [...editingProduct.detailColumns, colName]
        };
        setEditingProduct(updated);
        updateProduct(updated);
        setNewDetailColumnName('');
    };

    const deleteDetailColumn = (colName: string) => {
        if (!editingProduct) return;
        const updated = {
            ...editingProduct,
            detailColumns: editingProduct.detailColumns.filter(c => c !== colName)
        };
        setEditingProduct(updated);
        updateProduct(updated);
    };

    const moveDetailColumn = (index: number, direction: 'up' | 'down') => {
        if (!editingProduct) return;
        const newCols = [...editingProduct.detailColumns];
        if (direction === 'up' && index > 0) {
            [newCols[index], newCols[index - 1]] = [newCols[index - 1], newCols[index]];
        } else if (direction === 'down' && index < newCols.length - 1) {
            [newCols[index], newCols[index + 1]] = [newCols[index + 1], newCols[index]];
        }
        const updated = { ...editingProduct, detailColumns: newCols };
        setEditingProduct(updated);
        updateProduct(updated);
    };

    // Inline rename column with data migration
    const renameAndMigrateColumn = async (index: number, oldName: string, newName: string) => {
        if (!editingProduct || !oldName || !newName || oldName === newName) {
            setEditingColumnIndex(null);
            return;
        }

        setMigrating(true);
        try {
            // 1. Call API to migrate data
            const res = await fetch('/api/migrate-columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: editingProduct.id,
                    oldColumnName: oldName,
                    newColumnName: newName
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Migration failed');
            }

            // 2. Update detailColumns
            const newCols = [...editingProduct.detailColumns];
            newCols[index] = newName;
            const updated = { ...editingProduct, detailColumns: newCols };

            setEditingProduct(updated);
            updateProduct(updated);

            setMessage({
                type: 'success',
                text: `✓ "${oldName}" → "${newName}" (${data.migratedOrders} orders migrated)`
            });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Migration failed'
            });
        } finally {
            setMigrating(false);
            setEditingColumnIndex(null);
            setEditingColumnValue('');
        }
    };

    // Inline rename Step with data migration
    const renameAndMigrateStep = async (index: number, oldName: string, newName: string) => {
        if (!editingProduct || !oldName || !newName || oldName === newName) {
            setEditingStepIndex(null);
            return;
        }

        // Prevent duplicate step names
        if (editingProduct.steps.includes(newName)) {
            setMessage({ type: 'error', text: 'Step name already exists!' });
            return;
        }

        setMigrating(true);
        try {
            // 1. Call API to migrate data (same API works for any key in JSON data)
            const res = await fetch('/api/migrate-columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: editingProduct.id,
                    oldColumnName: oldName,
                    newColumnName: newName
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Migration failed');
            }

            // 2. Update steps array
            const newSteps = [...editingProduct.steps];
            newSteps[index] = newName;

            // 3. Update stepDurations keys
            const newDurations = { ...editingProduct.stepDurations };
            if (newDurations[oldName] !== undefined) {
                newDurations[newName] = newDurations[oldName];
                delete newDurations[oldName];
            }

            // 4. Update stepUnits keys (if exists)
            const newUnits = { ...editingProduct.stepUnits };
            if (newUnits && newUnits[oldName] !== undefined) {
                newUnits[newName] = newUnits[oldName];
                delete newUnits[oldName];
            }

            const updated = {
                ...editingProduct,
                steps: newSteps,
                stepDurations: newDurations,
                stepUnits: newUnits
            };

            setEditingProduct(updated);
            updateProduct(updated);

            setMessage({
                type: 'success',
                text: `✓ Step "${oldName}" → "${newName}" (${data.migratedOrders} orders migrated)`
            });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Migration failed'
            });
        } finally {
            setMigrating(false);
            setEditingStepIndex(null);
            setEditingStepValue('');
        }
    };

    // Manual step management functions
    const addManualStep = () => {
        if (!editingProduct || !newStepName.trim()) return;
        const stepName = newStepName.trim();
        if (editingProduct.steps.includes(stepName)) {
            setMessage({ type: 'error', text: 'Step already exists!' });
            return;
        }
        const updated = {
            ...editingProduct,
            steps: [...editingProduct.steps, stepName],
            stepDurations: { ...editingProduct.stepDurations, [stepName]: 0 }
        };
        setEditingProduct(updated);
        updateProduct(updated);
        setNewStepName('');
    };

    const deleteStep = (stepName: string) => {
        if (!editingProduct) return;
        const newDurations = { ...editingProduct.stepDurations };
        delete newDurations[stepName];
        const updated = {
            ...editingProduct,
            steps: editingProduct.steps.filter(s => s !== stepName),
            stepDurations: newDurations
        };
        setEditingProduct(updated);
        updateProduct(updated);
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        if (!editingProduct) return;
        const newSteps = [...editingProduct.steps];
        if (direction === 'up' && index > 0) {
            [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
        } else if (direction === 'down' && index < newSteps.length - 1) {
            [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
        }
        const updated = { ...editingProduct, steps: newSteps };
        setEditingProduct(updated);
        updateProduct(updated);
    };

    const deleteProduct = (productId: string) => {
        if (config.products.length <= 1) {
            setMessage({ type: 'error', text: 'Cannot delete the last product.' });
            return;
        }
        const newProducts = config.products.filter(p => p.id !== productId);
        const newActiveId = config.activeProductId === productId ? newProducts[0].id : config.activeProductId;
        setConfig({ ...config, products: newProducts, activeProductId: newActiveId });
        if (editingProduct?.id === productId) {
            setEditingProduct(null);
        }
    };

    const updateProduct = (updatedProduct: Product) => {
        setConfig({
            ...config,
            products: config.products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
        });
    };

    const moveColumn = (index: number, direction: 'up' | 'down') => {
        const newCols = [...detectedColumns];
        if (direction === 'up' && index > 0) {
            [newCols[index], newCols[index - 1]] = [newCols[index - 1], newCols[index]];
        } else if (direction === 'down' && index < newCols.length - 1) {
            [newCols[index], newCols[index + 1]] = [newCols[index + 1], newCols[index]];
        }
        setDetectedColumns(newCols);
    };


    const confirmDetectedColumns = () => {
        if (!editingProduct) return;
        const details = detectedColumns.filter(col => columnCategories[col] === 'detail');
        const steps = detectedColumns.filter(col => columnCategories[col] === 'step');
        const updated = { ...editingProduct, detailColumns: details, steps: steps };
        setEditingProduct(updated);
        updateProduct(updated);
        setShowColumnsConfirm(false);
        setDetectedColumns([]);
        setColumnCategories({});
        setMessage({ type: 'success', text: `${details.length} detail columns + ${steps.length} step columns imported!` });
    };

    const isAdmin = currentUser?.role === 'admin';
    const isSupervisor = currentUser?.role === 'supervisor';

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
                <div className="max-w-full mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
                        title="Return to Home"
                    >
                        <img src="/logo.png" alt="iProTraX" className="h-9 w-auto" />
                    </button>

                    <nav className="flex items-center gap-2">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"
                        >
                            <Table2 className="w-4 h-4" />
                            <span className="hidden sm:inline">{tDash('home')}</span>
                        </button>

                        <button
                            onClick={() => router.push('/dashboard/operation')}
                            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"
                        >
                            <HardHat className="w-4 h-4" />
                            <span className="hidden sm:inline">{tDash('operation')}</span>
                        </button>

                        {(isAdmin || isSupervisor) && (
                            <button
                                onClick={() => {
                                    if (!selectedProductId && config.activeProductId) {
                                        setSelectedProductId(config.activeProductId);
                                    }
                                    setShowAnalytics(!showAnalytics);
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showAnalytics
                                    ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                title={tDash('reports')}
                            >
                                <BarChart2 className="w-4 h-4" />
                                <span className="hidden sm:inline">{tDash('reports')}</span>
                            </button>
                        )}

                        <button className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">{tDash('settings')}</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </nav>
                </div>
            </header>

            {/* Analytics Dashboard (Modal) */}
            <AnalyticsDashboard
                isOpen={showAnalytics}
                onClose={() => setShowAnalytics(false)}
                productId={selectedProductId || config.activeProductId}
            />

            {/* Main Content */}
            <main className="p-4 max-w-4xl mx-auto pb-24">
                {loading ? (
                    <div className="text-center py-10 text-slate-400">Loading...</div>
                ) : (

                    <div className="max-w-4xl mx-auto space-y-6">
                        {isAdmin && (
                            <div className="space-y-6">

                                {/* Products Section */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                            <Package className="w-5 h-5 text-indigo-600" />
                                            {t('productLines')}
                                        </h2>
                                    </div>

                                    {/* Add Products Section */}
                                    <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex justify-between items-center mb-3">
                                            <p className="text-sm text-slate-700 font-medium">{t('addProductLine')}:</p>
                                            {config.license && (
                                                <span className={`text-xs px-2 py-1 rounded font-medium ${config.products.length >= config.license.maxProductLines ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {config.products.length} / {config.license.maxProductLines} {t('linesUsed')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={addCustomProduct}
                                                disabled={config.license ? config.products.length >= config.license.maxProductLines : false}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={config.license && config.products.length >= config.license.maxProductLines ? t('licenseLimitReached') : ''}
                                            >
                                                <Plus className="w-4 h-4" />
                                                {t('addNewProductionLine')}
                                            </button>
                                        </div>
                                        {config.license && config.products.length >= config.license.maxProductLines && (
                                            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                {t('upgradeLicenseForMore')}
                                            </p>
                                        )}
                                    </div>

                                    {/* Product List */}
                                    <div className="space-y-3">
                                        {config.products.map(product => (
                                            <div
                                                key={product.id}
                                                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${editingProduct?.id === product.id
                                                    ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                                                    : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">

                                                    <div>
                                                        <div className="font-semibold text-slate-900">{product.name}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                            <span className={`px-1.5 py-0.5 rounded ${product.steps.length > 0 ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
                                                                {product.steps.length > 0 ? `${product.steps.length} ${t('steps')}` : t('noSteps')}
                                                            </span>
                                                            {product.excelPath && (
                                                                <span className="truncate max-w-[200px]" title={product.excelPath}>
                                                                    • {product.excelPath.split('/').pop()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setEditingProduct(editingProduct?.id === product.id ? null : product)}
                                                        className={`p-2 rounded-lg transition-colors ${editingProduct?.id === product.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-indigo-600'}`}
                                                        title={tCommon('edit')}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteProduct(product.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={tCommon('delete')}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Product Editor */}
                                    {editingProduct && (
                                        <div className="mt-6 p-6 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="font-semibold text-slate-900 text-lg">{t('configureProduct')}</h3>
                                                <button onClick={() => setEditingProduct(null)} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>

                                            {/* Product Name (Editable) */}
                                            <div className="mb-6">
                                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                    {t('productLineName')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editingProduct.name}
                                                    onChange={(e) => {
                                                        const updated = { ...editingProduct, name: e.target.value };
                                                        setEditingProduct(updated);
                                                        updateProduct(updated);
                                                    }}
                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-black font-medium transition-shadow shadow-sm"
                                                    placeholder={t('enterProductLineName')}
                                                />
                                            </div>

                                            {/* Excel File Upload with Auto-Detect */}
                                            <div className="mb-6">
                                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                    <FileSpreadsheet className="w-4 h-4 inline mr-1.5" />
                                                    {t('uploadExcelFile')}
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="file"
                                                        accept=".xlsx,.xls"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file || !editingProduct) return;

                                                            setDetecting(true);
                                                            setMessage(null);

                                                            try {
                                                                // Call preview API
                                                                const formData = new FormData();
                                                                formData.append('file', file);
                                                                formData.append('productId', editingProduct.id);

                                                                const res = await fetch('/api/import-excel/preview', {
                                                                    method: 'POST',
                                                                    body: formData
                                                                });

                                                                if (res.ok) {
                                                                    const data = await res.json();
                                                                    setPreviewData(data);
                                                                    setPreviewFile(file);
                                                                    setShowPreviewModal(true);
                                                                } else {
                                                                    const err = await res.json();
                                                                    setMessage({ type: 'error', text: err.error || 'Failed to preview Excel file.' });
                                                                }
                                                            } catch (err) {
                                                                console.error('Excel preview error:', err);
                                                                setMessage({ type: 'error', text: 'Failed to process Excel file.' });
                                                            } finally {
                                                                setDetecting(false);
                                                                // Reset file input
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm text-slate-800 shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                                        disabled={detecting}
                                                    />
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">
                                                    {t('excelUploadHelp')}
                                                </p>

                                                {/* Excel Template Management */}
                                                {(editingProduct.steps.length > 0 || editingProduct.detailColumns.length > 0) && (
                                                    <div className={`mt-4 p-4 rounded-xl border shadow-sm ${editingProduct.excelPath ? 'bg-indigo-50 border-indigo-200' : 'bg-green-50 border-green-200'}`}>
                                                        <div className="mb-4">
                                                            <p className={`text-sm font-medium mb-2 ${editingProduct.excelPath ? 'text-indigo-800' : 'text-green-800'}`}>
                                                                {editingProduct.excelPath ? t('templateExists') || 'Excel Template Ready' : t('detailStepsDefined', { countDetails: editingProduct.detailColumns.length, countSteps: editingProduct.steps.length })}
                                                            </p>
                                                            {editingProduct.excelPath && (
                                                                <div className="p-2 bg-white/50 rounded-lg border border-indigo-100/50 flex items-start gap-2.5">
                                                                    <FileSpreadsheet className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-[11px] text-indigo-600 font-mono break-all line-clamp-2" title={editingProduct.excelPath}>
                                                                            {editingProduct.excelPath.split('/').pop()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col sm:flex-row gap-2">
                                                            <button
                                                                onClick={async () => {
                                                                    setCreatingTemplate(true);
                                                                    try {
                                                                        // Always trigger creation first to ensure it matches current DB config
                                                                        const res = await fetch('/api/create-template', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ productId: editingProduct.id })
                                                                        });
                                                                        const data = await res.json();
                                                                        if (res.ok) {
                                                                            // Update state
                                                                            const updated = { ...editingProduct, excelPath: data.path };
                                                                            setEditingProduct(updated);

                                                                            // Trigger download
                                                                            const filename = data.path.split('/').pop() || 'template.xlsx';
                                                                            window.open(`/api/download?path=${encodeURIComponent(data.path)}&name=${encodeURIComponent(filename)}`);

                                                                            setMessage({ type: 'success', text: `Excel template updated and downloaded` });

                                                                            // Refresh config for background sync
                                                                            const configRes = await fetch('/api/config');
                                                                            if (configRes.ok) {
                                                                                setConfig(await configRes.json());
                                                                            }
                                                                        } else {
                                                                            setMessage({ type: 'error', text: data.error || 'Failed to prepare template' });
                                                                        }
                                                                    } catch (err) {
                                                                        setMessage({ type: 'error', text: 'Failed to prepare template' });
                                                                    } finally {
                                                                        setCreatingTemplate(false);
                                                                    }
                                                                }}
                                                                disabled={creatingTemplate}
                                                                className={`w-full px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] ${editingProduct.excelPath
                                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                                                                    : 'bg-green-600 text-white hover:bg-green-500'
                                                                    }`}
                                                            >
                                                                {creatingTemplate ? (
                                                                    <>
                                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                                        <span>{t('creating') || 'Preparing...'}</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {editingProduct.excelPath ? <Download className="w-4 h-4" /> : <FilePlus className="w-4 h-4" />}
                                                                        <span>{editingProduct.excelPath ? t('downloadTemplate') || 'Download Template' : t('createExcelTemplateFile')}</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>





                                            <div className="mb-6">
                                                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                    <Bot className="w-4 h-4 text-indigo-600" />
                                                    {t('aiAssistantSettings')}
                                                </h4>
                                                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between">
                                                        <span>{t('aiModel')}</span>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); fetchModels(); }}
                                                            className="text-indigo-600 text-xs hover:underline flex items-center gap-1"
                                                        >
                                                            <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                                                            {t('refreshList')}
                                                        </button>
                                                    </label>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        {/* Cloud Models */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{t('cloudOpenAI')}</h5>
                                                                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{cloudModels.length}</span>
                                                            </div>
                                                            <div className="h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white p-1 space-y-1">
                                                                {cloudModels.length > 0 ? cloudModels.map(model => (
                                                                    <button
                                                                        key={model.id}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            const updated = { ...editingProduct, aiModel: model.id, aiProvider: 'openai' as const };
                                                                            setEditingProduct(updated);
                                                                            updateProduct(updated);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 text-xs rounded-md transition-all flex items-center justify-between ${editingProduct.aiModel === model.id && editingProduct.aiProvider !== 'ollama' // Default to openai if undefined
                                                                            ? 'bg-indigo-50 text-indigo-700 font-medium ring-1 ring-indigo-200'
                                                                            : 'text-slate-600 hover:bg-slate-50'
                                                                            }`}
                                                                    >
                                                                        <span className="truncate">{model.id}</span>
                                                                        {(editingProduct.aiModel === model.id && editingProduct.aiProvider !== 'ollama') && <Check className="w-3 h-3 text-indigo-600 flex-shrink-0 ml-2" />}
                                                                    </button>
                                                                )) : (
                                                                    <div className="p-3 text-center text-xs text-slate-400 italic">{t('noCloudModelsFound')}</div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Local Models */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{t('localOllama')}</h5>
                                                                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{localModels.length}</span>
                                                            </div>
                                                            <div className="h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white p-1 space-y-1">
                                                                {localModels.length > 0 ? localModels.map(model => (
                                                                    <button
                                                                        key={model.id}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            const updated = { ...editingProduct, aiModel: model.id, aiProvider: 'ollama' as const };
                                                                            setEditingProduct(updated);
                                                                            updateProduct(updated);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 text-xs rounded-md transition-all flex items-center justify-between ${editingProduct.aiModel === model.id && editingProduct.aiProvider === 'ollama'
                                                                            ? 'bg-indigo-50 text-indigo-700 font-medium ring-1 ring-indigo-200'
                                                                            : 'text-slate-600 hover:bg-slate-50'
                                                                            }`}
                                                                    >
                                                                        <span className="truncate">{model.id}</span>
                                                                        {editingProduct.aiModel === model.id && editingProduct.aiProvider === 'ollama' && <Check className="w-3 h-3 text-indigo-600 flex-shrink-0 ml-2" />}
                                                                    </button>
                                                                )) : (
                                                                    <div className="p-3 text-center text-xs text-slate-400 italic">{t('noLocalModelsFound')}</div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* DeepSeek Models (China) */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">DeepSeek</h5>
                                                            </div>
                                                            <div className="h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white p-1 space-y-1">
                                                                {config.deepseekApiKey ? (
                                                                    <>
                                                                        {['deepseek-chat', 'deepseek-reasoner'].map(modelId => (
                                                                            <button
                                                                                key={modelId}
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    const updated = { ...editingProduct, aiModel: modelId, aiProvider: 'deepseek' as const };
                                                                                    setEditingProduct(updated);
                                                                                    updateProduct(updated);
                                                                                }}
                                                                                className={`w-full text-left px-3 py-2 text-xs rounded-md transition-all flex items-center justify-between ${editingProduct.aiModel === modelId && editingProduct.aiProvider === 'deepseek'
                                                                                    ? 'bg-indigo-50 text-indigo-700 font-medium ring-1 ring-indigo-200'
                                                                                    : 'text-slate-600 hover:bg-slate-50'
                                                                                    }`}
                                                                            >
                                                                                <span className="truncate">{modelId}</span>
                                                                                {editingProduct.aiModel === modelId && editingProduct.aiProvider === 'deepseek' && <Check className="w-3 h-3 text-indigo-600 flex-shrink-0 ml-2" />}
                                                                            </button>
                                                                        ))}
                                                                    </>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs p-4 text-center">
                                                                        <Key className="w-5 h-5 mb-2 opacity-50" />
                                                                        <p>{t('deepseekApiKeyRequired')}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-2 mb-4">
                                                        {t('aiModelSelectionHelp', {
                                                            provider: config.aiProvider === 'ollama'
                                                                ? t('localOllamaInstance')
                                                                : t('openAIModels')
                                                        })}
                                                    </p>

                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                        {t('productKnowledgeInstructions')}
                                                    </label>
                                                    <textarea
                                                        value={editingProduct.customInstructions || ''}
                                                        onChange={(e) => {
                                                            const updated = { ...editingProduct, customInstructions: e.target.value };
                                                            setEditingProduct(updated);
                                                            updateProduct(updated);
                                                        }}
                                                        placeholder={t('customInstructionsPlaceholder')}
                                                        className="w-full px-4 py-2.5 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-medium bg-white shadow-sm min-h-[100px] text-slate-900"
                                                    />
                                                    <p className="text-xs text-slate-500 mt-2">
                                                        {t('customInstructionsHelp')}
                                                    </p>

                                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                                Context Order Limit
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={editingProduct.aiContextLimit || 60}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value) || 60;
                                                                    const updated = { ...editingProduct, aiContextLimit: val };
                                                                    setEditingProduct(updated);
                                                                    updateProduct(updated);
                                                                }}
                                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-900"
                                                            />
                                                            <p className="text-xs text-slate-500 mt-1">Default: 60 orders</p>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                                Max Response Tokens
                                                            </label>
                                                            <input
                                                                type="number"
                                                                value={editingProduct.aiMaxTokens || 4000}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value) || 4000;
                                                                    const updated = { ...editingProduct, aiMaxTokens: val };
                                                                    setEditingProduct(updated);
                                                                    updateProduct(updated);
                                                                }}
                                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-900"
                                                            />
                                                            <p className="text-xs text-slate-500 mt-1">Default: 4000 tokens</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-6">
                                                <h4 className="text-sm font-bold text-slate-900 mb-3">{t('ecdCalculationSettings')}</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                                        <div>
                                                            <p className="font-medium text-slate-900 text-sm">{t('includeSaturday')}</p>
                                                            <p className="text-xs text-slate-500">{editingProduct.includeSaturday ? t('included') : t('excluded')}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const updated = { ...editingProduct, includeSaturday: !editingProduct.includeSaturday };
                                                                setEditingProduct(updated);
                                                                updateProduct(updated);
                                                            }}
                                                            className={`relative w-10 h-6 rounded-full transition-colors ${editingProduct.includeSaturday ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                        >
                                                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editingProduct.includeSaturday ? 'left-5' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                                        <div>
                                                            <p className="font-medium text-slate-900 text-sm">{t('includeSunday')}</p>
                                                            <p className="text-xs text-slate-500">{editingProduct.includeSunday ? t('included') : t('excluded')}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const updated = { ...editingProduct, includeSunday: !editingProduct.includeSunday };
                                                                setEditingProduct(updated);
                                                                updateProduct(updated);
                                                            }}
                                                            className={`relative w-10 h-6 rounded-full transition-colors ${editingProduct.includeSunday ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                        >
                                                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editingProduct.includeSunday ? 'left-5' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Shift Configuration */}
                                            <div className="mb-6">
                                                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-indigo-600" />
                                                    {t('shiftConfiguration')}
                                                </h4>

                                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                                    <p className="text-sm text-slate-500 mb-4">{t('shiftHelp')}</p>

                                                    <div className="space-y-3">
                                                        {(editingProduct.shifts || []).map((shift, index) => (
                                                            <div key={index} className="flex gap-2 items-center">
                                                                <input
                                                                    value={shift.name}
                                                                    onChange={(e) => {
                                                                        const shifts = [...(editingProduct.shifts || [])];
                                                                        shifts[index] = { ...shifts[index], name: e.target.value };
                                                                        const updated = { ...editingProduct, shifts };
                                                                        setEditingProduct(updated);
                                                                        updateProduct(updated);
                                                                    }}
                                                                    placeholder={t('shiftName')}
                                                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-900"
                                                                />
                                                                <input
                                                                    type="time"
                                                                    value={shift.start}
                                                                    onChange={(e) => {
                                                                        const shifts = [...(editingProduct.shifts || [])];
                                                                        shifts[index] = { ...shifts[index], start: e.target.value };
                                                                        const updated = { ...editingProduct, shifts };
                                                                        setEditingProduct(updated);
                                                                        updateProduct(updated);
                                                                    }}
                                                                    className="w-24 px-2 py-2 border border-slate-200 rounded-md text-sm text-slate-900"
                                                                />
                                                                <span className="text-slate-400">-</span>
                                                                <input
                                                                    type="time"
                                                                    value={shift.end}
                                                                    onChange={(e) => {
                                                                        const shifts = [...(editingProduct.shifts || [])];
                                                                        shifts[index] = { ...shifts[index], end: e.target.value };
                                                                        const updated = { ...editingProduct, shifts };
                                                                        setEditingProduct(updated);
                                                                        updateProduct(updated);
                                                                    }}
                                                                    className="w-24 px-2 py-2 border border-slate-200 rounded-md text-sm text-slate-900"
                                                                />
                                                                <button
                                                                    onClick={() => {
                                                                        const shifts = editingProduct.shifts?.filter((_, i) => i !== index);
                                                                        const updated = { ...editingProduct, shifts };
                                                                        setEditingProduct(updated);
                                                                        updateProduct(updated);
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <button
                                                        onClick={() => {
                                                            const newShift = { name: `Shift ${(editingProduct.shifts?.length || 0) + 1}`, start: '08:00', end: '16:00' };
                                                            const updated = { ...editingProduct, shifts: [...(editingProduct.shifts || []), newShift] };
                                                            setEditingProduct(updated);
                                                            updateProduct(updated);
                                                        }}
                                                        className="mt-3 text-sm text-indigo-600 font-medium flex items-center gap-1 hover:text-indigo-700"
                                                    >
                                                        <Plus className="w-4 h-4" /> {t('addShift')}
                                                    </button>

                                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
                                                        <label className="text-sm font-medium text-slate-700">
                                                            {t('overtimeThreshold')}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={editingProduct.overtimeThreshold !== undefined ? editingProduct.overtimeThreshold : 30}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                const updated = { ...editingProduct, overtimeThreshold: val };
                                                                setEditingProduct(updated);
                                                                updateProduct(updated);
                                                            }}
                                                            className="w-20 px-3 py-1.5 border border-slate-200 rounded-md text-sm text-slate-900"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Auto-Import Watch Folder */}
                                            <div className="mb-6">
                                                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                    <RefreshCw className="w-4 h-4 text-green-600" />
                                                    {t('automaticExcelImport')}
                                                </h4>
                                                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                        {t('watchFolderPath')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editingProduct.watchFolder || ''}
                                                        onChange={(e) => {
                                                            const updated = { ...editingProduct, watchFolder: e.target.value };
                                                            setEditingProduct(updated);
                                                            updateProduct(updated);
                                                        }}
                                                        placeholder={t('watchFolderPlaceholder')}
                                                        className="w-full px-4 py-2.5 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 text-sm text-slate-800 font-mono bg-white shadow-sm"
                                                    />
                                                    <p className="text-xs text-green-700 mt-2 mb-3">
                                                        {t('watchFolderHelp')}
                                                    </p>

                                                    {/* Watcher Status and Controls */}
                                                    <div className="mt-4 p-4 bg-white rounded-lg border border-green-200 shadow-sm">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2.5 h-2.5 rounded-full ${watcherRunning ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                                                                    <span className="text-sm font-medium text-slate-700">
                                                                        {t('status')}: {watcherRunning ? t('running') : t('stopped')}
                                                                    </span>
                                                                </div>
                                                                {watcherPid && (
                                                                    <span className="text-xs text-slate-500 font-mono">PID: {watcherPid}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={fetchWatcherStatus}
                                                                    disabled={watcherLoading}
                                                                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title={t('refreshStatus')}
                                                                >
                                                                    <RefreshCw className={`w-4 h-4 ${watcherLoading ? 'animate-spin' : ''}`} />
                                                                </button>
                                                                {watcherRunning ? (
                                                                    <button
                                                                        onClick={stopWatcher}
                                                                        disabled={watcherLoading}
                                                                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                        {t('stopWatcher')}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={startWatcher}
                                                                        disabled={watcherLoading || !editingProduct?.watchFolder}
                                                                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all"
                                                                        title={!editingProduct?.watchFolder ? t('setWatchFolderPathFirst') : ''}
                                                                    >
                                                                        <Play className="w-4 h-4" />
                                                                        {t('startWatcher')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-200">
                                                {/* Detail Columns Management */}
                                                <div className="md:col-span-1">
                                                    <label className="block text-sm font-bold text-slate-900 mb-2">
                                                        {t('detailColumns')}
                                                    </label>
                                                    <p className="text-xs text-slate-500 mb-3">
                                                        {t('detailColumnsHelp')}
                                                        <span className="block mt-1 text-[10px] text-slate-400">
                                                            <Eye className="w-3 h-3 inline mr-1 text-green-600" />{t('visibleToAI')} | <EyeOff className="w-3 h-3 inline mr-1 text-slate-400" />{t('hidden')}
                                                        </span>
                                                    </p>

                                                    {/* Add Detail Column Input */}
                                                    <div className="flex gap-2 mb-2">
                                                        <input
                                                            type="text"
                                                            value={newDetailColumnName}
                                                            onChange={(e) => setNewDetailColumnName(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && addManualDetailColumn()}
                                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm text-black font-medium"
                                                            placeholder={t('columnNamePlaceholder')}
                                                        />
                                                        <button
                                                            onClick={addManualDetailColumn}
                                                            disabled={!newDetailColumnName.trim()}
                                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {/* Detail Columns List - Double-click to rename */}
                                                    <p className="text-[10px] text-amber-600 mb-2">💡 {t('doubleClickToRename') || 'Double-click column name to rename (data will be migrated)'}</p>
                                                    <div className="bg-white border border-slate-200 rounded-lg p-1 min-h-[100px] max-h-[400px] overflow-y-auto space-y-1">
                                                        {editingProduct.detailColumns.map((col, index) => (
                                                            <div key={`${col}-${index}`} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-md group hover:bg-blue-100 transition-colors">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <button onClick={() => moveDetailColumn(index, 'up')} disabled={index === 0} className="text-blue-500 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed"><ChevronUp className="w-4 h-4" /></button>
                                                                    <button onClick={() => moveDetailColumn(index, 'down')} disabled={index === editingProduct.detailColumns.length - 1} className="text-blue-500 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed"><ChevronDown className="w-4 h-4" /></button>
                                                                </div>
                                                                <span className="text-xs font-mono text-blue-500 w-5 text-center">{index + 1}</span>

                                                                {/* Editable column name */}
                                                                {editingColumnIndex === index ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editingColumnValue}
                                                                        onChange={(e) => setEditingColumnValue(e.target.value)}
                                                                        onBlur={() => {
                                                                            if (editingColumnValue.trim() && editingColumnValue !== col) {
                                                                                renameAndMigrateColumn(index, col, editingColumnValue.trim());
                                                                            } else {
                                                                                setEditingColumnIndex(null);
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                if (editingColumnValue.trim() && editingColumnValue !== col) {
                                                                                    renameAndMigrateColumn(index, col, editingColumnValue.trim());
                                                                                } else {
                                                                                    setEditingColumnIndex(null);
                                                                                }
                                                                            } else if (e.key === 'Escape') {
                                                                                setEditingColumnIndex(null);
                                                                            }
                                                                        }}
                                                                        autoFocus
                                                                        disabled={migrating}
                                                                        className="flex-1 px-2 py-1 text-sm font-medium text-slate-900 border border-blue-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className="flex-1 text-sm font-medium text-slate-700 truncate cursor-pointer hover:text-blue-600"
                                                                        onDoubleClick={() => {
                                                                            setEditingColumnIndex(index);
                                                                            setEditingColumnValue(col);
                                                                        }}
                                                                        title={t('doubleClickToRename') || 'Double-click to rename'}
                                                                    >
                                                                        {col}
                                                                    </div>
                                                                )}

                                                                {/* AI Visibility Toggle */}
                                                                <button
                                                                    onClick={() => {
                                                                        const currentVisible = editingProduct.aiVisibleColumns || [];
                                                                        // If currently undefined, it means ALL are visible (implicit). So initializing means we must be careful.
                                                                        // Actually, if we want to "Hide" this one, we should add ALL OTHERS to visible list (if list was empty/undefined).
                                                                        // Simplified approach: If undefined, assume all are visible.
                                                                        // To toggle this OFF, we need to populate the list with ALL except this one.

                                                                        let newVisible: string[];

                                                                        if (!editingProduct.aiVisibleColumns) {
                                                                            // Initial state: All visible. Toggle OFF means:
                                                                            newVisible = editingProduct.detailColumns.filter(c => c !== col);
                                                                        } else {
                                                                            if (editingProduct.aiVisibleColumns.includes(col)) {
                                                                                // Toggle OFF
                                                                                newVisible = editingProduct.aiVisibleColumns.filter(c => c !== col);
                                                                            } else {
                                                                                // Toggle ON
                                                                                newVisible = [...editingProduct.aiVisibleColumns, col];
                                                                            }
                                                                        }

                                                                        const updated = { ...editingProduct, aiVisibleColumns: newVisible };
                                                                        setEditingProduct(updated);
                                                                        updateProduct(updated);
                                                                    }}
                                                                    className="p-1 hover:bg-white rounded transition-colors"
                                                                    title={(!editingProduct.aiVisibleColumns || editingProduct.aiVisibleColumns.includes(col)) ? t('visibleToAI') : t('hiddenFromAI')}
                                                                >
                                                                    {(!editingProduct.aiVisibleColumns || editingProduct.aiVisibleColumns.includes(col))
                                                                        ? <Eye className="w-4 h-4 text-green-600" />
                                                                        : <EyeOff className="w-4 h-4 text-slate-400" />
                                                                    }
                                                                </button>

                                                                <button onClick={() => deleteDetailColumn(col)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        ))}
                                                        {editingProduct.detailColumns.length === 0 && (
                                                            <div className="text-center py-8 text-slate-400 text-sm italic">{t('noDetailColumns')}</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Process Steps Management */}
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-bold text-slate-900 mb-2">
                                                        {t('processSteps')}
                                                    </label>
                                                    <p className="text-xs text-slate-500 mb-3">
                                                        {t('processStepsHelp')}
                                                        <span className="block mt-1 text-[10px] text-slate-400">
                                                            <Eye className="w-3 h-3 inline mr-1 text-green-600" />{t('visibleToAI')} | <EyeOff className="w-3 h-3 inline mr-1 text-slate-400" />{t('hidden')}
                                                        </span>
                                                    </p>

                                                    {/* Add Step Input */}
                                                    <div className="flex gap-2 mb-3">
                                                        <input
                                                            type="text"
                                                            value={newStepName}
                                                            onChange={(e) => setNewStepName(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && addManualStep()}
                                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm text-black font-medium"
                                                            placeholder={t('stepNamePlaceholder')}
                                                        />
                                                        <button
                                                            onClick={addManualStep}
                                                            disabled={!newStepName.trim()}
                                                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {/* Steps List */}
                                                    <div className="bg-white border border-slate-200 rounded-lg p-1 min-h-[100px] max-h-[400px] overflow-y-auto space-y-1">
                                                        {editingProduct.steps.map((step, index) => (
                                                            <div key={step} className="grid grid-cols-12 gap-2 p-2 items-center bg-white border border-slate-200 rounded-md group hover:bg-slate-50 transition-colors">
                                                                {/* Move Buttons - Col 1 */}
                                                                <div className="col-span-1 flex flex-col items-center justify-center gap-0.5">
                                                                    <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="text-indigo-500 hover:text-indigo-700 disabled:text-slate-300 disabled:cursor-not-allowed"><ChevronUp className="w-4 h-4" /></button>
                                                                    <button onClick={() => moveStep(index, 'down')} disabled={index === editingProduct.steps.length - 1} className="text-indigo-500 hover:text-indigo-700 disabled:text-slate-300 disabled:cursor-not-allowed"><ChevronDown className="w-4 h-4" /></button>
                                                                </div>

                                                                <div className="col-span-4 flex items-center gap-2 min-w-0">
                                                                    <span className="text-xs font-mono text-slate-400 w-5 text-center flex-shrink-0">{index + 1}</span>
                                                                    {editingStepIndex === index ? (
                                                                        <div className="flex-1 relative">
                                                                            <input
                                                                                autoFocus
                                                                                type="text"
                                                                                className="w-full text-sm font-medium border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-900 bg-white"
                                                                                value={editingStepValue}
                                                                                onChange={(e) => setEditingStepValue(e.target.value)}
                                                                                onBlur={() => renameAndMigrateStep(index, step, editingStepValue)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') renameAndMigrateStep(index, step, editingStepValue);
                                                                                    if (e.key === 'Escape') setEditingStepIndex(null);
                                                                                }}
                                                                                disabled={migrating}
                                                                            />
                                                                            {migrating && (
                                                                                <div className="absolute right-2 top-1.5 animate-spin">
                                                                                    <RefreshCw className="w-3 h-3 text-indigo-500" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            className="text-sm font-medium text-slate-700 truncate cursor-pointer hover:text-indigo-600 hover:bg-slate-100 px-1 rounded border border-transparent hover:border-slate-200"
                                                                            title={`${step} (${t('renameColumn')})`}
                                                                            onDoubleClick={() => {
                                                                                setEditingStepIndex(index);
                                                                                setEditingStepValue(step);
                                                                            }}
                                                                        >
                                                                            {step}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Quantity & Unit - Col 4 */}
                                                                <div className="col-span-4 flex items-center gap-1">
                                                                    <input
                                                                        type="number"
                                                                        placeholder={t('targetQuantity')}
                                                                        value={editingProduct.stepQuantities?.[step] !== undefined ? editingProduct.stepQuantities[step] : ''}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                                            const newQtys = { ...editingProduct.stepQuantities };
                                                                            if (val === undefined) delete newQtys[step];
                                                                            else newQtys[step] = val;

                                                                            const updated = { ...editingProduct, stepQuantities: newQtys };
                                                                            setEditingProduct(updated);
                                                                            updateProduct(updated);
                                                                        }}
                                                                        className="w-full min-w-0 px-2 py-1 text-right text-xs border border-slate-200 rounded text-slate-900 placeholder:text-slate-300"
                                                                        title={t('targetQuantity')}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        placeholder={t('unit')}
                                                                        value={editingProduct.stepUnits?.[step] || ''}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            const newUnits = { ...editingProduct.stepUnits, [step]: val };
                                                                            const updated = { ...editingProduct, stepUnits: newUnits };
                                                                            setEditingProduct(updated);
                                                                            updateProduct(updated);
                                                                        }}
                                                                        className="w-12 flex-shrink-0 px-1 py-1 text-xs border border-slate-200 rounded text-slate-900 placeholder:text-slate-300 text-center"
                                                                        title={t('unit')}
                                                                    />
                                                                </div>

                                                                {/* Duration - Col 2 */}
                                                                <div className="col-span-2 flex items-center gap-1">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.5"
                                                                        value={editingProduct.stepDurations?.[step] || 0}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            const newDurations = { ...editingProduct.stepDurations, [step]: val };
                                                                            const updated = { ...editingProduct, stepDurations: newDurations };
                                                                            setEditingProduct(updated);
                                                                            updateProduct(updated);
                                                                        }}
                                                                        className="w-full min-w-0 px-2 py-1 text-right text-xs text-black font-medium border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                                                        title={t('hours')}
                                                                    />
                                                                </div>

                                                                {/* Actions - Col 1 */}
                                                                <div className="col-span-1 flex items-center justify-end gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            // Logic same as columns: If undefined, all visible.
                                                                            let newVisible: string[];
                                                                            if (!editingProduct.aiVisibleSteps) {
                                                                                newVisible = editingProduct.steps.filter(s => s !== step);
                                                                            } else {
                                                                                if (editingProduct.aiVisibleSteps.includes(step)) {
                                                                                    newVisible = editingProduct.aiVisibleSteps.filter(s => s !== step);
                                                                                } else {
                                                                                    newVisible = [...editingProduct.aiVisibleSteps, step];
                                                                                }
                                                                            }
                                                                            const updated = { ...editingProduct, aiVisibleSteps: newVisible };
                                                                            setEditingProduct(updated);
                                                                            updateProduct(updated);
                                                                        }}
                                                                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                                                                        title={(!editingProduct.aiVisibleSteps || editingProduct.aiVisibleSteps.includes(step)) ? t('visibleToAI') : t('hiddenFromAI')}
                                                                    >
                                                                        {(!editingProduct.aiVisibleSteps || editingProduct.aiVisibleSteps.includes(step))
                                                                            ? <Eye className="w-4 h-4 text-green-600" />
                                                                            : <EyeOff className="w-4 h-4 text-slate-400" />
                                                                        }
                                                                    </button>

                                                                    <button onClick={() => deleteStep(step)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {editingProduct.steps.length === 0 && (
                                                            <div className="text-center py-8 text-slate-400 text-sm italic">{t('noStepsDefined')}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>




                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Save className="w-4 h-4" />
                                                {saving ? t('saving') : t('saveSettings')}
                                            </button>

                                            {/* Save Status Message */}
                                            {message && (
                                                <div className={`mt-3 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                                    }`}>
                                                    {message.type === 'success' ? (
                                                        <Check className="w-4 h-4 flex-shrink-0" />
                                                    ) : (
                                                        <X className="w-4 h-4 flex-shrink-0" />
                                                    )}
                                                    <span>{message.text}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Right Column - Sidebar (ECD / Security / About) */}
                        <div className="space-y-6">




                            {/* Data Management (Admin Only) */}
                            {isAdmin && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                        <Database className="w-5 h-5 text-indigo-600" />
                                        {t('dataManagement')}
                                    </h3>
                                    <div className="space-y-4">

                                        <div className="border-t border-slate-100 pt-4">
                                            <p className="text-xs text-slate-500 mb-3">
                                                {t('retentionPolicy')}
                                            </p>

                                            <div className="space-y-2">
                                                {/* Step 1: Download Archive */}
                                                <button
                                                    onClick={() => window.open('/api/export-archive')}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    {t('downloadArchive')}
                                                </button>

                                                {/* Step 2: Delete Old Data */}
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(
                                                            t('deleteOldDataWarning')
                                                        )) return;

                                                        try {
                                                            const res = await fetch('/api/cleanup', { method: 'POST' });
                                                            const data = await res.json();
                                                            if (res.ok) {
                                                                alert(
                                                                    t('cleanupComplete', {
                                                                        deletedOrders: data.details.deletedOrders,
                                                                        deletedOrphanLogs: data.details.deletedOrphanLogs,
                                                                        cutOffDate: data.details.cutOffDate
                                                                    })
                                                                );
                                                            } else {
                                                                alert(t('error') + ': ' + data.error);
                                                            }
                                                        } catch (e) {
                                                            alert(t('cleanupFailed'));
                                                        }
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    {t('deleteOldData')}
                                                </button>
                                            </div>

                                            <p className="text-xs text-amber-600 mt-2">
                                                {t('downloadArchiveBeforeDeletingWarning')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Settings (Admin Only) */}
                            {isAdmin && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-purple-600" />
                                        {t('aiSettings')}
                                    </h3>

                                    <div className="space-y-6">
                                        {/* Provider Toggle */}
                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                            <button
                                                onClick={() => {
                                                    const newConfig = { ...config, aiProvider: 'openai' as const };
                                                    setConfig(newConfig);
                                                    fetchModels('openai');
                                                }}
                                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${config.aiProvider === 'openai' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                OpenAI
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const newConfig = { ...config, aiProvider: 'ollama' as const };
                                                    setConfig(newConfig);
                                                    fetchModels('ollama');
                                                }}
                                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${config.aiProvider === 'ollama' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Ollama
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const newConfig = { ...config, aiProvider: 'deepseek' as const };
                                                    setConfig(newConfig);
                                                }}
                                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${config.aiProvider === 'deepseek' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                DeepSeek
                                            </button>
                                        </div>

                                        {/* Provider Settings */}
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            {config.aiProvider === 'ollama' ? (
                                                <>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('ollamaUrl')}</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={config.ollamaUrl || 'http://localhost:11434/v1'}
                                                                onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
                                                                placeholder="http://localhost:11434/v1"
                                                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono text-sm text-slate-800"
                                                            />
                                                            <button
                                                                onClick={() => fetchModels('ollama')}
                                                                className="px-3 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                                                                title={t('testConnectionListModels')}
                                                            >
                                                                <RefreshCw className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {t('foundModels', { count: localModels.length })}
                                                            {localModels.length > 0 && (
                                                                <span className="ml-1 text-green-600">✓ {t('connectionSuccessful')}</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </>
                                            ) : config.aiProvider === 'deepseek' ? (
                                                <>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('deepseekApiKey')}</label>
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type={aiApiKeyVisible ? 'text' : 'password'}
                                                                    value={config.deepseekApiKey || ''}
                                                                    onChange={(e) => setConfig({ ...config, deepseekApiKey: e.target.value })}
                                                                    placeholder="sk-..."
                                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono text-sm text-slate-800 pr-10"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAiApiKeyVisible(!aiApiKeyVisible)}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                                >
                                                                    {aiApiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                            {config.deepseekApiKey && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfig({ ...config, deepseekApiKey: '' })}
                                                                    className="px-3 py-2.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-500"
                                                                    title={t('clearApiKey') || 'Clear API Key'}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">{t('deepseekApiKeyHelp')}</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('openAIApiKey')}</label>
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type={aiApiKeyVisible ? 'text' : 'password'}
                                                                    value={config.openAIApiKey || ''}
                                                                    onChange={(e) => setConfig({ ...config, openAIApiKey: e.target.value })}
                                                                    placeholder="sk-proj-..."
                                                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono text-sm text-slate-800 pr-10"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAiApiKeyVisible(!aiApiKeyVisible)}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                                >
                                                                    {aiApiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                            {config.openAIApiKey && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfig({ ...config, openAIApiKey: '' })}
                                                                    className="px-3 py-2.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-500"
                                                                    title={t('clearApiKey') || 'Clear API Key'}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">{t('apiKeyHelp')}</p>
                                                    </div>
                                                </>
                                            )}

                                            {/* Unified Save Button */}
                                            <button
                                                onClick={async () => {
                                                    setSavingAiKey(true);
                                                    try {
                                                        if (config.aiProvider === 'ollama') {
                                                            const res = await fetch('/api/config', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    aiProvider: 'ollama',
                                                                    ollamaUrl: config.ollamaUrl
                                                                })
                                                            });
                                                            if (res.ok) {
                                                                setAiTestResult({ status: 'success', message: t('ollamaSettingsSaved') });
                                                                fetchModels();
                                                            } else {
                                                                setAiTestResult({ status: 'error', message: t('failedToSaveSettings') });
                                                            }
                                                        } else if (config.aiProvider === 'deepseek') {
                                                            const res = await fetch('/api/config', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    aiProvider: 'deepseek',
                                                                    deepseekApiKey: config.deepseekApiKey
                                                                })
                                                            });
                                                            if (res.ok) {
                                                                setAiTestResult({ status: 'success', message: t('keySaved') });
                                                            } else {
                                                                setAiTestResult({ status: 'error', message: t('failedToSaveSettings') });
                                                            }
                                                        } else {
                                                            // OpenAI
                                                            const apiKeyToSave = config.openAIApiKey || '';
                                                            /* Allow saving empty key to clear it
                                                            if (!apiKeyToSave.trim()) {
                                                                setAiTestResult({ status: 'error', message: t('enterApiKey') });
                                                                return;
                                                            }
                                                            */

                                                            const res = await fetch('/api/config', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    aiProvider: 'openai',
                                                                    openAIApiKey: apiKeyToSave
                                                                })
                                                            });

                                                            if (res.ok) {
                                                                setAiTestResult({ status: 'success', message: t('keySaved') });
                                                            } else {
                                                                setAiTestResult({ status: 'error', message: t('saveFailed') });
                                                            }
                                                        }
                                                    } catch (e) {
                                                        setAiTestResult({ status: 'error', message: t('errorSavingSettings') });
                                                    } finally {
                                                        setSavingAiKey(false);
                                                    }
                                                }}
                                                disabled={savingAiKey}
                                                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <Save className="w-4 h-4" />
                                                {savingAiKey ? t('saving') : tCommon('save')}
                                            </button>
                                        </div>

                                        {aiTestResult.message && (
                                            <div className={`text-sm px-3 py-2 rounded-lg ${aiTestResult.status === 'success' ? 'bg-green-50 text-green-700' :
                                                aiTestResult.status === 'error' ? 'bg-red-50 text-red-700' :
                                                    'bg-slate-50 text-slate-600'
                                                }`}>
                                                {aiTestResult.message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Notifications & Webhooks */}
                            {isAdmin && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md mb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                            <Bot className="w-5 h-5 text-indigo-600" />
                                            {t('notifications') || 'Notifications'}
                                        </h3>
                                        <button
                                            onClick={() => {
                                                setEditingWebhook({
                                                    id: `wh_${Date.now()}`,
                                                    name: t('newWebhook') || 'New Webhook',
                                                    url: '',
                                                    enabled: true,
                                                    provider: 'dingtalk',
                                                    events: ['on_hold', 'on_qn']
                                                });
                                                setIsWebhookModalOpen(true);
                                                setWebhookTestStatus({ status: 'idle', message: '' });
                                            }}
                                            className="text-sm px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 font-medium transition-colors flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" />
                                            {t('addWebhook') || 'Add Webhook'}
                                        </button>
                                    </div>

                                    {!config.webhooks || config.webhooks.length === 0 ? (
                                        <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                            <p>{t('noWebhooks') || 'No webhooks configured.'}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {config.webhooks.map((wh) => (
                                                <div key={wh.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${wh.enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                        <div>
                                                            <div className="font-medium text-slate-900">{wh.name}</div>
                                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                                <span className="uppercase bg-slate-100 px-1.5 py-0.5 rounded text-[10px] tracking-wide">{t(`providers.${wh.provider}`) || wh.provider}</span>
                                                                <span>{wh.events.length} events</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingWebhook({ ...wh });
                                                                setIsWebhookModalOpen(true);
                                                                setWebhookTestStatus({ status: 'idle', message: '' });
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const newWebhooks = config.webhooks?.filter(w => w.id !== wh.id) || [];
                                                                setConfig({ ...config, webhooks: newWebhooks });
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Webhook Edit Modal (Inline for now to save space) */}
                                    {isWebhookModalOpen && editingWebhook && (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                                            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                                    <h4 className="font-semibold text-slate-900">
                                                        {config.webhooks?.some(w => w.id === editingWebhook.id) ? t('editWebhook') : t('newWebhook')}
                                                    </h4>
                                                    <button onClick={() => setIsWebhookModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                                                </div>

                                                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                                    {/* Name & Enabled */}
                                                    <div className="flex gap-4">
                                                        <div className="flex-1">
                                                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('webhookName') || 'Name'}</label>
                                                            <input
                                                                type="text"
                                                                value={editingWebhook.name}
                                                                onChange={e => setEditingWebhook({ ...editingWebhook, name: e.target.value })}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                                placeholder="Alerts Channel"
                                                            />
                                                        </div>
                                                        <div className="flex items-end pb-2">
                                                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editingWebhook.enabled}
                                                                    onChange={e => setEditingWebhook({ ...editingWebhook, enabled: e.target.checked })}
                                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                <span className="text-slate-700">{t('enabled') || 'Enabled'}</span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* Provider & URL */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('provider') || 'Provider'}</label>
                                                        <div className="mb-2">
                                                            <div className="relative">
                                                                <select
                                                                    value={editingWebhook.provider}
                                                                    onChange={e => {
                                                                        const newProvider = e.target.value as any;
                                                                        let newSettings = { ...editingWebhook.settings };

                                                                        // Set defaults for specific providers
                                                                        if (newProvider === 'bark' && !newSettings.serverUrl) {
                                                                            newSettings.serverUrl = 'https://api.day.app';
                                                                        }

                                                                        setEditingWebhook({
                                                                            ...editingWebhook,
                                                                            provider: newProvider,
                                                                            settings: newSettings
                                                                        });
                                                                    }}
                                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                                                                >
                                                                    {['dingtalk', 'wecom', 'feishu', 'slack', 'teams', 'telegram', 'discord', 'bark', 'gotify', 'serverchan', 'pushdeer', 'matrix', 'custom'].map(p => (
                                                                        <option key={p} value={p}>
                                                                            {t(`providers.${p}`) || p}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Dynamic Provider Settings */}
                                                    {(() => {
                                                        const p = editingWebhook.provider;
                                                        if (p === 'bark') {
                                                            return (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('serverUrl') || 'Server URL'}</label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingWebhook.settings?.serverUrl ?? 'https://api.day.app'}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, serverUrl: e.target.value } })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="https://api.day.app"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('deviceKey') || 'Device Key'} <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingWebhook.settings?.deviceKey || ''}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, deviceKey: e.target.value } })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="Your BN..."
                                                                        />
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <div className="flex-1">
                                                                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('sound') || 'Sound'}</label>
                                                                            <input
                                                                                type="text"
                                                                                value={editingWebhook.settings?.sound ?? 'minuet'}
                                                                                onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, sound: e.target.value } })}
                                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                                                placeholder="minuet"
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('icon') || 'Icon URL'}</label>
                                                                            <input
                                                                                type="text"
                                                                                value={editingWebhook.settings?.icon || ''}
                                                                                onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, icon: e.target.value } })}
                                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                                                placeholder="https://..."
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else if (p === 'telegram') {
                                                            return (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('botToken') || 'Bot Token'} <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="password"
                                                                            value={editingWebhook.settings?.botToken || ''}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, botToken: e.target.value } })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="123456:ABC-DEF..."
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('chatId') || 'Chat ID'} <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingWebhook.settings?.chatId || ''}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, chatId: e.target.value } })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="-100..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else if (p === 'gotify') {
                                                            return (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('serverUrl') || 'Server URL'} <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingWebhook.settings?.serverUrl || ''}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, serverUrl: e.target.value } })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="https://gotify.example.com"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('appToken') || 'App Token'} <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="password"
                                                                            value={editingWebhook.settings?.appToken || ''}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, appToken: e.target.value } })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="A1..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );

                                                        } else if (p === 'custom') {
                                                            return (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('webhookUrl') || 'Webhook URL'} <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingWebhook.url}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, url: e.target.value })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="https://example.com/webhook"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('httpMethod') || 'HTTP Method'}</label>
                                                                        <select
                                                                            value={editingWebhook.settings?.method || 'POST'}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, method: e.target.value } })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 bg-white"
                                                                        >
                                                                            {['POST', 'GET', 'PUT', 'PATCH'].map(m => (
                                                                                <option key={m} value={m}>{m}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('headers') || 'Custom Headers (JSON)'}</label>
                                                                        <textarea
                                                                            rows={3}
                                                                            value={JSON.stringify(editingWebhook.customHeaders || {}, null, 2)}
                                                                            onChange={e => {
                                                                                try {
                                                                                    const val = JSON.parse(e.target.value);
                                                                                    setEditingWebhook({ ...editingWebhook, customHeaders: val });
                                                                                } catch (err) {
                                                                                    // Allow typing invalid JSON temporarily (managed via raw state usually, but simplified here)
                                                                                }
                                                                            }}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-600"
                                                                            placeholder='{"Authorization": "Bearer token"}'
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('bodyTemplate') || 'Body Template (JSON)'}</label>
                                                                        <textarea
                                                                            rows={5}
                                                                            value={editingWebhook.customPayload || ''}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, customPayload: e.target.value })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-600"
                                                                            placeholder='{"text": "Order {{orderId}} status: {{status}}"}'
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else if (['dingtalk', 'wecom', 'feishu'].includes(p)) {
                                                            return (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('webhookUrl') || 'Webhook URL'} <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingWebhook.url || ''}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, url: e.target.value })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="https://..."
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('signSecret') || 'Sign Secret (Optional)'}</label>
                                                                        <input
                                                                            type="password"
                                                                            value={editingWebhook.settings?.signSecret || ''}
                                                                            onChange={e => setEditingWebhook({ ...editingWebhook, settings: { ...editingWebhook.settings, signSecret: e.target.value } })}
                                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                            placeholder="SEC..."
                                                                        />
                                                                        <p className="text-[10px] text-slate-400 mt-1">{t('signSecretHelp') || 'Required for secure chatbots (DingTalk/Feishu)'}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <div>
                                                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('webhookUrl') || 'Webhook URL'} <span className="text-red-500">*</span></label>
                                                                    <input
                                                                        type="text"
                                                                        value={editingWebhook.url || ''}
                                                                        onChange={e => setEditingWebhook({ ...editingWebhook, url: e.target.value })}
                                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-600"
                                                                        placeholder="https://..."
                                                                    />
                                                                </div>
                                                            );
                                                        }
                                                    })()}

                                                    {/* Events */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-2">{t('triggers') || 'Triggers'}</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {[
                                                                { id: 'on_hold', label: t('events.on_hold') || 'On Hold' },
                                                                { id: 'on_qn', label: t('events.on_qn') || 'QN Issue' },
                                                                { id: 'on_done', label: t('events.on_done') || 'Order Completed' },
                                                                { id: 'on_step_update', label: t('events.on_step_update') || 'Step Update' },
                                                                { id: 'on_morning_report', label: t('events.on_morning_report') || 'Daily Morning Report' },
                                                                { id: 'on_message', label: t('events.on_message') || 'New Message' }
                                                            ].map(evt => (
                                                                <label key={evt.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded bg-slate-50 cursor-pointer hover:bg-slate-100">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editingWebhook.events.includes(evt.id as any)}
                                                                        onChange={e => {
                                                                            const newEvents = e.target.checked
                                                                                ? [...editingWebhook.events, evt.id]
                                                                                : editingWebhook.events.filter(x => x !== evt.id);
                                                                            setEditingWebhook({ ...editingWebhook, events: newEvents as any });
                                                                        }}
                                                                        className="rounded border-slate-300 text-indigo-600"
                                                                    />
                                                                    <span className="text-xs text-slate-700">{evt.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Test Section */}
                                                    <div className="pt-2 border-t border-slate-100">
                                                        <div className="flex items-center justify-between">
                                                            <div className={`text-xs ${webhookTestStatus.status === 'success' ? 'text-green-600' :
                                                                webhookTestStatus.status === 'error' ? 'text-red-600' : 'text-slate-400'
                                                                }`}>
                                                                {webhookTestStatus.message}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    setWebhookTestStatus({ status: 'idle', message: t('testSending') || 'Sending...' });
                                                                    // For now, mockup success
                                                                    try {
                                                                        const res = await fetch('/api/webhooks/test', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify(editingWebhook)
                                                                        });
                                                                        const data = await res.json();
                                                                        if (res.ok) {
                                                                            setWebhookTestStatus({ status: 'success', message: t('testSentParams') || 'Test sent!' });
                                                                        } else {
                                                                            setWebhookTestStatus({ status: 'error', message: data.error || 'Failed' });
                                                                        }
                                                                    } catch (e) {
                                                                        setWebhookTestStatus({ status: 'error', message: 'Network error' });
                                                                    }
                                                                }}
                                                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                                            >
                                                                {t('sendTestPayload') || 'Send Test Payload'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setIsWebhookModalOpen(false)}
                                                        className="px-4 py-2 text-sm text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                                                    >
                                                        {t('cancel') || 'Cancel'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            // Validation logic
                                                            if (!editingWebhook.name) return;

                                                            let isValid = false;
                                                            if (['bark', 'telegram', 'gotify'].includes(editingWebhook.provider)) {
                                                                if (editingWebhook.provider === 'bark') isValid = !!editingWebhook.settings?.deviceKey;
                                                                else if (editingWebhook.provider === 'telegram') isValid = !!editingWebhook.settings?.botToken && !!editingWebhook.settings?.chatId;
                                                                else if (editingWebhook.provider === 'gotify') isValid = !!editingWebhook.settings?.serverUrl && !!editingWebhook.settings?.appToken;
                                                            } else {
                                                                // Generic / Custom requires URL
                                                                isValid = !!editingWebhook.url;
                                                            }

                                                            if (!isValid) return;

                                                            // Clean up URL if using a dynamic provider to avoid confusion
                                                            const finalWebhook = { ...editingWebhook };
                                                            if (['bark', 'telegram', 'gotify'].includes(finalWebhook.provider)) {
                                                                finalWebhook.url = '';
                                                            }

                                                            let newWebhooks = config.webhooks ? [...config.webhooks] : [];
                                                            const index = newWebhooks.findIndex(w => w.id === finalWebhook.id);
                                                            if (index >= 0) {
                                                                newWebhooks[index] = finalWebhook;
                                                            } else {
                                                                newWebhooks.push(finalWebhook);
                                                            }

                                                            const newConfig = { ...config, webhooks: newWebhooks };
                                                            setConfig(newConfig);
                                                            setIsWebhookModalOpen(false);

                                                            // Auto-save to backend
                                                            fetch('/api/config', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify(newConfig)
                                                            }).then(res => {
                                                                if (res.ok) {
                                                                    setMessage({ type: 'success', text: 'Webhook saved successfully!' });
                                                                } else {
                                                                    setMessage({ type: 'error', text: 'Failed to save webhook.' });
                                                                }
                                                            }).catch(() => {
                                                                setMessage({ type: 'error', text: 'Failed to save webhook.' });
                                                            });
                                                        }}
                                                        // Disable button visually if invalid (optional, but good UX)
                                                        disabled={!editingWebhook.name ||
                                                            (['bark', 'telegram', 'gotify'].includes(editingWebhook.provider)
                                                                ? (editingWebhook.provider === 'bark' ? !editingWebhook.settings?.deviceKey
                                                                    : editingWebhook.provider === 'telegram' ? (!editingWebhook.settings?.botToken || !editingWebhook.settings?.chatId)
                                                                        : (!editingWebhook.settings?.serverUrl || !editingWebhook.settings?.appToken))
                                                                : !editingWebhook.url)
                                                        }
                                                        className={`px-4 py-2 text-sm text-white rounded-lg shadow-sm font-medium transition-all ${(!editingWebhook.name ||
                                                            (['bark', 'telegram', 'gotify'].includes(editingWebhook.provider)
                                                                ? (editingWebhook.provider === 'bark' ? !editingWebhook.settings?.deviceKey
                                                                    : editingWebhook.provider === 'telegram' ? (!editingWebhook.settings?.botToken || !editingWebhook.settings?.chatId)
                                                                        : (!editingWebhook.settings?.serverUrl || !editingWebhook.settings?.appToken))
                                                                : !editingWebhook.url))
                                                            ? 'bg-slate-300 cursor-not-allowed'
                                                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                                            }`}
                                                    >
                                                        {t('saveWebhook') || 'Save Webhook'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}



                            {/* AI Prompt Engineering (Admin Only) */}
                            {currentUser?.role === 'admin' && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md mb-6">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-purple-600" />
                                        {t('aiPromptEngineering')}
                                    </h3>
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-800">
                                        {t('aiPromptCaution')}
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <label className="block text-sm font-medium text-slate-700">{t('systemPromptGlobal')}</label>
                                                <button
                                                    onClick={() => setConfig({ ...config, systemPrompt: '' })}
                                                    className="text-xs text-slate-400 hover:text-red-500"
                                                >
                                                    {t('resetToDefault')}
                                                </button>
                                            </div>
                                            <textarea
                                                value={config.systemPrompt || ''}
                                                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                                                placeholder={t('defaultSystemPromptPlaceholder')}
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono text-sm h-32 text-slate-900"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {['admin', 'supervisor', 'user'].map((role) => (
                                                <div key={role}>
                                                    <div className="flex justify-between items-center mb-1.5">
                                                        <label className="block text-sm font-medium text-slate-700 capitalize">{t('persona', { role })}</label>
                                                        <button
                                                            onClick={() => {
                                                                const newRolePrompts = { ...(config.rolePrompts || {}) };
                                                                delete newRolePrompts[role];
                                                                setConfig({ ...config, rolePrompts: newRolePrompts });
                                                            }}
                                                            className="text-xs text-slate-400 hover:text-red-500"
                                                        >
                                                            {t('default')}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        value={config.rolePrompts?.[role] || ''}
                                                        onChange={(e) => {
                                                            const newRolePrompts = { ...(config.rolePrompts || {}) };
                                                            newRolePrompts[role] = e.target.value;
                                                            setConfig({ ...config, rolePrompts: newRolePrompts });
                                                        }}
                                                        placeholder={t('defaultRoleInstructionsPlaceholder', { role })}
                                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono text-xs h-32 text-slate-900"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Save Button */}
                                        <div className="pt-4 border-t border-slate-100">
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <Save className="w-4 h-4" />
                                                {saving ? t('saving') : t('saveAiPrompts')}
                                            </button>

                                            {/* Save Status Message */}
                                            {message && (
                                                <div className={`mt-3 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                                    }`}>
                                                    {message.type === 'success' ? (
                                                        <Check className="w-4 h-4 flex-shrink-0" />
                                                    ) : (
                                                        <X className="w-4 h-4 flex-shrink-0" />
                                                    )}
                                                    <span>{message.text}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}




                            {/* User Management Link */}
                            {(isAdmin || isSupervisor) && (
                                <div
                                    onClick={() => router.push('/dashboard/users')}
                                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md cursor-pointer group mb-6"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                                            <Users className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors">{t('userManagement')}</h3>
                                            <p className="text-sm text-slate-500">{t('manageAccountsApprovals')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* User Profile & Security */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md mb-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <User className="w-5 h-5 text-indigo-600" />
                                    {t('yourProfile')}
                                </h3>
                                {currentUser ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                                            <div className="bg-indigo-100 p-2 rounded-full">
                                                <User className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{currentUser.username}</p>
                                                <p className="text-sm text-slate-500 capitalize">{currentUser.role}</p>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100 pt-4">
                                            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                <Key className="w-4 h-4 text-slate-500" />
                                                {t('changePassword')}
                                            </h4>
                                            <div className="space-y-3">
                                                <input
                                                    type="password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPass(e.target.value)}
                                                    placeholder={t('currentPassword')}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm text-black font-medium"
                                                />
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPass(e.target.value)}
                                                    placeholder={t('newPassword')}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm text-black font-medium"
                                                />
                                                <input
                                                    type="password"
                                                    value={confirmNewPass}
                                                    onChange={(e) => setConfirmNewPass(e.target.value)}
                                                    placeholder={t('confirmNewPassword')}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm text-black font-medium"
                                                />
                                                <button
                                                    onClick={async () => {
                                                        if (!currentPassword) {
                                                            setPassMsg(t('currentPasswordRequired'));
                                                            return;
                                                        }
                                                        if (!newPassword || newPassword !== confirmNewPass) {
                                                            setPassMsg(t('passwordsDoNotMatch'));
                                                            return;
                                                        }
                                                        setPassMsg(tCommon('updating'));
                                                        try {
                                                            const res = await fetch(`/api/users/${currentUser.id}`, {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ password: newPassword, currentPassword })
                                                            });
                                                            if (res.ok) {
                                                                setPassMsg(t('passwordUpdated'));
                                                                setCurrentPass('');
                                                                setNewPass('');
                                                                setConfirmNewPass('');
                                                            } else {
                                                                const err = await res.json();
                                                                setPassMsg(err.error || t('saveFailed'));
                                                            }
                                                        } catch {
                                                            setPassMsg(t('errorSavingSettings'));
                                                        }
                                                    }}
                                                    disabled={!newPassword || !currentPassword}
                                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
                                                >
                                                    {t('updatePassword')}
                                                </button>
                                                {passMsg && (
                                                    <p className={`text-xs text-center ${passMsg.includes('updated') ? 'text-green-600' : 'text-amber-600'}`}>
                                                        {passMsg}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">{t('loadingUserProfile')}</p>
                                )}
                            </div>

                            {/* System Identity Section (Admin Only) */}
                            {isAdmin && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md mb-6">
                                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
                                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                                        System Identity
                                    </h2>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-sm text-slate-600 mb-2">
                                            {t('certificateId')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 bg-white px-3 py-2 rounded border border-slate-200 font-mono text-sm text-slate-800 break-all">
                                                {machineId || 'Loading...'}
                                            </code>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(machineId);
                                                    setCopiedId(true);
                                                    setTimeout(() => setCopiedId(false), 2000);
                                                }}
                                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                                                title="Copy ID"
                                            >
                                                {copiedId ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {fingerprintHash && (
                                            <p className="text-xs text-slate-400 mt-2 font-mono">
                                                Fingerprint: {fingerprintHash.substring(0, 16)}...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}


                        </div>
                    </div >
                )
                }
            </main >

            {/* Column Categorization Modal */}
            {
                showColumnsConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-lg mx-4 shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{t('categorizeColumns')}</h3>
                            <p className="text-slate-500 mb-2 text-sm">
                                {t('categorizeColumnsHelp')}
                            </p>
                            <p className="text-xs text-slate-500 mb-4">
                                Detail: {detectedColumns.filter(c => columnCategories[c] === 'detail').length} |
                                Step: {detectedColumns.filter(c => columnCategories[c] === 'step').length}
                            </p>

                            <div className="flex-1 overflow-y-auto mb-4 max-h-60">
                                <div className="space-y-1">
                                    {detectedColumns.map((col: string, index: number) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded group hover:bg-slate-100">
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <button
                                                        onClick={() => moveColumn(index, 'up')}
                                                        disabled={index === 0}
                                                        className="text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                                    >
                                                        <ChevronUp className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => moveColumn(index, 'down')}
                                                        disabled={index === detectedColumns.length - 1}
                                                        className="text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                                    >
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <span className="text-xs text-slate-400 w-6">{index + 1}</span>
                                                <span className="text-sm text-slate-800">{col}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setColumnCategories({ ...columnCategories, [col]: 'detail' })}
                                                    className={`px-2 py-0.5 text-xs rounded ${columnCategories[col] === 'detail' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-blue-100'}`}
                                                >
                                                    {t('detail')}
                                                </button>
                                                <button
                                                    onClick={() => setColumnCategories({ ...columnCategories, [col]: 'step' })}
                                                    className={`px-2 py-0.5 text-xs rounded ${columnCategories[col] === 'step' ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-green-100'}`}
                                                >
                                                    {t('step')}
                                                </button>
                                                <button
                                                    onClick={() => setDetectedColumns(detectedColumns.filter((_: string, i: number) => i !== index))}
                                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title={t('excludeThisColumn')}
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowColumnsConfirm(false); setDetectedColumns([]); setColumnCategories({}); }}
                                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                                >
                                    {tCommon('cancel')}
                                </button>
                                <button
                                    onClick={confirmDetectedColumns}
                                    disabled={detectedColumns.length === 0}
                                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Check className="w-4 h-4" />
                                    {t('importColumns')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Import Preview Modal */}
            {
                showPreviewModal && previewData && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-800">{t('connectExcelColumns')}</h2>
                                <button onClick={() => { setShowPreviewModal(false); setPreviewData(null); setPreviewFile(null); }} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="overflow-y-auto px-6 py-8 text-center space-y-4">
                                <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                                    <Table2 className="w-8 h-8 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">
                                    {t('excelAnalyzedSuccess')}
                                </h3>
                                <p className="text-slate-500 max-w-md mx-auto">
                                    {t('foundColumnsHelp', { count: previewData.detectedHeaders?.length || 0 })}
                                </p>
                            </div>
                            <div className="px-6 py-4 border-t flex justify-center gap-4 bg-slate-50">
                                <button onClick={() => { setShowPreviewModal(false); setPreviewData(null); setPreviewFile(null); }} className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-white transition-colors">{tCommon('cancel')}</button>

                                {/* Option to just use columns for config */}
                                {previewData.detectedHeaders && previewData.detectedHeaders.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const headers = previewData.detectedHeaders ?? [];
                                            setDetectedColumns(headers);
                                            // Simple heuristic categorization
                                            const cats: Record<string, 'detail' | 'step'> = {};
                                            headers.forEach(() => {
                                                // Assume defaults or unknown?
                                                // Let user decide in next modal
                                            });
                                            setColumnCategories(cats);
                                            setShowPreviewModal(false);
                                            setShowColumnsConfirm(true);
                                        }}
                                        className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow hover:scale-[1.02]"
                                    >
                                        <Table2 className="w-4 h-4" />
                                        {t('reviewUseColumns')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
