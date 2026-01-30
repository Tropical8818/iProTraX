'use client';

import React, { useState, useMemo } from 'react';
import {
    X, Sparkles, Clock,
    AlertCircle,
    CheckCircle2, Info, Percent,
    Download, RotateCcw, Calendar
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { Product } from '@/lib/types/config';
import { recommendSchedule, SchedulingResult } from '@/lib/scheduler';
import { refineScheduleWithAI } from '@/app/actions/scheduler';
import { calculateCapacityWithAI, AICapacityResult } from '@/app/actions/ai-scheduler';
import { useTranslations } from 'next-intl';

interface SmartSchedulerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    orders: any[];
    onConfirm: (recommendations: any[]) => Promise<void>;
    onResetAllP?: () => Promise<void>;
}

export const SmartSchedulerDialog: React.FC<SmartSchedulerDialogProps> = ({
    isOpen,
    onClose,
    product,
    orders,
    onConfirm,
    onResetAllP
}) => {
    const t = useTranslations('Dashboard');
    const [standardHours, setStandardHours] = useState(product.shiftConfig?.standardHours || 8);
    const [overtimeHours, setOvertimeHours] = useState(product.shiftConfig?.overtimeHours || 0);
    const [weights, setWeights] = useState({
        priority: product.schedulingConfig?.priorityWeight || 50,
        date: product.schedulingConfig?.dateWeight || 30,
        aging: product.schedulingConfig?.agingWeight || 20
    });
    const [planningHours, setPlanningHours] = useState(24);  // 1-72 hours planning horizon
    const [isResetting, setIsResetting] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);  // Custom confirmation dialog
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiOverrides, setAiOverrides] = useState<AICapacityResult | undefined>(undefined);
    const [isAutopilotLoading, setIsAutopilotLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // PERSISTENCE: Storage Key
    const storageKey = `scheduler_settings_${product.id}`;

    // PERSISTENCE: Load settings on mount
    React.useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.standardHours !== undefined) setStandardHours(parsed.standardHours);
                if (parsed.overtimeHours !== undefined) setOvertimeHours(parsed.overtimeHours);
                if (parsed.planningHours !== undefined) setPlanningHours(parsed.planningHours);
                if (parsed.weights) setWeights(prev => ({ ...prev, ...parsed.weights }));
            } catch (e) {
                console.error("Failed to load scheduler settings", e);
            }
        }
    }, [product.id, storageKey]);

    // PERSISTENCE: Save settings on change
    React.useEffect(() => {
        const settings = {
            standardHours,
            overtimeHours,
            planningHours,
            weights
        };
        localStorage.setItem(storageKey, JSON.stringify(settings));
    }, [standardHours, overtimeHours, planningHours, weights, product.id, storageKey]);


    // Dynamic product with temporary overrides
    const tempProduct: Product = useMemo(() => ({
        ...product,
        schedulingConfig: {
            priorityWeight: weights.priority,
            dateWeight: weights.date,
            agingWeight: weights.aging
        }
    }), [product, weights]);

    const result: SchedulingResult = useMemo(() => {
        return recommendSchedule(
            orders,
            tempProduct,
            standardHours,
            overtimeHours,
            planningHours,
            aiOverrides // Pass AI overrides
        );
    }, [orders, tempProduct, standardHours, overtimeHours, planningHours, aiOverrides]);

    // AI Analysis Effect
    React.useEffect(() => {
        let isActive = true;
        const fetchAiAdvice = async () => {
            if (result.recommendations.length > 0 && (tempProduct.aiModel || tempProduct.customInstructions)) {
                setIsAiLoading(true);
                setAiAnalysis('');
                try {
                    const advice = await refineScheduleWithAI(orders, tempProduct, result);
                    if (isActive) setAiAnalysis(advice);
                } catch (err) {
                    console.error('AI Advice error', err);
                } finally {
                    if (isActive) setIsAiLoading(false);
                }
            } else {
                setAiAnalysis('');
            }
        };

        const timer = setTimeout(fetchAiAdvice, 1000); // Debounce AI call
        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [result, orders, tempProduct]);

    const handleExport = async () => {
        if (!result.recommendations.length) return;

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Daily Plan');

            // Define columns
            worksheet.columns = [
                { header: 'WO ID', key: 'woId', width: 15 },
                { header: 'PN', key: 'pn', width: 20 },
                { header: 'Description', key: 'description', width: 30 },
                { header: 'Next Step', key: 'nextStep', width: 20 },
                { header: 'Priority', key: 'priority', width: 10 },
                { header: 'Due Date', key: 'dueDate', width: 15 },
                { header: 'Score', key: 'score', width: 10 },
                { header: 'Status', key: 'status', width: 20 }
            ];

            // Add rows
            result.recommendations.forEach(r => {
                const order = orders.find(o => o.id === r.orderId);
                worksheet.addRow({
                    woId: r.woId,
                    pn: order?.['PN'] || '',
                    description: order?.['Description'] || '',
                    nextStep: r.stepName,
                    priority: order?.['Priority'] || '',
                    dueDate: order?.['WO DUE'] || '',
                    score: r.score.toFixed(2),
                    status: 'P (Planned)'
                });
            });

            // Style header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Generate buffer
            const buffer = await workbook.xlsx.writeBuffer();

            // Trigger download
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            anchor.download = `Daily_Plan_${product.name}_${dateStr}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed', error);
            alert('Export failed. Please try again.');
        }
    };

    const handleAIAutopilot = async () => {
        setIsAutopilotLoading(true);
        try {
            const overrides = await calculateCapacityWithAI(
                tempProduct,
                planningHours,
                standardHours,
                overtimeHours,
                orders.length,
                tempProduct.monthlyTarget // Pass Monthly Target
            );
            setAiOverrides(overrides);
        } catch (error) {
            console.error("Autopilot failed", error);
        } finally {
            setIsAutopilotLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            await onConfirm(result.recommendations);
            onClose();
        } catch (err) {
            console.error('Scheduling confirm error', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetAllP = async () => {
        if (!onResetAllP) return;
        // Show custom confirmation dialog instead of window.confirm
        setShowResetConfirm(true);
    };

    const confirmResetAllP = async () => {
        if (!onResetAllP) return;
        setShowResetConfirm(false);
        setIsResetting(true);
        try {
            await onResetAllP();
            onClose();
        } catch (err) {
            console.error('Reset All P error', err);
        } finally {
            setIsResetting(false);
        }
    };


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                            <Sparkles className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 leading-tight">{t('aiSmartScheduler')}</h2>
                            <p className="text-xs text-slate-500 font-medium">{product.name} • {t('optimization4M1E')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleAIAutopilot}
                            disabled={isProcessing || isAutopilotLoading}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                                ${aiOverrides
                                    ? 'bg-purple-100 text-purple-700 border-purple-200 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                }
                                ${isAutopilotLoading ? 'animate-pulse opacity-80' : ''}
                            `}
                        >
                            <Sparkles size={14} className={aiOverrides ? "text-purple-600" : "text-amber-500"} />
                            {isAutopilotLoading ? 'Autopilot...' : 'Autopilot'}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Controls Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Environment: Shift & Capacity */}
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Clock size={16} className="text-indigo-500" /> {t('shiftCapacity')}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('standardHours')}</label>
                                    <div className="relative">
                                        <input
                                            type="number" step="0.5" min="0"
                                            value={standardHours}
                                            onChange={(e) => setStandardHours(parseFloat(e.target.value) || 0)}
                                            className="w-full h-10 px-3 pr-8 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">hrs</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('overtimeHours')}</label>
                                    <div className="relative">
                                        <input
                                            type="number" step="0.5" min="0"
                                            value={overtimeHours}
                                            onChange={(e) => setOvertimeHours(parseFloat(e.target.value) || 0)}
                                            className="w-full h-10 px-3 pr-8 bg-white border border-slate-200 rounded-lg text-sm text-amber-600 font-bold focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-bold">hrs</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                                <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-blue-700 leading-relaxed italic">
                                    {t('capacityNotice')}
                                </p>
                            </div>
                        </div>

                        {/* 2. Strategy: Weighted Scoring */}
                        <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100">
                            <h3 className="text-sm font-bold text-indigo-700 mb-4 flex items-center gap-2">
                                <Percent size={16} className="text-indigo-500" /> {t('scoringStrategy')}
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase">{t('priorityWeight')}</label>
                                        <span className="text-xs font-mono text-indigo-600 font-bold">{weights.priority}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="100"
                                        value={weights.priority}
                                        onChange={(e) => setWeights({ ...weights, priority: parseInt(e.target.value) })}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase">{t('dateWeight')}</label>
                                        <span className="text-xs font-mono text-indigo-600 font-bold">{weights.date}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="100"
                                        value={weights.date}
                                        onChange={(e) => setWeights({ ...weights, date: parseInt(e.target.value) })}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase">{t('agingWeight')}</label>
                                        <span className="text-xs font-mono text-indigo-600 font-bold">{weights.aging}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="100"
                                        value={weights.aging}
                                        onChange={(e) => setWeights({ ...weights, aging: parseInt(e.target.value) })}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Planning Horizon Section */}
                    <div className="p-5 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl border border-teal-100">
                        <h3 className="text-sm font-bold text-teal-700 mb-4 flex items-center gap-2">
                            <Calendar size={16} className="text-teal-500" /> {t('planningHorizon')}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">{t('planningHorizonHours')}</label>
                                <span className="text-sm font-mono text-teal-600 font-bold">
                                    {planningHours}h
                                    {planningHours > 24 && <span className="text-xs text-slate-400 ml-1">({Math.round(planningHours / 24 * 10) / 10} {t('days')})</span>}
                                </span>
                            </div>
                            <input
                                type="range" min="1" max="72" step="1"
                                value={planningHours}
                                onChange={(e) => setPlanningHours(parseInt(e.target.value))}
                                className="w-full h-2 bg-teal-100 rounded-lg appearance-none cursor-pointer accent-teal-600"
                            />
                            <div className="relative h-4 text-[10px] text-slate-400">
                                <span className="absolute left-0">1h</span>
                                <span className="absolute" style={{ left: '9.9%', transform: 'translateX(-50%)' }}>8h</span>
                                <span className="absolute" style={{ left: '32.4%', transform: 'translateX(-50%)' }}>24h</span>
                                <span className="absolute" style={{ left: '66.2%', transform: 'translateX(-50%)' }}>48h</span>
                                <span className="absolute right-0">72h</span>
                            </div>
                        </div>
                        <p className="mt-3 text-[11px] text-teal-700 italic">
                            {t('planningHorizonHelp')}
                        </p>
                    </div>

                    {/* Summary Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl text-center shadow-sm">
                            <p className="text-[11px] text-slate-500 font-bold uppercase mb-1">{t('totalPlanned')}</p>
                            <p className="text-2xl font-black text-slate-800">{result.summary.totalPlanned}</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl text-center shadow-sm">
                            <p className="text-[11px] text-red-500 font-bold uppercase mb-1">{t('highPriority')}</p>
                            <p className="text-2xl font-black text-red-600">{result.summary.highPriorityPlanned}</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-200 rounded-2xl text-center shadow-sm">
                            <p className="text-[11px] text-amber-500 font-bold uppercase mb-1">{t('skippedCap')}</p>
                            <p className="text-2xl font-black text-amber-600">{result.summary.skippedDueToCapacity}</p>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl text-center shadow-sm">
                            <p className="text-[11px] text-indigo-600 font-bold uppercase mb-1">{t('achievement') || 'Target'}</p>
                            <div className="flex items-baseline justify-center gap-1">
                                <p className="text-2xl font-black text-indigo-700">
                                    {result.summary.dailyCapacityFromGoal
                                        ? Math.round((result.summary.totalPlanned / (result.summary.dailyCapacityFromGoal * Math.ceil(planningHours / (standardHours ?? product.shiftConfig?.standardHours ?? 8)))) * 100)
                                        : 100}%
                                </p>
                            </div>
                        </div>

                        {/* NEW: Balance / Bottleneck Card */}
                        <div className="p-4 bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl text-center shadow-sm">
                            <p className="text-[11px] text-amber-600 font-bold uppercase mb-1">{t('bottleneck') || 'Bottleneck'}</p>
                            <div className="flex flex-col items-center justify-center">
                                <p className="text-sm font-black text-amber-700 truncate w-full">
                                    {Object.entries(result.stepUtilization)
                                        .filter((entry) => !entry[1].isUnlimited && (entry[1].usedMinutes / (entry[1].totalMinutes || 1)) > 0.9)
                                        .map((entry) => entry[0])[0] || t('noBottleneck') || 'Balanced'}
                                </p>
                                <p className="text-[10px] text-amber-500 font-medium">
                                    {Object.values(result.stepUtilization).every(u => u.isUnlimited || (u.usedMinutes / (u.totalMinutes || 1)) < 0.8) ? 'Optimized' : 'High Load'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* AI Advisor Section */}
                    {(tempProduct.aiModel || tempProduct.customInstructions) && (
                        <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 shadow-sm">
                            <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                <Sparkles size={16} className="text-indigo-600" />
                                {t('aiAdvisorBoard')}
                            </h3>
                            <div className="min-h-[60px] flex items-center">
                                {isAiLoading ? (
                                    <div className="flex items-center gap-3 text-slate-500 animate-pulse">
                                        <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                                        <p className="text-sm italic">{t('aiAnalyzing')}</p>
                                    </div>
                                ) : aiAnalysis ? (
                                    <div className="bg-white/60 p-3 rounded-xl text-sm text-indigo-900 leading-relaxed italic border border-white/80">
                                        {aiAnalysis}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">
                                        {t('aiReadyToAnalyze')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Preview Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-sm font-bold text-slate-700">{t('recommendedList')}</h3>
                            <div className="text-[11px] text-slate-400 flex items-center gap-3">
                                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" /> {t('materialOK')}</span>
                                <span className="flex items-center gap-1"><Info size={12} className="text-indigo-500" /> {t('nextStep') || 'Next Step'}</span>
                                <span className="flex items-center gap-1"><AlertCircle size={12} className="text-amber-500" /> {t('capacityWarning')}</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden min-h-[200px] max-h-[350px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100/50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase">{t('woId')}</th>
                                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase">{t('step')}</th>
                                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase text-right">{t('score')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {result.recommendations.map((rec, idx) => (
                                        <tr key={`${rec.orderId}-${idx}`} className="hover:bg-white text-xs text-slate-600 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-slate-800">{rec.woId}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {rec.predictedFlow?.map((flow, flowIdx) => (
                                                        <span key={flow.stepName} className="flex items-center">
                                                            <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${flowIdx === 0
                                                                ? 'bg-indigo-100 text-indigo-700'
                                                                : 'bg-teal-50 text-teal-600'
                                                                }`}>
                                                                {flow.stepName}
                                                            </span>
                                                            {flowIdx < (rec.predictedFlow?.length || 0) - 1 && (
                                                                <span className="text-slate-300 mx-0.5">→</span>
                                                            )}
                                                        </span>
                                                    )) || (
                                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                                                                {rec.stepName}
                                                            </span>
                                                        )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{ width: `${rec.score}%` }}></div>
                                                    </div>
                                                    <span className="font-mono font-bold w-12">{rec.score.toFixed(0)}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {result.recommendations.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-12 text-center text-slate-400 italic">
                                                {t('noRecommendations')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Step Utilization */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(result.stepUtilization).map(([step, util]) => {
                            const percent = util.isUnlimited ? 0 : (util.totalMinutes > 0 ? (util.usedMinutes / util.totalMinutes) * 100 : 0);
                            const isFull = percent >= 95;
                            const isUnlimited = util.isUnlimited;

                            return (
                                <div key={step} className={`p-3 border rounded-xl shadow-sm space-y-2 ${isUnlimited ? 'bg-indigo-50/30 border-indigo-100' : 'bg-white border-slate-200'}`}>
                                    <div className="flex justify-between items-start">
                                        <span className={`text-[11px] font-bold truncate max-w-[120px] ${isUnlimited ? 'text-indigo-700' : 'text-slate-700'}`}>{step}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isUnlimited ? 'bg-indigo-100 text-indigo-600' :
                                            isFull ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {isUnlimited ? 'Unlimited' : `${percent.toFixed(0)}%`}
                                        </span>
                                    </div>
                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${isUnlimited ? 'bg-indigo-300' : isFull ? 'bg-red-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${isUnlimited ? 100 : Math.min(100, percent)}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                                        <span>{t('applyOrders', { count: util.count })}</span>
                                        <span>
                                            {isUnlimited ? '∞' : `${Math.round(util.usedMinutes / 60)} / ${Math.round(util.totalMinutes / 60)} hrs`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-[11px] text-slate-400 italic">
                        {t('applyNote')}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleExport}
                            disabled={result.recommendations.length === 0}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-bold text-slate-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4 text-slate-500" />
                            {t('exportDispatchList')}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all active:scale-95"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isProcessing || result.recommendations.length === 0}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            {isProcessing ? t('processing') : (
                                <>{t('applyOrders', { count: result.recommendations.length })}</>
                            )}
                        </button>
                        {onResetAllP && (
                            <button
                                onClick={handleResetAllP}
                                disabled={isResetting}
                                className="flex items-center gap-2 px-4 py-2 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-bold text-red-600 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                                {isResetting ? t('processing') : t('resetAllP')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Reset Confirmation Dialog */}
            {
                showResetConfirm && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
                        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-slate-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-100 rounded-full">
                                    <AlertCircle className="w-6 h-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">{t('resetAllP')}</h3>
                            </div>
                            <p className="text-slate-600 mb-6">{t('resetAllPConfirm')}</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    {t('cancel') || 'Cancel'}
                                </button>
                                <button
                                    onClick={confirmResetAllP}
                                    className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                >
                                    {t('confirm') || 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
