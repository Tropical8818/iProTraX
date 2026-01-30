'use client';

import React, { useState, useEffect } from 'react';
import {
    X, TrendingUp, BarChart2, PieChart, Filter, Save,
    RefreshCw, Download, Layers, CheckCircle2, AlertTriangle, Info, Calendar, Clock
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useTranslations } from 'next-intl';

interface AnalyticsData {
    summary: {
        topProducer: string;
        bottleneck: string;
        totalOutput: number;
    };
    productivity: { name: string; count: number }[];
    bottlenecks: { name: string; count: number }[];
    trend: { date: string; output: number }[];
}

interface WorkerStats {
    userId: string;
    username: string;
    totalQuantity: number;
    activeTimeHours: number;
    efficiency: number;
    sessions: number;
}

interface WorkerLog {
    id: string;
    woId: string;
    stepName: string;
    quantity: number;
    startTime: string;
    endTime: string;
    durationMinutes: number;
}

interface AnalyticsDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    productId: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsDashboard({ isOpen, onClose, productId }: AnalyticsDashboardProps) {
    const t = useTranslations('AnalyticsDashboard');
    const [activeTab, setActiveTab] = useState<'overview' | 'performance'>('overview');

    // Date Range State
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Overview State
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [overviewData, setOverviewData] = useState<AnalyticsData | null>(null);

    // Performance State
    const [loadingPerformance, setLoadingPerformance] = useState(false);
    const [workerStats, setWorkerStats] = useState<WorkerStats[]>([]);

    // Detail Modal State
    const [selectedWorker, setSelectedWorker] = useState<{ id: string; name: string } | null>(null);
    const [workerLogs, setWorkerLogs] = useState<WorkerLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const fetchOverviewData = React.useCallback(async () => {
        setLoadingOverview(true);
        try {
            const res = await fetch(`/api/analytics?productId=${productId}`);
            if (res.ok) {
                const data = await res.json();
                setOverviewData(data);
            }
        } catch (err) {
            console.error('Failed to fetch overview', err);
        } finally {
            setLoadingOverview(false);
        }
    }, [productId]);

