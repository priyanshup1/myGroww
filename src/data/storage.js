/**
 * storage.js — Data layer abstraction
 * All localStorage access is centralized here.
 * UI components NEVER access localStorage directly.
 *
 * ── History key formats ──────────────────────────────────────────────────────
 *   Monthly    → mygroww_history:monthly:2026-03
 *   Weekly     → mygroww_history:weekly:2026-W13      (ISO week number)
 *   Fortnightly→ mygroww_history:fortnight:2026-F06   (fortnight 1-26)
 *
 * ── Monthly snapshot schema ──────────────────────────────────────────────────
 *   { income, familyContribution, sipsPaid:{[id]:n}, expenses, efBalance, efContribution, notes }
 *
 * ── Weekly / Fortnightly snapshot schema ────────────────────────────────────
 *   { expenses, notes }   (income/SIPs are monthly events, so not tracked here)
 */

const NAMESPACE = 'mygroww_';
const HIST = 'history:'; // base prefix for all history keys

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Zero-pad a number to 2 digits */
const pad = (n) => String(n).padStart(2, '0');

/** Build a storage key for a given granularity and period identifier */
function histKey(granularity, periodId) {
  return HIST + granularity + ':' + periodId;
}

/**
 * ISO week number (1-53) for a given Date.
 * Uses ISO 8601 standard (week starts Monday).
 */
export function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Fortnight number (1-26) for a given Date.
 * Fortnight 1 = weeks 1-2, Fortnight 2 = weeks 3-4, etc.
 */
export function getFortnightNumber(date) {
  return Math.ceil(getISOWeek(date) / 2);
}

// ─── Period ID builders ───────────────────────────────────────────────────────

export function monthlyId(year, month) { return `${year}-${pad(month)}`; }
export function weeklyId(year, weekNum) { return `${year}-W${pad(weekNum)}`; }
export function fortnightId(year, fortnightNum) { return `${year}-F${pad(fortnightNum)}`; }

// ─── Core R/W ────────────────────────────────────────────────────────────────

export function getData(key) {
  try {
    const raw = localStorage.getItem(NAMESPACE + key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setData(key, value) {
  try {
    localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
    localStorage.setItem(NAMESPACE + 'lastSaved', new Date().toISOString());
  } catch (e) {
    console.error('Storage write failed:', e);
  }
}

// ─── History R/W (multi-granularity) ─────────────────────────────────────────

/**
 * Read a single history entry.
 * @param {'monthly'|'weekly'|'fortnight'} granularity
 * @param {string} periodId  e.g. '2026-03', '2026-W13', '2026-F06'
 */
export function getHistory(granularity, periodId) {
  return getData(histKey(granularity, periodId));
}

/**
 * Write a full snapshot for a period.
 */
export function setHistory(granularity, periodId, snapshot) {
  setData(histKey(granularity, periodId), snapshot);
}

/**
 * Patch-merge partial fields into an existing entry (non-destructive).
 */
export function updateHistory(granularity, periodId, partial) {
  const existing = getHistory(granularity, periodId) || {};
  setHistory(granularity, periodId, { ...existing, ...partial });
}

/**
 * Return all history entries for a given granularity, sorted oldest → newest.
 * @param {'monthly'|'weekly'|'fortnight'} granularity
 * @returns {Array<{ periodId, data }>}
 */
export function getAllHistory(granularity) {
  const prefix = NAMESPACE + HIST + granularity + ':';
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(prefix))
    .map((k) => {
      const periodId = k.replace(prefix, '');
      let data = null;
      try { data = JSON.parse(localStorage.getItem(k)); } catch { /* ignore */ }
      return { periodId, data };
    })
    .sort((a, b) => a.periodId.localeCompare(b.periodId));
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function clearAll() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(NAMESPACE));
  keys.forEach((k) => localStorage.removeItem(k));
}

export function getLastSaved() { return getData('lastSaved'); }

export function exportAll() {
  const result = {};
  Object.keys(localStorage)
    .filter((k) => k.startsWith(NAMESPACE))
    .forEach((k) => {
      const shortKey = k.replace(NAMESPACE, '');
      try { result[shortKey] = JSON.parse(localStorage.getItem(k)); }
      catch { result[shortKey] = localStorage.getItem(k); }
    });
  return result;
}

export function importAll(data) {
  if (typeof data !== 'object' || data === null) return;
  clearAll();
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
  });
}
