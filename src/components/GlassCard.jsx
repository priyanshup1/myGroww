import React from 'react';

export default function GlassCard({ children, className = '', onClick, style }) {
    const clickable = !!onClick;
    return (
        <div
            className={`glass-card${clickable ? ' clickable' : ''} ${className}`}
            onClick={onClick}
            style={style}
        >
            {children}
        </div>
    );
}
