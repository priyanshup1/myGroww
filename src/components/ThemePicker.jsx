import { setPrefs, usePrefs } from '../prefs';

const THEMES = [
    { id: 'gold', name: 'Obsidian Gold', swatch: '#D9B26A' },
    { id: 'emerald', name: 'Midnight Emerald', swatch: '#4FD1A1' },
];
const MODES = [{ id: 'dark', name: 'Dark' }, { id: 'light', name: 'Light' }, { id: 'system', name: 'Match device' }];

export function ThemePicker() {
    const prefs = usePrefs();
    return (
        <div className="stack">
            <div className="chips" role="group" aria-label="Theme">
                {THEMES.map((t) => <button key={t.id} type="button" className="chip" aria-pressed={prefs.theme === t.id} onClick={() => setPrefs({ theme: t.id })}><i className="swatch" style={{ background: t.swatch, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.2)' }} />{t.name}</button>)}
            </div>
            <div className="chips" role="group" aria-label="Light or dark">
                {MODES.map((m) => <button key={m.id} type="button" className="chip" aria-pressed={prefs.mode === m.id} onClick={() => setPrefs({ mode: m.id })}>{m.name}</button>)}
            </div>
        </div>
    );
}
