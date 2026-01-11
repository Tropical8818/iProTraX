export default function TermsPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-8 font-sans">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h1 className="text-3xl font-bold mb-6 text-slate-900">Terms of Service (服务条款)</h1>
                <p className="mb-4 text-sm text-slate-500">Last updated: January 11, 2026</p>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-3">1. Usage Agreement</h2>
                    <p>By using iProTraX, you agree to comply with internal company data security policies. This system is intended for authorized professional use only.</p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-3">2. Account Security</h2>
                    <p>Users are responsible for maintaining the confidentiality of their Employee ID and password. Unauthorized access should be reported to the IT department immediately.</p>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold mb-3">3. Data Accuracy</h2>
                    <p>Users responsible for importing Excel data must ensure accuracy to maintain production integrity.</p>
                </section>

                <div className="border-t pt-6 mt-8">
                    <a href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">← Back to Login</a>
                </div>
            </div>
        </div>
    );
}
