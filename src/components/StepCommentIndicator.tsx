'use client';
import { useEffect, useState } from 'react';
import { UnifiedMessageButton } from './common/UnifiedMessageButton';

interface Props {
    orderId: string;
    stepName: string;
    onClick?: () => void;
}

interface CommentStats {
    total: number;
    unread: number;
}

export function StepCommentIndicator({ orderId, stepName, onClick }: Props) {
    const [stats, setStats] = useState<CommentStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, [orderId, stepName]);

    const fetchStats = async () => {
        try {
            const res = await fetch(
                `/api/comments/stats?orderId=${orderId}&stepName=${encodeURIComponent(stepName)}`
            );
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch comment stats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Don't show anything if no comments
    if (!loading && (!stats || stats.total === 0)) {
        return null;
    }

    if (loading) {
        return (
            <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg opacity-50">
                <UnifiedMessageButton variant="table" count={0} unreadCount={0} className="pointer-events-none" />
            </div>
        );
    }

    const hasUnread = stats && stats.unread > 0;

    return (
        <UnifiedMessageButton
            variant="table"
            count={stats!.total}
            unreadCount={stats!.unread}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            title={`${stats!.total} messages${hasUnread ? `, ${stats!.unread} unread` : ''}`}
        />
    );
}
