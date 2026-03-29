import React from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from '../components/GlassCard';
import DataControls from '../components/DataControls';
import BackButton from '../components/BackButton';
import { formatRupee } from '../components/EditableNumber';
import { EXPENSE_CATEGORIES } from '../data/defaults';

export default function ExpenseTrackerPage() {
    const { expenses, addExpense, updateExpense, deleteExpense, monthlyExpenses, income, monthsCovered } = useFinanceData();

    function handleAddRow() {
        const today = new Date().toISOString().slice(0, 10);
        addExpense({
            id: Date.now().toString(),
            date: today,
            category: 'Food',
            amount: 0,
            notes: '',
        });
    }

    const expenseRatio = income > 0 ? ((monthlyExpenses / income) * 100).toFixed(1) : 0;
    const ratioStatus = expenseRatio < 50 ? 'green' : expenseRatio < 70 ? 'amber' : 'red';

    // By category totals
    const byCat = EXPENSE_CATEGORIES.map((cat) => ({
        cat,
        total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + (Number(e.amount) || 0), 0),
    })).filter((c) => c.total > 0);

    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="flex items-center gap-3">
                            <BackButton />
                            <div>
                                <div className="section-title">Expense Tracker</div>
                                <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>🧾 Monthly Expenses</h2>
                            </div>
                        </div>
                        <DataControls />
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>
                {/* Summary strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'Monthly Total', value: formatRupee(monthlyExpenses), color: ratioStatus === 'red' ? 'var(--alert-red)' : 'var(--accent-gold)' },
                        { label: 'Of Income', value: `${expenseRatio}%`, color: ratioStatus === 'red' ? 'var(--alert-red)' : ratioStatus === 'amber' ? 'var(--accent-gold)' : 'var(--accent-mint-light)' },
                        { label: 'Emergency Coverage', value: `${monthsCovered} months`, color: 'var(--text-primary)' },
                    ].map((item) => (
                        <GlassCard key={item.label} className="animate-in" style={{ padding: '18px 22px' }}>
                            <div className="section-title mb-1">{item.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                        </GlassCard>
                    ))}
                </div>

                {/* Category breakdown */}
                {byCat.length > 0 && (
                    <GlassCard className="animate-in stagger-2" style={{ padding: '20px 24px', marginBottom: 24 }}>
                        <div className="section-title mb-3">By Category</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {byCat.map(({ cat, total }) => (
                                <div key={cat} style={{
                                    background: 'rgba(26,125,111,0.08)', border: '1px solid var(--border)',
                                    borderRadius: 10, padding: '8px 16px', minWidth: 120,
                                }}>
                                    <div className="label" style={{ fontSize: '0.7rem' }}>{cat}</div>
                                    <div style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{formatRupee(total)}</div>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                )}

                {/* Expense table */}
                <GlassCard style={{ padding: '24px' }} className="animate-in stagger-3">
                    <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="section-title" style={{ margin: 0 }}>Expense Log</div>
                        <button className="btn btn-primary btn-icon" onClick={handleAddRow}>+ Add Expense</button>
                    </div>

                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Category</th>
                                    <th>Amount (₹)</th>
                                    <th>Notes</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((exp) => (
                                    <tr key={exp.id}>
                                        <td>
                                            <input
                                                type="date"
                                                value={exp.date}
                                                onChange={(e) => updateExpense(exp.id, 'date', e.target.value)}
                                                style={{ width: 140 }}
                                            />
                                        </td>
                                        <td>
                                            <select
                                                value={exp.category}
                                                onChange={(e) => updateExpense(exp.id, 'category', e.target.value)}
                                            >
                                                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={exp.amount || 0}
                                                onChange={(e) => updateExpense(exp.id, 'amount', parseFloat(e.target.value) || 0)}
                                                style={{ width: 110 }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                value={exp.notes || ''}
                                                onChange={(e) => updateExpense(exp.id, 'notes', e.target.value)}
                                                placeholder="Optional note…"
                                                style={{ width: 180 }}
                                            />
                                        </td>
                                        <td>
                                            <button className="btn btn-danger btn-icon" onClick={() => deleteExpense(exp.id)}>✕</button>
                                        </td>
                                    </tr>
                                ))}
                                {expenses.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
                                            No expenses logged — click "+ Add Expense" to start
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2} style={{ fontWeight: 700, paddingTop: 12 }}>Monthly Total</td>
                                    <td style={{ fontWeight: 700, color: 'var(--accent-gold)', paddingTop: 12 }}>
                                        {formatRupee(monthlyExpenses)}
                                    </td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
