'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface CommentData {
    orderId: string;
    stepName: string;
    category: string;
    structuredData: Record<string, string>;
    note: string;
    triggeredStatus: string | null;
    mentions?: string[];
    replyToId?: string;
}

interface Props {
    orderId: string;
    stepName: string;
    onClose: () => void;
    onSubmit: (data: CommentData) => Promise<void>;
}

export function StructuredCommentDialog({ orderId, stepName, onClose, onSubmit }: Props) {
    const t = useTranslations('Operation');

    const [comments, setComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(true);
    const [users, setUsers] = useState<Array<{ id: string; username: string; role: string }>>([]);

    const [commentCategory, setCommentCategory] = useState<string>('');
    const [commentText, setCommentText] = useState<string>('');
    const [selectedMention, setSelectedMention] = useState<string>('');
    const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
    const [replyToComment, setReplyToComment] = useState<{ id: string; username: string; userId: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const COMMENT_CATEGORIES = [
        { key: 'MATERIAL', label: t('category_material'), color: 'bg-red-100 text-red-700 ring-red-300' },
        { key: 'MACHINE', label: t('category_machine'), color: 'bg-orange-100 text-orange-700 ring-orange-300' },
        { key: 'QUALITY', label: t('category_quality'), color: 'bg-amber-100 text-amber-700 ring-amber-300' },
        { key: 'PROCESS', label: t('category_process'), color: 'bg-blue-100 text-blue-700 ring-blue-300' },
        { key: 'OTHER', label: t('category_other'), color: 'bg-slate-200 text-slate-700 ring-slate-300' },
    ];

    const fetchStepComments = useCallback(async () => {
        setLoadingComments(true);
        try {
            const res = await fetch(`/api/comments?orderId=${orderId}&stepName=${encodeURIComponent(stepName)}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data.comments || []);

                await fetch('/api/comments/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId, stepName })
                });
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('messages-updated'));
                }
            }
        } catch (error) {
            console.error('Failed to fetch step comments:', error);
        } finally {
            setLoadingComments(false);
        }
    }, [orderId, stepName]);

    useEffect(() => {
        fetchStepComments();
        fetch('/api/users/supervisors')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.supervisors) setUsers(data.supervisors);
            })
            .catch(() => {});
    }, [fetchStepComments]);

    const getCategoryBadgeStyle = (catRaw: string) => {
        const cat = (catRaw || '').toUpperCase();
        if (cat === 'MATERIAL_SHORTAGE' || cat === 'MATERIAL') return 'bg-red-50 text-red-600';
        if (cat === 'EQUIPMENT_FAILURE' || cat === 'MACHINE') return 'bg-orange-50 text-orange-600';
        if (cat === 'QUALITY_ISSUE' || cat === 'QUALITY') return 'bg-amber-50 text-amber-600';
        if (cat === 'PROCESS_ISSUE' || cat === 'PROCESS') return 'bg-blue-50 text-blue-600';
        return 'bg-slate-100 text-slate-600';
    };

    const getCategoryLabel = (catRaw: string) => {
        const cat = (catRaw || '').toUpperCase();
        if (cat === 'MATERIAL_SHORTAGE' || cat === 'MATERIAL') return t('category_material');
        if (cat === 'EQUIPMENT_FAILURE' || cat === 'MACHINE') return t('category_machine');
        if (cat === 'QUALITY_ISSUE' || cat === 'QUALITY') return t('category_quality');
        if (cat === 'PROCESS_ISSUE' || cat === 'PROCESS') return t('category_process');
        return t('category_other');
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm(t('confirmDeleteComment'))) return;
        try {
            const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchStepComments();
            } else {
                alert(t('failedToDeleteComment'));
            }
        } catch (e) {
            console.error('Delete comment error:', e);
            alert(t('failedToDeleteComment'));
        }
    };

    const handleSubmit = async () => {
        if (!commentText.trim()) return;
        setSubmitting(true);
        try {
            const effectiveCategory = commentCategory || 'GENERAL';
            const payload: CommentData = {
                orderId,
                stepName,
                category: effectiveCategory,
                structuredData: { category: effectiveCategory, note: commentText.trim() },
                note: commentText.trim(),
                triggeredStatus: null,
                mentions: selectedMention ? [selectedMention] : [],
                replyToId: replyToComment?.id
            };

            await onSubmit(payload);
            setCommentText('');
            setCommentCategory('');
            setSelectedMention('');
            setReplyToComment(null);
            await fetchStepComments();
        } catch (error) {
            alert('Submission Failed: ' + error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div
                className="bg-white text-slate-900 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-6 h-6 text-purple-600" />
                        <h3 className="font-bold text-lg text-slate-900">{stepName}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Comment History */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-2">
                        {t('history')} ({comments.length})
                    </label>
                    {loadingComments ? (
                        <div className="text-center py-4 text-slate-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                            {t('loadingHistory')}
                        </div>
                    ) : comments.length > 0 ? (
                        <div className="max-h-56 overflow-y-auto space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                            {comments.map((comment: any) => (
                                <div key={comment.id} className="bg-white rounded-lg p-2.5 shadow-sm border border-slate-100 text-xs group relative">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                        <span className="font-bold text-slate-800">
                                            {comment.user?.username || 'Unknown'}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getCategoryBadgeStyle(comment.category)}`}>
                                            {getCategoryLabel(comment.category)}
                                        </span>
                                        {comment.replyTo?.user?.username && (
                                            <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                                                ↩ @{comment.replyTo.user.username}
                                            </span>
                                        )}
                                        {comment.structuredData?.mentionGroup ? (
                                            <>
                                                <span className="text-[9px] text-slate-400">→</span>
                                                <span className="text-[9px] px-1 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold">
                                                    {comment.structuredData.mentionGroup}
                                                </span>
                                            </>
                                        ) : comment.mentionedUsers && comment.mentionedUsers.length > 0 && (
                                            <>
                                                <span className="text-[9px] text-slate-400">→</span>
                                                {comment.mentionedUsers.map((user: any) => (
                                                    <span
                                                        key={user.id}
                                                        className="text-[9px] px-1 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium"
                                                    >
                                                        @{user.username}
                                                    </span>
                                                ))}
                                            </>
                                        )}
                                        <span className="text-[9px] text-slate-400 ml-auto">
                                            {new Date(comment.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="opacity-0 group-hover:opacity-100 ml-1 text-red-500 hover:text-red-700 transition-opacity"
                                            title={t('deleteComment')}
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-[13px] text-slate-700 break-words leading-snug flex-1 whitespace-pre-wrap">
                                            {comment.content || comment.note}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReplyToComment({
                                                    id: comment.id,
                                                    username: comment.user?.username || 'User',
                                                    userId: comment.userId
                                                });
                                                setSelectedMention(comment.userId);
                                                textareaRef.current?.focus();
                                            }}
                                            className="flex-shrink-0 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded font-medium transition-colors"
                                            title={t('replyToUser', { username: comment.user?.username || 'User' })}
                                        >
                                            {t('reply')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-slate-400 text-sm italic">
                            {t('noComments')}
                        </div>
                    )}
                </div>

                {/* Optional Category Tags (Not required for replying) */}
                {!replyToComment && (
                    <div className="mb-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                            {t('category')} <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {COMMENT_CATEGORIES.map(cat => (
                                <button
                                    key={cat.key}
                                    type="button"
                                    onClick={() => setCommentCategory(prev => prev === cat.key ? '' : cat.key)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                        commentCategory === cat.key
                                            ? cat.color + ' ring-2 ring-offset-1'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message Input & Mention Selector */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-slate-700">{t('message')}</label>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setMentionMenuOpen(!mentionMenuOpen)}
                                className={`text-xs px-2.5 py-1 rounded border flex items-center gap-1 ${
                                    selectedMention
                                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200 font-medium'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {selectedMention
                                    ? (selectedMention.startsWith('@')
                                        ? `To: ${selectedMention}`
                                        : `To: @${users.find(u => u.id === selectedMention)?.username || replyToComment?.username || 'User'}`)
                                    : t('mentionPlaceholder')}
                            </button>

                            {mentionMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-52 overflow-hidden max-h-60 overflow-y-auto">
                                    <div className="text-[10px] text-slate-400 px-3 py-1 bg-slate-50 border-b">{t('selectRecipient')}</div>

                                    <div className="px-2 py-1 text-[10px] text-slate-400 bg-slate-50 font-medium">{t('groups')}</div>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedMention('@Everyone'); setReplyToComment(null); setMentionMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-indigo-600 font-bold"
                                    >
                                        @Everyone (所有人)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedMention('@Supervisor'); setReplyToComment(null); setMentionMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-purple-600 font-bold"
                                    >
                                        @Supervisor (主管/管理员)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedMention('@Operator'); setReplyToComment(null); setMentionMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-blue-600 font-bold"
                                    >
                                        @Operator (操作员)
                                    </button>

                                    <div className="px-2 py-1 text-[10px] text-slate-400 bg-slate-50 font-medium border-t">{t('supervisors')}</div>
                                    {users.filter(s => s.role === 'admin' || s.role === 'supervisor').map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => { setSelectedMention(s.id); setReplyToComment(null); setMentionMenuOpen(false); }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-purple-600 truncate"
                                        >
                                            @{s.username} <span className="text-[10px] text-slate-400">({s.role})</span>
                                        </button>
                                    ))}

                                    <div className="px-2 py-1 text-[10px] text-slate-400 bg-slate-50 font-medium border-t">Operators</div>
                                    {users.filter(s => s.role === 'user').map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => { setSelectedMention(s.id); setReplyToComment(null); setMentionMenuOpen(false); }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-blue-600 truncate"
                                        >
                                            @{s.username}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {replyToComment && (
                        <div className="flex items-center justify-between bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-lg mb-2">
                            <span>↩ {t('replyToUser', { username: `@${replyToComment.username}` })}</span>
                            <button
                                type="button"
                                onClick={() => { setReplyToComment(null); setSelectedMention(''); }}
                                className="text-blue-400 hover:text-blue-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={replyToComment ? `${t('replyToUser', { username: `@${replyToComment.username}` })}...` : 'Type your message...'}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 text-slate-900 bg-white placeholder:text-slate-400 min-h-[80px] resize-none text-sm"
                    />

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !commentText.trim()}
                        className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-3 transition-colors"
                    >
                        {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        {submitting ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
}
