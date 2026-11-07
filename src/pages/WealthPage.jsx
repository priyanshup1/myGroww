import { useState } from 'react';
import toast from 'react-hot-toast';
import { Connected, EditableAmount, PageHead, Stat, Tabs, useTab } from '../components/ui';
import { ShareBars, StackedColumns } from '../components/Charts';
import { Icon } from '../components/icons';
import { changeWithUndo } from '../components/undo';
import { formatDate, formatMonth, monthKey } from '../core/dates';
import { project } from '../core/goals';
import { EMERGENCY_FUND, SIP_CATEGORIES, newId } from '../core/ledger';
import { formatCompact, formatINR, toPaise } from '../core/money';
import { addTx, removeFund, removeTx, setPlan, updateTx, upsertFund } from '../core/state';
import { commit, useFinance } from '../store';

const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'sips', label: 'SIPs' }, { id: 'safety', label: 'Safety net' }];

function Choice({ label, options, value, onChange, format }) {
    return (
        <div className="between wrap">
            <span className="small" style={{ fontWeight: 500 }}>{label}</span>
            <span className="chips" role="group" aria-label={label}>
                {options.map((o) => <button key={o} type="button" className="chip" aria-pressed={value === o} onClick={() => onChange(o)}>{format(o)}</button>)}
            </span>
        </div>
    );
}

function Overview({ s }) {
    const [years, setYears] = useState(2);
    const [rate, setRate] = useState(10);
    const inv = s.investments;
    const monthly = inv.plannedMonthlyPaise || s.current.investedPaise;
    const points = project(inv.totalPaise, monthly, years, rate);
    const end = points[points.length - 1];
    const data = points.map((p) => ({
        label: p.year === 0 ? 'Now' : `${p.year} yr`,
        s1: p.putPaise,
        s2: Math.max(0, p.growthPaise),
        tip: `${p.year === 0 ? 'Now' : `In ${p.year} ${p.year === 1 ? 'year' : 'years'}`}: about ${formatCompact(p.valuePaise)}, of which ${formatCompact(p.putPaise)} is money you put in`,
    }));
    const shown = inv.categories.filter((c) => c.amountPaise > 0);
    return (
        <div className="stack-l">
            <div className="stat-grid">
                <Stat label="Invested" value={formatINR(inv.totalPaise)} note="What you paid, not market value" />
                <Stat label="Safety net" value={formatINR(s.emergency.balancePaise)} note={s.emergency.months === null ? 'Saved so far' : `Covers ${s.emergency.months.toFixed(1)} months`} />
                {s.lentPaise > 0 && <Stat label="Lent to people" value={formatINR(s.lentPaise)} />}
            </div>
            <div className="grid-2">
                <section>
                    <h2 className="section-title">Your investments in {years} {years === 1 ? 'year' : 'years'}</h2>
                    <div className="card stack">
                        <p>About <strong className="tabular">{formatCompact(end.valuePaise)}</strong> at {rate}% a year, adding {formatINR(monthly)} a month. <strong className="tabular">{formatCompact(end.putPaise)}</strong> of that is money you put in.</p>
                        <StackedColumns data={data} names={['Money you put in', 'Possible growth']} ariaLabel="Projected investment value by year" defaultTip="Tap a bar to see that year." />
                        <Choice label="Time" options={[1, 2, 5]} value={years} onChange={setYears} format={(y) => `${y} yr`} />
                        <Choice label="Return you assume" options={[0, 8, 10, 12]} value={rate} onChange={setRate} format={(r) => `${r}%`} />
                        <p className="tiny mute">An estimate from the rate you choose, not advice. Returns are not guaranteed.</p>
                    </div>
                </section>
                <section>
                    <h2 className="section-title">Where it is invested</h2>
                    <div className="card card-flush">
                        {shown.length ? <ShareBars rows={shown} total={inv.totalPaise} /> : <p className="empty small">Nothing recorded yet. Add your funds under SIPs.</p>}
                    </div>
                </section>
            </div>
        </div>
    );
}

