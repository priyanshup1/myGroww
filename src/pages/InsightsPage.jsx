import React from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from '../components/GlassCard';
import DataControls from '../components/DataControls';
import BackButton from '../components/BackButton';
import { formatRupee } from '../components/EditableNumber';

function InsightCard({ status, emoji, title, detail }) {
    return (
        <div className={`insight-card ${status} animate-in`}>
            <div className="insight-icon">{emoji}</div>
            <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
                <div className="label" style={{ fontSize: '0.82rem' }}>{detail}</div>
            </div>
        </div>
    );
}

export default function InsightsPage() {
    const {
        income, totalMonthlySip, totalInvested, emergencyFund,
        monthlyExpenses, monthsCovered, smallCapPct,
        investmentCategories, sips,
    } = useFinanceData();

    const efMonths = parseFloat(monthsCovered);
    const expenseRatio = income > 0 ? (monthlyExpenses / income) * 100 : 0;
    const sipRatio = income > 0 ? (totalMonthlySip / income) * 100 : 0;

    const insights = [
        {
            id: 'smallcap',
            show: true,
            status: smallCapPct > 20 ? 'amber' : 'green',
            emoji: smallCapPct > 20 ? '⚠️' : '✅',
            title: smallCapPct > 20
                ? `High small cap exposure (${smallCapPct.toFixed(1)}%)`
                : `Small cap allocation is balanced (${smallCapPct.toFixed(1)}%)`,
            detail: smallCapPct > 20
                ? 'Small cap > 20% of portfolio — consider rebalancing to reduce volatility risk.'
                : 'Small cap allocation is within healthy limits. Keep monitoring.',
        },
        {
            id: 'emergency',
            show: true,
            status: efMonths >= 6 ? 'green' : efMonths >= 3 ? 'amber' : 'red',
            emoji: efMonths >= 6 ? '🛡' : efMonths >= 3 ? '⚠️' : '🚨',
            title: efMonths >= 6
                ? `Emergency fund is strong (${monthsCovered} months)`
                : efMonths >= 3
                    ? `Emergency fund below 6 months (${monthsCovered} months covered)`
                    : `Emergency fund critically low (${monthsCovered} months covered)`,
            detail: efMonths >= 6
                ? `${formatRupee(emergencyFund)} in your emergency fund — well above the 6-month threshold.`
                : `Target: ${formatRupee(monthlyExpenses * 6)} for 6 months coverage. Current: ${formatRupee(emergencyFund)}.`,
        },
        {
            id: 'siprate',
            show: true,
            status: sipRatio > 20 ? 'green' : sipRatio > 10 ? 'amber' : 'red',
            emoji: sipRatio > 20 ? '🏆' : sipRatio > 10 ? '📊' : '💡',
            title: sipRatio > 20
                ? `Great savings discipline — ${sipRatio.toFixed(1)}% of income in SIPs`
                : sipRatio > 10
                    ? `Moderate savings rate — ${sipRatio.toFixed(1)}% of income in SIPs`
                    : `Low SIP rate — ${sipRatio.toFixed(1)}% of income invested`,
            detail: sipRatio > 20
                ? 'You\'re investing more than 20% of income. This puts you on track for long-term wealth.'
                : 'Target 20%+ of income for SIPs to build substantial long-term wealth.',
        },
        {
            id: 'consistency',
            show: true,
            status: sips.length > 0 ? 'green' : 'amber',
            emoji: sips.length > 0 ? '📅' : '📌',
            title: sips.length > 0
                ? `Consistent investor — ${sips.length} active SIP${sips.length > 1 ? 's' : ''} this month`
                : 'No SIPs configured yet',
            detail: sips.length > 0
                ? `All ${sips.length} SIPs active. Total monthly commitment: ${formatRupee(totalMonthlySip)}`
                : 'Add your mutual fund SIPs in the SIP Tracker to start tracking consistency.',
        },
        {
            id: 'expenses',
            show: true,
            status: expenseRatio < 50 ? 'green' : expenseRatio < 70 ? 'amber' : 'red',
            emoji: expenseRatio < 50 ? '💚' : expenseRatio < 70 ? '🟡' : '🔴',
            title: expenseRatio < 50
                ? `Excellent expense control — only ${expenseRatio.toFixed(1)}% of income spent`
                : expenseRatio < 70
                    ? `Moderate expenses — ${expenseRatio.toFixed(1)}% of income spent`
                    : `High expenses — ${expenseRatio.toFixed(1)}% of income spent`,
            detail: expenseRatio < 50
                ? 'You\'re keeping expenses below 50% of income. Excellent financial health.'
                : expenseRatio < 70
                    ? 'Consider reducing discretionary spending to improve your savings rate.'
                    : 'Expenses exceed 70% of income. Review and reduce non-essential costs urgently.',
        },
        {
            id: 'diversification',
            show: true,
            status: investmentCategories.filter(c => c.amount > 0).length >= 4 ? 'green'
                : investmentCategories.filter(c => c.amount > 0).length >= 2 ? 'amber' : 'red',
            emoji: investmentCategories.filter(c => c.amount > 0).length >= 4 ? '🌐' : '📂',
            title: `Portfolio diversification: ${investmentCategories.filter(c => c.amount > 0).length} asset class${investmentCategories.filter(c => c.amount > 0).length !== 1 ? 'es' : ''}`,
            detail: investmentCategories.filter(c => c.amount > 0).length >= 4
                ? 'Well-diversified across 4+ asset classes. Good risk distribution.'
                : 'Consider diversifying into more asset classes (Index, Flexi Cap, Small Cap, Gold, etc.).',
        },
    ];

    const greenCount = insights.filter((i) => i.status === 'green').length;
    const redCount = insights.filter((i) => i.status === 'red').length;
    const overallScore = Math.round((greenCount / insights.length) * 100);

    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="flex items-center gap-3">
                            <BackButton />
                            <div>
                                <div className="section-title">Smart Insights</div>
                                <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>🧠 Financial Health Check</h2>
                            </div>
                        </div>
                        <DataControls />
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>
                {/* Score card */}
                <GlassCard className="animate-in" style={{ padding: '24px 28px', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: `conic-gradient(${overallScore >= 70 ? 'var(--accent-mint)' : overallScore >= 50 ? 'var(--accent-gold)' : 'var(--alert-red)'} ${overallScore * 3.6}deg, var(--border) 0deg)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <div style={{
                                width: 60, height: 60, borderRadius: '50%',
                                background: 'var(--bg-card)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: '1.1rem',
                                color: overallScore >= 70 ? 'var(--accent-mint-light)' : overallScore >= 50 ? 'var(--accent-gold)' : 'var(--alert-red)',
                            }}>
                                {overallScore}
                            </div>
                        </div>
                        <div>
                            <div className="section-title">Financial Health Score</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                                {overallScore >= 70 ? 'Healthy 🌟' : overallScore >= 50 ? 'Needs attention ⚡' : 'Action required 🚨'}
                            </div>
                            <div className="label mt-1">
                                {greenCount} of {insights.length} checks passed ·{' '}
                                {redCount > 0 ? `${redCount} critical issue${redCount > 1 ? 's' : ''}` : 'No critical issues'}
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Insight cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {insights.map((ins, idx) => (
                        <InsightCard
                            key={ins.id}
                            status={ins.status}
                            emoji={ins.emoji}
                            title={ins.title}
                            detail={ins.detail}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
