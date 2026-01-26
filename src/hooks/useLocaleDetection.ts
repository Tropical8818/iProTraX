import { useState, useEffect } from 'react';

/**
 * Custom hook to detect and manage locale from cookies
 * Follows React best practices by avoiding setState in effects
 */
export function useLocaleDetection() {
    // Use lazy initialization to read locale on first render
    const [locale, setLocale] = useState<string>(() => {
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            const cookie = document.cookie
                .split('; ')
                .find(row => row.startsWith('NEXT_LOCALE='))
                ?.split('=')[1];
            return cookie || 'en';
        }
        return 'en'; // Default for SSR
    });

    // Subscribe to manual updates (for future enhancements)
    useEffect(() => {
        // This effect only sets up subscriptions, doesn't call setState directly
        // Currently no-op, but could listen for storage events or custom events
        return () => {
            // Cleanup if needed
        };
    }, []);

    return locale;
}
