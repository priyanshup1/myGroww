import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BackButton() {
    const navigate = useNavigate();
    return (
        <button
            className="btn btn-ghost btn-icon"
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
            ← Dashboard
        </button>
    );
}
