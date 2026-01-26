'use client';
import { MessageCircle } from 'lucide-react';

interface Props {
    variant: 'header' | 'table' | 'mobile';
    count?: number;
    unreadCount?: number;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
    title?: string;
}

export function UnifiedMessageButton({ variant, count, unreadCount, onClick, className = '', title }: Props) {
    const hasUnread = unreadCount !== undefined && unreadCount > 0;

    if (variant === 'header') {
        return (
            <button
                onClick={onClick}
                className={`relative p-2 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 ${className}`}
                title={title || "Notifications"}
            >
                <MessageCircle size={20} className="text-slate-600" />
                {hasUnread && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center font-bold border-2 border-white shadow-sm scale-90">
                        {unreadCount! > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
        );
    }

    if (variant === 'table') {
        const hasTotal = count !== undefined && count > 0;
        // Don't hide if it's explicitly placed, but for indicators we often hide if empty
        // However, this component should just render what it's told.

        return (
            <button
                onClick={onClick}
                className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-all active:scale-95 ${className}`}
                title={title}
            >
                <MessageCircle
                    size={16}
                    className={hasUnread ? 'text-blue-600' : 'text-slate-400'}
                />
                {count !== undefined && (
                    <span className={`text-xs ${hasUnread ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                        {count}
                    </span>
                )}
                {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
            </button>
        );
    }

    if (variant === 'mobile') {
        return (
            <button
                onClick={onClick}
                className={`p-3 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:bg-slate-50 active:bg-slate-100 transition-all shadow-sm flex items-center justify-center relative ${className}`}
                title={title}
            >
                <MessageCircle className="w-5 h-5" />
                {hasUnread && (
                    <span className="absolute top-2.5 right-2.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                )}
            </button>
        );
    }

    return null;
}
