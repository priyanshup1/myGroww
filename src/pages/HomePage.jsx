import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from '../components/GlassCard';
import StatusBadge from '../components/StatusBadge';
import DataControls from '../components/DataControls';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const LOKI_COLORS = ['#1a7d6f', '#d4a574', '#22c9a8', '#8b92a9', '#e74c3c', '#b8865a'];

function formatRupee(val) {
    const num = Number(val) || 0;
    if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
    return '₹' + num.toLocaleString('en-IN');
}

function DashCard({ emoji, title, metric, subtext, badge, onClick, delay, children }) {
    return (
        <GlassCard
            className={`animate-in stagger-${delay}`}
            onClick={onClick}
            style={{ padding: '22px 24px', position: 'relative', minHeight: 160 }}
        >
            <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>{emoji}</span>
                {badge}
            </div>
            <div className="label mb-2">{title}</div>
            <div className="big-number" style={{ fontSize: 'clamp(1.3rem,3vw,1.9rem)', marginBottom: 6 }}>
                {metric}
            </div>
            {subtext && <div className="label opacity-60" style={{ fontSize: '0.77rem' }}>{subtext}</div>}
            {children}
            <div style={{
                position: 'absolute', bottom: 14, right: 18,
                fontSize: '0.7rem', color: 'var(--accent-mint)', fontWeight: 600, opacity: 0.7,
            }}>
                View details →
            </div>
        </GlassCard>
    );
}

