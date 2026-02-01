'use client';

import { useState, useEffect } from 'react';
import { useLocaleDetection } from '@/hooks/useLocaleDetection';

interface Props {
    className?: string;
}

// Define SVG components outside to prevent recreation on each render (ESLint: react-hooks/static-components)
const USFlag = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 741 390" className="w-7 h-5 rounded-sm shadow-sm">
        <path fill="#b22234" d="M0 0h741v30H0zM0 60h741v30H0zM0 120h741v30H0zM0 180h741v30H0zM0 240h741v30H0zM0 300h741v30H0zM0 360h741v30H0z" /><path fill="#fff" d="M0 30h741v30H0zM0 90h741v30H0zM0 150h741v30H0zM0 210h741v30H0zM0 270h741v30H0zM0 330h741v30H0z" /><path fill="#3c3b6e" d="M0 0h296.4v210H0z" /><g fill="#fff"><path d="M24.7 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M74.1 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M123.5 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M172.9 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M222.3 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M271.7 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /></g></svg>
);

const CNFlag = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" className="w-7 h-5 rounded-sm shadow-sm">
        <rect width="30" height="20" fill="#de2910" /><path fill="#ffde00" d="M5 5l-1.123.816.429-1.321-1.123-.816h1.388L5 2.358l.429 1.321h1.388l-1.123.816.429 1.321L5 5z" /><circle fill="#ffde00" cx="10" cy="2" r="0.4" /><circle fill="#ffde00" cx="12" cy="4" r="0.4" /><circle fill="#ffde00" cx="12" cy="7" r="0.4" /><circle fill="#ffde00" cx="10" cy="9" r="0.4" /></svg>
);

export function LanguageSwitcher({ className = '' }: Props) {
    const currentLocale = useLocaleDetection();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Delay to avoid strict linter warning about cascading renders
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    // Default to 'en' until hydrated to match Server HTML
    const displayLocale = mounted ? currentLocale : 'en';

    const toggleLanguage = () => {
        const newLocale = currentLocale === 'en' ? 'zh' : 'en';

        // Set cookie with explicit SameSite and path
        document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

        // Use purely native reload to ensure full server re-render
        window.location.reload();
    };

    return (
        <button
            onClick={toggleLanguage}
            className={`p-2.5 rounded-lg transition-all shadow-lg flex items-center justify-center ${className || 'text-slate-500 hover:bg-slate-100'}`}
            title={displayLocale === 'en' ? '切换到中文' : 'Switch to English'}
            aria-label="Switch Language"
        >
            <div className="w-7 h-5 flex items-center justify-center">
                {displayLocale === 'zh' ? <CNFlag /> : <USFlag />}
            </div>
        </button>
    );
}
