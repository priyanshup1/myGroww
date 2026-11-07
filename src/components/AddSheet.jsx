import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import toast from 'react-hot-toast';
import { EMERGENCY_FUND, SPEND_CATEGORIES } from '../core/ledger';
import { formatINR, toPaise } from '../core/money';
import { addTx, removeTx, updateTx } from '../core/state';
import { commit, useFinance } from '../store';
import { CategorySelect, TypeSelect } from './ui';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { changeWithUndo } from './undo';

/* Any page can open the sheet, to add something new or change an existing entry. */
let request = null;
const listeners = new Set();
const publish = (next) => { request = next; listeners.forEach((l) => l()); };
export const openAdd = (options = {}) => publish({ kind: 'spend', ...options, at: Date.now() });
export const openEdit = (tx) => publish({ tx, at: Date.now() });
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

const KINDS = [
    { id: 'spend', label: 'Spent' },
    { id: 'family', label: 'Family' },
    { id: 'save', label: 'Saved' },
    { id: 'in', label: 'Received' },
];
const QUICK_COUNT = 7;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

function NewEntry({ start, close }) {
    const { state, s, today } = useFinance();
    const [kind, setKind] = useState(start.kind);
    const [amount, setAmount] = useState(start.amount ?? '');
    const [category, setCategory] = useState(null);
    const [account, setAccount] = useState('debit');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(today);
    const [oneOff, setOneOff] = useState(false);
    const [saveTo, setSaveTo] = useState('ef');
    const [isSalary, setIsSalary] = useState(Boolean(start.salary));
    const [error, setError] = useState('');
    const [more, setMore] = useState(false);
    const input = useRef(null);
    useEffect(() => { if (matchMedia('(pointer: fine)').matches) input.current?.focus(); }, []);

    /** Your most-used categories come first, so the common tap is the shortest. */
    const quick = useMemo(() => {
        const counts = {};
        state.transactions.forEach((t) => { if (t.type === 'spend' && t.category) counts[t.category] = (counts[t.category] ?? 0) + 1; });
        const used = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        return [...new Set([...used, ...SPEND_CATEGORIES])].slice(0, QUICK_COUNT);
    }, [state.transactions]);
    const chosen = category ?? quick[0];
    const paise = toPaise(amount);
    const valid = Number.isFinite(paise) && paise > 0;

    function press(key) {
        setError('');
        setAmount((a) => {
            if (key === 'del') return a.slice(0, -1);
            if (key === '.' && a.includes('.')) return a;
            if (a.includes('.') && a.split('.')[1].length >= 2) return a;
            return (a + key).slice(0, 10);
        });
    }

    function save(e) {
        e.preventDefault();
        if (!valid) { setError('Enter an amount more than ₹0.'); return; }
        if (date > today) { setError('Choose today or an earlier date.'); return; }
        const description = note.trim();
        let tx;
        if (kind === 'spend') tx = { type: 'spend', category: chosen, description: description || chosen, account, oneOff };
        else if (kind === 'family') tx = { type: 'family_support', category: 'Family', description: description || 'Sent to family' };
        else if (kind === 'save') {
            const goal = state.goals.find((g) => g.id === saveTo);
            tx = goal
                ? { type: 'savings', category: 'Goal', goalId: goal.id, description: description || `Saved for ${goal.name}` }
                : { type: 'savings', category: EMERGENCY_FUND, description: description || 'Added to emergency fund' };
        } else tx = { type: 'income', flow: 'in', category: isSalary ? 'Salary' : 'Other income', description: description || (isSalary ? 'Salary' : 'Money received') };
        changeWithUndo(`${formatINR(paise, { exact: true })} added`, (st) => addTx(st, { ...tx, date, amountPaise: paise, source: 'manual' }));
        close();
    }

    const left = s.safeToSpendPaise - (valid && kind === 'spend' ? paise : 0);
    return (
        <form onSubmit={save} className="stack">
            <div className="between" data-drag>
                <h2 className="section-title" style={{ margin: 0 }}>Add money</h2>
                <button type="button" className="icon-btn" aria-label="Close" onClick={close}><Icon name="close" /></button>
            </div>
            <div className="chips" role="group" aria-label="What happened">
                {KINDS.map((k) => <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}
            </div>
            <div>
                <label htmlFor="add-amount" className="sr-only">Amount in rupees</label>
                <div className="row" style={{ gap: 2 }}>
                    <span className="amount-input" style={{ width: 'auto' }} aria-hidden="true">₹</span>
                    <input id="add-amount" ref={input} className="amount-input" inputMode={matchMedia('(pointer: fine)').matches ? 'decimal' : 'none'} autoComplete="off" placeholder="0" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, '')); setError(''); }} />
                </div>
                <div className="small mute" aria-live="polite" style={{ minHeight: 20 }}>
                    {error ? <span className="bad" role="alert">{error}</span> : kind === 'spend' && (left < 0 ? `${formatINR(-left)} over this cycle after this` : `${formatINR(left)} safe to spend after this`)}
                </div>
            </div>
            {kind === 'spend' && (
                <>
                    <div className="chips" role="group" aria-label="Category">
                        {quick.map((c) => <button key={c} type="button" className="chip" aria-pressed={chosen === c} onClick={() => setCategory(c)}>{c}</button>)}
                    </div>
                    <div className="chips" role="group" aria-label="Paid by">
                        <button type="button" className="chip" aria-pressed={account === 'debit'} onClick={() => setAccount('debit')}>Debit</button>
                        <button type="button" className="chip" aria-pressed={account === 'credit'} onClick={() => setAccount('credit')}>Credit card</button>
                    </div>
                </>
            )}
            {kind === 'save' && (
                <label className="field" htmlFor="add-saveto">Save to
                    <select id="add-saveto" value={saveTo} onChange={(e) => setSaveTo(e.target.value)}>
                        <option value="ef">Emergency fund</option>
                        {state.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </label>
            )}
            {kind === 'in' && <label className="check"><input id="add-salary" type="checkbox" checked={isSalary} onChange={(e) => setIsSalary(e.target.checked)} />This is my salary, so start a new cycle</label>}
            {more ? (
                <div className="stack">
                    <div className="form-grid">
                        <label className="field" htmlFor="add-note">Note<input id="add-note" value={note} enterKeyHint="done" onChange={(e) => setNote(e.target.value)} /></label>
                        <label className="field" htmlFor="add-date">Date<input id="add-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
                    </div>
                    {kind === 'spend' && <label className="check"><input id="add-oneoff" type="checkbox" checked={oneOff} onChange={(e) => setOneOff(e.target.checked)} />One-off, keep it out of my normal month</label>}
                </div>
            ) : <button type="button" className="link-more" onClick={() => setMore(true)}>Add a note, date or one-off</button>}
            <div className="keypad">
                {KEYS.map((k) => <button key={k} type="button" aria-label={k === 'del' ? 'Delete last digit' : k} onClick={() => press(k)}>{k === 'del' ? <Icon name="del" /> : k}</button>)}
            </div>
            <div className="sheet-save"><button type="submit" className="btn btn-primary btn-block" disabled={!valid}>Save</button></div>
        </form>
    );
}

