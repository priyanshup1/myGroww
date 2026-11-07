import toast from 'react-hot-toast';
import { Card, CategorySelect, PageHeader, TypeSelect } from '../components/ui';
import { changeWithUndo } from '../components/undo';
import { formatDate } from '../core/dates';
import { EMERGENCY_FUND, SOURCES } from '../core/ledger';
import { formatINR } from '../core/money';
import { categoriseMerchant, removeTx, updateTx } from '../core/state';
import { commit, useFinance } from '../store';

function changeType(st, t, type) {
    const patch = { type };
    if (type === 'savings') patch.category = EMERGENCY_FUND;
    if (type === 'spend' && t.type !== 'spend') patch.category = 'Misc';
    return updateTx(st, t.id, patch);
}

function FlaggedRow({ t }) {
    return (
        <Card className="mb-3">
            <div className="flex justify-between gap-3" style={{ flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                    <strong>{t.description}</strong>
                    <div className="label">{formatDate(t.date)} · {SOURCES[t.source]}</div>
                </div>
                <strong>{formatINR(t.amountPaise, { exact: true })}{t.flow === 'in' ? ' received' : ''}</strong>
            </div>
            <p className="mt-2 mb-3" style={{ color: 'var(--accent-gold)' }}>{t.reviewReason}</p>
            <div className="form-row">
                <label>Type<TypeSelect value={t.type} onChange={(v) => commit((st) => changeType(st, t, v))} /></label>
                {t.type === 'spend' && <label>Category (saves and confirms)<CategorySelect value={t.category} onChange={(v) => commit((st) => categoriseMerchant(st, t.id, v))} /></label>}
                <button type="button" className="btn btn-primary" onClick={() => { commit((st) => updateTx(st, t.id, { needsReview: false, reviewReason: '' })); toast.success('Confirmed'); }}>Looks right</button>
                <button type="button" className="btn btn-danger" onClick={() => changeWithUndo('Entry deleted.', (st) => removeTx(st, t.id))}>Delete</button>
            </div>
        </Card>
    );
}

export default function ReviewPage() {
    const { s } = useFinance();
    const { flagged, duplicates } = s.review;
    return (
        <div className="page-layout">
            <PageHeader section="Review" title={`✅ ${s.review.count} to check`} />
            <div className="container" style={{ paddingTop: 24, maxWidth: 800 }}>
                {s.review.count === 0 && <Card><strong>All checked.</strong><p className="label mt-1">Anything unsure from a future import will appear here.</p></Card>}

                {duplicates.length > 0 && <h3 className="mb-3">Possible duplicates</h3>}
                {duplicates.map(({ key, a, b }) => (
                    <Card key={key} className="mb-3">
                        <strong>{a.description} / {b.description}</strong>
                        <div className="label mb-3">{formatINR(a.amountPaise)} on {formatDate(a.date)}{a.date !== b.date ? ` and ${formatDate(b.date)}` : ', twice'}</div>
                        <div className="form-row">
                            <button type="button" className="btn btn-primary" onClick={() => commit((st) => ({ ...st, dismissedDuplicates: [...st.dismissedDuplicates, key] }))}>Both are real</button>
                            <button type="button" className="btn btn-danger" onClick={() => changeWithUndo('Duplicate deleted.', (st) => removeTx(st, b.id))}>Delete one</button>
                        </div>
                    </Card>
                ))}

                {flagged.length > 0 && <h3 className="mb-3 mt-4">Please confirm</h3>}
                {flagged.map((t) => <FlaggedRow key={t.id} t={t} />)}
            </div>
        </div>
    );
}
