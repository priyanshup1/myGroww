import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { todayISO } from '../core/dates';
import { readBackup } from '../core/migrate';
import { openVault } from '../core/vault';
import { replaceAll } from '../store';

/** Unlocks the owner's encrypted data. Decryption happens only in this browser. */
export function UnlockSection({ onDone }) {
    const [vault, setVault] = useState(null);
    const [passphrase, setPassphrase] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let live = true;
        fetch('/vault.json', { cache: 'no-store' })
            .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
            .then((v) => { if (live && v?.app === 'mygroww-vault') setVault(v); })
            .catch(() => {});
        return () => { live = false; };
    }, []);

    if (!vault) return null;

    async function unlock(e) {
        e.preventDefault();
        if (!passphrase.trim()) { setError('Enter your passphrase.'); return; }
        setBusy(true);
        setError('');
        try {
            const data = await openVault(vault, passphrase.trim());
            const result = readBackup(data, todayISO());
            if (!result.ok) throw new Error('The data could not be read, so nothing was changed.');
            replaceAll({ ...result.state, setupDone: true });
            setPassphrase('');
            toast.success(`${result.state.transactions.length} records loaded`);
            onDone?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={unlock} className="card stack" autoComplete="off">
            <div><strong>Unlock my data</strong><p className="small mute">Enter your passphrase to load your private records into this browser. Anything already here is replaced, and kept as one restore point.</p></div>
            <label className="field" htmlFor="unlock-passphrase">Passphrase<input id="unlock-passphrase" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck="false" enterKeyHint="go" value={passphrase} onChange={(e) => { setPassphrase(e.target.value); setError(''); }} /></label>
            {error && <p className="bad small" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Unlocking' : 'Unlock'}</button>
        </form>
    );
}
