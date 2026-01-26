'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { UnifiedMessageButton } from './common/UnifiedMessageButton';

export function MessageNotification() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMessages();

        // Poll every 30 seconds
        const interval = setInterval(fetchMessages, 30000);

        // Listen for updates from other components
        const handleUpdate = () => fetchMessages();
        window.addEventListener('messages-updated', handleUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('messages-updated', handleUpdate);
        };
    }, []);

    const fetchMessages = async () => {
        try {
            const res = await fetch('/api/messages/my');
            if (res.ok) {
                // Check if response is actually JSON
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const result = await res.json();
                    setData(result);
                } else {
                    // Safety fallback: read text first to avoid "Unexpected end of JSON input"
                    const text = await res.text();
                    try {
                        if (text) {
                            const result = JSON.parse(text);
                            setData(result);
                        }
                    } catch (e) {
                        console.warn('Received non-JSON response from messages API:', text.substring(0, 100));
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMessageClick = async (msg: any) => {
        // Mark as read
        try {
            await fetch(`/api/messages/${msg.id}/read`, { method: 'POST' });
            fetchMessages(); // Refresh
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }

        // Navigate to order and step
        const params = new URLSearchParams({
            product: msg.order.productId,
            wo: msg.order.woId,
            step: msg.stepName // Auto-open this step
        });
        router.push(`/dashboard/operation?${params.toString()}`);
        setIsOpen(false);
    };

    const unreadCount = data?.unreadCount || 0;
    const messages = data?.messages || [];

    return (
        <div className="relative">
            <UnifiedMessageButton
                variant="header"
                unreadCount={unreadCount}
                onClick={() => setIsOpen(!isOpen)}
                title="Notifications"
            />

            {/* Click outside to close - must be before dropdown */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setIsOpen(false)}
                    />

                    <div className="absolute right-0 top-12 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[101] overflow-hidden ring-1 ring-black/5">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                            <h3 className="font-bold text-slate-800 dark:text-white">💬 Messages</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{unreadCount} unread</span>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                await fetch('/api/messages/read-all', { method: 'POST' });
                                                fetchMessages();
                                            } catch (error) {
                                                console.error('Failed to mark all as read:', error);
                                            }
                                        }}
                                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[450px] overflow-y-auto no-scrollbar">
                            {loading ? (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">Loading...</div>
                            ) : messages.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <MessageCircle className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 text-sm">No new messages</p>
                                </div>
                            ) : (
                                messages.slice(0, 10).map((msg: any) => (
                                    <div
                                        key={msg.id}
                                        onClick={() => handleMessageClick(msg)}
                                        className={`group px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all ${msg.isUnread ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-transform group-hover:scale-110 ${msg.isUnread ? 'bg-indigo-500 shadow-sm shadow-indigo-200' : 'bg-slate-200'}`} />

                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                                                        {msg.user.username}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                        {formatTime(msg.createdAt)}
                                                    </span>
                                                </div>

                                                <div className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                                    {msg.content || msg.note || '(Structured Message)'}
                                                </div>

                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                    <span className="bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600/50">
                                                        {msg.order?.woId}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{msg.stepName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {messages.length > 10 && (
                            <div className="p-2 border-t border-slate-50 dark:border-slate-700 bg-slate-50/50 text-center">
                                <span className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Showing recent 10</span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function formatTime(timestamp: string) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return new Date(timestamp).toLocaleDateString('en-US');
}
