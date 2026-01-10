'use client';

import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
    className?: string;
}

export function LanguageSwitcher({ className = '' }: Props) {
    const router = useRouter();

    const toggleLanguage = () => {
        const currentLocale = document.cookie
            .split('; ')
            .find(row => row.startsWith('NEXT_LOCALE='))
            ?.split('=')[1] || 'en';

        const newLocale = currentLocale === 'en' ? 'zh' : 'en';

        // Set cookie with explicit SameSite and path
        document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

        // Use purely native reload to ensure full server re-render
        window.location.reload();
    };

    return (
        <button
            onClick={toggleLanguage}
            className={`p-2.5 rounded-lg transition-all shadow-lg ${className || 'text-slate-500 hover:bg-slate-100'}`}
            title="Switch Language (English/中文)"
            aria-label="Switch Language"
        >
            <Globe className="w-6 h-6" />
        </button>
    );
}
