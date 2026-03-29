import React, { useState, useRef, useEffect } from 'react';

export function formatRupee(val) {
    const num = Number(val) || 0;
    return '₹' + num.toLocaleString('en-IN');
}

export default function EditableNumber({ value, onChange, className = '', style }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef(null);

    function startEdit() {
        setDraft(String(value));
        setEditing(true);
    }

    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.select();
    }, [editing]);

    function commit() {
        const num = parseFloat(draft.replace(/,/g, ''));
        if (!isNaN(num) && num >= 0) onChange(num);
        setEditing(false);
    }

    function handleKey(e) {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
    }

    if (editing) {
        return (
            <input
                ref={inputRef}
                className={`editable-number-input ${className}`}
                style={style}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={handleKey}
                type="text"
                inputMode="numeric"
            />
        );
    }

    return (
        <span
            className={`editable-number-wrap ${className}`}
            style={style}
            onClick={startEdit}
            title="Click to edit"
        >
            <span className="editable-number-display">{formatRupee(value)}</span>
            <span style={{ fontSize: '0.75em', opacity: 0.5, color: 'var(--accent-mint)' }}>✎</span>
        </span>
    );
}
