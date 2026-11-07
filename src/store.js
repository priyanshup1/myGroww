/**
 * The one place the app reads and writes saved data. Every page shares this store,
 * so a change on one page shows everywhere at once.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { todayISO } from './core/dates';
import { STATE_VERSION, emptyState } from './core/state';
import { legacyFromFlat, looksLegacy, makeBackup, migrateLegacy, readBackup } from './core/migrate';
import { summarize } from './core/selectors';

const KEY = 'mygroww_v2';
const RESTORE_KEY = 'mygroww_v2_restore';
const OLD_PREFIX = 'mygroww_';

function readJSON(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
    } catch {
        return undefined;
    }
}

function readOldKeys() {
    const flat = {};
    try {
        Object.keys(localStorage)
            .filter((k) => k.startsWith(OLD_PREFIX) && !k.startsWith(KEY))
            .forEach((k) => {
                const value = readJSON(k);
                if (value !== undefined && value !== null) flat[k.slice(OLD_PREFIX.length)] = value;
            });
    } catch {
        /* Storage is blocked: the app still runs for this visit. */
    }
    return flat;
}

function load() {
    const saved = readJSON(KEY);
    if (saved === undefined) {
        try {
            localStorage.setItem(`${KEY}_damaged`, localStorage.getItem(KEY));
        } catch { /* nothing more can be done */ }
        return { state: emptyState(), notice: 'Your saved data could not be read. A copy was kept, and you can restore from a backup on the Import page.' };
    }
    if (saved) {
        const result = readBackup({ app: 'mygroww', version: saved.version ?? STATE_VERSION, state: saved }, todayISO());
        if (result.ok) return { state: result.state, notice: '' };
    }
    const old = readOldKeys();
    if (looksLegacy(old)) return { state: migrateLegacy(legacyFromFlat(old), todayISO()), notice: '', migrated: true };
    return { state: emptyState(), notice: '' };
}

const first = load();
let current = first.state;
let lastSaved = null;
let saveError = first.notice;
const listeners = new Set();

function publish() {
    snapshot = { state: current, lastSaved, saveError };
    listeners.forEach((l) => l());
}

let snapshot = { state: current, lastSaved, saveError };

function persist() {
    try {
        localStorage.setItem(KEY, JSON.stringify(current));
        lastSaved = new Date();
        saveError = '';
    } catch {
        saveError = 'Your latest change could not be saved in this browser. Export a backup now so it is not lost.';
    }
}

/** Applies a change. If the change is invalid it throws, and nothing is altered. */
export function commit(change) {
    current = change(current);
    persist();
    publish();
}

function keepRestorePoint() {
    try {
        localStorage.setItem(RESTORE_KEY, JSON.stringify(current));
    } catch {
        return false;
    }
    return true;
}

/** Replaces everything, after keeping one restore point of what was there. */
export function replaceAll(next) {
    keepRestorePoint();
    commit(() => next);
}

export function resetAll() {
    keepRestorePoint();
    commit(() => emptyState());
}

export function hasRestorePoint() {
    return Boolean(readJSON(RESTORE_KEY));
}

export function restoreLast() {
    const saved = readJSON(RESTORE_KEY);
    if (!saved) return false;
    const result = readBackup({ app: 'mygroww', version: saved.version ?? STATE_VERSION, state: saved }, todayISO());
    if (!result.ok) return false;
    keepRestorePoint();
    commit(() => result.state);
    return true;
}

export function exportBackup() {
    return makeBackup(current, new Date().toISOString());
}

if (first.migrated) {
    persist();
    snapshot = { state: current, lastSaved, saveError };
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key !== KEY) return;
        current = load().state;
        publish();
    });
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useFinance() {
    const { state, lastSaved: saved, saveError: error } = useSyncExternalStore(subscribe, () => snapshot);
    const today = todayISO();
    const s = useMemo(() => summarize(state, today), [state, today]);
    return { state, s, today, lastSaved: saved, saveError: error };
}
