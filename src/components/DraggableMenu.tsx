'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, HardHat, Table2, Pencil, Ban, PauseCircle, Eraser, Upload, ScanBarcode, RefreshCw, Settings, LogOut, BarChart2 } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';
import type { Product } from '@/lib/config';
import { APP_VERSION } from '@/lib/version';
import { useTranslations } from 'next-intl';

interface DraggableMenuProps {
    products: Product[];
    selectedProductId: string;
    role: string;
    onNavigate: (path: string) => void;

    // Toggles
    pMode: boolean; setPMode: (v: boolean) => void;
    naMode: boolean; setNaMode: (v: boolean) => void;
    holdMode: boolean; setHoldMode: (v: boolean) => void;
    eraseMode: boolean; setEraseMode: (v: boolean) => void;
    handleEraseRequest: () => void;

    // Actions
    onImport: () => void;
    onScan: () => void;
    onShowAnalytics: () => void;
    onRefresh: () => void;
    onLogout: () => void;
}

// Helper to get initial position (runs only once)
function getInitialPosition() {
    if (typeof window !== 'undefined') {
        return { x: window.innerWidth - 70, y: 80 };
    }
    return { x: 300, y: 80 };
}

export default function DraggableMenu({
    selectedProductId,
    role, onNavigate,
    pMode, setPMode,
    naMode, setNaMode,
    holdMode, setHoldMode,
    eraseMode, setEraseMode,
    handleEraseRequest,
    onImport, onScan, onShowAnalytics, onRefresh, onLogout
}: DraggableMenuProps) {
    const t = useTranslations('Dashboard.mobileMenu');
    const [isOpen, setIsOpen] = useState(false);
    // Use lazy initialization to avoid SSR/hydration mismatch
    const [position, setPosition] = useState(getInitialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const initialPos = useRef({ x: 0, y: 0 });
    const [hasMoved, setHasMoved] = useState(false);

    // Mark as mounted for hydration handling
    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setPosition(p => ({
                x: Math.min(p.x, window.innerWidth - 60),
                y: Math.min(p.y, window.innerHeight - 60)
            }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Don't render until mounted (avoids hydration mismatch)
    if (!mounted) return null;

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        setHasMoved(false);
        dragStart.current = { x: e.clientX, y: e.clientY };
        initialPos.current = { ...position };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;

        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            setHasMoved(true);
        }

        setPosition({
            x: initialPos.current.x + dx,
            y: initialPos.current.y + dy
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);

        const padding = 10;
        const buttonSize = 56;
        let newX = position.x;
        let newY = position.y;

        if (newX < padding) newX = padding;
        if (newX > window.innerWidth - buttonSize - padding) newX = window.innerWidth - buttonSize - padding;
        if (newY < padding) newY = padding;
        if (newY > window.innerHeight - buttonSize - padding) newY = window.innerHeight - buttonSize - padding;

        setPosition({ x: newX, y: newY });
    };

    const handleClick = () => {
        if (!hasMoved) {
            setIsOpen(!isOpen);
        }
    };

    if (isOpen) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
                <div
                    className="absolute bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 w-[240px] flex flex-col gap-3 animate-in fade-in zoom-in duration-200"
                    style={{
                        top: Math.min(Math.max(position.y, 10), window.innerHeight - 450),
                        left: position.x > window.innerWidth / 2 ? position.x - 180 : position.x
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2 mb-1">
                        <span className="font-bold text-slate-800 dark:text-white">{t('menu')}</span>
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>

                    {/* Primary Actions: Operation & Scan */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => { onNavigate(`/dashboard/operation?product=${selectedProductId}`); setIsOpen(false); }}
                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 font-medium transition-colors border border-slate-100/50 dark:border-slate-600/50"
                        >
                            <HardHat className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                            <span className="text-sm">{t('operation')}</span>
                        </button>

                        <button
                            onClick={() => { onScan(); setIsOpen(false); }}
                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 font-medium transition-colors border border-slate-100/50 dark:border-slate-600/50"
                        >
                            <ScanBarcode className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                            <span className="text-sm">{t('scanBarcode')}</span>
                        </button>
                    </div>

                    {/* Secondary Nav - Compact Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => { onNavigate(`/dashboard`); setIsOpen(false); }}
                            className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 font-medium transition-colors border border-slate-100/50 dark:border-slate-600/50 text-sm"
                        >
                            <Table2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span>{t('home')}</span>
                        </button>

                        <button
                            onClick={() => { onShowAnalytics(); setIsOpen(false); }}
                            className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 font-medium transition-colors border border-slate-100/50 dark:border-slate-600/50 text-sm"
                        >
                            <BarChart2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span>{t('reports')}</span>
                        </button>

                        {(role === 'admin' || role === 'supervisor') && (
                            <button
                                onClick={() => { onImport(); setIsOpen(false); }}
                                className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 font-medium transition-colors border border-slate-100/50 dark:border-slate-600/50 text-sm"
                            >
                                <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                <span>{t('import')}</span>
                            </button>
                        )}

                        <button
                            onClick={() => { onNavigate('/dashboard/settings'); setIsOpen(false); }}
                            className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 font-medium transition-colors border border-slate-100/50 dark:border-slate-600/50 text-sm"
                        >
                            <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span>{t('settings')}</span>
                        </button>

                        <button
                            onClick={() => { onRefresh(); setIsOpen(false); }}
                            className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 font-medium transition-colors border border-slate-100/50 dark:border-slate-600/50 text-sm col-span-2"
                        >
                            <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span>{t('refresh')}</span>
                        </button>
                    </div>

                    {(role === 'admin' || role === 'supervisor') && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">{t('quickActions')}</label>
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={() => { setPMode(!pMode); if (!pMode) { setNaMode(false); setEraseMode(false); setHoldMode(false); } setIsOpen(false); }}
                                    className={`aspect-square rounded-xl flex items-center justify-center transition-all ${pMode ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                    title={t('pMode')}
                                >
                                    <Pencil className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => { setNaMode(!naMode); if (!naMode) { setPMode(false); setEraseMode(false); setHoldMode(false); } setIsOpen(false); }}
                                    className={`aspect-square rounded-xl flex items-center justify-center transition-all ${naMode ? 'bg-slate-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                    title={t('naMode')}
                                >
                                    <Ban className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => { setHoldMode(!holdMode); if (!holdMode) { setPMode(false); setNaMode(false); setEraseMode(false); } setIsOpen(false); }}
                                    className={`aspect-square rounded-xl flex items-center justify-center transition-all ${holdMode ? 'bg-orange-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                    title={t('holdMode')}
                                >
                                    <PauseCircle className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => { handleEraseRequest(); setIsOpen(false); }}
                                    className={`aspect-square rounded-xl flex items-center justify-center transition-all ${eraseMode ? 'bg-red-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                    title={t('eraseMode')}
                                >
                                    <Eraser className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>{APP_VERSION}</span>

                            {/* Theme Switcher - ADDED */}
                            <ThemeSwitcher className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg p-1" />

                            {/* Language Switcher */}
                            <button
                                onClick={() => {
                                    const locale = document.cookie
                                        .split('; ')
                                        .find(row => row.startsWith('NEXT_LOCALE='))
                                        ?.split('=')[1] || 'en';
                                    const newLocale = locale === 'en' ? 'zh' : 'en';
                                    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
                                    window.location.reload();
                                }}
                                className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                                title={typeof window !== 'undefined' && document.cookie.includes('NEXT_LOCALE=zh') ? t('switchToEnglish') : t('switchToChinese')}
                            >
                                {typeof window !== 'undefined' && document.cookie.includes('NEXT_LOCALE=zh') ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 741 390" className="w-5 h-3.5 rounded-sm shadow-sm">
                                        <path fill="#b22234" d="M0 0h741v30H0zM0 60h741v30H0zM0 120h741v30H0zM0 180h741v30H0zM0 240h741v30H0zM0 300h741v30H0zM0 360h741v30H0z" /><path fill="#fff" d="M0 30h741v30H0zM0 90h741v30H0zM0 150h741v30H0zM0 210h741v30H0zM0 270h741v30H0zM0 330h741v30H0z" /><path fill="#3c3b6e" d="M0 0h296.4v210H0z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" className="w-5 h-3.5 rounded-sm shadow-sm">
                                        <rect width="30" height="20" fill="#de2910" /><path fill="#ffde00" d="M5 5l-1.123.816.429-1.321-1.123-.816h1.388L5 2.358l.429 1.321h1.388l-1.123.816.429 1.321L5 5z" /><circle fill="#ffde00" cx="10" cy="2" r="0.4" /><circle fill="#ffde00" cx="12" cy="4" r="0.4" /><circle fill="#ffde00" cx="12" cy="7" r="0.4" /><circle fill="#ffde00" cx="10" cy="9" r="0.4" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium">
                            <LogOut className="w-4 h-4" />
                            {t('logOut')}
                        </button>
                    </div>
                </div>
            </div >
        );
    }

    return (
        <button
            className="fixed z-[90] w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-transform touch-none"
            style={{
                left: position.x,
                top: position.y,
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={handleClick}
        >
            <Menu className="w-7 h-7" />
        </button>
    );
}
