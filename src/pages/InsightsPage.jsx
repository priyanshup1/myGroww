import { PageHeader, StatusBadge } from '../components/ui';
import { useFinance } from '../store';

const LABELS = { green: 'Good', amber: 'Worth a look', red: 'Needs attention' };

export default function InsightsPage() {
    const { s } = useFinance();
    return (
        <div className="page-layout">
            <PageHeader section="Insights" title="🧠 What your data says" />
            <div className="container" style={{ paddingTop: 24 }}>
                <div className="flex flex-col gap-3">
                    {s.insights.map((i) => (
                        <div key={i.id} className={`insight-card ${i.status}`}>
                            <div>
                                <div className="flex items-center gap-3 mb-1" style={{ flexWrap: 'wrap' }}>
                                    <strong>{i.title}</strong>
                                    <StatusBadge status={i.status} label={LABELS[i.status]} />
                                </div>
                                <div className="label">{i.detail}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="label mt-6">These are facts worked out from your own records, not financial advice.</p>
            </div>
        </div>
    );
}
