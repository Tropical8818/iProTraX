
/**
 * Date Utility Functions
 * Centralized date handling to ensure consistent timezone usage across the application.
 * Uses process.env.TZ (default: Asia/Shanghai) for all formatting.
 */

export function getTimeZone(): string {
    return process.env.TZ || "Asia/Shanghai";
}

/**
 * Get current date (wrapper for new Date to be explicit)
 */
export function getNow(): Date {
    return new Date();
}

/**
 * Format a date as "dd-MMM, HH:mm" (e.g., "02-Jan, 19:30")
 * Used for order step timestamps and display.
 */
export function formatToShortTimestamp(date: Date): string {
    const timeZone = getTimeZone();

    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(date);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

        return `${getPart('day')}-${getPart('month')}, ${getPart('hour')}:${getPart('minute')}`;
    } catch (e) {
        console.error('Date formatting error:', e);
        // Fallback to local time if Intl fails
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${day}-${month}, ${hour}:${minute}`;
    }
}

/**
 * Format a date as "YYYY-MM-DD HH:mm" (e.g., "2026-01-02 19:30")
 * Used for Excel reports and full timestamps.
 */
export function formatToExcelTimestamp(date: Date): string {
    const timeZone = getTimeZone();

    try {
        // en-SE uses YYYY-MM-DD format which is close to what we want
        const formatter = new Intl.DateTimeFormat('en-SE', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // en-SE output is usually "2026-01-02 19:30"
        return formatter.format(date).replace('T', ' ');
    } catch (e) {
        return date.toISOString().slice(0, 16).replace('T', ' ');
    }
}

/**
 * Date component for YYYY-MM-DD
 */
export function formatToDateOnly(date: Date): string {
    const timeZone = getTimeZone();
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA is YYYY-MM-DD
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(date);
    } catch (e) {
        return date.toISOString().slice(0, 10);
    }
}

/**
 * Convert Excel Serial Date to JS Date
 * Excel serial date 1 = 1900-01-01 (approx)
 * Uses UTC-based calculation to avoid local timezone shifts for "Date Only" values.
 */
export function excelSerialToDate(serial: number): Date {
    // Excel base date: Dec 30 1899
    // Math: (serial - 25569) convert to Unix epoch days
    // 25569 = Days between 1899-12-30 and 1970-01-01
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400; // seconds
    const dateInfo = new Date(utcValue * 1000);

    // Fractional day part (Time)
    const fractionalDay = serial - Math.floor(serial);
    let totalSeconds = Math.floor(fractionalDay * 86400); // 24 * 60 * 60

    if (totalSeconds > 0) {
        // If there is time, we add it. 
        // Note: Floating point errors might give 0.999999 so round to nearest second
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds -= hours * 3600;
        const minutes = Math.floor(totalSeconds / 60);
        totalSeconds -= minutes * 60;
        const seconds = totalSeconds;

        dateInfo.setUTCHours(hours, minutes, seconds);
    }

    return dateInfo;
}
