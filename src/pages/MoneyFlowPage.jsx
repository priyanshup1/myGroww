import React from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from '../components/GlassCard';
import { formatRupee } from '../components/EditableNumber';
import DataControls from '../components/DataControls';
import BackButton from '../components/BackButton';

function FlowArrow() {
    return (
        <div className="flow-arrow" style={{ margin: '8px 0' }}>
            <div className="flow-arrow-line" style={{ height: 30 }} />
            <div className="flow-arrow-head" />
        </div>
    );
}

export default function MoneyFlowPage() {
    const {
        income,
        familyContribution,
        amountRetained,
        moneyFlow,
        updateFlowNode
    } = useFinanceData();

    // The user wants: [Monthly Income] -> [-] Family Contribution -> [Remaining Amount] -> Account 1 -> Account 2 -> Account 3

    // Account nodes usually have indexes. I'll stick to the provided accounts but inject the family part above Account 1.
    const nodeColors = ['var(--accent-mint)', 'var(--accent-gold)', 'var(--text-secondary)'];

    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="flex items-center gap-3">
                            <BackButton />
                            <div>
                                <div className="section-title">Money Flow</div>
                                <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>⚡ The Engine</h2>
                            </div>
                        </div>
                        <DataControls />
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>
                <p className="label mb-6" style={{ marginBottom: 24 }}>
                    Visual flow of your financial pipeline. Amounts are pulled from source cards.
                </p>

                <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 60 }}>

                    {/* 1. SOURCE: Monthly Income */}
                    <GlassCard className="animate-in" style={{ padding: '20px 24px', borderColor: 'var(--accent-mint)' }}>
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="section-title" style={{ color: 'var(--accent-mint)' }}>Monthly Income</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{formatRupee(income)}</div>
                                <div className="label mt-1">Total take-home salary</div>
                            </div>
                            <span style={{ fontSize: '2rem' }}>💼</span>
                        </div>
                    </GlassCard>

                    <FlowArrow />

                    {/* 2. DEDUCTION: Family Contribution */}
                    <GlassCard className="animate-in stagger-1" style={{
                        padding: '16px 24px',
                        borderColor: 'var(--accent-gold)',
                        background: 'rgba(212, 165, 116, 0.05)'
                    }}>
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="section-title" style={{ color: 'var(--accent-gold)' }}>[-] Family Contribution</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                    {formatRupee(familyContribution)}
                                </div>
                                <div className="label mt-1">Sent to family first</div>
                            </div>
                            <span style={{ fontSize: '1.5rem' }}>👪</span>
                        </div>
                    </GlassCard>

                    <FlowArrow />

                    {/* 3. TRANSIT: Remaining Amount */}
                    <div className="animate-in stagger-2" style={{
                        textAlign: 'center',
                        padding: '12px',
                        border: '1px dashed var(--border)',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)'
                    }}>
                        <div className="label" style={{ fontSize: '0.65rem' }}>REMAINING TO ALLOCATE</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{formatRupee(amountRetained)}</div>
                    </div>

                    <FlowArrow />

                    {/* 4. ACCOUNTS (1, 2, 3) */}
                    {moneyFlow.map((node, idx) => (
                        <React.Fragment key={node.id}>
                            <div className={`flow-node animate-in stagger-${idx + 3}`}>
                                <div style={{
                                    position: 'absolute', top: -10, left: 20,
                                    background: 'var(--bg-base)',
                                    padding: '2px 10px',
                                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                                    textTransform: 'uppercase', color: nodeColors[idx],
                                    border: `1px solid ${nodeColors[idx]}`,
                                    borderRadius: 20,
                                }}>
                                    Account {idx + 1}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, paddingTop: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{node.label}</div>
                                        <div className="label" style={{ marginBottom: 12 }}>{node.description}</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: nodeColors[idx] }}>
                                            {formatRupee(node.amount)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {idx < moneyFlow.length - 1 && <FlowArrow />}
                        </React.Fragment>
                    ))}

                    {/* Summary */}
                    <div style={{ marginTop: 28 }} className="animate-in stagger-6">
                        <GlassCard style={{ padding: '16px 20px' }}>
                            <div className="section-title mb-2">Allocation Breakdown</div>
                            <div className="flex justify-between py-2 border-b border-white-10">
                                <span className="label">Total Income</span>
                                <span style={{ fontWeight: 600 }}>{formatRupee(income)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white-10">
                                <span className="label">Family Support</span>
                                <span style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>-{formatRupee(familyContribution)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white-10" style={{ background: 'rgba(255,255,255,0.03)', margin: '0 -20px', padding: '8px 20px' }}>
                                <span className="label" style={{ fontWeight: 700 }}>Net Disposable</span>
                                <span style={{ fontWeight: 800 }}>{formatRupee(amountRetained)}</span>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </div>
    );
}
