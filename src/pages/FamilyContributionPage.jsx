import { Card, EditableAmount, PageHeader, Stat } from '../components/ui';
import { formatDate } from '../core/dates';
import { formatINR } from '../core/money';
import { setPlan } from '../core/state';
import { commit, useFinance } from '../store';

export default function FamilyContributionPage() {
    const { state, s } = useFinance();
    const c = s.current;
    const share = c.incomePaise > 0 ? Math.min(100, Math.max(0, (c.familyPaise / c.incomePaise) * 100)) : 0;
    return (
        <div className="page-layout">
            <PageHeader section="Family" title="👪 Monthly support" />
            <div className="container" style={{ paddingTop: 24 }}>
                <div className="stat-row mb-4">
                    <Card>
                        <div className="section-title mb-1">Planned contribution each cycle</div>
                        <div className="big-number"><EditableAmount value={state.plan.familyContributionPaise} onChange={(p) => commit((st) => setPlan(st, { familyContributionPaise: p }))} /></div>
                        <div className="label mt-1">Held back from safe to spend until it goes out</div>
                    </Card>
                    <Stat label="Sent this cycle" value={formatINR(c.familyPaise)} note={`${formatINR(c.familyContributionPaise)} contribution, ${formatINR(c.familySupportPaise)} support`} />
                    <Stat label="Still to send" value={formatINR(s.unpaidFamilyPaise)} />
                </div>
                <Card className="mb-4">
                    <div className="section-title mb-3">Share of this cycle&apos;s income</div>
                    <div className="split"><div style={{ width: `${share}%` }} /></div>
                    <p className="label mt-2">{Math.round(share)}% of {formatINR(c.incomePaise)}</p>
                </Card>
                <Card>
                    <div className="section-title mb-3">By salary cycle</div>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead><tr><th>Cycle from</th><th>Contribution</th><th>Support (after money received)</th></tr></thead>
                            <tbody>
                                {s.cycles.slice().reverse().map((x) => <tr key={x.cycle.id}><td>{formatDate(x.cycle.start)}</td><td>{formatINR(x.familyContributionPaise)}</td><td>{formatINR(x.familySupportPaise)}</td></tr>)}
                                {s.cycles.length === 0 && <tr><td colSpan={3} className="label" style={{ textAlign: 'center', padding: 20 }}>Import your data to see this.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
