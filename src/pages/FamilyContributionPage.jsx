import React from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from '../components/GlassCard';
import EditableNumber, { formatRupee } from '../components/EditableNumber';
import DataControls from '../components/DataControls';
import BackButton from '../components/BackButton';

export default function FamilyContributionPage() {
    const {
        income,
        familyContribution,
        setFamilyContribution,
        amountRetained,
        familyPctGiven,
    } = useFinanceData();

    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="flex items-center gap-3">
                            <BackButton />
                            <div>
                                <div className="section-title">Family Contribution</div>
                                <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>👪 Monthly Support</h2>
                            </div>
                        </div>
                        <DataControls />
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>
                <p className="label mb-6" style={{ marginBottom: 24 }}>
                    Track how much of your income is shared with family vs. retained for your own expenses and investments.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
                    {/* Salary (Read-only) */}
                    <GlassCard style={{ padding: '24px' }} className="animate-in">
                        <div className="section-title mb-2">Monthly Take-home</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                            {formatRupee(income)}
                        </div>
                        <div className="label mt-2 opacity-60">Source: Financial Snapshot</div>
                    </GlassCard>

                    {/* Amount Given (Editable) */}
                    <GlassCard style={{ padding: '24px' }} className="animate-in stagger-1">
                        <div className="section-title mb-2" style={{ color: 'var(--accent-mint)' }}>Amount Given to Family</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-mint)' }}>
                            <EditableNumber value={familyContribution} onChange={setFamilyContribution} />
                        </div>
                        <div className="label mt-2 opacity-60">Click to edit amount</div>
                    </GlassCard>

                    {/* Amount Retained */}
                    <GlassCard style={{ padding: '24px' }} className="animate-in stagger-2">
                        <div className="section-title mb-2" style={{ color: 'var(--accent-gold)' }}>Amount Retained</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                            {formatRupee(amountRetained)}
                        </div>
                        <div className="label mt-2 opacity-60">Remaining for self</div>
                    </GlassCard>
                </div>

                {/* Visual Split Bar */}
                <GlassCard style={{ padding: '32px' }} className="animate-in stagger-3">
                    <div className="section-title mb-4">Contribution Split</div>

                    <div style={{
                        height: 48,
                        width: '100%',
                        background: 'var(--border)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        display: 'flex',
                        marginBottom: 20,
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                        {/* Amount Given (Mint) */}
                        <div style={{
                            width: `${familyPctGiven}%`,
                            height: '100%',
                            background: 'var(--accent-mint)',
                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap',
                            minWidth: familyPctGiven > 0 ? '4px' : '0'
                        }} />

                        {/* Amount Retained (Gold) */}
                        <div style={{
                            width: `${100 - familyPctGiven}%`,
                            height: '100%',
                            background: 'var(--accent-gold)',
                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} />
                    </div>

                    <div className="flex justify-between items-start" style={{ gap: 20 }}>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-mint)' }} />
                                <span style={{ fontWeight: 700, color: 'var(--accent-mint)' }}>Given to Family</span>
                            </div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatRupee(familyContribution)}</div>
                            <div className="label">{familyPctGiven.toFixed(1)}% of income</div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div className="flex items-center gap-2 mb-1 justify-end">
                                <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>Retained by You</span>
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-gold)' }} />
                            </div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatRupee(amountRetained)}</div>
                            <div className="label">{(100 - familyPctGiven).toFixed(1)}% of income</div>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
