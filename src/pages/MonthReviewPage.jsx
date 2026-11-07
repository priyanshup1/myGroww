import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BackHead, Connected } from '../components/ui';
import { ShareBars } from '../components/Charts';
import { formatDate } from '../core/dates';
import { cycleReview } from '../core/insights';
import { formatINR } from '../core/money';
import { commit, useFinance } from '../store';

/** A finished salary cycle, told in a few plain sentences. */
export default function MonthReviewPage() {
    const { s } = useFinance();
    const [params, setParams] = useSearchParams();
    const closed = s.cycles.filter((c) => c.cycle.end);
    const pick = params.get('cycle');
    const cycle = closed.find((c) => c.cycle.id === pick) ?? closed[closed.length - 1];
    const id = cycle?.cycle.id;
    useEffect(() => {
        if (id) commit((st) => (st.reviewedCycles.includes(id) ? st : { ...st, reviewedCycles: [...st.reviewedCycles, id] }));
    }, [id]);
    if (!cycle) {
        return (
            <>
                <BackHead title="Cycle review" />
                <p className="empty">Your first review appears when your next salary comes in.</p>
            </>
        );
    }
    const index = s.cycles.findIndex((c) => c.cycle.id === id);
    const before = index > 0 ? s.cycles[index - 1] : null;
    const lines = cycleReview(cycle, before);
    return (
        <>
            <BackHead title="Cycle review" />
            <div className="stack-l">
                <label className="field" htmlFor="review-cycle">Salary cycle
                    <select id="review-cycle" value={id} onChange={(e) => setParams({ cycle: e.target.value }, { replace: true })}>
                        {closed.slice().reverse().map((c) => <option key={c.cycle.id} value={c.cycle.id}>{formatDate(c.cycle.start)} to {formatDate(c.cycle.end)}</option>)}
                    </select>
                </label>
                <div className="grid-2">
                    <div className="stack">
                        {lines.map((l, i) => (
                            <article key={l.id} className="card rise" style={{ animationDelay: `${i * 70}ms` }}>
                                <h2 style={{ fontSize: 19, fontWeight: 600 }}>{l.title}</h2>
                                <p className="small mute" style={{ marginTop: 3 }}>{l.detail}</p>
                            </article>
                        ))}
                    </div>
                    <section>
                        <h2 className="section-title">Where it went</h2>
                        <div className="card card-flush">
                            {cycle.categories.length ? <ShareBars rows={cycle.categories.filter((c) => c.amountPaise > 0)} total={cycle.spendPaise} /> : <p className="empty small">No spending recorded in this cycle.</p>}
                        </div>
                    </section>
                </div>
                <Connected links={[
                    { to: '/activity?tab=history', label: 'All cycles', value: `${s.cycles.length}` },
                    { to: '/plan?tab=budgets', label: 'Budgets', value: formatINR(s.budgets.reduce((a, b) => a + b.limitPaise, 0)) },
                ]} />
            </div>
        </>
    );
}
