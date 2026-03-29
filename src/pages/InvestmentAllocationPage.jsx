import React from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from '../components/GlassCard';
import DataControls from '../components/DataControls';
import BackButton from '../components/BackButton';
import { formatRupee } from '../components/EditableNumber';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const LOKI_COLORS = ['#1a7d6f', '#d4a574', '#22c9a8', '#8b92a9', '#e74c3c', '#b8865a', '#6c5ce7', '#00cec9'];

function CustomTooltip({ active, payload }) {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem',
            }}>
                <div style={{ fontWeight: 700 }}>{payload[0].name}</div>
                <div style={{ color: 'var(--accent-gold)' }}>{formatRupee(payload[0].value)}</div>
            </div>
        );
    }
    return null;
}

export default function InvestmentAllocationPage() {
    const { investmentCategories, totalInvested } = useFinanceData();

    const pieData = investmentCategories
        .filter((c) => (c.amount || 0) > 0)
        .map((c, i) => ({
            name: c.name,
            value: c.amount,
            color: LOKI_COLORS[i % LOKI_COLORS.length],
        }));

    const barData = investmentCategories.map((c, i) => ({
        name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
        Amount: c.amount || 0,
        color: LOKI_COLORS[i % LOKI_COLORS.length],
    }));

    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="flex items-center gap-3">
                            <BackButton />
                            <div>
                                <div className="section-title">Investment Allocation</div>
                                <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>🥧 Portfolio Breakdown</h2>
                            </div>
                        </div>
                        <DataControls />
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>
                <p className="label mb-6" style={{ marginBottom: 24 }}>
                    Portfolio metrics derived from your fund list. Edit fund details in the <span style={{ color: 'var(--accent-gold)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.location.href = '/sip'}>SIP Tracker</span>.
                </p>

                {/* Charts row — donut + bar */}
                <div className="charts-row mb-6" style={{ marginBottom: 32 }}>
                    {/* Donut */}
                    <GlassCard style={{ padding: '24px' }} className="animate-in">
                        <div className="section-title mb-3">Allocation (by %)</div>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                        animationDuration={600}
                                    >
                                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{val}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                                No investment data found. Update your fund list in SIP Tracker.
                            </div>
                        )}
                    </GlassCard>

                    {/* Bar Chart */}
                    <GlassCard style={{ padding: '24px' }} className="animate-in stagger-2">
                        <div className="section-title mb-3">Absolute Amount (₹)</div>
                        {barData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                        angle={-25}
                                        textAnchor="end"
                                        interval={0}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                        tickFormatter={(v) => v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="Amount" radius={[4, 4, 0, 0]} animationDuration={600}>
                                        {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                                No data yet
                            </div>
                        )}
                    </GlassCard>
                </div>

                {/* Category table (Read-only) */}
                <GlassCard style={{ padding: '24px' }} className="animate-in stagger-3">
                    <div className="section-title mb-4">Category Details (Auto-calculated)</div>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Total Invested (₹)</th>
                                    <th>% of Portfolio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {investmentCategories.map((cat, idx) => {
                                    const pct = totalInvested > 0 ? ((cat.amount / totalInvested) * 100).toFixed(1) : '0';
                                    return (
                                        <tr key={cat.id}>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block', width: 10, height: 10,
                                                    borderRadius: '50%', background: LOKI_COLORS[idx % LOKI_COLORS.length],
                                                    marginRight: 8,
                                                }} />
                                                <span style={{ fontWeight: 600 }}>{cat.name}</span>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatRupee(cat.amount)}</span>
                                            </td>
                                            <td style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{pct}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style={{ fontWeight: 700, paddingTop: 12 }}>Total Portfolio</td>
                                    <td style={{ fontWeight: 800, color: 'var(--accent-mint)', paddingTop: 12 }}>
                                        {formatRupee(totalInvested)}
                                    </td>
                                    <td style={{ fontWeight: 700, paddingTop: 12 }}>100%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
