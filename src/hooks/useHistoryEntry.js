/**
 * useHistoryEntry.js — React hook for multi-granularity history data
 *
 * Supports: 'monthly' | 'weekly' | 'fortnight'
 * All reads/writes to period-based data flow through here.
 *
 * Schema per granularity:
 *   monthly   → { income, familyContribution, sipsPaid:{[id]:n}, expenses, efBalance, efContribution, notes }
 *   weekly    → { expenses, notes }
 *   fortnight → { expenses, sipsPaid:{[id]:n}, notes }
 */

import { useState, useCallback, useMemo } from 'react';
import {
    getHistory, setHistory, updateHistory, getAllHistory,
    monthlyId, weeklyId, fortnightId,
} from '../data/storage';

// ─── Default shapes per granularity ──────────────────────────────────────────

const DEFAULTS = {
    monthly: {
        income: 0, familyContribution: 0,
        sipsPaid: {}, expenses: 0,
        efBalance: 0, efContribution: 0, notes: '',
    },
    weekly: {
        expenses: 0, notes: '',
    },
    fortnight: {
        expenses: 0, sipsPaid: {}, notes: '',
    },
};

function emptyEntry(granularity) {
    return { ...DEFAULTS[granularity] };
}

// ─── Period ID builder ────────────────────────────────────────────────────────

export function buildPeriodId(granularity, year, periodNum) {
    if (granularity === 'monthly') return monthlyId(year, periodNum);
    if (granularity === 'weekly') return weeklyId(year, periodNum);
    if (granularity === 'fortnight') return fortnightId(year, periodNum);
    return monthlyId(year, periodNum);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param {'monthly'|'weekly'|'fortnight'} granularity
 * @param {number} year         e.g. 2026
 * @param {number} periodNum    month (1-12) | week (1-53) | fortnight (1-26)
 */
export function useHistoryEntry(granularity, year, periodNum) {
    const periodId = buildPeriodId(granularity, year, periodNum);

    const [entry, setEntry] = useState(() => {
        const stored = getHistory(granularity, periodId);
        return stored ? { ...emptyEntry(granularity), ...stored } : emptyEntry(granularity);
    });

    // Re-initialise when the period changes
    const [lastPeriod, setLastPeriod] = useState(periodId);
    if (periodId !== lastPeriod) {
        const stored = getHistory(granularity, periodId);
        setEntry(stored ? { ...emptyEntry(granularity), ...stored } : emptyEntry(granularity));
        setLastPeriod(periodId);
    }

    /** Update a single top-level field and persist */
    const setField = useCallback((field, value) => {
        setEntry((prev) => {
            const next = { ...prev, [field]: value };
            updateHistory(granularity, periodId, { [field]: value });
            return next;
        });
    }, [granularity, periodId]);

    /** Update a SIP amount within sipsPaid */
    const setSipPaid = useCallback((sipId, amount) => {
        setEntry((prev) => {
            const nextSips = { ...prev.sipsPaid, [sipId]: Number(amount) || 0 };
            const next = { ...prev, sipsPaid: nextSips };
            updateHistory(granularity, periodId, { sipsPaid: nextSips });
            return next;
        });
    }, [granularity, periodId]);

    /** Overwrite full snapshot */
    const saveEntry = useCallback((snapshot) => {
        const merged = { ...emptyEntry(granularity), ...snapshot };
        setHistory(granularity, periodId, merged);
        setEntry(merged);
    }, [granularity, periodId]);

    /** Force reload from storage (after import) */
    const refresh = useCallback(() => {
        const stored = getHistory(granularity, periodId);
        setEntry(stored ? { ...emptyEntry(granularity), ...stored } : emptyEntry(granularity));
    }, [granularity, periodId]);

    // Derived
    const totalSipPaid = useMemo(
        () => Object.values(entry.sipsPaid || {}).reduce((s, v) => s + (Number(v) || 0), 0),
        [entry.sipsPaid]
    );

    const allEntries = useMemo(() => getAllHistory(granularity), [granularity, entry]);

    return { entry, setField, setSipPaid, saveEntry, refresh, totalSipPaid, allEntries, periodId };
}

// ─── Standalone time-series helper for charts ──────────────────────────────

/**
 * Returns a flat array of entries for a given granularity, enriched with a
 * human-readable label. Safe to call outside React (no hooks).
 *
 * @param {'monthly'|'weekly'|'fortnight'} granularity
 * @returns {Array<{ periodId, label, ...snapshot }>}
 */
export function getTimeSeries(granularity) {
    return getAllHistory(granularity).map(({ periodId, data }) => {
        let label = periodId;
        if (granularity === 'monthly') {
            const [y, m] = periodId.split('-');
            label = new Date(Number(y), Number(m) - 1)
                .toLocaleString('en-IN', { month: 'short', year: '2-digit' });
        } else if (granularity === 'weekly') {
            label = `Wk ${periodId.split('-W')[1]}`;
        } else if (granularity === 'fortnight') {
            const fn = periodId.split('-F')[1];
            label = `Fn ${fn}`;
        }
        return { periodId, label, ...DEFAULTS[granularity], ...(data || {}) };
    });
}
