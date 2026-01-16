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
    const [activeTab, setActiveTab] = useState<'overview'>('overview');

    // Overview State
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [overviewData, setOverviewData] = useState<AnalyticsData | null>(null);

    useEffect(() => {
        if (isOpen && productId) {
            fetchOverviewData();
        }
    }, [isOpen, productId]);

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
                    {/* Custom Builder Tab Removed as per request */}
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
                </div>
            </div>
        </div>
    );
}
