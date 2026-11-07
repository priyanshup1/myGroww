import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AnimatedAmount, PageHead, SaveWarning } from '../components/ui';
import { MoneyMap } from '../components/MoneyMap';
import { Icon } from '../components/icons';
import { openAdd, openEdit } from '../components/AddSheet';
import { formatDate, parseISO } from '../core/dates';
import { formatCompact, formatINR } from '../core/money';
import { paymentFor } from '../core/recurring';
import { addTx } from '../core/state';
import { commit, useFinance } from '../store';

/** Remembered across pages, so a change made elsewhere plays out when you come back here. */
let lastSeen = null;

function metricsOf(s) {
    const top = s.goals.plans.find((p) => !p.done);
    return {
        salary: s.current.incomePaise,
        spend: s.safeToSpendPaise,
        family: s.current.familyPaise,
        bills: s.billsMonthlyPaise,
        sips: s.current.investedPaise,
        goals: s.goals.plannedPaise,
        topgoal: top?.paceDate ?? null,
        safety: s.emergency.balancePaise,
    };
}

/** Morphs the tapped card into the title of the page it opens. */
const morphFrom = (e) => { e.currentTarget.style.viewTransitionName = 'page-title'; };

/** A money-going-out tile: compact, because the outcome is what matters. */
function Node({ id, to, label, value, sub, delay, first }) {
    return (
        <Link to={to} viewTransition onClick={morphFrom} data-node={id} className={`node node-small${first ? ' rise' : ''}`} style={{ animationDelay: `${delay}ms` }}>
            <span className="node-label">{label}</span>
            <span className="node-value">{value}</span>
            <span className="node-sub">{sub}</span>
        </Link>
    );
}