export default function HomePage() {
    const nav = useNavigate();
    const fd = useFinanceData();
    const {
        income, netWorth, totalInvested, emergencyFund,
        monthlyExpenses, monthsCovered, totalMonthlySip,
        sips, investmentCategories, smallCapPct,
        familyContribution, familyPctOfIncome, totalLumpsum, amountRetained,
        wealthBuildingPctOfIncome,
        setIncome, setFamilyContribution, setEmergencyFund,
    } = fd;

    // Insight badge counts
    const insights = useMemo(() => {
        const arr = [];
        if (smallCapPct > 20) arr.push('amber');
        if (parseFloat(monthsCovered) < 3) arr.push('red');
        else if (parseFloat(monthsCovered) < 6) arr.push('amber');
        if (wealthBuildingPctOfIncome > 20) arr.push('green');
        if (sips.length > 0) arr.push('green');
        return arr;
    }, [smallCapPct, monthsCovered, wealthBuildingPctOfIncome, sips]);

    const insightStatus = insights.includes('red') ? 'red' : insights.includes('amber') ? 'amber' : 'green';

    // Expense ratio
    const expenseRatio = income > 0 ? (monthlyExpenses / income) * 100 : 0;
    const expenseStatus = expenseRatio < 50 ? 'green' : expenseRatio < 70 ? 'amber' : 'red';

    // Emergency fund status
    const efMonths = parseFloat(monthsCovered);
    const efStatus = efMonths >= 6 ? 'green' : efMonths >= 3 ? 'amber' : 'red';

    // Investment diversification (# of categories with amount > 0)
    const activeCats = investmentCategories.filter((c) => (c.amount || 0) > 0).length;
    const divStatus = activeCats >= 4 ? 'green' : activeCats >= 2 ? 'amber' : 'red';

    // SIP status
    const sipStatus = totalMonthlySip === 0 ? 'red' : wealthBuildingPctOfIncome > 20 ? 'green' : 'amber';

    // Money flow completeness
    const flowData = fd.moneyFlow;
    const flowComplete = flowData.every((n) => (n.amount || 0) > 0);
    const flowStatus = flowComplete ? 'green' : 'amber';

    // Mini donut data
    const pieData = investmentCategories
        .filter((c) => (c.amount || 0) > 0)
        .map((c, i) => ({ name: c.name, value: c.amount, color: LOKI_COLORS[i % LOKI_COLORS.length] }));

    return (
        <div className="page-layout">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="page-header">
                <div className="container">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div>
                            <div style={{
                                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                                textTransform: 'uppercase', color: 'var(--accent-mint)', marginBottom: 2,
                            }}>
                                Personal Finance
                            </div>
                            <h1 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', background: 'linear-gradient(135deg, #e8eaf6 0%, #d4a574 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                myGroww Command Center
                            </h1>
                        </div>
                        <DataControls />
                    </div>
                </div>
            </div>

            {/* ── Master Control Panel ────────────────────────────────── */}
            <div className="container" style={{ paddingTop: 20 }}>
                <GlassCard
                    style={{
                        background: 'linear-gradient(135deg, rgba(81, 45, 168, 0.2) 0%, rgba(49, 27, 146, 0.2) 100%)',
                        border: '1px solid rgba(126, 87, 194, 0.3)',
                        padding: '24px',
                        marginBottom: 32
                    }}
                    className="animate-in"
                >
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <div className="section-title" style={{ color: '#b39ddb' }}>Master Control Panel</div>
                            <h3 style={{ fontSize: '1.1rem', color: '#ede7f6' }}>Core Financial Inputs</h3>
                        </div>
                        <span style={{ fontSize: '1.5rem' }}>🎛️</span>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 20
                    }}>
                        <div>
                            <div className="label mb-1">Monthly Income</div>
                            <div className="big-number" style={{ fontSize: '1.4rem' }}>{formatRupee(income)}</div>
                            <button className="btn-secondary mt-2" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => nav('/snapshot')}>Edit Snapshot</button>
                        </div>
                        <div>
                            <div className="label mb-1">Family Support</div>
                            <div className="big-number" style={{ fontSize: '1.4rem' }}>{formatRupee(familyContribution)}</div>
                            <button className="btn-secondary mt-2" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => nav('/family')}>Edit Support</button>
                        </div>
                        <div>
                            <div className="label mb-1">Monthly Expenses</div>
                            <div className="big-number" style={{ fontSize: '1.4rem' }}>{formatRupee(monthlyExpenses)}</div>
                            <button className="btn-secondary mt-2" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => nav('/expenses')}>Track Expenses</button>
                        </div>
                        <div>
                            <div className="label mb-1">Emergency Fund</div>
                            <div className="big-number" style={{ fontSize: '1.4rem' }}>{formatRupee(emergencyFund)}</div>
                            <button className="btn-secondary mt-2" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => nav('/snapshot')}>Manage Safety</button>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* ── Dashboard Grid ────────────────────────────────────────── */}
            <div className="container" style={{ paddingTop: 32 }}>

                {/* Subtitle */}
                <div style={{ marginBottom: 24 }}>
                    <div className="section-title">Overview</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Your personal financial command center — click any card to view and edit details.
                    </p>
                </div>

                <div className="dashboard-grid">

                    {/* 1. Financial Snapshot */}
                    <DashCard
                        delay={1}
                        emoji="💰"
                        title="Financial Snapshot"
                        metric={formatRupee(netWorth)}
                        subtext={`Monthly Income: ${formatRupee(income)}`}
                        badge={<StatusBadge status={netWorth > 0 ? 'green' : 'amber'} label={netWorth > 0 ? 'Growing' : 'Setup'} />}
                        onClick={() => nav('/snapshot')}
                    />

                    {/* 2. Investment Allocation */}
                    <DashCard
                        delay={2}
                        emoji="🥧"
                        title="Investment Portfolio"
                        metric={formatRupee(totalInvested)}
                        subtext={`${formatRupee(totalMonthlySip)} SIP + ${formatRupee(totalLumpsum)} Lumpsum`}
                        badge={<StatusBadge status={divStatus} label={divStatus === 'green' ? 'Diversified' : divStatus === 'amber' ? 'Moderate' : 'Concentrated'} />}
                        onClick={() => nav('/investments')}
                    >
                        {pieData.length > 0 && (
                            <div className="mini-chart-wrap" style={{ marginTop: 8 }}>
                                <ResponsiveContainer width={80} height={60}>
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" innerRadius={18} outerRadius={28} paddingAngle={2} stroke="none">
                                            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </DashCard>

                    {/* 3. The Engine (Money Flow) */}
                    <DashCard
                        delay={3}
                        emoji="⚡"
                        title="The Engine — Money Flow"
                        metric={formatRupee(income)}
                        subtext="Income → Salary → Expenses → Investments"
                        badge={<StatusBadge status={flowStatus} label={flowComplete ? 'Configured' : 'Incomplete'} />}
                        onClick={() => nav('/money-flow')}
                    />

                    {/* 4. SIP Tracker */}
                    <DashCard
                        delay={4}
                        emoji="📈"
                        title="SIP & Investment Tracker"
                        metric={formatRupee(totalMonthlySip) + '/mo'}
                        subtext={`${sips.length} active fund${sips.length !== 1 ? 's' : ''}`}
                        badge={<StatusBadge status={sipStatus} label={sipStatus === 'green' ? 'Excellent' : sipStatus === 'amber' ? 'Building' : 'No SIPs'} />}
                        onClick={() => nav('/sip')}
                    />

                    {/* 5. Expense Tracker */}
                    <DashCard
                        delay={5}
                        emoji="🧾"
                        title="Expense Tracker"
                        metric={formatRupee(monthlyExpenses)}
                        subtext={`${expenseRatio.toFixed(0)}% of income spent`}
                        badge={<StatusBadge status={expenseStatus} label={expenseStatus === 'green' ? 'Controlled' : expenseStatus === 'amber' ? 'Watch out' : 'Overspending'} />}
                        onClick={() => nav('/expenses')}
                    />

                    {/* 6. Emergency Fund */}
                    <DashCard
                        delay={6}
                        emoji="🛡"
                        title="Emergency Fund"
                        metric={formatRupee(emergencyFund)}
                        subtext={`${monthsCovered} months covered`}
                        badge={<StatusBadge status={efStatus} label={efStatus === 'green' ? 'Safe' : efStatus === 'amber' ? 'Caution' : 'Low'} />}
                        onClick={() => nav('/snapshot')}
                    />

                    {/* 7. Family Contribution */}
                    <DashCard
                        delay={7}
                        emoji="👪"
                        title="Family Contribution"
                        metric={formatRupee(familyContribution)}
                        subtext={`${familyPctOfIncome.toFixed(0)}% of income shared`}
                        badge={<StatusBadge status={familyPctOfIncome > 50 ? 'amber' : 'green'} label={familyPctOfIncome > 50 ? 'Substantial' : 'Managed'} />}
                        onClick={() => nav('/family')}
                    />

                    {/* 8. Smart Insights */}
                    <DashCard
                        delay={8}
                        emoji="🧠"
                        title="Smart Insights & Discipline"
                        metric={`${insights.filter((x) => x === 'green').length} / ${insights.length}`}
                        subtext="Discipline checks passed"
                        badge={<StatusBadge status={insightStatus} label={insightStatus === 'green' ? 'Healthy' : insightStatus === 'amber' ? 'Review needed' : 'Action needed'} />}
                        onClick={() => nav('/insights')}
                    />
                </div>

                {/* Footer */}
                <div style={{
                    marginTop: 40, textAlign: 'center',
                    color: 'var(--text-secondary)', fontSize: '0.75rem', paddingBottom: 20,
                }}>
                    myGroww v1 · All data stored locally · No external API calls
                </div>
            </div>
        </div>
    );
}
