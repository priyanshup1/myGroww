import React, { useState } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from './GlassCard';
import StatusBadge from './StatusBadge';
import EditableNumber, { formatRupee } from './EditableNumber';

export default function EmergencyFundTracker() {
    const { efMonthlyEntries, setEfMonthlyEntries, amountRetained } = useFinanceData();

    // Auto-calculated from saved AND submitted entries
    const totalEF = efMonthlyEntries
        .filter(e => e.status === 'submitted' || e.status === 'saved')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const efMonths = amountRetained > 0 ? totalEF / amountRetained : Infinity;
    const efStatus = efMonths >= 6 ? 'green' : efMonths >= 3 ? 'amber' : 'red';

    // Impact Message logic
    let impactMessage = '';
    if (efMonths < 3) impactMessage = '⚠️ Emergency fund below target. Keep parking monthly.';
    else if (efMonths < 6) impactMessage = '📊 On track. Continue monthly contributions.';
    else impactMessage = '✅ Well covered. Emergency fund is healthy.';

    // Month Generator for Selector
    const generateMonthOptions = () => {
        const options = [];
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        // Last 12 months + next 12 months
        for (let y = currentYear - 1; y <= currentYear + 1; y++) {
            for (let m = 1; m <= 12; m++) {
                // Ensure we don't go too far ahead
                if (y === currentYear + 1 && m > currentMonth) break;
                options.push(`${y}-${String(m).padStart(2, '0')}`);
            }
        }
        return options.reverse(); // Newest first
    };
    const monthOptions = generateMonthOptions();

    // Handlers
    const addEntry = () => {
        const newId = 'ef_' + Date.now();
        // default to current month if available
        let defMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        // If already exists, just take the first option
        if (efMonthlyEntries.some(e => e.month === defMonth)) {
            defMonth = monthOptions.find(o => !efMonthlyEntries.some(e => e.month === o)) || defMonth;
        }

        setEfMonthlyEntries(prev => [...prev, {
            id: newId,
            month: defMonth,
            amount: 0,
            status: 'draft', // initial status
            actionDate: new Date().toISOString()
        }]);
    };

    const updateEntry = (id, field, value) => {
        setEfMonthlyEntries(prev => prev.map(e => {
            if (e.id !== id) return e;
            // Prevention: Cannot change month to an already existing one
            if (field === 'month' && prev.some(other => other.id !== id && other.month === value)) {
                alert('This month is already tracked. Please select a different month.');
                return e;
            }
            return { ...e, [field]: value };
        }));
    };

    const handleSave = (id) => {
        const entry = efMonthlyEntries.find(e => e.id === id);
        if (!entry.amount || entry.amount <= 0) {
            alert('Enter amount to save.');
            return;
        }
        // Change status to saved
        setEfMonthlyEntries(prev => prev.map(e =>
            e.id === id ? { ...e, status: 'saved', actionDate: new Date().toISOString() } : e
        ));
    };

    const handleSubmit = (id) => {
        const entry = efMonthlyEntries.find(e => e.id === id);
        if (!entry.amount || entry.amount <= 0) {
            alert('Enter amount to save and submit.');
            return;
        }
        // Lock it
        setEfMonthlyEntries(prev => prev.map(e =>
            e.id === id ? { ...e, status: 'submitted', actionDate: new Date().toISOString() } : e
        ));
    };

    // Sort entries descending
    const sortedEntries = [...efMonthlyEntries].sort((a, b) => b.month.localeCompare(a.month));

    return (
        <GlassCard style={{ padding: '24px 28px', gridColumn: '1 / -1' }} className="animate-in">
            {/* Top: Goal Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, marginBottom: 24 }}>
                <div>
                    <div className="section-title mb-2">Emergency Fund Protocol</div>
                    <div className="label opacity-60">Target: 6 months emergency coverage</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Current: {efMonths === Infinity ? '∞' : efMonths.toFixed(1)} months
                        </span>
                        <StatusBadge status={efStatus} label={efStatus === 'green' ? 'Safe' : efStatus === 'amber' ? 'Caution' : 'Low'} />
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="label opacity-60 mb-2">Total Emergency Fund</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent-mint-light)' }}>
                        {formatRupee(totalEF)}
                    </div>
                </div>
            </div>

            {/* Middle: Monthly Log Table */}
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                            <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MONTH</th>
                            <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PARKED AMOUNT</th>
                            <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>STATUS</th>
                            <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEntries.map(entry => {
                            const isLocked = entry.status === 'submitted';
                            return (
                                <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '16px' }}>
                                        {isLocked ? (
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{entry.month}</span>
                                        ) : (
                                            <select
                                                value={entry.month}
                                                onChange={(e) => updateEntry(entry.id, 'month', e.target.value)}
                                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', outline: 'none' }}
                                            >
                                                {monthOptions.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                                        {isLocked ? (
                                            <span>{formatRupee(entry.amount)}</span>
                                        ) : (
                                            <EditableNumber
                                                value={entry.amount}
                                                onChange={(v) => updateEntry(entry.id, 'amount', v)}
                                            />
                                        )}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {isLocked ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                <span>🔒</span> Submitted
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: entry.status === 'saved' ? '#f39c12' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                <span>{entry.status === 'saved' ? '✏️' : '📝'}</span> {entry.status === 'saved' ? 'Saved' : 'Draft'}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        {!isLocked && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                <button
                                                    onClick={() => handleSave(entry.id)}
                                                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => e.target.style.borderColor = 'var(--text-primary)'}
                                                    onMouseLeave={(e) => e.target.style.borderColor = 'var(--border)'}
                                                >
                                                    SAVE
                                                </button>
                                                <button
                                                    onClick={() => handleSubmit(entry.id)}
                                                    style={{ background: 'var(--accent-mint)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => e.target.style.opacity = 0.8}
                                                    onMouseLeave={(e) => e.target.style.opacity = 1}
                                                >
                                                    SUBMIT
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {sortedEntries.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No entries logged. Start parking funds locally!
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                    <button
                        onClick={addEntry}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'var(--accent-gold)', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>+</span> Add New Month
                    </button>
                </div>
            </div>

            {/* Bottom: Impact Message */}
            <div style={{ background: 'var(--bg-app)', padding: '16px 20px', borderRadius: 8, borderLeft: `4px solid ${efStatus === 'green' ? '#2ecc71' : efStatus === 'amber' ? '#f39c12' : '#e74c3c'}` }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {impactMessage}
                </span>
            </div>

        </GlassCard >
    );
}
