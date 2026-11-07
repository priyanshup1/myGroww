import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SPEND_CATEGORIES, TX_TYPES } from '../core/ledger';
import { formatINR, toPaise } from '../core/money';

export function BackButton() {
    const navigate = useNavigate();
    return <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate('/')}>← Dashboard</button>;
}

export function PageHeader({ section, title, action }) {
    return (
        <div className="page-header">
            <div className="container flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div className="flex items-center gap-3">
                    <BackButton />
                    <div>
                        <div className="section-title">{section}</div>
                        <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>{title}</h2>
                    </div>
                </div>
                {action}
            </div>
        </div>
    );
}

export function Card({ children, className = '', style, onClick }) {
    return <div className={`glass-card${onClick ? ' clickable' : ''} ${className}`} style={{ padding: 22, ...style }} onClick={onClick}>{children}</div>;
}

export function Stat({ label, value, note, tone }) {
    return (
        <Card>
            <div className="section-title mb-1">{label}</div>
            <div className="big-number" style={{ color: tone }}>{value}</div>
            {note && <div className="label mt-1">{note}</div>}
        </Card>
    );
}

const ICONS = { green: '●', amber: '◆', red: '▲' };

export function StatusBadge({ status = 'green', label }) {
    return <span className={`status-badge ${status}`}><span>{ICONS[status]}</span>{label}</span>;
}

/** An amount in paise that you can click to change. */
export function EditableAmount({ value, onChange }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const ref = useRef(null);
    useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
    function save() {
        const paise = toPaise(draft);
        if (Number.isFinite(paise) && paise >= 0) onChange(paise);
        setEditing(false);
    }
    if (editing) {
        return (
            <input
                ref={ref}
                className="editable-number-input"
                inputMode="decimal"
                aria-label="Amount in rupees"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            />
        );
    }
    return (
        <button type="button" className="editable-number-wrap link-button" title="Click to change" onClick={() => { setDraft(String(value / 100)); setEditing(true); }}>
            <span className="editable-number-display">{formatINR(value, { exact: true })}</span>
            <span aria-hidden="true" style={{ fontSize: '0.75em', opacity: 0.6 }}>✎</span>
        </button>
    );
}

export function CategorySelect({ value, onChange, id }) {
    const options = SPEND_CATEGORIES.includes(value) || !value ? SPEND_CATEGORIES : [value, ...SPEND_CATEGORIES];
    return (
        <select id={id} aria-label="Category" value={value || 'Misc'} onChange={(e) => onChange(e.target.value)}>
            {options.map((c) => <option key={c}>{c}</option>)}
        </select>
    );
}

export function TypeSelect({ value, onChange }) {
    return (
        <select aria-label="Type" value={value} onChange={(e) => onChange(e.target.value)}>
            {Object.entries(TX_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
    );
}

export function SaveWarning({ error }) {
    if (!error) return null;
    return <div className="insight-card red mb-4" role="alert"><div>{error}</div></div>;
}
