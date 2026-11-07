import { useMemo, useState } from 'react';
import { CategorySelect, Card, EditableAmount, PageHeader, Stat, TypeSelect } from '../components/ui';
import { changeWithUndo } from '../components/undo';
import { cycleFor, inCycle } from '../core/cycles';
import { formatDate } from '../core/dates';
import { ACCOUNTS, SOURCES, TX_TYPES } from '../core/ledger';
import { formatINR, toPaise } from '../core/money';
import { addTx, removeTx, updateTx } from '../core/state';
import { commit, useFinance } from '../store';

function AddExpense({ today }) {
    const [form, setForm] = useState({ amount: '', category: 'Food', description: '', date: today, account: 'debit', oneOff: false });
    const [error, setError] = useState('');
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    function submit(e) {
        e.preventDefault();
        const amountPaise = toPaise(form.amount);
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) { setError('Enter an amount more than ₹0.'); return; }
        if (!form.date || form.date > today) { setError('Choose today or an earlier date.'); return; }
        commit((state) => addTx(state, { ...form, amountPaise, type: 'spend', description: form.description.trim() || form.category }));
        setForm((f) => ({ ...f, amount: '', description: '', oneOff: false }));
        setError('');
    }
    return (
        <form onSubmit={submit} className="form-row">
            <label>Amount (₹)<input id="exp-amount" autoFocus inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="250" /></label>
            <label>Category<CategorySelect id="exp-cat" value={form.category} onChange={(v) => set('category', v)} /></label>
            <label>What for (optional)<input id="exp-desc" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Lunch" /></label>
            <label>Date<input id="exp-date" type="date" max={today} value={form.date} onChange={(e) => set('date', e.target.value)} /></label>
            <label>Paid by<select id="exp-account" value={form.account} onChange={(e) => set('account', e.target.value)}>{Object.entries(ACCOUNTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="check"><input id="exp-oneoff" type="checkbox" checked={form.oneOff} onChange={(e) => set('oneOff', e.target.checked)} /> One-off</label>
            <button type="submit" className="btn btn-primary">Add expense</button>
            {error && <p className="red-text" role="alert" style={{ flexBasis: '100%' }}>{error}</p>}
        </form>
    );
}

export default function ExpenseTrackerPage() {
    const { s, today } = useFinance();
    const [cycleStart, setCycleStart] = useState('current');
    const [scope, setScope] = useState('spend');
    const [query, setQuery] = useState('');
    const selected = cycleStart === 'current' ? s.current.cycle : s.cycles.find((c) => c.cycle.start === cycleStart)?.cycle ?? cycleFor([], today);
    const summary = s.cycles.find((c) => c.cycle.id === selected.id) ?? s.current;

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return s.transactions
            .filter((t) => scope === 'everything' || (scope === 'all-time-spend' ? t.type === 'spend' : t.type === 'spend' && inCycle(t, selected, today)))
            .filter((t) => scope !== 'everything' || inCycle(t, selected, today))
            .filter((t) => !q || `${t.description} ${t.category}`.toLowerCase().includes(q))
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [s.transactions, scope, selected, today, query]);

    return (
        <div className="page-layout">
            <PageHeader section="Spending" title="🧾 Expenses" />
            <div className="container" style={{ paddingTop: 24 }}>
                <Card className="mb-4"><AddExpense today={today} /></Card>

                <div className="stat-row mb-4">
                    <Stat label="Spent this cycle" value={formatINR(summary.spendPaise)} note={`${formatDate(selected.start)} to ${selected.end ? formatDate(selected.end) : 'today'}`} />
                    <Stat label="Normal spending" value={formatINR(summary.normalSpendPaise)} note="Without one-offs" />
                    <Stat label="One-offs" value={formatINR(summary.oneOffPaise)} note="Big purchases that are not monthly" />
                </div>

                {summary.categories.length > 0 && (
                    <Card className="mb-4">
                        <div className="section-title mb-3">By category</div>
                        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                            {summary.categories.map((c) => (
                                <div key={c.name} className="chip"><span className="label">{c.name}</span> <strong>{formatINR(c.amountPaise)}</strong></div>
                            ))}
                        </div>
                    </Card>
                )}

                <Card>
                    <div className="form-row mb-4">
                        <label>Salary cycle
                            <select id="cycle-pick" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)}>
                                <option value="current">Current</option>
                                {s.cycles.slice().reverse().map((c) => <option key={c.cycle.start} value={c.cycle.start}>From {formatDate(c.cycle.start)}</option>)}
                            </select>
                        </label>
                        <label>Show
                            <select id="scope-pick" value={scope} onChange={(e) => setScope(e.target.value)}>
                                <option value="spend">Spending</option>
                                <option value="everything">All money in this cycle</option>
                                <option value="all-time-spend">All spending ever</option>
                            </select>
                        </label>
                        <label>Search<input id="tx-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Grocery, cab" /></label>
                    </div>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Paid by</th><th>Amount</th><th>One-off</th><th><span className="sr-only">Delete</span></th></tr></thead>
                            <tbody>
                                {rows.map((t) => (
                                    <tr key={t.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                                        <td>{t.description}<div className="label" style={{ fontSize: '0.72rem' }}>{SOURCES[t.source]}{t.flow === 'in' && t.type !== 'income' ? ' · money back' : ''}</div></td>
                                        <td>{t.type === 'spend' ? <CategorySelect value={t.category} onChange={(v) => commit((st) => updateTx(st, t.id, { category: v }))} /> : t.category}</td>
                                        <td><TypeSelect value={t.type} onChange={(v) => commit((st) => updateTx(st, t.id, { type: v }))} /></td>
                                        <td>{ACCOUNTS[t.account]}</td>
                                        <td><EditableAmount value={t.amountPaise} onChange={(p) => { if (p > 0) commit((st) => updateTx(st, t.id, { amountPaise: p })); }} /></td>
                                        <td><input type="checkbox" aria-label="One-off" disabled={t.type !== 'spend'} checked={t.oneOff} onChange={(e) => commit((st) => updateTx(st, t.id, { oneOff: e.target.checked }))} /></td>
                                        <td><button type="button" className="btn btn-danger btn-icon" aria-label={`Delete ${t.description}`} onClick={() => changeWithUndo('Entry deleted.', (st) => removeTx(st, t.id))}>✕</button></td>
                                    </tr>
                                ))}
                                {rows.length === 0 && <tr><td colSpan={8} className="label" style={{ textAlign: 'center', padding: 24 }}>Nothing here yet. {TX_TYPES.spend} you add will appear in this list.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
