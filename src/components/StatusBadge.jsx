import React from 'react';

const ICONS = { green: '●', amber: '◆', red: '▲' };

export default function StatusBadge({ status = 'green', label }) {
    return (
        <span className={`status-badge ${status}`}>
            <span>{ICONS[status]}</span>
            {label}
        </span>
    );
}
