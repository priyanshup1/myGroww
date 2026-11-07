import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BackHead, SaveWarning } from '../components/ui';
import { ThemePicker } from '../components/ThemePicker';
import { BackupSection, ImportSection } from '../components/DataSection';
import { commit, useFinance } from '../store';
import { setPrefs, usePrefs } from '../prefs';

function InstallCard() {
    const [ready, setReady] = useState(Boolean(window.installPrompt));
    const installed = matchMedia('(display-mode: standalone)').matches;
    useEffect(() => {
        const on = () => setReady(true);
        window.addEventListener('mygroww-installable', on);
        return () => window.removeEventListener('mygroww-installable', on);
    }, []);
    async function install() {
        window.installPrompt.prompt();
        await window.installPrompt.userChoice;
        window.installPrompt = null;
        setReady(false);
    }
    if (installed) return <p className="small mute">myGroww is installed on this device.</p>;
    return (
        <div className="stack">
            <p className="small mute">Opens like a normal app and works without internet.</p>
            {ready ? <div><button type="button" className="btn btn-primary btn-small" onClick={install}>Install myGroww</button></div> : <p className="small">On iPhone, tap Share, then Add to Home Screen. On Android, open your browser menu and choose Install app.</p>}
        </div>
    );
}

function Reminders() {
    const prefs = usePrefs();
    const supported = typeof Notification !== 'undefined';
    async function toggle(on) {
        if (!on) { setPrefs({ notify: false }); return; }
        const result = await Notification.requestPermission();
        if (result === 'granted') { setPrefs({ notify: true }); toast.success('Reminders are on'); } else toast.error('Your browser blocked notifications');
    }
    return (
        <div className="stack">
            {supported && <label className="check"><input id="notify" type="checkbox" checked={prefs.notify} onChange={(e) => toggle(e.target.checked)} />Notify me when I open the app and something is due</label>}
            <p className="small mute">myGroww has no server, so it cannot alert you while closed. For reminders that always arrive, download the calendar file from Plan, then Bills.</p>
        </div>
    );
}

export default function SettingsPage() {
    const { state, saveError } = useFinance();
    const set = (key) => (e) => {
        const n = Number(e.target.value);
        if (Number.isInteger(n) && n >= 1 && n <= 31) commit((st) => ({ ...st, card: { ...st.card, [key]: n } }));
    };
    return (
        <>
            <BackHead title="Settings" />
            <SaveWarning error={saveError} />
            <div className="grid-2">
                <div className="stack-l">
                    <section><h2 className="section-title">Appearance</h2><div className="card"><ThemePicker /></div></section>
                    <section><h2 className="section-title">Install on your phone</h2><div className="card"><InstallCard /></div></section>
                    <section><h2 className="section-title">Reminders</h2><div className="card"><Reminders /></div></section>
                    <section>
                        <h2 className="section-title">Credit card dates</h2>
                        <div className="card form-grid">
                            <label className="field" htmlFor="card-close">Statement closes on day<input id="card-close" inputMode="numeric" defaultValue={state.card.closeDay} onChange={set('closeDay')} /></label>
                            <label className="field" htmlFor="card-due">Bill is due on day<input id="card-due" inputMode="numeric" defaultValue={state.card.dueDay} onChange={set('dueDay')} /></label>
                        </div>
                    </section>
                </div>
                <div className="stack-l">
                    <section>
                        <h2 className="section-title">Import</h2>
                        <p className="small mute" style={{ marginBottom: 10 }}>Files are read on this device. Nothing is uploaded, and importing the same file twice does not create duplicates.</p>
                        <ImportSection />
                    </section>
                    <section><h2 className="section-title">Your data</h2><BackupSection /></section>
                </div>
            </div>
        </>
    );
}
