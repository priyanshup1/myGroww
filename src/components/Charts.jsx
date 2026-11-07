import { useState } from 'react';
import { formatINR } from '../core/money';

/**
 * Two-part stacked columns from one hue and one neutral, read by hovering or focusing a column.
 * The same values are also listed in text beneath for anyone not reading the bars.
 * @param {{label: string, s1: number, s2: number, tip: string}[]} data amounts in paise
 */
export function StackedColumns({ data, names, ariaLabel, defaultTip }) {
    const [active, setActive] = useState(null);
    const max = Math.max(1, ...data.map((d) => d.s1 + d.s2));
    const HEIGHT = 170;
    const px = (v) => `${Math.max(v > 0 ? 3 : 0, (v / max) * (HEIGHT - 4)).toFixed(1)}px`;
    const shown = active === null ? (defaultTip ?? '') : data[active].tip;
    return (
        <figure style={{ margin: 0 }}>
            <div className="chart-tip tabular" aria-live="polite">{shown}</div>
            <div className="chart" role="group" aria-label={ariaLabel}>
                {data.map((d, i) => (
                    <button key={d.label} type="button" className="chart-col" aria-label={d.tip} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(i)}>
                        {d.s2 > 0 && <i className="s2" style={{ height: px(d.s2) }} />}
                        {d.s1 > 0 && <i className="s1" style={{ height: px(d.s1) }} />}
                    </button>
                ))}
            </div>
            <div className="chart-labels" aria-hidden="true">{data.map((d) => <span key={d.label}>{d.label}</span>)}</div>
            <figcaption className="legend">
                <span><i style={{ background: 'var(--chart-1)' }} />{names[0]}</span>
                <span><i style={{ background: 'var(--chart-2)' }} />{names[1]}</span>
            </figcaption>
        </figure>
    );
}

/** Horizontal bars are the clearest way to compare categories, and need no colour coding. */
export function ShareBars({ rows, total }) {
    return (
        <div>
            {rows.map((r) => (
                <div key={r.name} className="list-row" style={{ display: 'block' }}>
                    <div className="between"><span>{r.name}</span><span className="tabular"><strong>{formatINR(r.amountPaise)}</strong> <span className="mute small">{total > 0 ? `${Math.round((r.amountPaise / total) * 100)}%` : ''}</span></span></div>
                    <div className="bar" aria-hidden="true"><i style={{ width: `${total > 0 ? (Math.max(0, r.amountPaise) / total) * 100 : 0}%` }} /></div>
                </div>
            ))}
        </div>
    );
}
