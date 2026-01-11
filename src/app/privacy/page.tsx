import { useTranslations } from 'next-intl';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-8 font-sans">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h1 className="text-3xl font-bold mb-6 text-slate-900">Privacy Policy (隐私政策)</h1>
                <p className="mb-4 text-sm text-slate-500">Last updated: January 11, 2026</p>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-3">1. Information Collection</h2>
                    <p>iProTraX is an internal manufacturing tracking system. We collect limited professional data including:</p>
                    <ul className="list-disc ml-6 mt-2 space-y-1">
                        <li>Employee IDs and Usernames for authentication.</li>
                        <li>Production order data (imported via Excel).</li>
                        <li>Operation logs for traceability.</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-3">2. Data Usage</h2>
                    <p>Data is used exclusively for internal shop floor monitoring and production management. We do not sell or share data with third parties.</p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-3">3. Cookies</h2>
                    <p>We use essential cookies (`protracker_sess`) purely for session management and security. These cookies are encrypted and cannot be read by third-party scripts.</p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-3">4. Security</h2>
                    <p>We implement industry-standard security measures, including JWT encryption, HttpOnly cookies, and role-based access control to protect internal data.</p>
                </section>

                <div className="border-t pt-6 mt-8">
                    <a href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">← Back to Login</a>
                </div>
            </div>
        </div>
    );
}
