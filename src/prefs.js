/** Per-device preferences: theme, mode and reminders. They are not financial data. */
import { useSyncExternalStore } from 'react';

const KEY = 'mygroww_prefs';
const DEFAULTS = { theme: 'gold', mode: 'dark', notify: false, lastBackup: null, lastNotified: null };
const BARS = {
    gold: { dark: '#0A0A0B', light: '#F5F3EE' },
    emerald: { dark: '#06120E', light: '#EFF3F1' },
};

function read() {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    } catch {
        return DEFAULTS;
    }
}

let prefs = read();
const listeners = new Set();
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;

export function resolvedMode(p = prefs) {
    if (p.mode === 'system') return media?.matches ? 'light' : 'dark';
    return p.mode;
}

function apply() {
    const root = document.documentElement;
    const mode = resolvedMode();
    root.dataset.theme = prefs.theme;
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BARS[prefs.theme]?.[mode] ?? '#0A0A0B');
}

export function setPrefs(patch) {
    prefs = { ...prefs, ...patch };
    try {
        localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch { /* still applies for this visit */ }
    apply();
    listeners.forEach((l) => l());
}

export function getPrefs() {
    return prefs;
}

apply();
media?.addEventListener('change', () => {
    apply();
    prefs = { ...prefs };
    listeners.forEach((l) => l());
});

function subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
}

export function usePrefs() {
    return useSyncExternalStore(subscribe, getPrefs);
}
