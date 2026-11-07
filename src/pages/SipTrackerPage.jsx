import { useState } from 'react';
import { Card, EditableAmount, PageHeader, Stat } from '../components/ui';
import { changeWithUndo } from '../components/undo';
import { formatDate, formatMonth, monthKey } from '../core/dates';
import { SIP_CATEGORIES, newId } from '../core/ledger';
import { formatINR, toPaise } from '../core/money';
import { addTx, removeFund, removeTx, updateTx, upsertFund } from '../core/state';
import { commit, useFinance } from '../store';

function AddFund() {
    const [form, setForm] = useState({ name: '', category: SIP_CATEGORIES[0], monthly: '', start: '' });
    const [error, setError] = useState('');
    function submit(e) {
        e.preventDefault();
        const monthlySipPaise = form.monthly === '' ? 0 : toPaise(form.monthly);
        if (!form.name.trim()) { setError('Enter the fund name.'); return; }
        if (!Number.isFinite(monthlySipPaise) || monthlySipPaise < 0) { setError('Enter a valid monthly amount.'); return; }
        commit((st) => upsertFund(st, { id: newId(), name: form.name.trim(), category: form.category, monthlySipPaise, startDate: form.start ? `${form.start}-01` : null }));
        setForm({ name: '', category: SIP_CATEGORIES[0], monthly: '', start: '' });
        setError('');
    }
    return (
        <form onSubmit={submit} className="form-row">
            <label>Fund name<input id="fund-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Category<select id="fund-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{SIP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Monthly SIP (₹)<input id="fund-monthly" inputMode="decimal" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} /></label>
            <label>Started<input id="fund-start" type="month" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
            <button type="submit" className="btn btn-primary">Add fund</button>
            {error && <p className="red-text" role="alert" style={{ flexBasis: '100%' }}>{error}</p>}
        </form>
    );
}

export default function SipTrackerPage() {
    const { state, s, today } = useFinance();
    const [month, setMonth] = useState(monthKey(today));
    const investments = s.transactions.filter((t) => t.type === 'investment');
    const inMonth = investments.filter((t) => monthKey(t.date) === month);
    const months = [...new Set([monthKey(today), ...investments.map((t) => monthKey(t.date))])].sort().reverse();
    const unassigned = investments.filter((t) => !t.fundId).sort((a, b) => b.date.localeCompare(a.date));
    const thisMonthPaid = inMonth.reduce((sum, t) => sum + (t.flow === 'out' ? t.amountPaise : -t.amountPaise), 0);

    function markPaid(fund) {
        const date = month === monthKey(today) ? today : `${month}-01`;
        commit((st) => addTx(st, { date, amountPaise: fund.monthlySipPaise, type: 'investment', fundId: fund.id, category: fund.category, description: `${fund.name} SIP` }));
    }

    return (
        <div className="page-layout">
            <PageHeader section="SIP tracker" title="📈 Mutual fund SIPs" />
            <div className="container" style={{ paddingTop: 24 }}>
                <div className="stat-row mb-4">
                    <Stat label="Planned each month" value={formatINR(s.investments.plannedMonthlyPaise)} />
                    <Stat label={`Paid in ${formatMonth(month)}`} value={formatINR(thisMonthPaid)} />
                    <Stat label="Total money put in" value={formatINR(s.investments.totalPaise)} note="Only what you actually paid. Changing a plan never changes this." />
                </div>

                <Card className="mb-4">
                    <div className="section-title mb-3">My funds</div>
                    <AddFund />
                    <div className="table-wrap mt-4">
                        <table className="data-table">
                            <thead><tr><th>Fund</th><th>Category</th><th>Monthly SIP</th><th>Started</th><th>Put in so far</th><th><span className="sr-only">Remove</span></th></tr></thead>
                            <tbody>
                                {state.funds.map((f) => (
                                    <tr key={f.id}>
                                        <td><input aria-label="Fund name" value={f.name} onChange={(e) => commit((st) => upsertFund(st, { id: f.id, name: e.target.value }))} /></td>
                                        <td><select aria-label="Fund category" value={f.category} onChange={(e) => commit((st) => upsertFund(st, { id: f.id, category: e.target.value }))}>{SIP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></td>
                                        <td><EditableAmount value={f.monthlySipPaise} onChange={(p) => commit((st) => upsertFund(st, { id: f.id, monthlySipPaise: p }))} /></td>
                                        <td><input aria-label="Start month" type="month" value={(f.startDate ?? '').slice(0, 7)} onChange={(e) => commit((st) => upsertFund(st, { id: f.id, startDate: e.target.value ? `${e.target.value}-01` : null }))} /></td>
                                        <td>{formatINR(s.investments.byFund[f.id] ?? 0)}</td>
                                        <td><button type="button" className="btn btn-danger btn-icon" aria-label={`Remove ${f.name}`} onClick={() => changeWithUndo('Fund removed. Its past payments still count.', (st) => removeFund(st, f.id))}>✕</button></td>
                                    </tr>
                                ))}
                                {state.funds.length === 0 && <tr><td colSpan={6} className="label" style={{ textAlign: 'center', padding: 20 }}>Add your funds above.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card className="mb-4">
                    <div className="flex justify-between items-center mb-3" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="section-title" style={{ margin: 0 }}>Monthly log</div>
                        <div className="form-row"><label>Month<select id="sip-month" value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}</select></label></div>
                    </div>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead><tr><th>Fund</th><th>Paid</th><th>Status</th></tr></thead>
                            <tbody>
                                {state.funds.map((f) => {
                                    const paid = inMonth.filter((t) => t.fundId === f.id);
                                    return (
                                        <tr key={f.id}>
                                            <td>{f.name}</td>
                                            <td>{paid.map((t) => <div key={t.id} className="flex items-center gap-2"><EditableAmount value={t.amountPaise} onChange={(p) => { if (p > 0) commit((st) => updateTx(st, t.id, { amountPaise: p })); }} /><button type="button" className="btn btn-ghost btn-icon" aria-label="Remove payment" onClick={() => changeWithUndo('Payment removed.', (st) => removeTx(st, t.id))}>✕</button></div>)}{paid.length === 0 && '₹0'}</td>
                                            <td>{paid.length ? <span className="green-text">Paid</span> : <button type="button" className="btn btn-primary btn-icon" disabled={!f.monthlySipPaise} onClick={() => markPaid(f)}>Mark {formatINR(f.monthlySipPaise)} paid</button>}</td>
                                        </tr>
                                    );
                                })}
                                {state.funds.length === 0 && <tr><td colSpan={3} className="label" style={{ textAlign: 'center', padding: 20 }}>Your funds will appear here.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {unassigned.length > 0 && (
                    <Card>
                        <div className="section-title mb-1">Which fund was this for?</div>
                        <p className="label mb-3">These payments count toward your total. Choose a fund so your allocation is accurate.</p>
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Fund</th></tr></thead>
                                <tbody>
                                    {unassigned.map((t) => (
                                        <tr key={t.id}>
                                            <td>{formatDate(t.date)}</td><td>{t.description}</td><td>{formatINR(t.amountPaise)}</td>
                                            <td><select aria-label="Assign to fund" value="" disabled={!state.funds.length} onChange={(e) => commit((st) => updateTx(st, t.id, { fundId: e.target.value }))}><option value="">{state.funds.length ? 'Choose a fund' : 'Add a fund first'}</option>{state.funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