function AddFund() {
    const [form, setForm] = useState({ name: '', category: SIP_CATEGORIES[0], monthly: '', day: '' });
    const [error, setError] = useState('');
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    function submit(e) {
        e.preventDefault();
        const monthlySipPaise = form.monthly === '' ? 0 : toPaise(form.monthly);
        const sipDay = form.day === '' ? null : Number(form.day);
        if (!form.name.trim()) { setError('Enter the fund name.'); return; }
        if (!Number.isFinite(monthlySipPaise) || monthlySipPaise < 0) { setError('Enter a valid monthly amount.'); return; }
        if (sipDay !== null && (!Number.isInteger(sipDay) || sipDay < 1 || sipDay > 31)) { setError('The SIP day must be between 1 and 31.'); return; }
        commit((st) => upsertFund(st, { id: newId(), name: form.name.trim(), category: form.category, monthlySipPaise, sipDay, startDate: null }));
        setForm({ name: '', category: SIP_CATEGORIES[0], monthly: '', day: '' });
        setError('');
    }
    return (
        <form onSubmit={submit} className="stack">
            <div className="form-grid">
                <label className="field" htmlFor="fund-name">Fund name<input id="fund-name" value={form.name} onChange={set('name')} /></label>
                <label className="field" htmlFor="fund-cat">Category<select id="fund-cat" value={form.category} onChange={set('category')}>{SIP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="field" htmlFor="fund-monthly">Monthly SIP (₹)<input id="fund-monthly" inputMode="decimal" value={form.monthly} onChange={set('monthly')} /></label>
                <label className="field" htmlFor="fund-day">SIP day (optional)<input id="fund-day" inputMode="numeric" value={form.day} onChange={set('day')} /></label>
            </div>
            {error && <p className="bad small" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary">Add fund</button>
        </form>
    );
}

function Sips({ state, s, today }) {
    const [month, setMonth] = useState(monthKey(today));
    const investments = s.transactions.filter((t) => t.type === 'investment');
    const inMonth = investments.filter((t) => monthKey(t.date) === month);
    const months = [...new Set([monthKey(today), ...investments.map((t) => monthKey(t.date))])].sort().reverse();
    const unassigned = investments.filter((t) => !t.fundId).sort((a, b) => b.date.localeCompare(a.date));
    function markPaid(f) {
        const date = month === monthKey(today) ? today : `${month}-01`;
        commit((st) => addTx(st, { date, amountPaise: f.monthlySipPaise, type: 'investment', fundId: f.id, category: f.category, description: `${f.name} SIP` }));
        toast.success(`${f.name} marked paid`);
    }
    return (
        <div className="stack-l">
            <div className="stat-grid">
                <Stat label="Planned each month" value={formatINR(s.investments.plannedMonthlyPaise)} />
                <Stat label={`Paid in ${formatMonth(month)}`} value={formatINR(inMonth.reduce((a, t) => a + (t.flow === 'out' ? t.amountPaise : -t.amountPaise), 0))} />
            </div>
            <section>
                <div className="between wrap" style={{ marginBottom: 10 }}>
                    <h2 className="section-title" style={{ margin: 0 }}>Monthly log</h2>
                    <label className="field" htmlFor="sip-month"><span className="sr-only">Month</span><select id="sip-month" value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}</select></label>
                </div>
                <div className="card card-flush">
                    {state.funds.map((f) => {
                        const paid = inMonth.filter((t) => t.fundId === f.id);
                        return (
                            <div key={f.id} className="list-row">
                                <span className="grow">{f.name}<br /><span className="tiny mute">{f.category} · {s.investments.byFund[f.id] ? `${formatINR(s.investments.byFund[f.id])} put in so far` : 'Nothing recorded yet'}</span></span>
                                {paid.length ? (
                                    <span className="row" style={{ gap: 4 }}>
                                        <span className="good small" style={{ fontWeight: 600 }}>{formatINR(paid.reduce((a, t) => a + t.amountPaise, 0))} paid</span>
                                        <button type="button" className="icon-btn" aria-label={`Remove ${f.name} payment`} onClick={() => changeWithUndo('Payment removed', (st) => paid.reduce((acc, t) => removeTx(acc, t.id), st))}><Icon name="close" size={16} /></button>
                                    </span>
                                ) : <button type="button" className="btn btn-ghost btn-small" disabled={!f.monthlySipPaise} onClick={() => markPaid(f)}>Mark {formatINR(f.monthlySipPaise)} paid</button>}
                            </div>
                        );
                    })}
                    {state.funds.length === 0 && <p className="empty small">Add your funds below to log each month&apos;s SIP.</p>}
                </div>
            </section>
            {unassigned.length > 0 && (
                <section>
                    <h2 className="section-title">Which fund was this for?</h2>
                    <div className="card card-flush">
                        {unassigned.slice(0, 8).map((t) => (
                            <div key={t.id} className="list-row">
                                <span className="grow">{t.description}<br /><span className="tiny mute tabular">{formatDate(t.date)}, {formatINR(t.amountPaise)}</span></span>
                                <label className="field" htmlFor={`assign-${t.id}`} style={{ maxWidth: 150 }}><span className="sr-only">Assign to a fund</span><select id={`assign-${t.id}`} value="" disabled={!state.funds.length} onChange={(e) => commit((st) => updateTx(st, t.id, { fundId: e.target.value }))}><option value="">{state.funds.length ? 'Choose' : 'Add a fund'}</option>{state.funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
                            </div>
                        ))}
                    </div>
                    {unassigned.length > 8 && <p className="tiny mute" style={{ marginTop: 6 }}>{unassigned.length - 8} more will appear as you assign these.</p>}
                </section>
            )}
            <section>
                <h2 className="section-title">My funds</h2>
                <div className="stack">
                    {state.funds.map((f) => (
                        <div key={f.id} className="card">
                            <div className="between">
                                <strong className="grow">{f.name}</strong>
                                <button type="button" className="icon-btn" style={{ marginRight: -10 }} aria-label={`Remove ${f.name}`} onClick={() => changeWithUndo('Fund removed. Its past payments still count.', (st) => removeFund(st, f.id))}><Icon name="trash" size={18} /></button>
                            </div>
                            <div className="between"><span className="small mute">Monthly SIP. Changing this never changes past payments.</span><EditableAmount className="" value={f.monthlySipPaise} label={`Monthly SIP for ${f.name}`} onChange={(p) => commit((st) => upsertFund(st, { id: f.id, monthlySipPaise: p }))} /></div>
                        </div>
                    ))}
                    <div className="card"><AddFund /></div>
                </div>
            </section>
        </div>
    );
}

function Safety({ state, s, today }) {
    const ef = s.emergency;
    const [form, setForm] = useState({ amount: '', flow: 'out', date: today });
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
        <div className="stack-l">
            <div className="stat-grid">
                <Stat label="Saved" value={formatINR(ef.balancePaise)} />
                <Stat label="Months covered" value={ef.months === null ? 'Not known yet' : ef.months.toFixed(1)} note={`At ${formatINR(ef.monthlyNeedPaise)} a month for family and normal spending`} />
                <Stat label={`${state.plan.emergencyMonths}-month target`} value={formatINR(ef.targetPaise)} note={ef.gapPaise ? `${formatINR(ef.gapPaise)} still to go` : 'Target reached'} />
            </div>
            <div className="card">
                <form onSubmit={submit} className="stack">
                    <div className="form-grid">
                        <label className="field" htmlFor="ef-flow">Action<select id="ef-flow" value={form.flow} onChange={(e) => setForm({ ...form, flow: e.target.value })}><option value="out">Add money</option><option value="in">Take money out</option></select></label>
                        <label className="field" htmlFor="ef-amount">Amount (₹)<input id="ef-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
                        <label className="field" htmlFor="ef-date">Date<input id="ef-date" type="date" max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
                        <label className="field" htmlFor="ef-months">Target months<input id="ef-months" inputMode="numeric" value={state.plan.emergencyMonths} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 24) commit((st) => setPlan(st, { emergencyMonths: n })); }} /></label>
                    </div>
                    {error && <p className="bad small" role="alert">{error}</p>}
                    <button type="submit" className="btn btn-primary">Save</button>
                </form>
            </div>
            <section>
                <h2 className="section-title">History</h2>
                <div className="card card-flush">
                    {entries.map((t) => (
                        <div key={t.id} className="list-row">
                            <span className="grow">{t.flow === 'out' ? 'Added' : 'Taken out'}<br /><span className="tiny mute">{formatDate(t.date)}</span></span>
                            <span className="tabular" style={{ fontWeight: 600 }}>{formatINR(t.amountPaise)}</span>
                            <button type="button" className="icon-btn" aria-label="Delete entry" onClick={() => changeWithUndo('Entry deleted', (st) => removeTx(st, t.id))}><Icon name="close" size={16} /></button>
                        </div>
                    ))}
                    {entries.length === 0 && <p className="empty small">Nothing saved yet. Add your first amount above.</p>}
                </div>
            </section>
        </div>
    );
}

export default function WealthPage() {
    const { state, s, today } = useFinance();
    const [tab, setTab] = useTab('overview');
    return (
        <>
            <PageHead title="Wealth" />
            <Tabs tabs={TABS} value={tab} onChange={setTab} label="Wealth views" />
            <div className="stack-l">
                {tab === 'overview' && <Overview s={s} />}
                {tab === 'sips' && <Sips state={state} s={s} today={today} />}
                {tab === 'safety' && <Safety state={state} s={s} today={today} />}
                <Connected links={[
                    { to: '/plan', label: 'Goals', value: formatINR(s.goals.plannedPaise) },
                    { to: '/', label: 'Safe to spend', value: formatINR(s.safeToSpendPaise) },
                ]} />
            </div>
        </>
    );
}
