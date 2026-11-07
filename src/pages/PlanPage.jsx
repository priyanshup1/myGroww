import { useState } from 'react';
import toast from 'react-hot-toast';
import { Bar, Connected, EditableAmount, PageHead, Stat, Tabs, useTab } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/icons';
import { openAdd } from '../components/AddSheet';
import { changeWithUndo } from '../components/undo';
import { buildCalendar } from '../core/calendar';
import { formatDate, parseISO } from '../core/dates';
import { SPEND_CATEGORIES, newId } from '../core/ledger';
import { formatINR, toPaise } from '../core/money';
import { monthlySetAside, paymentFor } from '../core/recurring';
import { addTx, removeById, removeGoal, setBudget, setPlan, upsertById } from '../core/state';
import { commit, useFinance } from '../store';

const TABS = [{ id: 'goals', label: 'Goals' }, { id: 'budgets', label: 'Budgets' }, { id: 'bills', label: 'Bills' }, { id: 'income', label: 'Income' }];
const monthYear = (iso) => (iso ? parseISO(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Not moving');
const rupees = (paise) => (paise ? String(paise / 100) : '');

function GoalForm({ goal, today, close }) {
    const [form, setForm] = useState({
        name: goal?.name ?? '', target: rupees(goal?.targetPaise), date: goal?.targetDate ?? '', saved: rupees(goal?.openingPaise),
        monthly: rupees(goal?.monthlyPaise), rise: goal?.priceRisePct ? String(goal.priceRisePct) : '', ret: goal?.returnPct ? String(goal.returnPct) : '',
    });
    const [error, setError] = useState('');
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    function save(e) {
        e.preventDefault();
        const targetPaise = toPaise(form.target);
        const openingPaise = form.saved === '' ? 0 : toPaise(form.saved);
        const monthlyPaise = form.monthly === '' ? 0 : toPaise(form.monthly);
        const priceRisePct = form.rise === '' ? 0 : Number(form.rise);
        const returnPct = form.ret === '' ? 0 : Number(form.ret);
        if (!form.name.trim()) { setError('Give this goal a name, like Car.'); return; }
        if (!Number.isFinite(targetPaise) || targetPaise <= 0) { setError('Enter what it costs.'); return; }
        if (!form.date || form.date <= today) { setError('Choose a date in the future.'); return; }
        if (![openingPaise, monthlyPaise].every((v) => Number.isFinite(v) && v >= 0)) { setError('Check the saved and monthly amounts.'); return; }
        if (![priceRisePct, returnPct].every((v) => Number.isFinite(v) && v >= 0 && v <= 40)) { setError('Percentages must be between 0 and 40.'); return; }
        commit((st) => upsertById(st, 'goals', { id: goal?.id ?? newId(), name: form.name.trim(), targetPaise, targetDate: form.date, openingPaise, monthlyPaise, priceRisePct, returnPct }));
        close();
    }
    return (
        <form onSubmit={save} className="stack">
            <div className="between" data-drag><h2 className="section-title" style={{ margin: 0 }}>{goal ? 'Change goal' : 'New goal'}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={close}><Icon name="close" /></button></div>
            {!goal && <div className="chips" role="group" aria-label="Common goals">{['Car', 'Bike', 'House deposit', 'Trip'].map((n) => <button key={n} type="button" className="chip" aria-pressed={form.name === n} onClick={() => setForm((f) => ({ ...f, name: n }))}>{n}</button>)}</div>}
            <label className="field" htmlFor="goal-name">Name<input id="goal-name" value={form.name} onChange={set('name')} /></label>
            <div className="form-grid">
                <label className="field" htmlFor="goal-target">Cost today (₹)<input id="goal-target" inputMode="decimal" value={form.target} onChange={set('target')} /></label>
                <label className="field" htmlFor="goal-date">Want it by<input id="goal-date" type="date" min={today} value={form.date} onChange={set('date')} /></label>
                <label className="field" htmlFor="goal-saved">Saved so far (₹)<input id="goal-saved" inputMode="decimal" value={form.saved} onChange={set('saved')} /></label>
                <label className="field" htmlFor="goal-monthly">Save each month (₹)<input id="goal-monthly" inputMode="decimal" value={form.monthly} onChange={set('monthly')} /></label>
                <label className="field" htmlFor="goal-rise">Price rise a year (%)<input id="goal-rise" inputMode="decimal" value={form.rise} placeholder="0" onChange={set('rise')} /></label>
                <label className="field" htmlFor="goal-ret">Return you assume (%)<input id="goal-ret" inputMode="decimal" value={form.ret} placeholder="0" onChange={set('ret')} /></label>
            </div>
            <p className="tiny mute">The last two are your own assumptions. Leave them at 0 for the plainest estimate.</p>
            {error && <p className="bad small" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block">Save goal</button>
            {goal && <button type="button" className="btn btn-danger btn-block" onClick={() => { changeWithUndo('Goal removed. Money saved stays in your records.', (st) => removeGoal(st, goal.id)); close(); }}>Remove goal</button>}
        </form>
    );
}

function GoalCard({ plan, onEdit }) {
    const [open, setOpen] = useState(false);
    const { goal } = plan;
    const end = plan.paceMonths === null ? plan.months * 1.6 : Math.max(plan.months, plan.paceMonths);
    const wantLeft = end > 0 ? Math.min(98, (plan.months / end) * 98) : 0;
    const paceLeft = plan.paceMonths === null ? 100 : Math.max(6, Math.min(100, (plan.paceMonths / Math.max(end, 1)) * 100));
    const step = (delta) => commit((st) => upsertById(st, 'goals', { id: goal.id, monthlyPaise: Math.max(0, (goal.monthlyPaise ?? 0) + delta) }));
    return (
        <article className="card">
            <div className="between"><h3 style={{ fontSize: 20 }}>{goal.name}</h3><button type="button" className="icon-btn" style={{ marginRight: -10 }} aria-label={`Change ${goal.name}`} onClick={onEdit}><Icon name="edit" size={18} /></button></div>
            <div className="small mute tabular">{formatINR(plan.savedPaise)} saved of {formatINR(plan.targetPaise)}{goal.priceRisePct ? ` (with ${goal.priceRisePct}% yearly price rise)` : ''}</div>
            {plan.done ? <p className="good" style={{ marginTop: 10, fontWeight: 600 }}>You have saved enough for this goal.</p> : (
                <>
                    <div className="route" aria-hidden="true">
                        <div className="route-line" />
                        <div className="route-want" style={{ left: `${wantLeft}%` }} />
                        <div className="route-pace" style={{ left: `${paceLeft}%` }} />
                    </div>
                    <div className="between small"><span className="row" style={{ gap: 6 }}><i className="mark-want" aria-hidden="true" /><span><span className="mute">Wanted</span> {monthYear(goal.targetDate)}</span></span><span className="row" style={{ gap: 6 }}><i className="mark-pace" aria-hidden="true" /><span><span className="mute">At this pace</span> <strong>{monthYear(plan.paceDate)}</strong></span></span></div>
                    <div className="between" style={{ marginTop: 10 }}>
                        <p className="small">{plan.onTrack ? 'You are on track.' : `On time needs ${formatINR(Math.ceil(plan.neededMonthlyPaise / 10000) * 10000)} a month.`}</p>
                        <button type="button" className="link-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Adjust'}</button>
                    </div>
                    {open && (
                        <div className="stack" style={{ marginTop: 6 }}>
                            {goal.returnPct > 0 && <p className="small mute">At {goal.returnPct}% returns, on time needs about {formatINR(Math.ceil(plan.neededWithReturnsPaise / 10000) * 10000)} a month. At your current saving you would reach it by {monthYear(plan.paceWithReturnsDate)}.</p>}
                    <div className="between">
                        <span className="small" style={{ fontWeight: 500 }}>Save each month</span>
                        <span className="row" style={{ gap: 6 }}>
                            <button type="button" className="btn btn-ghost btn-small" style={{ width: 44 }} aria-label={`Save ₹1,000 less for ${goal.name}`} onClick={() => step(-100000)}><Icon name="minus" size={18} /></button>
                            <strong className="tabular" style={{ minWidth: 76, textAlign: 'center' }}>{formatINR(goal.monthlyPaise ?? 0)}</strong>
                            <button type="button" className="btn btn-ghost btn-small" style={{ width: 44 }} aria-label={`Save ₹1,000 more for ${goal.name}`} onClick={() => step(100000)}><Icon name="plus" size={18} /></button>
                        </span>
                    </div>
                    <button type="button" className="btn btn-ghost btn-small btn-block" onClick={() => openAdd({ kind: 'save' })}>Add money saved</button>
                        </div>
                    )}
                </>
            )}
        </article>
    );
}

function Goals({ s, today }) {
    const [editing, setEditing] = useState(null);
    const g = s.goals;
    return (
        <div className="stack">
            {g.plans.length > 1 && g.shortfallPaise > 0 && (
                <div className="notice small"><span>All goals on time need <strong>{formatINR(Math.ceil(g.neededPaise / 10000) * 10000)}</strong> a month. You plan to save <strong>{formatINR(g.plannedPaise)}</strong>, so choose what comes first, push a date back, or lower a target.</span></div>
            )}
            <div className="grid-2">
                {g.plans.map((p) => <GoalCard key={p.goal.id} plan={p} onEdit={() => setEditing(p.goal)} />)}
            </div>
            {g.plans.length === 0 && <div className="card empty"><p style={{ marginBottom: 12 }}>What are you saving for? A car, a bike, a house deposit?</p></div>}
            <button type="button" className="btn btn-primary btn-block" onClick={() => setEditing('new')}>Add a goal</button>
            <p className="tiny mute">These are estimates from your own numbers, not financial advice. Returns are not guaranteed.</p>
            <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} label="Goal">
                {editing && <GoalForm key={editing === 'new' ? 'new' : editing.id} goal={editing === 'new' ? null : editing} today={today} close={() => setEditing(null)} />}
            </Sheet>
        </div>
    );
}

function Budgets({ s, state }) {
    const rows = [...s.budgets, ...SPEND_CATEGORIES.filter((c) => !s.budgets.some((b) => b.name === c)).map((name) => ({ name, spentPaise: 0, limitPaise: state.budgets[name] ?? 0, share: 0 }))];
    const total = Object.values(state.budgets).reduce((a, b) => a + b, 0);
    return (
        <div className="stack">
            <p className="small mute">Set a limit only where you want one. {total > 0 && <>Total limits: <strong className="tabular">{formatINR(total)}</strong> a cycle.</>}</p>
            <div className="card card-flush">
                {rows.map((b) => (
                    <div key={b.name} className="list-row" style={{ display: 'block' }}>
                        <div className="between">
                            <span className="grow">{b.name}<br /><span className="tiny mute tabular">{formatINR(b.spentPaise)} spent{b.over ? `, ${formatINR(b.spentPaise - b.limitPaise)} over` : ''}</span></span>
                            <EditableAmount className="" value={b.limitPaise} label={`Budget for ${b.name}`} onChange={(p) => commit((st) => setBudget(st, b.name, p))} />
                        </div>
                        {b.limitPaise > 0 && <Bar share={b.share} over={b.over} />}
                    </div>
                ))}
            </div>
        </div>
    );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function BillForm({ bill, today, close }) {
    const [form, setForm] = useState({ name: bill?.name ?? '', amount: rupees(bill?.amountPaise), frequency: bill?.frequency ?? 'monthly', dueDay: String(bill?.dueDay ?? 1), dueMonth: String(bill?.dueMonth ?? 1), type: bill?.type ?? 'spend', account: bill?.account ?? 'debit' });
    const [error, setError] = useState('');
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    function save(e) {
        e.preventDefault();
        const amountPaise = toPaise(form.amount);
        const dueDay = Number(form.dueDay);
        if (!form.name.trim()) { setError('Give this bill a name.'); return; }
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) { setError('Enter an amount more than ₹0.'); return; }
        if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) { setError('The due day must be between 1 and 31.'); return; }
        commit((st) => upsertById(st, 'recurring', { id: bill?.id ?? newId(), startDate: bill?.startDate ?? today, name: form.name.trim(), amountPaise, frequency: form.frequency, dueDay, dueMonth: Number(form.dueMonth), type: form.type, account: form.account, category: form.type === 'spend' ? 'Bills' : form.name.trim() }));
        close();
    }
    return (
        <form onSubmit={save} className="stack">
            <div className="between" data-drag><h2 className="section-title" style={{ margin: 0 }}>{bill ? 'Change bill' : 'New bill'}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={close}><Icon name="close" /></button></div>
            <label className="field" htmlFor="bill-name">Name<input id="bill-name" value={form.name} placeholder="Rent, electricity, LIC" onChange={set('name')} /></label>
            <div className="form-grid">
                <label className="field" htmlFor="bill-amount">Amount (₹)<input id="bill-amount" inputMode="decimal" value={form.amount} onChange={set('amount')} /></label>
                <label className="field" htmlFor="bill-freq">Repeats<select id="bill-freq" value={form.frequency} onChange={set('frequency')}><option value="monthly">Every month</option><option value="quarterly">Every 3 months</option><option value="yearly">Every year</option></select></label>
                <label className="field" htmlFor="bill-day">Due on day<input id="bill-day" inputMode="numeric" value={form.dueDay} onChange={set('dueDay')} /></label>
                {form.frequency !== 'monthly' && <label className="field" htmlFor="bill-month">{form.frequency === 'yearly' ? 'Month' : 'First month'}<select id="bill-month" value={form.dueMonth} onChange={set('dueMonth')}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>}
                <label className="field" htmlFor="bill-type">Kind<select id="bill-type" value={form.type} onChange={set('type')}><option value="spend">Bill</option><option value="insurance">Insurance</option><option value="loan_emi">Loan EMI</option><option value="family_contribution">Family contribution</option></select></label>
                <label className="field" htmlFor="bill-account">Paid from<select id="bill-account" value={form.account} onChange={set('account')}><option value="debit">Debit account</option><option value="credit">Credit card</option></select></label>
            </div>
            {error && <p className="bad small" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block">Save bill</button>
            {bill && <button type="button" className="btn btn-danger btn-block" onClick={() => { changeWithUndo('Bill removed. Past payments stay in your records.', (st) => removeById(st, 'recurring', bill.id)); close(); }}>Remove bill</button>}
        </form>
    );
}

function downloadCalendar(state, today) {
    const blob = new Blob([buildCalendar(state, today)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mygroww-reminders.ics';
    a.click();
    URL.revokeObjectURL(url);
}

function Bills({ s, state, today }) {
    const [editing, setEditing] = useState(null);
    const nextDue = (r) => s.due.find((d) => d.item.id === r.id && !d.paid);
    return (
        <div className="stack">
            <div className="stat-grid">
                <Stat label="Monthly bills" value={formatINR(s.billsMonthlyPaise)} note="Due every month" />
                <Stat label="Set aside monthly" value={formatINR(s.setAsideMonthlyPaise)} note="For yearly and quarterly bills" />
            </div>
            <div className="card card-flush">
                {state.recurring.map((r) => {
                    const entry = nextDue(r);
                    return (
                        <div key={r.id} className="list-row">
                            <button type="button" className="grow" style={{ textAlign: 'left', minHeight: 44 }} onClick={() => setEditing(r)}>
                                {r.name}<br />
                                <span className="tiny mute tabular">{formatINR(r.amountPaise)} {r.frequency === 'monthly' ? 'a month' : r.frequency === 'yearly' ? 'a year' : 'every 3 months'}{monthlySetAside(r) ? `, set aside ${formatINR(monthlySetAside(r))} a month` : ''}{entry ? `. ${entry.overdue ? 'Was due' : 'Due'} ${formatDate(entry.due)}` : ''}</span>
                            </button>
                            {entry && <button type="button" className="btn btn-ghost btn-small" onClick={() => { commit((st) => addTx(st, paymentFor(entry, today))); toast.success(`${r.name} marked paid`); }}>Paid</button>}
                        </div>
                    );
                })}
                {state.recurring.length === 0 && <p className="empty small">Add rent, electricity, internet and yearly bills such as insurance, so they are held back from safe to spend.</p>}
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setEditing('new')}>Add a bill</button>
            <div className="card">
                <div style={{ fontWeight: 600 }}>Get reminders on your phone</div>
                <p className="small mute" style={{ margin: '4px 0 10px' }}>Adds your bills, SIPs and card due date to your calendar, which reminds you even with this app closed.</p>
                <button type="button" className="btn btn-ghost btn-small" disabled={!state.recurring.length && !state.funds.length} onClick={() => downloadCalendar(state, today)}>Download calendar file</button>
            </div>
            <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} label="Bill">
                {editing && <BillForm key={editing === 'new' ? 'new' : editing.id} bill={editing === 'new' ? null : editing} today={today} close={() => setEditing(null)} />}
            </Sheet>
        </div>
    );
}

function Income({ s, state }) {
    const c = s.current;
    const rows = [
        ['Salary this cycle', c.incomePaise, c.incomeIsExpected ? 'Expected, not recorded yet' : 'Received'],
        ['Paid from your debit account', -c.debitOutPaise, 'Everything so far, including card bills'],
        ['Family still to send', -s.unpaidFamilyPaise],
        ['SIPs still to pay', -s.unpaidSipPaise],
        ['Bills still due this cycle', -s.unpaidBillsPaise],
        ['Goal saving still to do', -s.unpaidGoalsPaise],
        ['Unpaid on your card', -s.cardOutstandingPaise, 'Already spent, so it cannot be spent again'],
    ].filter(([, amount, note]) => amount !== 0 || note);
    const flow = [
        ['Family', c.familyPaise], ['Loan EMIs', c.loanPaise], ['Insurance', c.insurancePaise], ['SIPs and investments', c.investedPaise],
        ['Savings', c.savedPaise], ['Transfers to people', c.transfersPaise], ['Your other accounts', c.selfTransferPaise], ['Card bill', c.cardBillPaise],
        ['Spent from debit', c.debitOutPaise - c.familyPaise - c.loanPaise - c.insurancePaise - c.investedPaise - c.savedPaise - c.transfersPaise - c.selfTransferPaise - c.cardBillPaise],
    ].filter(([, v]) => v !== 0);
    return (
        <div className="stack-l">
            <div className="grid-2">
                <div className="card">
                    <div className="tiny mute">Expected salary</div>
                    <EditableAmount value={state.plan.salaryPaise} label="Expected salary" onChange={(p) => commit((st) => setPlan(st, { salaryPaise: p }))} />
                    <div className="tiny mute">Used until the real credit is recorded</div>
                    <button type="button" className="btn btn-ghost btn-small" style={{ marginTop: 10 }} onClick={() => openAdd({ kind: 'in', salary: true, amount: state.plan.salaryPaise ? String(state.plan.salaryPaise / 100) : '' })}>Salary came in</button>
                </div>
                <div className="card">
                    <div className="tiny mute">Family contribution each cycle</div>
                    <EditableAmount value={state.plan.familyContributionPaise} label="Family contribution" onChange={(p) => commit((st) => setPlan(st, { familyContributionPaise: p }))} />
                    <div className="tiny mute">{formatINR(c.familyPaise)} sent this cycle</div>
                    <button type="button" className="btn btn-ghost btn-small" style={{ marginTop: 10 }} onClick={() => openAdd({ kind: 'family' })}>Add money sent</button>
                </div>
            </div>
            <section>
                <h2 className="section-title">Where this salary went</h2>
                <div className="card card-flush">
                    {flow.map(([label, v]) => (
                        <div key={label} className="list-row" style={{ display: 'block' }}>
                            <div className="between"><span>{label}</span><strong className="tabular">{formatINR(v)}</strong></div>
                            <Bar share={c.incomePaise > 0 ? Math.abs(v) / c.incomePaise : 0} />
                        </div>
                    ))}
                    {flow.length === 0 && <p className="empty small">Nothing has gone out this cycle yet.</p>}
                </div>
            </section>
            <section>
                <h2 className="section-title">How safe to spend is worked out</h2>
                <div className="card card-flush">
                    {rows.map(([label, amount, note]) => <div key={label} className="list-row"><span className="grow">{label}{note && <><br /><span className="tiny mute">{note}</span></>}</span><span className="tabular">{formatINR(amount)}</span></div>)}
                    <div className="list-row"><strong>Safe to spend</strong><strong className="tabular">{formatINR(s.safeToSpendPaise)}</strong></div>
                </div>
            </section>
        </div>
    );
}

export default function PlanPage() {
    const { state, s, today } = useFinance();
    const [tab, setTab] = useTab('goals');
    return (
        <>
            <PageHead title="Plan" />
            <Tabs tabs={TABS} value={tab} onChange={setTab} label="Plan views" />
            <div className="stack-l">
                {tab === 'goals' && <Goals s={s} today={today} />}
                {tab === 'budgets' && <Budgets s={s} state={state} />}
                {tab === 'bills' && <Bills s={s} state={state} today={today} />}
                {tab === 'income' && <Income s={s} state={state} />}
                <Connected links={[
                    { to: '/', label: 'Safe to spend', value: formatINR(s.safeToSpendPaise) },
                    { to: '/activity', label: 'Spending', value: formatINR(s.current.spendPaise) },
                    { to: '/wealth', label: 'Wealth', value: formatINR(s.assetsPaise) },
                ]} />
            </div>
        </>
    );
}
