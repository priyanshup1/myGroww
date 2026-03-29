/**
 * storage.js — Data layer abstraction
 * All localStorage access is centralized here.
 * UI components NEVER access localStorage directly.
 * Future: swap implementation to fetch() calls for a backend.
 */

const NAMESPACE = 'mygroww_';

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

export function clearAll() {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(NAMESPACE)
  );
  keys.forEach((k) => localStorage.removeItem(k));
}

export function getLastSaved() {
  return getData('lastSaved');
}

export function exportAll() {
  const result = {};
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(NAMESPACE)
  );
  keys.forEach((k) => {
    const shortKey = k.replace(NAMESPACE, '');
    try {
      result[shortKey] = JSON.parse(localStorage.getItem(k));
    } catch {
      result[shortKey] = localStorage.getItem(k);
    }
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