function EditEntry({ tx, close }) {
    const { today } = useFinance();
    const [form, setForm] = useState({ amount: String(tx.amountPaise / 100), description: tx.description, category: tx.category, type: tx.type, date: tx.date, account: tx.account, oneOff: tx.oneOff, flow: tx.flow });
    const [error, setError] = useState('');
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    function save(e) {
        e.preventDefault();
        const amountPaise = toPaise(form.amount);
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) { setError('Enter an amount more than ₹0.'); return; }
        const fields = { description: form.description, category: form.category, type: form.type, date: form.date, account: form.account, flow: form.flow };
        try {
            commit((st) => updateTx(st, tx.id, { ...fields, amountPaise, oneOff: form.type === 'spend' && form.oneOff }));
            toast.success('Saved');
            close();
        } catch (err) {
            setError(err.message);
        }
    }
    return (
        <form onSubmit={save} className="stack">
            <div className="between" data-drag>
                <h2 className="section-title" style={{ margin: 0 }}>Change entry</h2>
                <button type="button" className="icon-btn" aria-label="Close" onClick={close}><Icon name="close" /></button>
            </div>
            <label className="field" htmlFor="edit-amount">Amount (₹)<input id="edit-amount" inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} /></label>
            <label className="field" htmlFor="edit-desc">Description<input id="edit-desc" value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
            <div className="form-grid">
                <TypeSelect id="edit-type" value={form.type} onChange={(v) => set('type', v)} />
                {form.type === 'spend' && <CategorySelect id="edit-cat" value={form.category} onChange={(v) => set('category', v)} />}
                <label className="field" htmlFor="edit-date">Date<input id="edit-date" type="date" max={today} value={form.date} onChange={(e) => set('date', e.target.value)} /></label>
                <label className="field" htmlFor="edit-account">Paid by<select id="edit-account" value={form.account} onChange={(e) => set('account', e.target.value)}><option value="debit">Debit account</option><option value="credit">Credit card</option></select></label>
                <label className="field" htmlFor="edit-flow">Direction<select id="edit-flow" value={form.flow} onChange={(e) => set('flow', e.target.value)}><option value="out">Money out</option><option value="in">Money back or received</option></select></label>
            </div>
            {form.type === 'spend' && <label className="check"><input id="edit-oneoff" type="checkbox" checked={form.oneOff} onChange={(e) => set('oneOff', e.target.checked)} />One-off, keep it out of my normal month</label>}
            {error && <p className="bad small" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block">Save</button>
            <button type="button" className="btn btn-danger btn-block" onClick={() => { changeWithUndo('Entry deleted', (st) => removeTx(st, tx.id)); close(); }}>Delete</button>
        </form>
    );
}

export function AddSheet() {
    const current = useSyncExternalStore(subscribe, () => request);
    const close = useRef(() => publish(null)).current;
    return (
        <Sheet open={Boolean(current)} onClose={close} label={current?.tx ? 'Change entry' : 'Add money'}>
            {current && (current.tx ? <EditEntry key={current.at} tx={current.tx} close={close} /> : <NewEntry key={current.at} start={current} close={close} />)}
        </Sheet>
    );
}
