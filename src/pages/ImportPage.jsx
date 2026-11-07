import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Card, PageHeader, SaveWarning } from '../components/ui';
import { todayISO } from '../core/dates';
import { importCSV } from '../core/importers/csv';
import { importTracker } from '../core/importers/tracker';
import { readWorkbook } from '../core/importers/xlsx';
import { ACCOUNTS } from '../core/ledger';
import { readBackup } from '../core/migrate';
import { formatINR } from '../core/money';
import { mergeTransactions } from '../core/state';
import { commit, exportBackup, hasRestorePoint, replaceAll, resetAll, restoreLast, useFinance } from '../store';


function FilePick({ id, label, accept, onFile, primary }) {
    const ref = useRef(null);
    return (
        <>
            <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-ghost'}`} onClick={() => ref.current.click()}>{label}</button>
            <input id={id} ref={ref} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f); }} />
        </>
    );
}

export default function ImportPage() {
    const { state, s, lastSaved, saveError } = useFinance();
    const [pending, setPending] = useState(null);
    const [problem, setProblem] = useState(null);
    const [csvAccount, setCsvAccount] = useState('credit');
    const [confirmReset, setConfirmReset] = useState(false);

    function previewRecords(name, transactions, warnings) {
        const { added, skipped } = mergeTransactions(state, transactions);
        setProblem(null);
        setPending({
            kind: 'merge',
            name,
            transactions,
            warnings,
            added,
            skipped,
            flagged: transactions.filter((t) => t.needsReview).length,
            totalPaise: transactions.reduce((sum, t) => sum + (t.type === 'income' ? 0 : t.amountPaise), 0),
        });
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
        previewRecords(f.name, transactions, warnings);
    });

    const onCSV = (file) => guard(file, async (f) => {
        const { transactions, warnings } = importCSV(await f.text(), { account: csvAccount, source: csvAccount === 'credit' ? 'card_statement' : 'bank_statement' });
        previewRecords(f.name, transactions, warnings);
    });

    const onBackup = (file) => guard(file, async (f) => {
        let data;
        try {
            data = JSON.parse(await f.text());
        } catch {
            throw new Error('This file is not valid JSON.');
        }
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
            commit((st) => mergeTransactions(st, pending.transactions).state);
            toast.success(`${pending.added} records added`);
        } else {
            replaceAll(pending.next);
            toast.success('Backup restored');
        }
        setPending(null);
    }

    function download() {
        const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mygroww_backup_${todayISO()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="page-layout">
            <PageHeader section="Your data" title="📥 Import and backup" />
            <div className="container" style={{ paddingTop: 24, maxWidth: 860 }}>
                <SaveWarning error={saveError} />
                <p className="label mb-4">Files are read on this device and stay in this browser. Nothing is uploaded. Importing the same file twice does not create duplicates.</p>

                {problem && (
                    <div className="insight-card red mb-4" role="alert">
                        <div><strong>{problem.title}</strong><ul style={{ paddingLeft: 18, marginTop: 6 }}>{problem.items.map((i) => <li key={i}>{i}</li>)}</ul></div>
                    </div>
                )}

                {pending && (
                    <Card className="mb-4" style={{ borderColor: 'var(--accent-gold)' }}>
                        <h3 className="mb-2">Check before adding: {pending.name}</h3>
                        {pending.kind === 'merge' ? (
                            <ul style={{ paddingLeft: 18 }} className="mb-3">
                                <li>{pending.added} new records will be added</li>
                                {pending.skipped > 0 && <li>{pending.skipped} are already here and will be skipped</li>}
                                <li>{formatINR(pending.totalPaise)} of money moved, not counting income</li>
                                {pending.flagged > 0 && <li>{pending.flagged} will go to your review list</li>}
                                {pending.warnings.map((w) => <li key={w} className="gold-text">{w}</li>)}
                            </ul>
                        ) : (
                            <p className="mb-3">This replaces everything here with {pending.count} records from the backup. Your current data is kept as a restore point.</p>
                        )}
                        <div className="form-row">
                            <button type="button" className="btn btn-primary" onClick={apply}>{pending.kind === 'merge' ? 'Add records' : 'Replace my data'}</button>
                            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
                        </div>
                    </Card>
                )}

                <Card className="mb-4">
                    <h3 className="mb-1">Debit account tracker</h3>
                    <p className="label mb-3">Your Excel workbook with the Ledger, Summary and Notes sheets.</p>
                    <FilePick id="tracker-file" label="Choose .xlsx file" accept=".xlsx" primary onFile={onTracker} />
                </Card>

                <Card className="mb-4">
                    <h3 className="mb-1">Statement as CSV</h3>
                    <p className="label mb-3">Needs Date, Description and Amount columns. Category, Type and Review are optional.</p>
                    <div className="form-row">
                        <label>This statement is for<select id="csv-account" value={csvAccount} onChange={(e) => setCsvAccount(e.target.value)}>{Object.entries(ACCOUNTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                        <FilePick id="csv-file" label="Choose .csv file" accept=".csv,text/csv" onFile={onCSV} />
                    </div>
                </Card>

                <Card>
                    <h3 className="mb-1">Backup</h3>
                    <p className="label mb-3">{s.transactions.length} records here. {lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.` : ''} Browser data can be cleared by accident, so export a backup now and then.</p>
                    <div className="form-row">
                        <button type="button" className="btn btn-primary" onClick={download}>Export backup</button>
                        <FilePick id="backup-file" label="Restore from backup file" accept=".json,application/json" onFile={onBackup} />
                        {hasRestorePoint() && <button type="button" className="btn btn-ghost" onClick={() => { if (restoreLast()) toast.success('Restored'); }}>Undo last replace or reset</button>}
                        <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>Delete all my data</button>
                    </div>
                    {confirmReset && (
                        <div className="insight-card red mt-4" role="alert">
                            <div>
                                <strong>Delete all {state.transactions.length} records?</strong>
                                <p className="label mb-3">One restore point is kept in this browser, but export a backup first if you might need this data.</p>
                                <div className="form-row">
                                    <button type="button" className="btn btn-danger" onClick={() => { resetAll(); setConfirmReset(false); toast.success('All data deleted'); }}>Yes, delete everything</button>
                                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Keep my data</button>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
