import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { animate, motion } from 'motion/react';
import { SPEND_CATEGORIES, TX_TYPES } from '../core/ledger';
import { formatCompact, formatINR, toPaise } from '../core/money';
import { Icon } from './icons';

export function PageHead({ title, action, plain }) {
    return (
        <header className="page-head">
            <h1 className={`page-title${plain ? '' : ' morph'}`}>{title}</h1>
            {action ?? <Link to="/settings" className="icon-btn" aria-label="Settings"><Icon name="settings" /></Link>}
        </header>
    );
}

export function BackHead({ title, to = '/' }) {
    return (
        <header className="page-head" style={{ justifyContent: 'flex-start' }}>
            <Link to={to} viewTransition className="icon-btn" aria-label="Back" style={{ marginLeft: -10 }}><Icon name="back" /></Link>
            <h1 className="page-title morph">{title}</h1>
        </header>
    );
}

export function Stat({ label, value, note }) {
    return (
        <div className="card">
            <div className="tiny mute">{label}</div>
            <div className="stat-value">{value}</div>
            {note && <div className="tiny mute" style={{ marginTop: 3 }}>{note}</div>}
        </div>
    );
}

/** A rupee figure that counts smoothly to its new value when the money changes. */
export function AnimatedAmount({ paise, compact = false, abs = false, start }) {
    const ref = useRef(null);
    const shown = useRef(start ?? paise);
    const fmt = (v) => {
        const value = abs ? Math.abs(v) : v;
        return compact ? formatCompact(value) : formatINR(value);
    };
    useEffect(() => {
        const from = shown.current;
        if (from === paise || matchMedia('(prefers-reduced-motion: reduce)').matches) {
            shown.current = paise;
            if (ref.current) ref.current.textContent = fmt(paise);
            return undefined;
        }
        const controls = animate(from, paise, {
            duration: 0.85,
            ease: [0.23, 1, 0.32, 1],
            onUpdate: (v) => { shown.current = v; if (ref.current) ref.current.textContent = fmt(v); },
        });
        return () => controls.stop();
    });
    return <span ref={ref}>{fmt(shown.current)}</span>;
}

/** A tab choice kept in the address, so links can open a specific tab. */
export function useTab(defaultTab) {
    const [params, setParams] = useSearchParams();
    const value = params.get('tab') ?? defaultTab;
    return [value, (tab) => setParams((p) => { p.set('tab', tab); return p; }, { replace: true })];
}

/** A segmented control whose highlight slides between options. */
export function Tabs({ tabs, value, onChange, label }) {
    const group = useId();
    return (
        <div className="tabs" role="tablist" aria-label={label}>
            {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" className="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
                    {value === t.id && <motion.i className="tab-pill" layoutId={`pill-${group}`} transition={{ type: 'spring', duration: 0.32, bounce: 0.12 }} />}
                    <span>{t.label}</span>
                </button>
            ))}
        </div>
    );
}

/** An amount you tap to change. */
export function EditableAmount({ value, onChange, label = 'Amount in rupees', className = 'stat-value' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const ref = useRef(null);
    useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
    function save() {
        const paise = toPaise(draft === '' ? '0' : draft);
        if (Number.isFinite(paise) && paise >= 0) onChange(paise);
        setEditing(false);
    }
    if (editing) {
        return (
            <span className="field">
                <input ref={ref} inputMode="decimal" enterKeyHint="done" aria-label={label} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
            </span>
        );
    }
    return (
        <button type="button" className={`row ${className}`} style={{ gap: 6, minHeight: 44 }} aria-label={`${label}: ${formatINR(value)}. Change`} onClick={() => { setDraft(value ? String(value / 100) : ''); setEditing(true); }}>
            {formatINR(value, { exact: true })}
            <span className="mute"><Icon name="edit" size={15} /></span>
        </button>
    );
}

export function CategorySelect({ value, onChange, id, label = 'Category' }) {
    const options = SPEND_CATEGORIES.includes(value) || !value ? SPEND_CATEGORIES : [value, ...SPEND_CATEGORIES];
    return (
        <label className="field" htmlFor={id}>{label}
            <select id={id} value={value || 'Misc'} onChange={(e) => onChange(e.target.value)}>{options.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
    );
}

export function TypeSelect({ value, onChange, id, label = 'What kind of money' }) {
    return (
        <label className="field" htmlFor={id}>{label}
            <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{Object.entries(TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
    );
}

export function Bar({ share, over }) {
    return <div className={`bar${over ? ' over' : ''}`} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, share * 100)).toFixed(1)}%` }} /></div>;
}

/** Links to related cards with their live values, so every page leads to the next. */
export function Connected({ links }) {
    return (
        <section aria-label="Connected to">
            <h2 className="section-title">Connected to</h2>
            <div className="stack" style={{ gap: 6 }}>
                {links.map((l) => (
                    <Link key={l.to} to={l.to} viewTransition className="card between" style={{ minHeight: 56, padding: '8px 14px', textDecoration: 'none' }}>
                        <span style={{ fontWeight: 600 }}>{l.label}</span>
                        <span className="row tabular" style={{ gap: 6 }}>{l.value}<Icon name="chevron" size={16} /></span>
                    </Link>
                ))}
            </div>
        </section>
    );
}

export function SaveWarning({ error }) {
    if (!error) return null;
    return <div className="alert-box small" role="alert" style={{ marginBottom: 12 }}>{error}</div>;
}
