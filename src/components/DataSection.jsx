import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { todayISO } from '../core/dates';
import { importCSV } from '../core/importers/csv';
import { importTracker } from '../core/importers/tracker';
import { readWorkbook } from '../core/importers/xlsx';
import { ACCOUNTS } from '../core/ledger';
import { readBackup } from '../core/migrate';
import { formatINR } from '../core/money';
import { mergeTransactions } from '../core/state';
import { setPrefs } from '../prefs';
import { commit, exportBackup, hasRestorePoint, replaceAll, resetAll, restoreLast, useFinance } from '../store';

function FilePick({ id, label, accept, onFile, primary }) {
    const ref = useRef(null);
    return (
        <>
            <button type="button" className={`btn btn-small ${primary ? 'btn-primary' : 'btn-ghost'}`} onClick={() => ref.current.click()}>{label}</button>
            <input id={id} ref={ref} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f); }} />
        </>
    );
}

/** Import, backup, restore and delete. Used by first-run setup and Settings. */
export function ImportSection({ onDone }) {
    const { state } = useFinance();
    const [pending, setPending] = useState(null);
    const [problem, setProblem] = useState(null);
    const [csvAccount, setCsvAccount] = useState('credit');

    function preview(name, transactions, warnings) {
        const { added, skipped } = mergeTransactions(state, transactions);
        setProblem(null);
        setPending({ kind: 'merge', name, transactions, warnings, added, skipped, flagged: transactions.filter((t) => t.needsReview).length, totalPaise: transactions.reduce((a, t) => a + (t.type === 'income' ? 0 : t.amountPaise), 0) });
    }
    async function guard(file, work) {
        try {
            await work(file);
        } catch (err) {
            setPending(null);
            setProblem({ title: `"${file.name}" could not be read. Nothing was changed.`, items: [err.message] });
        }
    }
    const onTracker = (file) => guard(file, async (f) => {
        const { transactions, warnings } = importTracker(readWorkbook(new Uint8Array(await f.arrayBuffer())));
        preview(f.name, transactions, warnings);
    });
    const onCSV = (file) => guard(file, async (f) => {
        const { transactions, warnings } = importCSV(await f.text(), { account: csvAccount, source: csvAccount === 'credit' ? 'card_statement' : 'bank_statement' });
        preview(f.name, transactions, warnings);
    });
    const onBackup = (file) => guard(file, async (f) => {
        let data;
        try { data = JSON.parse(await f.text()); } catch { throw new Error('This file is not valid JSON.'); }
        const result = readBackup(data, todayISO());
        if (!result.ok) {
            setPending(null);
            setProblem({ title: `"${f.name}" was not loaded. Nothing was changed.`, items: result.errors });
            return;
        }
        setProblem(null);
        setPending({ kind: 'replace', name: f.name, next: result.state, count: result.state.transactions.length });
    });
    function apply() {
        if (pending.kind === 'merge') {
            commit((st) => ({ ...mergeTransactions(st, pending.transactions).state, setupDone: true }));
            toast.success(`${pending.added} records added`);
        } else {
            replaceAll({ ...pending.next, setupDone: true });
            toast.success('Backup restored');
        }
        setPending(null);
        onDone?.();
    }
    return (
        <div className="stack">
            {problem && <div className="alert-box small" role="alert"><strong>{problem.title}</strong><ul style={{ paddingLeft: 18, margin: '4px 0 0' }}>{problem.items.map((i) => <li key={i}>{i}</li>)}</ul></div>}
            {pending && (
                <div className="card stack" style={{ boxShadow: 'inset 0 0 0 1px var(--accent)' }}>
                    <strong>Check before adding: {pending.name}</strong>
                    {pending.kind === 'merge' ? (
                        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                            <li>{pending.added} new records will be added</li>
                            {pending.skipped > 0 && <li>{pending.skipped} are already here and will be skipped</li>}
                            <li>{formatINR(pending.totalPaise)} of money moved, not counting income</li>
                            {pending.flagged > 0 && <li>{pending.flagged} will go to your review list</li>}
                            {pending.warnings.map((w) => <li key={w} className="accent">{w}</li>)}
                        </ul>
                    ) : <p className="small">This replaces everything here with {pending.count} records from the backup. Your current data is kept as a restore point.</p>}
                    <div className="row wrap">
                        <button type="button" className="btn btn-primary btn-small" onClick={apply}>{pending.kind === 'merge' ? 'Add records' : 'Replace my data'}</button>
                        <button type="button" className="btn btn-ghost btn-small" onClick={() => setPending(null)}>Cancel</button>
                    </div>
                </div>
            )}
            <div className="card stack">
                <div><strong>Debit account tracker</strong><p className="small mute">An Excel workbook with Ledger, Summary and Notes sheets.</p></div>
                <div><FilePick id="tracker-file" label="Choose .xlsx file" accept=".xlsx" primary onFile={onTracker} /></div>
            </div>
            <div className="card stack">
                <div><strong>Statement as CSV</strong><p className="small mute">Needs Date, Description and Amount columns.</p></div>
                <div className="row wrap" style={{ alignItems: 'flex-end' }}>
                    <label className="field grow" htmlFor="csv-account">This statement is for<select id="csv-account" value={csvAccount} onChange={(e) => setCsvAccount(e.target.value)}>{Object.entries(ACCOUNTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    <FilePick id="csv-file" label="Choose .csv file" accept=".csv,text/csv" onFile={onCSV} />
                </div>
            </div>
            <div className="card stack">
                <div><strong>Restore from backup</strong><p className="small mute">A myGroww backup file.</p></div>
                <div><FilePick id="backup-file" label="Choose backup file" accept=".json,application/json" onFile={onBackup} /></div>
            </div>
        </div>
    );
}

export function BackupSection() {
    const { state, lastSaved } = useFinance();
    const [confirmReset, setConfirmReset] = useState(false);
    function download() {
        const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mygroww_backup_${todayISO()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setPrefs({ lastBackup: todayISO() });
        toast.success('Backup downloaded');
    }
    return (
        <div className="card stack">
            <p className="small mute">{state.transactions.length} records in this browser.{lastSaved ? ` Last saved at ${lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.` : ''} Browser data can be cleared by accident, and it does not move between devices, so export a backup now and then.</p>
            <div className="row wrap">
                <button type="button" className="btn btn-primary btn-small" onClick={download}>Export backup</button>
                {hasRestorePoint() && <button type="button" className="btn btn-ghost btn-small" onClick={() => { if (restoreLast()) toast.success('Restored'); }}>Undo last replace or delete</button>}
                <button type="button" className="btn btn-danger btn-small" onClick={() => setConfirmReset(true)}>Delete all my data</button>
            </div>
            {confirmReset && (
                <div className="alert-box stack" role="alert">
                    <div><strong>Delete all {state.transactions.length} records?</strong><p className="small mute">One restore point is kept in this browser, but export a backup first if you might need this data.</p></div>
                    <div className="row wrap">
                        <button type="button" className="btn btn-danger btn-small" onClick={() => { resetAll(); setConfirmReset(false); toast.success('All data deleted'); }}>Yes, delete everything</button>
                        <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirmReset(false)}>Keep my data</button>
                    </div>
                </div>
            )}
        </div>
    );
}
