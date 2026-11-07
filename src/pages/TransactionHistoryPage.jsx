import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, PageHeader, StatusBadge } from '../components/ui';
import { formatDate, formatMonth } from '../core/dates';
import { formatCompact, formatINR } from '../core/money';
import { useFinance } from '../store';

export default function TransactionHistoryPage() {
    const { s } = useFinance();
    const data = s.months.map((m) => ({ label: formatMonth(m.key), Normal: m.normalSpendPaise, 'One-offs': m.spendPaise - m.normalSpendPaise }));
    return (
        <div className="page-layout">
            <PageHeader section="History" title="📅 Every month and salary cycle" />
            <div className="container" style={{ paddingTop: 24 }}>
                <Card className="mb-4">
                    <div className="section-title mb-3">Spending by month</div>
                    {data.length ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={data}>
                                <XAxis dataKey="label" stroke="#8b92a9" fontSize={11} />
                                <YAxis stroke="#8b92a9" fontSize={11} tickFormatter={formatCompact} width={70} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(v) => formatINR(v)} contentStyle={{ background: '#15192a', border: '1px solid #2a2d3a', borderRadius: 8 }} />
                                <Bar dataKey="Normal" stackId="a" fill="#22a993" />
                                <Bar dataKey="One-offs" stackId="a" fill="#d4a574" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="label">Your months will appear here once you add or import data.</p>}
                </Card>
                <Card>
                    <div className="section-title mb-1">Salary cycles</div>
                    <p className="label mb-3">&quot;Not explained&quot; is salary the records do not account for. A large figure usually means entries are missing. &quot;Checked&quot; means it comes mostly from a statement.</p>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead><tr><th>From</th><th>Income</th><th>Spending</th><th>One-offs</th><th>Family</th><th>Invested</th><th>Saved</th><th>Card bill</th><th>Not explained</th><th>Data</th></tr></thead>
                            <tbody>
                                {s.cycles.slice().reverse().map((c) => (
                                    <tr key={c.cycle.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(c.cycle.start)}{c.cycle.end ? '' : ' (now)'}</td>
                                        <td>{formatINR(c.incomePaise)}</td><td>{formatINR(c.spendPaise)}</td><td>{formatINR(c.oneOffPaise)}</td><td>{formatINR(c.familyPaise)}</td><td>{formatINR(c.investedPaise)}</td><td>{formatINR(c.savedPaise)}</td><td>{formatINR(c.cardBillPaise)}</td>
                                        <td>{c.cycle.end ? formatINR(c.unexplainedPaise) : 'In progress'}</td>
                                        <td><StatusBadge status={c.verified ? 'green' : 'amber'} label={c.verified ? 'Checked' : 'Partial'} /></td>
                                    </tr>
                                ))}
                                {s.cycles.length === 0 && <tr><td colSpan={10} className="label" style={{ textAlign: 'center', padding: 20 }}>Cycles start from your first recorded salary.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
