import React, { useState, useEffect } from 'react';
import { useHistoryEntry, getTimeSeries } from '../hooks/useHistoryEntry';
import { useFinanceData } from '../hooks/useFinanceData';
import PeriodSelector from '../components/PeriodSelector';
import GlassCard from '../components/GlassCard';
import EditableNumber, { formatRupee } from '../components/EditableNumber';
import BackButton from '../components/BackButton';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function TransactionHistoryPage() {
    // Current period state
    const [granularity, setGranularity] = useState('monthly');
    const [year, setYear] = useState(new Date().getFullYear());
    const [periodNum, setPeriodNum] = useState(new Date().getMonth() + 1);

    // If granularity changes, we try to map the period roughly to the current date to avoid invalid states
    useEffect(() => {
        const cur = new Date();
        if (granularity === 'weekly') {
            // Very rough mapping just for safety; PeriodSelector handles the exact "today" jump when clicked
            setPeriodNum(1);
        } else if (granularity === 'fortnight') {
            setPeriodNum(1);
        } else {
            setPeriodNum(cur.getMonth() + 1);
        }
        setYear(cur.getFullYear());
    }, [granularity]);

    // Data hooks
    const {
        entry, setField, setSipPaid, periodId
    } = useHistoryEntry(granularity, year, periodNum);
    const { sips } = useFinanceData();

    // Chart Data
    const chartData = getTimeSeries(granularity).slice(-12);

    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex items-center gap-3 mb-4">
                        <BackButton />
                        <div>
                            <div className="section-title">Transaction History</div>
                            <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>📅 Log & Trends</h2>
                        </div>
                    </div>
                    <PeriodSelector
                        granularity={granularity} setGranularity={setGranularity}
                        year={year} setYear={setYear}
                        periodNum={periodNum} setPeriodNum={setPeriodNum}
                    />
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>

                {/* ── LOG ENTRY FORM ─────────────────────────────────────────── */}
                <GlassCard style={{ padding: 24, marginBottom: 32 }} className="animate-in">
                    <div className="section-title mb-4">Log for {periodId}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                        {/* Always visible */}
                        <div>
                            <div className="label">Total Expenses</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e74c3c' }}>
                                <EditableNumber value={entry.expenses} onChange={(v) => setField('expenses', v)} />
                            </div>
                        </div>

                        {/* Visible in Monthly only */}
                        {granularity === 'monthly' && (
                            <>
                                <div>
                                    <div className="label">Income Received</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-mint)' }}>
                                        <EditableNumber value={entry.income} onChange={(v) => setField('income', v)} />
                                    </div>
                                </div>
                                <div>
                                    <div className="label">Family Contribution</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                        <EditableNumber value={entry.familyContribution} onChange={(v) => setField('familyContribution', v)} />
                                    </div>
                                </div>
                                <div>
                                    <div className="label">Added to Emergency Fund</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3498db' }}>
                                        <EditableNumber value={entry.efContribution} onChange={(v) => setField('efContribution', v)} />
                                    </div>
                                </div>
                                <div>
                                    <div className="label">End of Month EF Balance</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2ecc71' }}>
                                        <EditableNumber value={entry.efBalance} onChange={(v) => setField('efBalance', v)} />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Notes (always visible) */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <div className="label mb-2">Notes & Remarks</div>
                            <textarea
                                value={entry.notes || ''}
                                onChange={(e) => setField('notes', e.target.value)}
                                placeholder="Any context for this period..."
                                style={{
                                    width: '100%', height: 60, background: 'var(--bg-app)', border: '1px solid var(--border)',
                                    borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-main)'
                                }}
                            />
                        </div>
                    </div>

                    {/* SIPs (Visible in Monthly and Fortnightly) */}
                    {granularity !== 'weekly' && sips.length > 0 && (
                        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                            <div className="section-title mb-4">SIPs Paid This Period</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                                {sips.map((sip) => (
                                    <div key={sip.id} style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                                        <div className="label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {sip.fundName}
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 4 }}>
                                            <EditableNumber
                                                value={entry.sipsPaid?.[sip.id] || 0}
                                                onChange={(v) => setSipPaid(sip.id, v)}
                                            />
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                            Target: {formatRupee(sip.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </GlassCard>

                {/* ── CHARTS ─────────────────────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                    <GlassCard style={{ padding: 24 }} className="animate-in stagger-1">
                        <div className="section-title mb-4">Expense Trend</div>
                        <div style={{ height: 200, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={10} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} />
                                    <Bar dataKey="expenses" fill="#e74c3c" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </GlassCard>

                    {granularity === 'monthly' && (
                        <GlassCard style={{ padding: 24 }} className="animate-in stagger-2">
                            <div className="section-title mb-4">Income vs Savings Trend</div>
                            <div style={{ height: 200, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={10} />
                                        <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} />
                                        <Line type="monotone" dataKey="income" stroke="var(--accent-mint)" strokeWidth={2} dot={{ r: 3 }} />
                                        <Line type="monotone" dataKey="efBalance" stroke="#3498db" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    )}
                </div>

            </div>
        </div>
    );
}
