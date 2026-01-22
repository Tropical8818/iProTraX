'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';

interface Props {
    className?: string;
}

// Get theme from cookie or system preference
function getTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';

    const savedTheme = document.cookie
        .split('; ')
        .find(row => row.startsWith('theme='))
        ?.split('=')[1] as 'light' | 'dark' | undefined;

    if (savedTheme) return savedTheme;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Subscribe to theme changes (for useSyncExternalStore)
function subscribe(callback: () => void): () => void {
    // Listen for storage events (for multi-tab sync)
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
}

// Server snapshot
function getServerSnapshot(): 'light' | 'dark' {
    return 'light';
}

export function ThemeSwitcher({ className = '' }: Props) {
    const theme = useSyncExternalStore(subscribe, getTheme, getServerSnapshot);
    const hasAppliedRef = useRef(false);

    // Apply theme class to document
    useEffect(() => {
        if (hasAppliedRef.current && theme === getTheme()) return;
        hasAppliedRef.current = true;

        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = useCallback(() => {
        const newTheme = theme === 'light' ? 'dark' : 'light';

        // Save to cookie
        document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

        // Apply immediately
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Force re-render via storage event
        window.dispatchEvent(new StorageEvent('storage'));
    }, [theme]);

    return (
        <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${className || 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'}`}
            title={theme === 'light' ? '切换到夜间模式' : 'Switch to Light Mode'}
            aria-label="Toggle Theme"
        >
            {theme === 'light' ? (
                <Moon className="w-5 h-5" />
            ) : (
                <Sun className="w-5 h-5 text-yellow-400" />
            )}
        </button>
    );
}
