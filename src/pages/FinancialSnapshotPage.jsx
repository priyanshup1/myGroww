import { Link } from 'react-router-dom';
import { Card, EditableAmount, PageHeader, Stat } from '../components/ui';
import { formatINR } from '../core/money';
import { setPlan } from '../core/state';
import { commit, useFinance } from '../store';

export default function FinancialSnapshotPage() {
    const { state, s } = useFinance();
    const c = s.current;
    const rows = [
        ['Salary this cycle', c.incomePaise, c.incomeIsExpected ? 'Expected, not recorded yet' : 'Received'],
        ['Paid from your debit account', -c.debitOutPaise, 'Everything so far, including card bills'],
        ['Held back for family and SIPs', -s.plannedUnpaidPaise, 'Planned but not gone out yet'],
        ['Unpaid on your card', -s.cardOutstandingPaise, 'Already spent, so it cannot be spent again'],
    ];
    return (
        <div className="page-layout">
            <PageHeader section="Snapshot" title="💰 Your plan and how safe to spend is worked out" />
            <div className="container" style={{ paddingTop: 24 }}>
                <div className="stat-row mb-4">
                    <Card>
                        <div className="section-title mb-1">Expected salary</div>
                        <div className="big-number"><EditableAmount value={state.plan.salaryPaise} onChange={(p) => commit((st) => setPlan(st, { salaryPaise: p }))} /></div>
                        <div className="label mt-1">Used only until the real credit is recorded</div>
                    </Card>
                    <Card>
                        <div className="section-title mb-1">Family contribution</div>
                        <div className="big-number"><EditableAmount value={state.plan.familyContributionPaise} onChange={(p) => commit((st) => setPlan(st, { familyContributionPaise: p }))} /></div>
                        <div className="label mt-1">Planned each cycle</div>
                    </Card>
                    <Stat label="Recorded savings and investments" value={formatINR(s.assetsPaise)} note="Money put in. Market value and bank balances are not included yet." />
                </div>
                <Card>
                    <div className="section-title mb-3">How safe to spend is worked out</div>
                    <table className="data-table">
                        <tbody>
                            {rows.map(([label, amount, note]) => (
                                <tr key={label}><td>{label}<div className="label">{note}</div></td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatINR(amount)}</td></tr>
                            ))}
                        </tbody>
                        <tfoot><tr><td style={{ fontWeight: 700, paddingTop: 12 }}>Safe to spend</td><td style={{ textAlign: 'right', fontWeight: 800, paddingTop: 12 }}>{formatINR(s.safeToSpendPaise)}</td></tr></tfoot>
                    </table>
                    <p className="label mt-4">Set your SIPs on the <Link to="/sip" className="card-link">SIP page</Link>.</p>
                </Card>
            </div>
        </div>
    );
}
