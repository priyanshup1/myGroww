import { useState } from 'react';
import { Card, EditableAmount, PageHeader, Stat, StatusBadge } from '../components/ui';
import { changeWithUndo } from '../components/undo';
import { formatDate } from '../core/dates';
import { EMERGENCY_FUND } from '../core/ledger';
import { formatINR, toPaise } from '../core/money';
import { addTx, removeTx, setPlan, updateTx } from '../core/state';
import { commit, useFinance } from '../store';

export default function EmergencyFundPage() {
    const { state, s, today } = useFinance();
    const ef = s.emergency;
    const [form, setForm] = useState({ amount: '', date: today, flow: 'out' });
    const [error, setError] = useState('');
    const entries = s.transactions.filter((t) => t.type === 'savings' && t.category === EMERGENCY_FUND).sort((a, b) => b.date.localeCompare(a.date));
    function submit(e) {
        e.preventDefault();
        const amountPaise = toPaise(form.amount);
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) { setError('Enter an amount more than ₹0.'); return; }
        if (form.flow === 'in' && amountPaise > ef.balancePaise) { setError(`You can take out at most ${formatINR(ef.balancePaise)}.`); return; }
        commit((st) => addTx(st, { date: form.date, amountPaise, flow: form.flow, type: 'savings', category: EMERGENCY_FUND, description: form.flow === 'out' ? 'Added to emergency fund' : 'Taken from emergency fund' }));
        setForm({ ...form, amount: '' });
        setError('');
    }
    return (
        <div className="page-layout">
            <PageHeader section="Emergency fund" title="🛡️ Your safety net" />
            <div className="container" style={{ paddingTop: 24 }}>
                <div className="stat-row mb-4">
                    <Stat label="Saved" value={formatINR(ef.balancePaise)} />
                    <Stat label="Months covered" value={ef.months === null ? 'Not known yet' : ef.months.toFixed(1)} note={`Based on ${formatINR(ef.monthlyNeedPaise)} a month for family and normal spending`} />
                    <Stat label={`${state.plan.emergencyMonths}-month target`} value={formatINR(ef.targetPaise)} note={ef.gapPaise ? `${formatINR(ef.gapPaise)} still to go` : 'Target reached'} />
                </div>
                <Card className="mb-4">
                    <div className="flex items-center gap-3 mb-3" style={{ flexWrap: 'wrap' }}>
                        <div className="section-title" style={{ margin: 0 }}>Add or take out</div>
                        {ef.months !== null && <StatusBadge status={ef.status} label={ef.status === 'green' ? 'On target' : ef.status === 'amber' ? 'Building' : 'Low'} />}
                    </div>
                    <form onSubmit={submit} className="form-row">
                        <label>Action<select id="ef-flow" value={form.flow} onChange={(e) => setForm({ ...form, flow: e.target.value })}><option value="out">Add money</option><option value="in">Take money out</option></select></label>
                        <label>Amount (₹)<input id="ef-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
                        <label>Date<input id="ef-date" type="date" max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                        <label>Target months<input id="ef-months" type="number" min="1" max="24" value={state.plan.emergencyMonths} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 24) commit((st) => setPlan(st, { emergencyMonths: n })); }} /></label>
                        <button type="submit" className="btn btn-primary">Save</button>
                        {error && <p className="red-text" role="alert" style={{ flexBasis: '100%' }}>{error}</p>}
                    </form>
                </Card>
                <Card>
                    <div className="section-title mb-3">History</div>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead><tr><th>Date</th><th>Action</th><th>Amount</th><th><span className="sr-only">Delete</span></th></tr></thead>
                            <tbody>
                                {entries.map((t) => (
                                    <tr key={t.id}>
                                        <td>{formatDate(t.date)}</td>
                                        <td>{t.flow === 'out' ? 'Added' : 'Taken out'}</td>
                                        <td><EditableAmount value={t.amountPaise} onChange={(p) => { if (p > 0) commit((st) => updateTx(st, t.id, { amountPaise: p })); }} /></td>
                                        <td><button type="button" className="btn btn-danger btn-icon" aria-label="Delete entry" onClick={() => changeWithUndo('Entry deleted.', (st) => removeTx(st, t.id))}>✕</button></td>
                                    </tr>
                                ))}
                                {entries.length === 0 && <tr><td colSpan={4} className="label" style={{ textAlign: 'center', padding: 20 }}>Nothing saved yet. Add your first amount above.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
