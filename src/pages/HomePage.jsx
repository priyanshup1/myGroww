import { Link, useNavigate } from 'react-router-dom';
import { Card, SaveWarning, StatusBadge } from '../components/ui';
import { formatDate } from '../core/dates';
import { formatCompact, formatINR } from '../core/money';
import { useFinance } from '../store';

function DashCard({ emoji, title, metric, note, badge, to, delay }) {
    const nav = useNavigate();
    return (
        <Card className={`animate-in stagger-${delay}`} onClick={() => nav(to)} style={{ minHeight: 150 }}>
            <div className="flex justify-between items-center mb-2">
                <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>{emoji}</span>
                {badge}
            </div>
            <div className="label mb-2"><Link to={to} onClick={(e) => e.stopPropagation()} className="card-link">{title}</Link></div>
            <div className="big-number" style={{ fontSize: 'clamp(1.3rem,3vw,1.9rem)' }}>{metric}</div>
            {note && <div className="label mt-1">{note}</div>}
        </Card>
    );
}

export default function HomePage() {
    const { s, saveError } = useFinance();
    const c = s.current;
    const empty = s.transactions.length === 0;
    const ef = s.emergency;
    const incomeShare = c.incomePaise > 0 ? Math.round((c.spendPaise / c.incomePaise) * 100) : 0;
    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <h1 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)' }}>myGroww</h1>
                    <Link to="/import" className="btn btn-ghost btn-icon">Import and backup</Link>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 20 }}>
                <SaveWarning error={saveError} />

                {empty ? (
                    <Card className="animate-in mb-6">
                        <h2 className="mb-2">Start with your real numbers</h2>
                        <p className="label mb-4">Your data stays in this browser. Import your statements, or add your first expense.</p>
                        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
                            <Link to="/import" className="btn btn-primary">Import my data</Link>
                            <Link to="/expenses" className="btn btn-ghost">Add an expense</Link>
                        </div>
                    </Card>
                ) : (
                    <Card className="animate-in mb-6">
                        <div className="section-title">{c.cycle.kind === 'salary' ? `Salary cycle from ${formatDate(c.cycle.start)}` : 'This month'}</div>
                        <div className="big-number" style={{ fontSize: 'clamp(2.2rem,7vw,3.4rem)', color: s.safeToSpendPaise < 0 ? 'var(--alert-red)' : 'var(--text-primary)' }}>
                            {formatINR(Math.abs(s.safeToSpendPaise))}
                        </div>
                        <div style={{ fontWeight: 600 }}>{s.safeToSpendPaise < 0 ? 'over this cycle' : 'safe to spend'}</div>
                        {s.safeToSpendPaise >= 0 && <div className="label">About {formatINR(s.dailyPaise)} a day for the next {s.daysLeft} days</div>}
                        {s.plannedUnpaidPaise > 0 && <div className="label mt-2">{formatINR(s.plannedUnpaidPaise)} is held back for family and SIPs that have not gone out yet.</div>}
                        {s.cardDataGap && <div className="label mt-2" style={{ color: 'var(--accent-gold)' }}>Card data stops at {formatDate(s.cardDataThrough)}, so this may be too high.</div>}
                    </Card>
                )}

                {s.review.count > 0 && (
                    <Link to="/review" className="insight-card amber mb-6 card-link" style={{ display: 'block' }}>
                        <strong>{s.review.count} entries need a quick check.</strong> Confirming them makes every number here more accurate.
                    </Link>
                )}

                <div className="dashboard-grid">
                    <DashCard delay={1} emoji="🧾" title="Spending" to="/expenses" metric={formatINR(c.spendPaise)} note={`This cycle, ${incomeShare}% of income${c.oneOffPaise ? `, including ${formatINR(c.oneOffPaise)} in one-offs` : ''}`} />
                    <DashCard delay={2} emoji="📈" title="SIPs" to="/sip" metric={`${formatINR(c.investedPaise)} paid`} note={`${formatINR(s.investments.plannedMonthlyPaise)} a month planned`} />
                    <DashCard delay={3} emoji="🥧" title="Investments" to="/investments" metric={formatCompact(s.investments.totalPaise)} note="Total money you have put in" />
                    <DashCard delay={4} emoji="🛡" title="Emergency fund" to="/emergency-fund" metric={formatCompact(ef.balancePaise)} note={ef.months === null ? 'Set your family contribution to see cover' : `Covers ${ef.months.toFixed(1)} months`} badge={ef.months === null ? null : <StatusBadge status={ef.status} label={ef.status === 'green' ? 'On target' : ef.status === 'amber' ? 'Building' : 'Low'} />} />
                    <DashCard delay={5} emoji="👪" title="Family" to="/family" metric={formatINR(c.familyPaise)} note="Sent this cycle" />
                    <DashCard delay={6} emoji="⚡" title="Where your salary goes" to="/money-flow" metric={formatINR(c.incomePaise)} note={c.incomeIsExpected ? 'Expected this cycle' : 'Received this cycle'} />
                    <DashCard delay={7} emoji="💰" title="Plan and snapshot" to="/snapshot" metric={formatCompact(s.assetsPaise)} note="Recorded savings and investments" />
                    <DashCard emoji="🧠" title="Insights" to="/insights" metric={`${s.insights.filter((i) => i.status !== 'green').length} to look at`} note="Facts from your own data" />
                    <DashCard emoji="📅" title="History" to="/history" metric={`${s.cycles.length} cycles`} note="Every salary cycle and month" />
                </div>
                <p className="label mt-6" style={{ textAlign: 'center' }}>Your data stays in this browser. Nothing is uploaded.</p>
            </div>
        </div>
    );
}
