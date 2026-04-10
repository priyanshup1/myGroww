/**
 * PeriodSelector.jsx — Reusable Granularity and Period selector
 *
 * Supports switching between Monthly, Fortnightly, and Weekly views.
 */
import React from 'react';
import { getISOWeek, getFortnightNumber } from '../data/storage';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PeriodSelector({
    granularity, setGranularity,
    year, setYear,
    periodNum, setPeriodNum
}) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 4 }, (_, i) => currentYear - i);

    const maxPeriods = {
        monthly: 12,
        fortnight: 26,
        weekly: 53 // ISO week can be up to 53
    };

    const go = (delta) => {
        let p = periodNum + delta;
        let y = year;
        const maxP = maxPeriods[granularity];

        if (p > maxP) { p = 1; y += 1; }
        if (p < 1) { p = maxP; y -= 1; }

        if (y >= currentYear - 3 && y <= currentYear) {
            setYear(y);
            setPeriodNum(p);
        }
    };

    // Calculate max current period to disable "next" button into the future
    const curDate = new Date();
    const isCurrentYear = year === curDate.getFullYear();
    let maxAllowedPeriod = Infinity;
    if (isCurrentYear) {
        if (granularity === 'monthly') maxAllowedPeriod = curDate.getMonth() + 1;
        if (granularity === 'weekly') maxAllowedPeriod = getISOWeek(curDate);
        if (granularity === 'fortnight') maxAllowedPeriod = getFortnightNumber(curDate);
    }
    const isAtMax = isCurrentYear && periodNum >= maxAllowedPeriod;

    // Helper to jump to current
    const setToday = (gran) => {
        setGranularity(gran);
        setYear(curDate.getFullYear());
        if (gran === 'monthly') setPeriodNum(curDate.getMonth() + 1);
        if (gran === 'weekly') setPeriodNum(getISOWeek(curDate));
        if (gran === 'fortnight') setPeriodNum(getFortnightNumber(curDate));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['monthly', 'fortnight', 'weekly'].map((g) => (
                    <button
                        key={g}
                        onClick={() => setToday(g)}
                        style={{
                            background: granularity === g ? 'var(--accent-mint)' : 'var(--bg-card)',
                            color: granularity === g ? '#000' : 'var(--text-secondary)',
                            border: `1px solid ${granularity === g ? 'var(--accent-mint)' : 'var(--border)'}`,
                            borderRadius: 20, padding: '4px 12px', fontSize: '0.8rem',
                            fontWeight: granularity === g ? 700 : 500, cursor: 'pointer',
                            textTransform: 'capitalize', transition: 'all 0.2s'
                        }}
                    >
                        {g}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                    onClick={() => go(-1)}
                    style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '6px 10px', color: 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s',
                    }}
                >‹</button>

                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <select
                        value={periodNum}
                        onChange={(e) => setPeriodNum(Number(e.target.value))}
                        style={{
                            background: 'transparent', border: 'none', color: 'var(--text-primary)',
                            fontSize: '0.88rem', fontWeight: 600, fontFamily: 'var(--font-main)',
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        {Array.from({ length: maxPeriods[granularity] }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num} style={{ background: 'var(--bg-card)' }}>
                                {granularity === 'monthly' ? MONTHS[num - 1] :
                                    granularity === 'fortnight' ? `Fortnight ${num}` : `Week ${num}`}
                            </option>
                        ))}
                    </select>

                    <span style={{ color: 'var(--border)' }}>·</span>

                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        style={{
                            background: 'transparent', border: 'none', color: 'var(--accent-gold)',
                            fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-main)',
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        {years.map((y) => (
                            <option key={y} value={y} style={{ background: 'var(--bg-card)' }}>{y}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={() => go(1)}
                    disabled={isAtMax}
                    style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '6px 10px', color: 'var(--text-secondary)',
                        cursor: isAtMax ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
                        opacity: isAtMax ? 0.3 : 1, transition: 'all 0.2s',
                    }}
                >›</button>
            </div>
        </div>
    );
}