    const fetchPerformanceData = React.useCallback(async () => {
        setLoadingPerformance(true);
        try {
            const res = await fetch(`/api/reports/workers?productId=${productId}&startDate=${startDate}&endDate=${endDate}`);
            if (res.ok) {
                const data = await res.json();
                setWorkerStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch worker stats', err);
        } finally {
            setLoadingPerformance(false);
        }
    }, [productId, startDate, endDate]);

    useEffect(() => {
        if (isOpen && productId) {
            if (activeTab === 'overview') fetchOverviewData();
            if (activeTab === 'performance') fetchPerformanceData();
        }
    }, [isOpen, productId, activeTab, startDate, endDate, fetchOverviewData, fetchPerformanceData]);

    // Moved up to fix hoisting
    // const fetchPerformanceData = ...

    const fetchWorkerLogs = async (userId: string) => {
        setLoadingLogs(true);
        try {
            const res = await fetch(`/api/reports/workers/${userId}?productId=${productId}&startDate=${startDate}&endDate=${endDate}`);
            if (res.ok) {
                const data = await res.json();
                setWorkerLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Failed to fetch worker logs', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    // Fetch Overview Data (Legacy API) -> Should ideally accept dates too, but keeping as is for now or updating if API supports it
    // Assuming legacy API might not support dates yet, but let's try passing them if we updated it (we didn't yet).
    // For now, Overview is fixed to "Recent", but Performance is flexible.
    // Moved up to fix hoisting
    // const fetchOverviewData = ...

    const handleWorkerClick = (userId: string, username: string) => {
        setSelectedWorker({ id: userId, name: username });
        fetchWorkerLogs(userId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col relative">

                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                            <BarChart2 className="w-6 h-6 text-indigo-700" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{t('title')}</h2>
                            <p className="text-xs text-slate-500 font-medium">{t('subtitle')}</p>
                        </div>
                    </div>

                    {/* Date Picker - Only show if Performance tab is active (or if we enable for both) */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm border-none focus:ring-0 text-slate-600 p-0"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm border-none focus:ring-0 text-slate-600 p-0"
                        />
                    </div>

                    <button onClick={onClose} className="hidden sm:block p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                    <button onClick={onClose} className="sm:hidden absolute top-4 right-4 p-2 text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-slate-100 pt-2 flex gap-6">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        {t('tabs.overview')}
                    </button>
                    <button
                        onClick={() => setActiveTab('performance')}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'performance' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        {t('tabs.performance')}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">

                    {/* -- OVERVIEW TAB -- */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {loadingOverview ? (
                                <div className="py-20 flex justify-center text-indigo-500"><RefreshCw className="animate-spin w-8 h-8" /></div>
                            ) : overviewData ? (
                                <>
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">{t('overview.totalOutput7d')}</div>
                                            <div className="text-2xl font-bold text-emerald-600">{overviewData.summary.totalOutput}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">{t('overview.topProducer')}</div>
                                            <div className="text-2xl font-bold text-indigo-600 truncate">{overviewData.summary.topProducer}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">{t('overview.bottleneckStep')}</div>
                                            <div className="text-2xl font-bold text-orange-600 truncate">{overviewData.summary.bottleneck}</div>
                                        </div>
                                    </div>

                                    {/* Charts Grid */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Trend */}
                                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[350px]">
                                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500" /> {t('overview.dailyProduction')}</h3>
                                            <ResponsiveContainer width="100%" height="90%">
                                                <AreaChart data={overviewData.trend}>
                                                    <defs>
                                                        <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="date" fontSize={10} tickFormatter={(str) => format(new Date(str), 'MM-dd')} />
                                                    <YAxis fontSize={10} />
                                                    <Tooltip />
                                                    <Area type="monotone" dataKey="output" name={t('overview.dailyProduction')} stroke="#4f46e5" fillOpacity={1} fill="url(#colorOutput)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Productivity */}
                                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[350px]">
                                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t('overview.stepOutput')}</h3>
                                            <ResponsiveContainer width="100%" height="90%">
                                                <BarChart data={overviewData.productivity}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" fontSize={10} />
                                                    <YAxis fontSize={10} />
                                                    <Tooltip />
                                                    <Bar dataKey="count" name={t('overview.stepOutput')} fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-20 text-slate-400">{t('overview.noData')}</div>
                            )}
                        </div>
                    )}


                    {/* -- PERFORMANCE TAB -- */}
                    {activeTab === 'performance' && (
                        <div className="space-y-6">
                            {loadingPerformance ? (
                                <div className="py-20 flex justify-center text-indigo-500"><RefreshCw className="animate-spin w-8 h-8" /></div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Chart */}
                                        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
                                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-indigo-500" /> {t('performance.outputByWorker')}
                                            </h3>
                                            <ResponsiveContainer width="100%" height={350}>
                                                <BarChart data={workerStats} layout="vertical" margin={{ left: 40 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                                    <XAxis type="number" fontSize={10} />
                                                    <YAxis dataKey="username" type="category" width={80} fontSize={11} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                        cursor={{ fill: '#f1f5f9' }}
                                                    />
                                                    <Bar dataKey="totalQuantity" name={t('performance.columns.totalOutput')} fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Stats Cards */}
                                        <div className="space-y-4">
                                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{t('performance.topPerformer')}</div>
                                                <div className="text-xl font-bold text-indigo-600">
                                                    {workerStats.length > 0 ? workerStats[0].username : '-'}
                                                </div>
                                                <div className="text-sm text-slate-400 mt-1">
                                                    {workerStats.length > 0 ? `${workerStats[0].totalQuantity} ${t('performance.units')}` : ''}
                                                </div>
                                            </div>
                                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{t('performance.avgEfficiency')}</div>
                                                <div className="text-xl font-bold text-emerald-600">
                                                    {workerStats.length > 0
                                                        ? Math.round(workerStats.reduce((acc, curr) => acc + curr.efficiency, 0) / workerStats.length) + '%'
                                                        : '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Table */}
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-slate-700">{t('performance.detailedStats')}</h3>
                                            <span className="text-xs text-slate-400">{t('performance.clickRowHint')}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-6 py-3">{t('performance.columns.worker')}</th>
                                                        <th className="px-6 py-3 text-right">{t('performance.columns.sessions')}</th>
                                                        <th className="px-6 py-3 text-right">{t('performance.columns.activeTime')}</th>
                                                        <th className="px-6 py-3 text-right">{t('performance.columns.totalOutput')}</th>
                                                        <th className="px-6 py-3 text-right">{t('performance.columns.efficiency')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {workerStats.map((stat) => (
                                                        <tr
                                                            key={stat.userId}
                                                            onClick={() => handleWorkerClick(stat.userId, stat.username)}
                                                            className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                                                        >
                                                            <td className="px-6 py-3 font-medium text-slate-900 group-hover:text-indigo-700">{stat.username}</td>
                                                            <td className="px-6 py-3 text-right text-slate-600">{stat.sessions}</td>
                                                            <td className="px-6 py-3 text-right text-slate-600">{stat.activeTimeHours} h</td>
                                                            <td className="px-6 py-3 text-right font-bold text-indigo-600">{stat.totalQuantity}</td>
                                                            <td className="px-6 py-3 text-right">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${stat.efficiency >= 100 ? 'bg-emerald-100 text-emerald-700' :
                                                                    stat.efficiency >= 80 ? 'bg-blue-100 text-blue-700' :
                                                                        stat.efficiency > 0 ? 'bg-amber-100 text-amber-700' :
                                                                            'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                    {stat.efficiency > 0 ? `${stat.efficiency}%` : 'N/A'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {workerStats.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-8 text-center text-slate-400">{t('performance.noData')}</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Worker Detail Modal */}
                {selectedWorker && (
                    <div className="absolute inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-right-10 duration-200">
                        {/* Detail Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedWorker(null)}
                                    className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 mr-2"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{selectedWorker.name}</h2>
                                    <p className="text-xs text-slate-500">{t('modal.activityLog', { startDate, endDate })}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedWorker(null)}
                                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100"
                            >
                                {t('modal.close')}
                            </button>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                            {loadingLogs ? (
                                <div className="py-20 flex justify-center text-indigo-500"><RefreshCw className="animate-spin w-8 h-8" /></div>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3">{t('modal.columns.wo')}</th>
                                                <th className="px-6 py-3">{t('modal.columns.step')}</th>
                                                <th className="px-6 py-3">{t('modal.columns.time')}</th>
                                                <th className="px-6 py-3 text-right">{t('modal.columns.duration')}</th>
                                                <th className="px-6 py-3 text-right">{t('modal.columns.qty')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {workerLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-slate-900">{log.woId}</td>
                                                    <td className="px-6 py-3 text-slate-600">
                                                        <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                                                            {log.stepName}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-slate-500 text-xs">
                                                        <div>{format(new Date(log.startTime), 'MMM d, HH:mm')}</div>
                                                        {log.endTime && <div className="text-slate-400">to {format(new Date(log.endTime), 'HH:mm')}</div>}
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-slate-600">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            {log.durationMinutes}m
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-bold text-indigo-600">{log.quantity}</td>
                                                </tr>
                                            ))}
                                            {workerLogs.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">{t('modal.noLogs')}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
