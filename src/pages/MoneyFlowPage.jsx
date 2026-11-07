import { Card, PageHeader } from '../components/ui';
import { formatDate } from '../core/dates';
import { formatINR } from '../core/money';
import { useFinance } from '../store';

export default function MoneyFlowPage() {
    const { s } = useFinance();
    const c = s.current;
    const steps = [
        ['Family', c.familyPaise],
        ['Loan EMIs', c.loanPaise],
        ['Insurance', c.insurancePaise],
        ['SIPs and investments', c.investedPaise],
        ['Savings', c.savedPaise],
        ['Transfers to people', c.transfersPaise],
        ['To your own other accounts', c.selfTransferPaise],
        ['Card bill paid', c.cardBillPaise],
        ['Spent from debit account', c.debitOutPaise - c.familyPaise - c.loanPaise - c.insurancePaise - c.investedPaise - c.savedPaise - c.transfersPaise - c.selfTransferPaise - c.cardBillPaise],
    ].filter(([, amount]) => amount !== 0);
    const left = c.incomePaise - c.debitOutPaise;
    const width = (amount) => `${c.incomePaise > 0 ? Math.min(100, (Math.abs(amount) / c.incomePaise) * 100) : 0}%`;
    return (
        <div className="page-layout">
            <PageHeader section="Money flow" title="⚡ Where this cycle's salary went" />
            <div className="container" style={{ paddingTop: 24, maxWidth: 720 }}>
                <Card className="mb-4">
                    <div className="section-title">{c.incomeIsExpected ? 'Expected salary' : `Salary from ${formatDate(c.cycle.start)}`}</div>
                    <div className="big-number">{formatINR(c.incomePaise)}</div>
                </Card>
                <Card className="mb-4">
                    {steps.map(([label, amount]) => (
                        <div key={label} className="mb-3">
                            <div className="flex justify-between"><span>{label}</span><strong>{formatINR(amount)}</strong></div>
                            <div className="split"><div style={{ width: width(amount) }} /></div>
                        </div>
                    ))}
                    {steps.length === 0 && <p className="label">Nothing has gone out in this cycle yet.</p>}
                </Card>
                <Card>
                    <div className="flex justify-between"><strong>Left from this salary so far</strong><strong>{formatINR(left)}</strong></div>
                    <p className="label mt-1">Card purchases not billed yet are not in this figure. They are taken out of safe to spend.</p>
                </Card>
            </div>
        </div>
    );
}
