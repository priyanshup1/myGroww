/**
 * All dates are local calendar dates in YYYY-MM-DD form.
 * toISOString() is never used for a date: it converts to UTC, which files a
 * 12:30 AM IST expense under the previous day.
 */

const pad = (n) => String(n).padStart(2, '0');

export function toISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
    return toISO(new Date());
}

export function parseISO(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function isValidISO(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
    return toISO(parseISO(iso)) === iso;
}

export function addDays(iso, days) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return toISO(d);
}

/** Same day next month, clamped to the month's last day (31 Jan becomes 28 Feb). */
export function addMonths(iso, months) {
    const d = parseISO(iso);
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    return toISO(target);
}

export function daysBetween(from, to) {
    return Math.round((parseISO(to) - parseISO(from)) / 86400000);
}

export function monthKey(iso) {
    return String(iso).slice(0, 7);
}

export function formatDate(iso) {
    if (!isValidISO(iso)) return '';
    return parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMonth(key) {
    const [y, m] = String(key).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Reads the date formats Indian statements use: 2026-09-04, 04/09/2026 (day first),
 * 4 Sep 2026, 04-Sep-26 and Sep 4 2026. Year-less dates need `fallbackYear`.
 * Returns null when the text is not a real date.
 */
export function parseFlexibleDate(text, fallbackYear) {
    const raw = String(text ?? '').trim();
    if (!raw) return null;
    if (isValidISO(raw)) return raw;
    const year = (y) => (y === undefined ? fallbackYear : y.length === 2 ? 2000 + Number(y) : Number(y));
    const build = (y, m, d) => {
        if (!y) return null;
        const iso = `${y}-${pad(m)}-${pad(d)}`;
        return isValidISO(iso) ? iso : null;
    };
    let match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (match) return build(year(match[3]), Number(match[2]), Number(match[1]));
    match = raw.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*(?:[\s,-]+(\d{2}|\d{4}))?$/);
    if (match && MONTHS[match[2].toLowerCase()]) return build(year(match[3]), MONTHS[match[2].toLowerCase()], Number(match[1]));
    match = raw.match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2})(?:,?\s+(\d{2}|\d{4}))?$/);
    if (match && MONTHS[match[1].toLowerCase()]) return build(year(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]));
    return null;
}
