'use client';

import { useState, useEffect } from 'react';
import { Lock, LogIn, Loader2, Eye, EyeOff, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { APP_VERSION } from '@/lib/version';
import { useTranslations } from 'next-intl';
import { useLocaleDetection } from '@/hooks/useLocaleDetection';

export default function LoginPage() {
    const t = useTranslations('Login');
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [successMsg, setSuccessMsg] = useState('');

    const currentLocale = useLocaleDetection();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, password })
            });

            const data = await res.json();

            if (data.success) {
                setSuccessMsg(t('success'));
                // Delay to let user see the outcome
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                setError(data.error || t('invalidCredentials'));
                setLoading(false);
            }
        } catch {
            setError(t('failed'));
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative">
                    {/* Language Switcher - Dynamic Flag */}
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
                        className="absolute top-6 right-6 z-50 px-3 py-2 rounded-lg transition-all shadow-lg text-white hover:text-indigo-300 hover:bg-white/20 border border-white/30 flex items-center justify-center min-w-[3.5rem]"
                        title={currentLocale === 'en' ? '切换到中文' : 'Switch to English'}
                        aria-label="Switch Language"
                    >
                        <div suppressHydrationWarning>
                            {mounted ? (
                                currentLocale === 'en' ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" className="w-7 h-5 rounded-sm shadow-sm">
                                        <rect width="30" height="20" fill="#de2910" /><path fill="#ffde00" d="M5 5l-1.123.816.429-1.321-1.123-.816h1.388L5 2.358l.429 1.321h1.388l-1.123.816.429 1.321L5 5z" /><circle fill="#ffde00" cx="10" cy="2" r="0.4" /><circle fill="#ffde00" cx="12" cy="4" r="0.4" /><circle fill="#ffde00" cx="12" cy="7" r="0.4" /><circle fill="#ffde00" cx="10" cy="9" r="0.4" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 741 390" className="w-7 h-5 rounded-sm shadow-sm">
                                        <path fill="#b22234" d="M0 0h741v30H0zM0 60h741v30H0zM0 120h741v30H0zM0 180h741v30H0zM0 240h741v30H0zM0 300h741v30H0zM0 360h741v30H0z" /><path fill="#fff" d="M0 30h741v30H0zM0 90h741v30H0zM0 150h741v30H0zM0 210h741v30H0zM0 270h741v30H0zM0 330h741v30H0z" /><path fill="#3c3b6e" d="M0 0h296.4v210H0z" /><g fill="#fff"><path d="M24.7 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M74.1 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M123.5 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M172.9 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M222.3 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /><path d="M271.7 10l1.2 3.7h3.9l-3.2 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.2-2.3h3.9z" /></g>
                                    </svg>
                                )
                            ) : null}
                        </div>
                    </button>

                    <div className="flex flex-col items-center mb-8">
                        <div className="bg-indigo-500/20 p-4 rounded-2xl mb-4">
                            <Lock className="w-10 h-10 text-indigo-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white">iProTraX <span className="text-indigo-400 text-lg">{APP_VERSION}</span></h1>
                        <p className="text-slate-400 mt-2">{t('subtitle')}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <input
                                id="employeeId"
                                name="employeeId"
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white pl-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-500"
                                placeholder={t('employeeId')}
                                autoFocus
                            />
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        </div>

                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={visible ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white pl-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-12 placeholder-slate-500"
                                placeholder={t('password')}
                            />
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <button
                                type="button"
                                onClick={() => setVisible(!visible)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                            >
                                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm text-center">
                                {error}
                            </div>
                        )}

                        {successMsg && (
                            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-300 text-sm text-center">
                                {successMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !employeeId || !password}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-4"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    {t('login')}
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 flex flex-col items-center gap-3">
                        <a href="/register" className="text-slate-400 hover:text-white transition-colors text-sm">
                            {t('noAccount')}
                        </a>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                            <a href="/privacy" className="hover:text-slate-400 underline decoration-slate-700">Privacy Policy</a>
                            <span>•</span>
                            <a href="/terms" className="hover:text-slate-400 underline decoration-slate-700">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
