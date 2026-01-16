'use client';

import React, { useState, useEffect } from 'react';
import {
    X, TrendingUp, BarChart2, PieChart, Filter, Save,
    RefreshCw, Download, Layers, CheckCircle2, AlertTriangle, Info
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';
import { format } from 'date-fns';

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

interface AnalyticsDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    productId: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsDashboard({ isOpen, onClose, productId }: AnalyticsDashboardProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'builder'>('overview');

    // Overview State
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [overviewData, setOverviewData] = useState<AnalyticsData | null>(null);

    // Builder State
    const [builderConfig, setBuilderConfig] = useState({
        source: 'orders', // 'orders' | 'logs'
        groupBy: 'status',
        metric: 'count',
        timeRange: '7d'
    });
    const [builderResult, setBuilderResult] = useState<any[]>([]);
    const [loadingBuilder, setLoadingBuilder] = useState(false);
    const [builderError, setBuilderError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && activeTab === 'overview' && productId) {
            fetchOverviewData();
        }
    }, [isOpen, activeTab, productId]);

    // Fetch Overview Data (Legacy API)
    const fetchOverviewData = async () => {
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
    };

    // Run Builder Query (New API)
    const runBuilderQuery = async () => {
        if (!productId) return;
        setLoadingBuilder(true);
        setBuilderError(null);
        try {
            const res = await fetch('/api/analytics/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...builderConfig,
                    filters: { productId: productId === 'all' ? undefined : productId }
                })
            });
            if (res.ok) {
                const json = await res.json();
                console.log('[Analytics UI] Received data:', json);
                setBuilderResult(json.data || []);
                if (!json.data || json.data.length === 0) {
                    setBuilderError('No data found for the selected filters. Try changing the time range to "All Time".');
                }
            } else {
                const errJson = await res.json().catch(() => ({}));
                setBuilderError(errJson.error || 'Query failed');
            }
        } catch (err) {
            console.error('Query failed', err);
            setBuilderError('Network error or server unavailable');
        } finally {
            setLoadingBuilder(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                            <BarChart2 className="w-6 h-6 text-indigo-700" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Analytics Dashboard</h2>
                            <p className="text-xs text-slate-500 font-medium">Unified Reporting & Insights</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-slate-100 pt-2 flex gap-6">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('builder')}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'builder' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Filter className="w-3 h-3" />
                        Custom Builder
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
                                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Total Output (7d)</div>
                                            <div className="text-2xl font-bold text-emerald-600">{overviewData.summary.totalOutput}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Top Producer</div>
                                            <div className="text-2xl font-bold text-indigo-600 truncate">{overviewData.summary.topProducer}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Bottleneck Step</div>
                                            <div className="text-2xl font-bold text-orange-600 truncate">{overviewData.summary.bottleneck}</div>
                                        </div>
                                    </div>

                                    {/* Charts Grid */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Trend */}
                                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[350px]">
                                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500" /> Daily Production</h3>
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
                                                    <Area type="monotone" dataKey="output" stroke="#4f46e5" fillOpacity={1} fill="url(#colorOutput)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Productivity */}
                                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[350px]">
                                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Step Output</h3>
                                            <ResponsiveContainer width="100%" height="90%">
                                                <BarChart data={overviewData.productivity}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" fontSize={10} />
                                                    <YAxis fontSize={10} />
                                                    <Tooltip />
                                                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-20 text-slate-400">No data available</div>
                            )}
                        </div>
                    )}


                    {/* -- BUILDER TAB -- */}
                    {activeTab === 'builder' && (
                        <div className="flex flex-col h-full gap-6">
                            {/* Controls */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Data Source</label>
                                    <select
                                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800"
                                        value={builderConfig.source}
                                        onChange={(e) => setBuilderConfig({ ...builderConfig, source: e.target.value })}
                                    >
                                        <option value="orders">Work Orders (Current)</option>
                                        <option value="logs">Operation Logs (History)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Group By</label>
                                    <select
                                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800"
                                        value={builderConfig.groupBy}
                                        onChange={(e) => setBuilderConfig({ ...builderConfig, groupBy: e.target.value })}
                                    >
                                        <option value="status">Status</option>
                                        <option value="priority">Priority</option>
                                        {builderConfig.source === 'logs' && <option value="userId">Operator</option>}
                                        {builderConfig.source === 'logs' && <option value="action">Action Type</option>}
                                        {builderConfig.source === 'logs' && <option value="step">Step</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Time Range</label>
                                    <select
                                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800"
                                        value={builderConfig.timeRange}
                                        onChange={(e) => setBuilderConfig({ ...builderConfig, timeRange: e.target.value })}
                                    >
                                        <option value="today">Today</option>
                                        <option value="7d">Last 7 Days</option>
                                        <option value="30d">Last 30 Days</option>
                                        <option value="3m">Last 3 Months</option>
                                        <option value="all">All Time</option>
                                    </select>
                                </div>
                                <button
                                    onClick={runBuilderQuery}
                                    disabled={loadingBuilder}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loadingBuilder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
                                    Run Query
                                </button>
                            </div>

                            {/* Chart Area */}
                            <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[450px]">
                                {loadingBuilder ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                                    </div>
                                ) : builderResult.length > 0 ? (
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-slate-700 mb-4 text-center">
                                            {builderConfig.metric.toUpperCase()} by {builderConfig.groupBy.toUpperCase()}
                                        </h3>
                                        <ResponsiveContainer width="100%" height={350}>
                                            <BarChart data={builderResult}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" fontSize={12} />
                                                <YAxis fontSize={12} />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40}>
                                                    {builderResult.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                                        <div className="bg-slate-50 p-6 rounded-full">
                                            <BarChart2 className="w-12 h-12 text-slate-300" />
                                        </div>
                                        {builderError ? (
                                            <div className="text-center">
                                                <p className="text-amber-600 font-medium">{builderError}</p>
                                                <p className="text-xs text-slate-400 mt-1">Check if you have data in the selected product line</p>
                                            </div>
                                        ) : (
                                            <p>Select parameters and click "Run Query" to visualize data</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
