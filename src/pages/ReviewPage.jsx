import toast from 'react-hot-toast';
import { BackHead, CategorySelect, TypeSelect } from '../components/ui';
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

function FlaggedCard({ t }) {
    return (
        <article className="card stack">
            <div className="between" style={{ alignItems: 'flex-start' }}>
                <div className="grow"><strong>{t.description}</strong><div className="small mute">{formatDate(t.date)} · {SOURCES[t.source]}</div></div>
                <strong className="tabular">{formatINR(t.amountPaise, { exact: true })}{t.flow === 'in' ? ' in' : ''}</strong>
            </div>
            <p className="small accent">{t.reviewReason}</p>
            <div className="form-grid">
                <TypeSelect id={`type-${t.id}`} value={t.type} onChange={(v) => commit((st) => changeType(st, t, v))} />
                {t.type === 'spend' && <CategorySelect id={`cat-${t.id}`} label="Category (saves and confirms)" value={t.category} onChange={(v) => commit((st) => categoriseMerchant(st, t.id, v))} />}
            </div>
            <div className="row wrap">
                <button type="button" className="btn btn-primary btn-small" onClick={() => { commit((st) => updateTx(st, t.id, { needsReview: false, reviewReason: '' })); toast.success('Confirmed'); }}>Looks right</button>
                <button type="button" className="btn btn-danger btn-small" onClick={() => changeWithUndo('Entry deleted', (st) => removeTx(st, t.id))}>Delete</button>
            </div>
        </article>
    );
}

export default function ReviewPage() {
    const { s } = useFinance();
    const { flagged, duplicates } = s.review;
    return (
        <>
            <BackHead title={s.review.count ? `${s.review.count} to check` : 'All checked'} />
            <div className="stack-l" style={{ maxWidth: 720 }}>
                {s.review.count === 0 && <p className="empty">Nothing needs checking. Anything unsure from a future import will appear here.</p>}
                {duplicates.length > 0 && (
                    <section className="stack">
                        <h2 className="section-title" style={{ margin: 0 }}>Possible duplicates</h2>
                        {duplicates.map(({ key, a, b }) => (
                            <article key={key} className="card stack">
                                <div><strong>{a.description}{a.description !== b.description ? ` / ${b.description}` : ''}</strong><div className="small mute tabular">{formatINR(a.amountPaise)} on {formatDate(a.date)}{a.date !== b.date ? ` and ${formatDate(b.date)}` : ', twice'}</div></div>
                                <div className="row wrap">
                                    <button type="button" className="btn btn-primary btn-small" onClick={() => commit((st) => ({ ...st, dismissedDuplicates: [...st.dismissedDuplicates, key] }))}>Both are real</button>
                                    <button type="button" className="btn btn-danger btn-small" onClick={() => changeWithUndo('Duplicate deleted', (st) => removeTx(st, b.id))}>Delete one</button>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
                {flagged.length > 0 && (
                    <section className="stack">
                        <h2 className="section-title" style={{ margin: 0 }}>Please confirm</h2>
                        {flagged.map((t) => <FlaggedCard key={t.id} t={t} />)}
                    </section>
                )}
            </div>
        </>
    );
}
