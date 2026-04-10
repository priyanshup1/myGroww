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
    const navigate = useNavigate();
    const {
        income, setIncome,
        familyContribution, setFamilyContribution,
        emergencyFund, setEmergencyFund,
        netWorth, totalInvested,
        monthlyExpenses, monthsCovered,
        totalMonthlySip,
        // New metrics
        amountRetained, familyPctOfIncome,
        expenseRatioOfRetained, sipRatioOfRetained,
        moneyLeft, emergencyGap,
        activeSipsCount, wealthBuildingPctOfIncome,
    } = useFinanceData();

    const efMonths = parseFloat(monthsCovered);
    const efStatus = efMonths >= 6 ? 'green' : efMonths >= 3 ? 'amber' : 'red';
    const efLabel = efStatus === 'green' ? 'Safe' : efStatus === 'amber' ? 'Caution' : 'Low';

    const summaryItems = [
        { label: 'Family Contribution', value: `${familyPctOfIncome.toFixed(1)}% of income` },
        { label: 'Amount Retained', value: formatRupee(amountRetained) },
        { label: 'Expense Ratio', value: `${expenseRatioOfRetained.toFixed(1)}% of retained` },
        { label: 'SIP Ratio', value: `${sipRatioOfRetained.toFixed(1)}% of retained` },
        { label: 'Money Left', value: formatRupee(moneyLeft) },
        { label: 'Emergency Gap', value: emergencyGap <= 0 ? 'Fully covered' : formatRupee(emergencyGap) },
        { label: 'Active Funds', value: `${activeSipsCount} funds` },
        { label: 'Wealth Building', value: `${wealthBuildingPctOfIncome.toFixed(1)}% of income` },
    ];

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
                    Core financial metrics. Edit income, family contribution and emergency fund here; investment totals are derived from your <span style={{ color: 'var(--accent-gold)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/sip')}>SIP Tracker</span>.
                </p>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
                        subtext="Click to edit your total income"
                    />

                    {/* 2. Family Contribution */}
                    <MetricCard
                        label="Family Contribution"
                        value={familyContribution}
                        editable
                        onEdit={setFamilyContribution}
                        accent="var(--alert-red)"
                        subtext={`${familyPctOfIncome.toFixed(1)}% of your income`}
                    />

                    {/* 3. Net Worth */}
                    <MetricCard
                        label="Net Worth"
                        value={netWorth}
                        subtext="Total Investments + Emergency Fund"
                        accent="var(--accent-mint-light)"
                        badge={<StatusBadge status={netWorth > 0 ? 'green' : 'amber'} label={netWorth > 0 ? 'Growing' : 'Getting started'} />}
                    />

                    {/* 4. Total Investments */}
                    <MetricCard
                        label="Total Investments"
                        value={totalInvested}
                        subtext={`Monthly SIP: ${formatRupee(totalMonthlySip)}`}
                        accent="var(--text-primary)"
                        badge={
                            wealthBuildingPctOfIncome > 20
                                ? <StatusBadge status="green" label="Great discipline" />
                                : null
                        }
                    />

                    {/* 5. Emergency Fund */}
                    <div onClick={() => navigate('/emergency-fund')} style={{ cursor: 'pointer' }}>
                        <MetricCard
                            label="Emergency Fund"
                            value={emergencyFund}
                            editable={false}
                            subtext="Click to park funds monthly"
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
                </div>

                {/* Summary row */}
                <GlassCard style={{ padding: '24px 28px' }}>
                    <div className="section-title mb-4">Quick Summary</div>
                    <div className="summary-grid-v2">
                        {summaryItems.map((item) => (
                            <div key={item.label}>
                                <div className="label" style={{ marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{item.value}</div>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .summary-grid-v2 {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 24px 16px;
                    }
                    @media (min-width: 768px) {
                        .summary-grid-v2 {
                            grid-template-columns: repeat(4, 1fr);
                        }
                    }
                `}} />
            </div>
        </div>
    );
}
