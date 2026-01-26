'use client';

import { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';

export default function StepTimer({ startTime }: { startTime: string | Date }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = new Date(startTime);
        const tick = () => {
            const now = new Date();
            const diff = differenceInSeconds(now, start);
            setElapsed(diff > 0 ? diff : 0);
        };

        tick(); // Initial tick
        const interval = setInterval(tick, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    const formatTime = (totalSeconds: number) => {
        if (totalSeconds < 0) totalSeconds = 0;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return <span className="font-mono tabular-nums font-bold animate-pulse">{formatTime(elapsed)}</span>;
}
