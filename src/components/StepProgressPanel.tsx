'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Play, Square, History, Clock, CheckCircle2, ChevronRight, X, AlertCircle, Pencil } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';

interface StepProgressPanelProps {
    orderId: string;
    orderName?: string;
    stepName: string;
    stepQuantity?: number;
    stepUnit?: string;
    role?: string;
    onClose: () => void;
}

interface ProgressRecord {
    id: string;
    startTime: string;
    endTime?: string;
    quantity: number;
    user: {
        username: string;
    };
}

export default function StepProgressPanel({ orderId, orderName, stepName, stepQuantity, stepUnit, role, onClose }: StepProgressPanelProps) {
    const t = useTranslations('StepTracking');
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<ProgressRecord[]>([]);
    const [myActiveSession, setMyActiveSession] = useState<ProgressRecord | null>(null);
    const [otherActiveUsers, setOtherActiveUsers] = useState<{ username: string; startTime: string }[]>([]);
    const [totalQuantity, setTotalQuantity] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Stop Modal State
    const [showStopModal, setShowStopModal] = useState(false);
    const [inputQuantity, setInputQuantity] = useState('');

    const [processing, setProcessing] = useState(false);

    // Start Modal State
    const [showStartModal, setShowStartModal] = useState(false);
    const [stdTimeHours, setStdTimeHours] = useState('');
    const [stdTimeMinutes, setStdTimeMinutes] = useState('');
    const [showEditStdTimeModal, setShowEditStdTimeModal] = useState(false);
    const [existingStandardTime, setExistingStandardTime] = useState<number | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Initial Data Fetch
    useEffect(() => {
        fetchProgress();
        return () => stopTimer();
    }, []);

    // Timer Logic
    useEffect(() => {
        if (myActiveSession) {
            startTimer(new Date(myActiveSession.startTime));
        } else {
            stopTimer();
            setElapsedSeconds(0);
        }
    }, [myActiveSession]);

    const startTimer = (startTime: Date) => {
        stopTimer();
        // Update immediately
        setElapsedSeconds(differenceInSeconds(new Date(), startTime));

        timerRef.current = setInterval(() => {
            setElapsedSeconds(differenceInSeconds(new Date(), startTime));
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const fetchProgress = async () => {
        try {
            const res = await fetch(`/api/step-progress/${orderId}/${encodeURIComponent(stepName)}`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
                setTotalQuantity(data.totalQuantity || 0);
                setMyActiveSession(data.myActiveSession || null);
                setOtherActiveUsers(data.otherActiveUsers || []);
                setExistingStandardTime(data.establishedStandardTime || null);
            }
        } catch (error) {
            console.error('Failed to fetch progress', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async () => {
        setProcessing(true);
        try {
            let standardTime = undefined;
            if (stdTimeHours || stdTimeMinutes) {
                standardTime = (parseInt(stdTimeHours) || 0) * 60 + (parseInt(stdTimeMinutes) || 0);
            }

            const res = await fetch('/api/step-progress/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    stepName,
                    standardTime
                })
            });
            setShowStartModal(false);

            if (res.ok) {
                await fetchProgress(); // Refresh to get active session
            } else {
                const errText = await res.text();
                console.error('Failed to start session:', errText);
                alert(`Failed to start session: ${errText}`);
            }
        } catch (error) {
            console.error('Start error', error);
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateStandardTime = async () => {
        setProcessing(true);
        try {
            const stdTime = (parseInt(stdTimeHours) || 0) * 60 + (parseInt(stdTimeMinutes) || 0);
            const res = await fetch('/api/step-progress/standard-time', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    stepName,
                    standardTime: stdTime
                })
            });

            if (res.ok) {
                setShowEditStdTimeModal(false);
                await fetchProgress(); // Refresh
                setStdTimeHours('');
                setStdTimeMinutes('');
            } else {
                alert('Failed to update standard time');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const [warningModal, setWarningModal] = useState<{ remaining: number; input: number } | null>(null);
    const [editModal, setEditModal] = useState<{ id: string; quantity: number; startTime: string; endTime?: string } | null>(null);

    const handleEditSave = async () => {
        if (!editModal) return;

        setProcessing(true);
        try {
            const res = await fetch('/api/step-progress/edit', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editModal.id,
                    quantity: editModal.quantity,
                    startTime: editModal.startTime,
                    endTime: editModal.endTime
                })
            });

            if (res.ok) {
                setEditModal(null);
                await fetchProgress(); // Refresh
            } else {
                const errText = await res.text();
                alert(`Failed to save: ${errText}`);
            }
        } catch (error) {
            console.error('Edit error', error);
        } finally {
            setProcessing(false);
        }
    };

    const handleStop = async () => {
        if (!inputQuantity) return;

        let qty = parseFloat(inputQuantity);

        // Round qty to 3 decimal places to avoid floating point artifacts
        qty = Math.round(qty * 1000) / 1000;

        // Validation: Strict Block - Do NOT allow exceeding remaining quantity
        if (stepQuantity) {
            const remaining = Math.round(Math.max(0, stepQuantity - totalQuantity) * 1000) / 1000;
            if (qty > remaining) {
                alert(`⚠️ Cannot exceed remaining quantity!\n\nYou entered: ${qty}\nRemaining: ${remaining}\n\nPlease enter ${remaining} or less.`);
                return; // Block submission
            }
        }

        setProcessing(true);
        try {
            const res = await fetch('/api/step-progress/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    progressId: myActiveSession?.id,
                    quantity: qty
                })
            });

            if (res.ok) {
                setShowStopModal(false);
                setWarningModal(null);
                setInputQuantity('');
                await fetchProgress(); // Refresh
            } else {
                const errText = await res.text();
                console.error('Failed to stop session:', errText);
                alert(`Failed to stop session: ${errText}`);
            }
        } catch (error) {
            console.error('Stop error', error);
        } finally {
            setProcessing(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Calculate progress percentage
    const progressPercent = stepQuantity ? Math.min(100, (totalQuantity / stepQuantity) * 100) : 0;
    const isComplete = stepQuantity && totalQuantity >= stepQuantity;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            {t('trackProgress')}
                            {isComplete && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                        </h3>
                        <div className="text-sm text-slate-500 font-mono">
                            {orderName || orderId} - <span className="font-semibold text-slate-700">{stepName}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {existingStandardTime && (
                            <div className="bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 flex items-center gap-2 shadow-sm">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Std Time</span>
                                    <span className="text-sm font-bold text-amber-700 font-mono">
                                        {Math.floor(existingStandardTime / 60)}h {existingStandardTime % 60}m
                                    </span>
                                </div>
                                {(role === 'supervisor' || role === 'admin') && (
                                    <button
                                        onClick={() => {
                                            setStdTimeHours(Math.floor(existingStandardTime / 60).toString());
                                            setStdTimeMinutes((existingStandardTime % 60).toString());
                                            setShowEditStdTimeModal(true);
                                        }}
                                        className="p-1 text-amber-400 hover:text-amber-600 rounded hover:bg-amber-100/50"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-6 flex-1">
                    {/* Progress Bar */}
                    {stepQuantity && (
                        <div className="mb-8">
                            <div className="flex justify-between text-sm mb-2 font-medium text-slate-700">
                                <span>{t('totalCompleted')}</span>
                                <span>{Math.round(totalQuantity * 1000) / 1000} / {stepQuantity} {stepUnit}</span>
                            </div>
                            <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                <div
                                    className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            {isComplete && (
                                <p className="text-green-600 text-xs font-bold mt-1 text-center animate-pulse">
                                    {t('targetReached')}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Main Control Area */}
                    <div className="flex flex-col items-center justify-center py-6 mb-8">
                        {loading ? (
                            <div className="animate-pulse text-slate-400">{t('loadingHistory')}</div>
                        ) : myActiveSession ? (
                            <div className="text-center w-full">
                                <div className="text-5xl font-mono font-bold text-slate-900 mb-2 tabular-nums tracking-wider">
                                    {formatDuration(elapsedSeconds)}
                                </div>
                                <div className="text-sm text-green-600 font-medium mb-6 bg-green-50 inline-block px-3 py-1 rounded-full animate-pulse">
                                    ● {t('activeSession')}
                                </div>

                                <button
                                    onClick={() => setShowStopModal(true)}
                                    disabled={processing}
                                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl text-lg font-bold shadow-lg shadow-red-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Square className="w-5 h-5 fill-current" />
                                    {t('stopStep')}
                                </button>
                            </div>
                        ) : (
                            <div className="text-center w-full">
                                <div className="text-5xl font-mono font-bold text-slate-300 mb-2 tabular-nums tracking-wider">
                                    00:00:00
                                </div>
                                <div className="text-sm text-slate-400 font-medium mb-4">
                                    {t('timeElapsed')}
                                </div>

                                {/* Show other workers currently active */}
                                {otherActiveUsers.length > 0 && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-left">
                                        <div className="text-xs font-bold text-blue-500 uppercase mb-1">Currently Working</div>
                                        {otherActiveUsers.map((u, i) => (
                                            <div key={i} className="text-sm text-blue-700 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                                {u.username}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        if (existingStandardTime) {
                                            handleStart();
                                        } else {
                                            setShowStartModal(true);
                                        }
                                    }}
                                    disabled={processing || !!isComplete}
                                    className={`w-full py-4 rounded-xl text-lg font-bold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2
                                        ${isComplete
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                                        }`}
                                >
                                    <Play className="w-5 h-5 fill-current" />
                                    {t('startStep')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* History List */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-500" />
                            {t('sessionHistory')}
                        </h4>

                        <div className="space-y-2">
                            {history.length === 0 ? (
                                <div className="text-slate-400 text-sm text-center py-6 border-2 border-dashed border-slate-100 rounded-lg">
                                    {t('noHistory')}
                                </div>
                            ) : (
                                history.map((record) => {
                                    const isActive = !record.endTime;
                                    const duration = isActive
                                        ? '...'
                                        : formatDuration(differenceInSeconds(new Date(record.endTime!), new Date(record.startTime)));

                                    return (
                                        <div key={record.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center text-sm">
                                            <div className="flex flex-col">
                                                <div className="font-semibold text-slate-700 flex items-center gap-2">
                                                    {record.user.username}
                                                    {isActive && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {format(new Date(record.startTime), 'MM-dd HH:mm')}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-400">{t('duration')}</div>
                                                    <div className="font-mono text-slate-600">{duration}</div>
                                                </div>
                                                <div className="text-right w-16">
                                                    <div className="text-xs text-slate-400">{t('quantity')}</div>
                                                    <div className="font-bold text-slate-900">{record.quantity} {stepUnit}</div>
                                                </div>
                                                {(role === 'supervisor' || role === 'admin') && (
                                                    <button
                                                        onClick={() => setEditModal({
                                                            id: record.id,
                                                            quantity: record.quantity,
                                                            startTime: record.startTime,
                                                            endTime: record.endTime
                                                        })}
                                                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stop Confirmation Modal */}
            {showStopModal && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-[60] backdrop-blur-[1px]">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-80 animate-in zoom-in-95 duration-200">
                        <h4 className="text-lg font-bold text-slate-900 mb-4">{t('enterQuantity')}</h4>

                        <div className="mb-6">
                            {stepQuantity && (
                                <div className="mb-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Remaining:</span>
                                        <span className="font-bold text-slate-700">
                                            {Math.round(Math.max(0, stepQuantity - totalQuantity) * 1000) / 1000} {stepUnit}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">{t('quantity')} ({stepUnit})</label>
                            <input
                                type="number"
                                autoFocus
                                value={inputQuantity}
                                onChange={(e) => setInputQuantity(e.target.value)}
                                className="w-full text-3xl font-bold text-center border-b-2 border-indigo-200 focus:border-indigo-600 outline-none py-2 text-indigo-600 placeholder-indigo-100"
                                placeholder="0"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowStopModal(false)}
                                className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStop}
                                disabled={!inputQuantity}
                                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none"
                            >
                                {t('confirmStop')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Warning Modal */}
            {warningModal && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[70] backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-80">
                        <div className="text-amber-500 mb-4 flex justify-center">
                            <AlertCircle className="w-12 h-12" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-2 text-center">{t('warningOverQuantity')}</h4>
                        <p className="text-slate-500 text-center text-sm mb-6">
                            {t('remaining')}: {warningModal.remaining} {stepUnit}<br />
                            {t('input')}: {warningModal.input} {stepUnit}
                        </p>

                        <div className="flex gap-2">
                            <button onClick={() => setWarningModal(null)} className="flex-1 py-2 bg-slate-100 rounded-lg font-medium hover:bg-slate-200">{t('cancel')}</button>
                            <button onClick={handleStop} className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium shadow-amber-200 hover:bg-amber-600">{t('ignoreExpected')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModal && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-[80] backdrop-blur-[1px]">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-96 animate-in zoom-in-95 duration-200">
                        <h4 className="text-lg font-bold text-slate-900 mb-4">{t('editSession')}</h4>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">{t('quantity')} ({stepUnit})</label>
                                <input
                                    type="number"
                                    value={isNaN(editModal.quantity) ? '' : editModal.quantity}
                                    onChange={(e) => setEditModal({ ...editModal, quantity: parseFloat(e.target.value) })}
                                    className="w-full text-lg font-medium border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">{t('startTime')}</label>
                                <input
                                    type="datetime-local"
                                    value={format(new Date(editModal.startTime), "yyyy-MM-dd'T'HH:mm")}
                                    onChange={(e) => setEditModal({ ...editModal, startTime: new Date(e.target.value).toISOString() })}
                                    className="w-full text-sm border rounded-lg px-3 py-2 text-slate-900"
                                />
                            </div>
                            {editModal.endTime && (
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">{t('endTime')}</label>
                                    <input
                                        type="datetime-local"
                                        value={format(new Date(editModal.endTime), "yyyy-MM-dd'T'HH:mm")}
                                        onChange={(e) => setEditModal({ ...editModal, endTime: new Date(e.target.value).toISOString() })}
                                        className="w-full text-sm border rounded-lg px-3 py-2 text-slate-900"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setEditModal(null)}
                                className="flex-1 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={processing}
                                className="flex-1 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700"
                            >
                                {t('saveChanges')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Start Modal */}
            {showStartModal && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-[60] backdrop-blur-[1px]">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-80 animate-in zoom-in-95 duration-200">
                        <h4 className="text-lg font-bold text-slate-900 mb-4">{t('startStep')}</h4>

                        <div className="mb-6">
                            <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">
                                Given Time (Standard)
                            </label>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        value={stdTimeHours}
                                        onChange={(e) => setStdTimeHours(e.target.value)}
                                        className="w-full text-2xl font-bold text-center border-b-2 border-indigo-200 focus:border-indigo-600 outline-none py-1 text-indigo-600 placeholder-indigo-100"
                                        placeholder="0"
                                    />
                                    <span className="block text-center text-xs text-slate-400 mt-1">Hrs</span>
                                </div>
                                <span className="text-xl font-bold text-slate-300 mb-4">:</span>
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        autoFocus
                                        value={stdTimeMinutes}
                                        onChange={(e) => setStdTimeMinutes(e.target.value)}
                                        className="w-full text-2xl font-bold text-center border-b-2 border-indigo-200 focus:border-indigo-600 outline-none py-1 text-indigo-600 placeholder-indigo-100"
                                        placeholder="0"
                                    />
                                    <span className="block text-center text-xs text-slate-400 mt-1">Mins</span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-4 text-center">
                                Input the target time for this task
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowStartModal(false)}
                                className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-lg"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleStart}
                                disabled={processing}
                                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none"
                            >
                                Start Timer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Standard Time Modal */}
            {showEditStdTimeModal && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-[90] backdrop-blur-[1px]">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-80 animate-in zoom-in-95 duration-200">
                        <h4 className="text-lg font-bold text-slate-900 mb-4">Edit Standard Time</h4>

                        <div className="mb-6">
                            <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">
                                Given Time (Standard)
                            </label>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        value={stdTimeHours}
                                        onChange={(e) => setStdTimeHours(e.target.value)}
                                        className="w-full text-2xl font-bold text-center border-b-2 border-amber-200 focus:border-amber-600 outline-none py-1 text-amber-600 placeholder-amber-100"
                                        placeholder="0"
                                    />
                                    <span className="block text-center text-xs text-slate-400 mt-1">Hrs</span>
                                </div>
                                <span className="text-xl font-bold text-slate-300 mb-4">:</span>
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        autoFocus
                                        value={stdTimeMinutes}
                                        onChange={(e) => setStdTimeMinutes(e.target.value)}
                                        className="w-full text-2xl font-bold text-center border-b-2 border-amber-200 focus:border-amber-600 outline-none py-1 text-amber-600 placeholder-amber-100"
                                        placeholder="0"
                                    />
                                    <span className="block text-center text-xs text-slate-400 mt-1">Mins</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowEditStdTimeModal(false)}
                                className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-lg"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleUpdateStandardTime}
                                disabled={processing}
                                className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-lg shadow-lg shadow-amber-200 hover:bg-amber-600 disabled:opacity-50 disabled:shadow-none"
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