/** An outcome tile: larger, with a labelled meter that always means progress to a target. */
function Outcome({ id, to, label, value, share, caption, delay, first }) {
    return (
        <Link to={to} viewTransition onClick={morphFrom} data-node={id} className={`node node-outcome${first ? ' rise' : ''}`} style={{ animationDelay: `${delay}ms` }}>
            <span className="node-label">{label}</span>
            <span className="node-value">{value}</span>
            {share !== null && <span className="node-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, share * 100)).toFixed(1)}%` }} /></span>}
            <span className="node-sub">{caption}</span>
        </Link>
    );
}

export default function HomePage() {
    const { s, saveError } = useFinance();
    const map = useRef(null);
    const [showAll, setShowAll] = useState(false);
    const c = s.current;
    const firstVisit = useRef(lastSeen === null).current;
    const top = s.goals.plans.find((p) => !p.done);
    const over = s.safeToSpendPaise < 0;
    const budgetLeft = c.incomePaise - c.debitOutPaise + c.spendPaise - s.plannedUnpaidPaise;
    const left = budgetLeft > 0 ? Math.max(0, Math.min(1, s.safeToSpendPaise / budgetLeft)) : 0;
    /* The big number waits for the light to land before it counts. */
    const [heroPaise, setHeroPaise] = useState(lastSeen?.spend ?? s.safeToSpendPaise);
    const latestSpend = useRef(s.safeToSpendPaise);
    latestSpend.current = s.safeToSpendPaise;
    const familyPlan = s.plan.familyContributionPaise;
    const nextBill = s.due.find((d) => d.kind === 'bill' && !d.paid && d.daysAway >= 0);
    const safetyTarget = s.plan.emergencyMonths;

    /** Sends light along the same lines the money really moved through. */
    useEffect(() => {
        const now = metricsOf(s);
        const was = lastSeen;
        lastSeen = now;
        if (!was || !map.current) return;
        /* Not cancelled on cleanup: the change has already been recorded, so it would never play again. */
        setTimeout(() => {
            const m = map.current;
            if (!m) return;
            if (now.salary !== was.salary) { m.pulse('salary'); m.send('goals'); m.send('sips'); m.send('family'); m.send('bills'); }
            if (now.family !== was.family) m.send('family', () => m.pulse('family'));
            if (now.bills !== was.bills) m.send('bills', () => m.pulse('bills'));
            if (now.sips !== was.sips) m.send('sips', () => m.pulse('sips'));
            if (now.spend !== was.spend) m.send('spend', () => { setHeroPaise(latestSpend.current); m.pulse('spend'); });
            if (now.goals !== was.goals) {
                m.send('spendToGoals');
                m.send('goals', () => { m.pulse('goals'); m.send('goalsToTop', () => m.pulse('topgoal')); });
            } else if (now.topgoal !== was.topgoal) {
                m.send('spendToTop', () => m.pulse('topgoal'));
            }
            if (now.safety !== was.safety) m.send('spendToSafety', () => m.pulse('safety'));
        }, 200);
    }, [s]);

    function markPaid(entry) {
        commit((st) => addTx(st, paymentFor(entry, s.today)));
        toast.success(`${entry.name} marked paid`);
    }

    function runNudge(n) {
        if (n.action === 'add') openAdd();
        if (n.action === 'salary') openAdd({ kind: 'in', salary: true, amount: s.plan.salaryPaise ? String(s.plan.salaryPaise / 100) : '' });
    }

    /* Most urgent first. Only the top one shows until you ask for the rest. */
    const notices = [];
    s.nudges.filter((n) => n.entry).forEach((n) => notices.push(<div key={n.id} className={`notice ${n.tone === 'red' ? 'red' : ''}`}><span className="small">{n.text}</span><button type="button" className="notice-action small" onClick={() => markPaid(n.entry)}>Mark paid</button></div>));
    s.nudges.filter((n) => n.id === 'card' || n.id === 'salary').forEach((n) => notices.push(n.action
        ? <div key={n.id} className="notice"><span className="small">{n.text}</span><button type="button" className="notice-action small" onClick={() => runNudge(n)}>Record it</button></div>
        : <Link key={n.id} to={n.to} className="notice"><span className="small">{n.text}</span><Icon name="chevron" size={16} /></Link>));
    if (s.cardDataGap) notices.push(<Link key="gap" to="/settings" className="notice"><span className="small">Card data stops at {formatDate(s.cardDataThrough)}, so safe to spend may be too high</span><Icon name="chevron" size={16} /></Link>);
    if (s.review.count > 0) notices.push(<Link key="review" to="/review" className="notice"><span className="small">{s.review.count === 1 ? '1 entry needs' : `${s.review.count} entries need`} a quick check</span><Icon name="chevron" size={16} /></Link>);
    if (s.plannedUnpaidPaise > 0) notices.push(<Link key="held" to="/plan?tab=income" className="notice"><span className="small">{formatINR(s.plannedUnpaidPaise)} is held back for payments still to go out</span><Icon name="chevron" size={16} /></Link>);
    s.nudges.filter((n) => n.id === 'log' || n.id === 'backup').forEach((n) => notices.push(n.action
        ? <div key={n.id} className="notice"><span className="small">{n.text}</span><button type="button" className="notice-action small" onClick={() => runNudge(n)}>Add</button></div>
        : <Link key={n.id} to={n.to} className="notice"><span className="small">{n.text}</span><Icon name="chevron" size={16} /></Link>));

    const upcoming = s.due.filter((d) => !d.paid && d.daysAway >= 0 && d.daysAway <= 14 && !s.nudges.some((n) => n.entry?.key === d.key));
    const recent = s.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

    return (
        <>
            <div className="home-head"><PageHead title="myGroww" plain /></div>
            <SaveWarning error={saveError} />
            <div className="home-grid">
                <MoneyMap ref={map}>
                    <Link to="/plan?tab=income" viewTransition onClick={morphFrom} data-node="salary" className={`node node-wide node-salary${firstVisit ? ' rise' : ''}`}>
                        <span className="node-label">{c.incomeIsExpected ? 'Expected salary' : c.cycle.kind === 'salary' ? `Salary, ${parseISO(c.cycle.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Salary'}</span>
                        <span className="node-value">{formatINR(c.incomePaise)}</span>
                    </Link>
                    <Node id="family" to="/plan?tab=income" label="Family" value={formatINR(c.familyPaise)} sub={familyPlan > 0 ? `sent of ${formatINR(familyPlan)}` : 'sent this cycle'} delay={70} first={firstVisit} />
                    <Node id="bills" to="/plan?tab=bills" label="Bills" value={formatINR(s.billsMonthlyPaise)} sub={nextBill ? `next ${parseISO(nextBill.due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'a month'} delay={140} first={firstVisit} />
                    <Node id="sips" to="/wealth?tab=sips" label="SIPs" value={formatINR(c.investedPaise)} sub={s.investments.plannedMonthlyPaise > 0 ? `paid of ${formatINR(s.investments.plannedMonthlyPaise)}` : 'paid this cycle'} delay={210} first={firstVisit} />
                    <Node id="goals" to="/plan" label="Goals" value={formatINR(s.goals.plannedPaise)} sub="a month" delay={280} first={firstVisit} />
                    <Link to="/activity" viewTransition onClick={morphFrom} data-node="spend" className={`node node-wide node-hero${firstVisit ? ' rise' : ''}`} style={{ animationDelay: '350ms' }}>
                        <span className="node-label">{over ? 'Over this cycle' : 'Safe to spend'}</span>
                        <span className="hero-number"><AnimatedAmount paise={heroPaise} abs /></span>
                        <span className="hero-track" aria-hidden="true"><i style={{ width: `${(left * 100).toFixed(1)}%` }} /></span>
                        <span className="hero-sub">{over ? 'Your plans and card spending are more than this cycle\'s salary' : `About ${formatINR(s.dailyPaise)} a day for ${s.daysLeft} days`}</span>
                    </Link>
                    <Outcome id="safety" to="/wealth?tab=safety" label="Safety net" value={s.emergency.months === null ? formatCompact(s.emergency.balancePaise) : `${s.emergency.months.toFixed(1)} months`} share={s.emergency.months === null ? null : s.emergency.months / safetyTarget} caption={`target ${safetyTarget} months`} delay={420} first={firstVisit} />
                    <Outcome id="topgoal" to="/plan" label={top ? `${top.goal.name}, at this pace` : 'Your first goal'} value={top ? (top.paceDate ? parseISO(top.paceDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Not moving') : 'Set one'} share={top ? top.progress : null} caption={top ? `${Math.round(top.progress * 100)}% saved` : 'A car, a bike, a house'} delay={490} first={firstVisit} />
                </MoneyMap>

                <div className="stack-l">
                    {notices.length > 0 && (
                        <section className="stack" style={{ gap: 8 }} aria-label="Needs your attention">
                            {showAll ? notices : notices.slice(0, 1)}
                            {notices.length > 1 && <button type="button" className="notice-more small" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : `${notices.length - 1} more`}</button>}
                        </section>
                    )}

                    {s.unreviewed && (
                        <Link to={`/month?cycle=${s.unreviewed.cycle.id}`} viewTransition className="card between" style={{ textDecoration: 'none' }}>
                            <span><strong>Your cycle review is ready</strong><br /><span className="small mute">From {formatDate(s.unreviewed.cycle.start)}. Takes a minute.</span></span>
                            <Icon name="chevron" />
                        </Link>
                    )}

                    {s.idea && <div className="card"><div className="small" style={{ fontWeight: 600, marginBottom: 2 }}>One thing to try</div><p className="small mute">{s.idea.text}</p></div>}

                    {upcoming.length > 0 && (
                        <section>
                            <h2 className="section-title">Coming up</h2>
                            <div className="card card-flush">
                                {upcoming.slice(0, 4).map((d) => (
                                    <div key={d.key} className="list-row">
                                        <span className="grow"><span>{d.name}</span><br /><span className="tiny mute">{formatINR(d.amountPaise)}, {d.daysAway === 0 ? 'today' : d.daysAway === 1 ? 'tomorrow' : `in ${d.daysAway} days`}</span></span>
                                        <button type="button" className="btn btn-ghost btn-small" onClick={() => markPaid(d)}>Paid</button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <div className="between"><h2 className="section-title">Latest</h2><Link to="/activity?tab=all" viewTransition className="small accent" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>See all</Link></div>
                        <div className="card card-flush">
                            {recent.map((t) => (
                                <button key={t.id} type="button" className="row-button" onClick={() => openEdit(t)}>
                                    <span className="grow"><span>{t.description}</span><br /><span className="tiny mute">{formatDate(t.date)}</span></span>
                                    <span className="tabular" style={{ fontWeight: 600 }}>{t.flow === 'in' ? '+' : ''}{formatINR(t.amountPaise)}</span>
                                </button>
                            ))}
                            {recent.length === 0 && <p className="empty small">Press the plus button to add your first entry.</p>}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}
