import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from '../components/GlassCard';
import StatusBadge from '../components/StatusBadge';
import EditableNumber, { formatRupee } from '../components/EditableNumber';
import DataControls from '../components/DataControls';
import BackButton from '../components/BackButton';

function MetricCard({ label, value, subtext, badge, editable, onEdit, accent }) {
    return (
        <GlassCard style={{ padding: '24px 28px' }} className="animate-in">
            <div className="section-title mb-2">{label}</div>
            <div style={{
                fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: accent || 'var(--text-primary)',
                marginBottom: 8,
            }}>
                {editable ? (
                    <EditableNumber value={value} onChange={onEdit} />
                ) : (
                    <span>{formatRupee(value)}</span>
                )}
            </div>
            {subtext && <div className="label opacity-60" style={{ marginBottom: 8 }}>{subtext}</div>}
            {badge}
        </GlassCard>
    );
}

export default function FinancialSnapshotPage() {
    const {
        income, setIncome,
        emergencyFund, setEmergencyFund,
        netWorth, totalInvested,
        monthlyExpenses, monthsCovered,
        totalMonthlySip,
    } = useFinanceData();

    const efMonths = parseFloat(monthsCovered);
    const efStatus = efMonths >= 6 ? 'green' : efMonths >= 3 ? 'amber' : 'red';
    const efLabel = efStatus === 'green' ? 'Safe' : efStatus === 'amber' ? 'Caution' : 'Low';

    const sipRatio = income > 0 ? ((totalMonthlySip / income) * 100).toFixed(1) : 0;

    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="flex items-center gap-3">
                            <BackButton />
                            <div>
                                <div className="section-title">Financial Snapshot</div>
                                <h2 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.35rem)' }}>💰 Key Metrics</h2>
                            </div>
                        </div>
                        <DataControls />
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>
                <p className="label mb-6" style={{ marginBottom: 24 }}>
                    Core financial metrics. Edit income and emergency fund here; investment totals are derived from your <span style={{ color: 'var(--accent-gold)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => nav('/sip')}>SIP Tracker</span>.
                </p>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 20,
                    marginBottom: 32,
                }}>
                    {/* 1. Monthly Income */}
                    <MetricCard
                        label="Monthly Income"
                        value={income}
                        editable
                        onEdit={setIncome}
                        accent="var(--accent-gold)"
                        subtext="Click the value to edit"
                    />

                    {/* 2. Net Worth */}
                    <MetricCard
                        label="Net Worth"
                        value={netWorth}
                        subtext="Total Investments + Emergency Fund"
                        accent="var(--accent-mint-light)"
                        badge={<StatusBadge status={netWorth > 0 ? 'green' : 'amber'} label={netWorth > 0 ? 'Growing' : 'Getting started'} />}
                    />

                    {/* 3. Total Investments */}
                    <MetricCard
                        label="Total Investments"
                        value={totalInvested}
                        subtext={`Monthly SIP: ${formatRupee(totalMonthlySip)} (${sipRatio}% of income)`}
                        accent="var(--text-primary)"
                        badge={
                            income > 0 && totalMonthlySip / income > 0.2
                                ? <StatusBadge status="green" label="Great discipline" />
                                : null
                        }
                    />

                    {/* 4. Emergency Fund */}
                    <MetricCard
                        label="Emergency Fund"
                        value={emergencyFund}
                        editable
                        onEdit={setEmergencyFund}
                        subtext={`Monthly expenses: ${formatRupee(monthlyExpenses)}`}
                        badge={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                                <StatusBadge status={efStatus} label={efLabel} />
                                <span style={{
                                    background: 'rgba(212, 165, 116, 0.15)',
                                    border: '1px solid rgba(212, 165, 116, 0.3)',
                                    borderRadius: 20, padding: '3px 10px',
                                    fontSize: '0.72rem', fontWeight: 700,
                                    color: 'var(--accent-gold)',
                                }}>
                                    {monthsCovered} months covered
                                </span>
                            </div>
                        }
                    />
                </div>

                {/* Summary row */}
                <GlassCard style={{ padding: '20px 24px' }}>
                    <div className="section-title mb-3">Quick Summary</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                        {[
                            { label: 'Savings Rate', value: income > 0 ? ((1 - monthlyExpenses / income) * 100).toFixed(1) + '%' : '—' },
                            { label: 'SIP % of Income', value: income > 0 ? ((totalMonthlySip / income) * 100).toFixed(1) + '%' : '—' },
                            { label: 'Monthly Expenses', value: formatRupee(monthlyExpenses) },
                            { label: 'Emergency Coverage', value: monthsCovered + ' months' },
                        ].map((item) => (
                            <div key={item.label}>
                                <div className="label" style={{ marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{item.value}</div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
