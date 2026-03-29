import React, { useState, useRef } from 'react';
import { exportAll, importAll, clearAll, getLastSaved } from '../data/storage';

function ConfirmModal({ message, onConfirm, onCancel }) {
    return (
        <div className="modal-backdrop">
            <div className="modal-box">
                <h3 style={{ marginBottom: 12, color: 'var(--alert-red)' }}>⚠ Confirm Reset</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{message}</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-danger" onClick={onConfirm}>Reset All</button>
                </div>
            </div>
        </div>
    );
}

function formatTs(iso) {
    if (!iso) return 'Never';
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
            ', ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return '—'; }
}

export default function DataControls({ onImport }) {
    const [showConfirm, setShowConfirm] = useState(false);
    const fileRef = useRef(null);
    const lastSaved = getLastSaved();

    function handleExport() {
        const data = exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mygroww_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                importAll(data);
                if (onImport) onImport();
                window.location.reload();
            } catch {
                alert('Invalid JSON file');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function handleReset() {
        clearAll();
        setShowConfirm(false);
        window.location.reload();
    }

    return (
        <>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
            }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    💾 Saved: {formatTs(lastSaved)}
                </span>
                <button className="btn btn-ghost btn-icon" onClick={handleExport} title="Export as JSON">
                    ↓ Export
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => fileRef.current.click()} title="Import JSON">
                    ↑ Import
                </button>
                <button className="btn btn-danger btn-icon" onClick={() => setShowConfirm(true)} title="Reset all data">
                    ✕ Reset
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportFile}
                />
            </div>
            {showConfirm && (
                <ConfirmModal
                    message="This will permanently delete all your data (income, expenses, investments, SIPs). This cannot be undone."
                    onConfirm={handleReset}
                    onCancel={() => setShowConfirm(false)}
                />
            )}
        </>
    );
}
