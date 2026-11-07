import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, PageHeader, Stat } from '../components/ui';
import { formatINR } from '../core/money';
import { useFinance } from '../store';

const COLORS = ['#22a993', '#d4a574', '#8b92a9', '#6c8cd5', '#b8865a', '#7fc8f8', '#c28fb8', '#5f7f6e'];

export default function InvestmentAllocationPage() {
    const { s } = useFinance();
    const inv = s.investments;
    const shown = inv.categories.filter((c) => c.amountPaise > 0);
    const data = shown.map((c) => ({ name: c.name, value: c.amountPaise }));
    return (
        <div className="page-layout">
            <PageHeader section="Investments" title="🥧 Where your investments are" />
            <div className="container" style={{ paddingTop: 24 }}>
                <div className="stat-row mb-4">
                    <Stat label="Total money put in" value={formatINR(inv.totalPaise)} note="This is what you paid, not the current market value." />
                    <Stat label="Planned each month" value={formatINR(inv.plannedMonthlyPaise)} />
                </div>
                <div className="charts-row">
                    <Card>
                        <div className="section-title mb-3">Share by category</div>
                        {data.length ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie data={data} dataKey="value" innerRadius={62} outerRadius={100} paddingAngle={2} stroke="none">
                                        {data.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ background: '#15192a', border: '1px solid #2a2d3a', borderRadius: 8 }} itemStyle={{ color: '#e8eaf6' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <p className="label">No investments recorded yet. Add them on the <Link to="/sip" className="card-link">SIP page</Link>.</p>}
                    </Card>
                    <Card>
                        <div className="section-title mb-3">Details</div>
                        <table className="data-table">
                            <thead><tr><th>Category</th><th>Put in</th><th>Share</th></tr></thead>
                            <tbody>
                                {shown.map((c, i) => (
                                    <tr key={c.name}>
                                        <td><span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], marginRight: 8 }} />{c.name}</td>
                                        <td>{formatINR(c.amountPaise)}</td>
                                        <td>{inv.totalPaise > 0 ? `${((c.amountPaise / inv.totalPaise) * 100).toFixed(1)}%` : '0%'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="label mt-3">Payments not linked to a fund show as &quot;Not assigned to a fund&quot;. Link them on the <Link to="/sip" className="card-link">SIP page</Link>.</p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
