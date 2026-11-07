/** Money is stored as whole paise, so totals never pick up floating-point drift. */

export function toPaise(rupees) {
    if (typeof rupees === 'string') {
        const cleaned = rupees.replace(/[₹,\s]|rs\.?|inr/gi, '');
        if (cleaned === '' || Number.isNaN(Number(cleaned))) return NaN;
        return Math.round(Number(cleaned) * 100);
    }
    if (typeof rupees !== 'number' || !Number.isFinite(rupees)) return NaN;
    return Math.round(rupees * 100);
}

export function fromPaise(paise) {
    return (Number(paise) || 0) / 100;
}

/** ₹1,00,000 in Indian digit grouping. Paise appear only when `exact` is set and they exist. */
export function formatINR(paise, { exact = false } = {}) {
    const value = Number(paise) || 0;
    const negative = value < 0;
    const abs = Math.abs(value);
    const hasPaise = abs % 100 !== 0;
    const text = (abs / 100).toLocaleString('en-IN', {
        minimumFractionDigits: exact && hasPaise ? 2 : 0,
        maximumFractionDigits: exact && hasPaise ? 2 : 0,
    });
    return `${negative ? '-' : ''}₹${text}`;
}

/** ₹1.20 L style, for tight spaces. */
export function formatCompact(paise) {
    const value = Number(paise) || 0;
    const rupees = Math.abs(value) / 100;
    const sign = value < 0 ? '-' : '';
    if (rupees >= 10000000) return `${sign}₹${(rupees / 10000000).toFixed(2)} Cr`;
    if (rupees >= 100000) return `${sign}₹${(rupees / 100000).toFixed(2)} L`;
    return formatINR(value);
}
