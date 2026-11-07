import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Connected, PageHead, Stat, Tabs, useTab } from '../components/ui';
import { ShareBars, StackedColumns } from '../components/Charts';
import { Icon } from '../components/icons';
import { openEdit } from '../components/AddSheet';
import { inCycle } from '../core/cycles';
import { formatDate, formatMonth } from '../core/dates';
import { compareCategories, topMerchants } from '../core/insights';
import { TX_TYPES } from '../core/ledger';
import { formatCompact, formatINR } from '../core/money';
import { useFinance } from '../store';

const TABS = [{ id: 'spending', label: 'Spending' }, { id: 'all', label: 'All entries' }, { id: 'history', label: 'History' }];

function CyclePicker({ s, value, onChange }) {
    return (
        <label className="field" htmlFor="cycle-pick">Salary cycle
            <select id="cycle-pick" value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="current">Current</option>
                {s.cycles.slice().reverse().filter((c) => c.cycle.end).map((c) => <option key={c.cycle.id} value={c.cycle.id}>From {formatDate(c.cycle.start)}</option>)}
            </select>
        </label>
    );
}

function Spending({ s }) {
    const [pick, setPick] = useState('current');
    const cycle = pick === 'current' ? s.current : s.cycles.find((c) => c.cycle.id === pick) ?? s.current;
    const index = s.cycles.findIndex((c) => c.cycle.id === cycle.cycle.id);
    const before = index > 0 ? s.cycles[index - 1] : null;
    const changes = compareCategories(cycle, before).filter((c) => c.changePaise !== 0);
    const merchants = topMerchants(cycle.txs);
    const rising = changes.filter((c) => c.changePaise > 0).slice(0, 3);
    return (
        <div className="stack-l">
            <CyclePicker s={s} value={pick} onChange={setPick} />
            <div className="stat-grid">
                <Stat label="Spent" value={formatINR(cycle.spendPaise)} note={cycle.cycle.end ? `To ${formatDate(cycle.cycle.end)}` : 'So far this cycle'} />
                <Stat label="Normal spending" value={formatINR(cycle.normalSpendPaise)} note="Without one-offs" />
                {cycle.oneOffPaise !== 0 && <Stat label="One-offs" value={formatINR(cycle.oneOffPaise)} note="Big, not monthly" />}
            </div>
            <div className="grid-2">
                <section>
                    <h2 className="section-title">Where it went</h2>
                    <div className="card card-flush">
                        {cycle.categories.length ? <ShareBars rows={cycle.categories.filter((c) => c.amountPaise > 0)} total={cycle.spendPaise} /> : <p className="empty small">Nothing spent in this cycle yet.</p>}
                    </div>
                </section>
                <div className="stack-l">
                    {rising.length > 0 && (
                        <section>
                            <h2 className="section-title">Going up since last cycle</h2>
                            <div className="card card-flush">
                                {rising.map((c) => <div key={c.name} className="list-row"><span>{c.name}</span><span className="tabular">+{formatINR(c.changePaise)}</span></div>)}
                            </div>
                        </section>
                    )}
                    {merchants.length > 0 && (
                        <section>
                            <h2 className="section-title">Most money to</h2>
                            <div className="card card-flush">
                                {merchants.map((m) => <div key={m.name} className="list-row"><span className="grow">{m.name}<br /><span className="tiny mute">{m.count} {m.count === 1 ? 'time' : 'times'}</span></span><span className="tabular">{formatINR(m.amountPaise)}</span></div>)}
                            </div>
                        </section>
                    )}
                </div>
            </div>
            {s.budgets.some((b) => b.limitPaise > 0) && pick === 'current' && (
                <section>
                    <div className="between"><h2 className="section-title">Budgets</h2><Link to="/plan?tab=budgets" viewTransition className="small accent">Change</Link></div>
                    <div className="card card-flush">
                        {s.budgets.filter((b) => b.limitPaise > 0).map((b) => (
                            <div key={b.name} className="list-row" style={{ display: 'block' }}>
                                <div className="between"><span>{b.name}</span><span className="tabular small">{formatINR(b.spentPaise)} of {formatINR(b.limitPaise)}</span></div>
                                <Bar share={b.share} over={b.over} />
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function Entries({ s, today }) {
    const [pick, setPick] = useState('current');
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState('all');
    const cycle = pick === 'current' ? s.current.cycle : s.cycles.find((c) => c.cycle.id === pick)?.cycle ?? s.current.cycle;
    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const rows = s.transactions
            .filter((t) => (q ? true : inCycle(t, cycle, today)))
            .filter((t) => scope === 'all' || (scope === 'spend' ? t.type === 'spend' : t.type !== 'spend'))
            .filter((t) => !q || `${t.description} ${t.category}`.toLowerCase().includes(q))
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date));
        const byDay = new Map();
        rows.forEach((t) => { byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]); });
        return [...byDay.entries()];
    }, [s.transactions, cycle, today, query, scope]);
    return (
        <div className="stack">
            <div className="form-grid">
                <label className="field" htmlFor="tx-search">Search everything<input id="tx-search" type="search" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Grocery, cab" /></label>
                <CyclePicker s={s} value={pick} onChange={setPick} />
            </div>
            <div className="chips" role="group" aria-label="Show">
                {[['all', 'All'], ['spend', 'Spending'], ['other', 'Not spending']].map(([id, label]) => <button key={id} type="button" className="chip" aria-pressed={scope === id} onClick={() => setScope(id)}>{label}</button>)}
            </div>
            {groups.map(([date, rows]) => (
                <section key={date}>
                    <h2 className="small mute" style={{ fontWeight: 600, margin: '6px 0' }}>{date === today ? 'Today' : formatDate(date)}</h2>
                    <div className="card card-flush">
                        {rows.map((t) => (
                            <button key={t.id} type="button" className="row-button" onClick={() => openEdit(t)}>
                                <span className="grow">
                                    <span>{t.description}</span><br />
                                    <span className="tiny mute">{t.type === 'spend' ? `${t.category} · ${t.account === 'credit' ? 'Credit card' : 'Debit'}` : TX_TYPES[t.type]}{t.oneOff ? ' · One-off' : ''}{t.flow === 'in' && t.type !== 'income' ? ' · Money back' : ''}</span>
                                </span>
                                <span className="tabular" style={{ fontWeight: 600 }}>{t.flow === 'in' ? '+' : ''}{formatINR(t.amountPaise, { exact: true })}</span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
            {groups.length === 0 && <p className="empty">{query ? 'Nothing matches that search. Try a shorter word.' : 'Nothing here yet. Press the plus button to add an entry.'}</p>}
        </div>
    );
}

function History({ s }) {
    const data = s.months.map((m) => ({
        label: formatMonth(m.key).split(' ')[0],
        s1: Math.max(0, m.normalSpendPaise),
        s2: Math.max(0, m.spendPaise - m.normalSpendPaise),
        tip: `${formatMonth(m.key)}: ${formatINR(m.spendPaise)} spent${m.spendPaise !== m.normalSpendPaise ? `, ${formatINR(m.spendPaise - m.normalSpendPaise)} one-offs` : ''}`,
    }));
    const last = data[data.length - 1];
    return (
        <div className="stack-l">
            <section>
                <h2 className="section-title">Spending by month</h2>
                <div className="card">
                    {data.length ? <StackedColumns data={data} names={['Normal spending', 'One-offs']} ariaLabel="Spending for each month" defaultTip={last?.tip} /> : <p className="empty small">Your months will appear here.</p>}
                </div>
            </section>
            <section>
                <h2 className="section-title">Salary cycles</h2>
                <p className="small mute" style={{ marginBottom: 10 }}>&quot;Not explained&quot; is salary your records do not account for, which usually means entries are missing.</p>
                <div className="card">
                    <div className="table-wrap">
                        <table className="table">
                            <thead><tr><th>From</th><th>Income</th><th>Spent</th><th>Family</th><th>Invested</th><th>Saved</th><th>Not explained</th><th>Data</th></tr></thead>
                            <tbody>
                                {s.cycles.slice().reverse().map((c) => (
                                    <tr key={c.cycle.id}>
                                        <td><Link to={`/month?cycle=${c.cycle.id}`} viewTransition>{formatDate(c.cycle.start)}</Link></td>
                                        <td>{formatCompact(c.incomePaise)}</td><td>{formatINR(c.spendPaise)}</td><td>{formatINR(c.familyPaise)}</td><td>{formatINR(c.investedPaise)}</td><td>{formatINR(c.savedPaise)}</td>
                                        <td>{c.cycle.end ? formatINR(c.unexplainedPaise) : 'In progress'}</td>
                                        <td><span className={`badge ${c.verified ? 'good' : 'warn'}`}>{c.verified ? <Icon name="check" size={12} /> : null}{c.verified ? 'From statement' : 'Partial'}</span></td>
                                    </tr>
                                ))}
                                {s.cycles.length === 0 && <tr><td colSpan={8} className="mute">Cycles start from your first recorded salary.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function ActivityPage() {
    const { s, today } = useFinance();
    const [tab, setTab] = useTab('spending');
    return (
        <>
            <PageHead title="Activity" />
            <Tabs tabs={TABS} value={tab} onChange={setTab} label="Activity views" />
            <div className="stack-l">
                {tab === 'spending' && <Spending s={s} />}
                {tab === 'all' && <Entries s={s} today={today} />}
                {tab === 'history' && <History s={s} />}
                <Connected links={[
                    { to: '/plan?tab=budgets', label: 'Budgets', value: s.budgets.filter((b) => b.over).length ? `${s.budgets.filter((b) => b.over).length} over` : 'On track' },
                    { to: '/plan', label: 'Goals', value: formatINR(s.goals.plannedPaise) },
                    { to: '/', label: 'Safe to spend', value: formatINR(s.safeToSpendPaise) },
                ]} />
            </div>
        </>
    );
}
