import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { usePrefs } from '../prefs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TRAVEL_PX_PER_SECOND = 380;
const SHORTEST_TRIP = 0.5;
const REST_PX_PER_SECOND = 22;
const REST_MIN_LINE = 70;
const REST_PAUSE_PX = 140;
const TAIL_PX = 34;
const SPRITE = 48;
let introPlayed = false;

function polyline(points) {
    const out = [];
    const radius = 12;
    points.forEach((p, i) => {
        if (i === 0 || i === points.length - 1) { out.push(p); return; }
        const a = points[i - 1];
        const b = points[i + 1];
        const la = Math.hypot(p[0] - a[0], p[1] - a[1]);
        const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
        const r = Math.min(radius, la / 2, lb / 2);
        const s0 = [p[0] + ((a[0] - p[0]) / la) * r, p[1] + ((a[1] - p[1]) / la) * r];
        const s1 = [p[0] + ((b[0] - p[0]) / lb) * r, p[1] + ((b[1] - p[1]) / lb) * r];
        for (let k = 0; k <= 8; k += 1) {
            const u = k / 8;
            const v = 1 - u;
            out.push([v * v * s0[0] + 2 * v * u * p[0] + u * u * s1[0], v * v * s0[1] + 2 * v * u * p[1] + u * u * s1[1]]);
        }
    });
    const len = [0];
    for (let j = 1; j < out.length; j += 1) len.push(len[j - 1] + Math.hypot(out[j][0] - out[j - 1][0], out[j][1] - out[j - 1][1]));
    return { pts: out, len, total: len[len.length - 1], heat: 0 };
}

function pointAt(edge, fraction) {
    const d = clamp(fraction, 0, 1) * edge.total;
    let i = 1;
    while (i < edge.len.length - 1 && edge.len[i] < d) i += 1;
    const seg = edge.len[i] - edge.len[i - 1] || 1;
    const u = (d - edge.len[i - 1]) / seg;
    const a = edge.pts[i - 1];
    const b = edge.pts[i];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/** A soft dot drawn once and reused, because live blur on every dot is too slow on a phone. */
function makeGlow(colour) {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE;
    canvas.height = SPRITE;
    const g = canvas.getContext('2d');
    const gradient = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(0.28, colour);
    gradient.addColorStop(0.42, `${colour}66`);
    gradient.addColorStop(1, `${colour}00`);
    g.fillStyle = gradient;
    g.fillRect(0, 0, SPRITE, SPRITE);
    return canvas;
}

/**
 * Draws the live lines behind the cards. Cards stay ordinary links and this layer only
 * decorates them, so the page works fully without it.
 */
export const MoneyMap = forwardRef(function MoneyMap({ children }, ref) {
    const root = useRef(null);
    const canvas = useRef(null);
    const edges = useRef({});
    const comets = useRef([]);
    const prefs = usePrefs();
    const look = useRef({ line: '255,255,255', glow: null });

    useImperativeHandle(ref, () => ({
        /** Sends light along a line, then calls back when it arrives. */
        send(name, onArrive) {
            if (reduced() || !edges.current[name]) { onArrive?.(); return; }
            comets.current.push({ name, p: 0, onArrive });
        },
        pulse(id) {
            const el = root.current?.querySelector(`[data-node="${id}"]`);
            if (!el?.animate || reduced()) return;
            el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)', offset: 0.35 }, { transform: 'translateY(0)' }], { duration: 620, easing: 'cubic-bezier(.23,1,.32,1)' });
        },
    }), []);

    useEffect(() => {
        const style = getComputedStyle(document.documentElement);
        const colour = style.getPropertyValue('--comet').trim();
        look.current = { line: style.getPropertyValue('--line-rgb').trim(), colour, glow: makeGlow(colour) };
    }, [prefs.theme, prefs.mode]);

    useEffect(() => {
        const el = root.current;
        const cv = canvas.current;
        const c = cv.getContext('2d');
        let W = 0;
        let H = 0;
        /* Layout boxes, not on-screen boxes: an entrance animation must not shift the lines. */
        const box = (id) => {
            const node = el.querySelector(`[data-node="${id}"]`);
            const grid = node.offsetParent;
            const left = grid.offsetLeft + node.offsetLeft;
            const top = grid.offsetTop + node.offsetTop;
            return { l: left, r: left + node.offsetWidth, t: top, b: top + node.offsetHeight, cx: left + node.offsetWidth / 2, cy: top + node.offsetHeight / 2 };
        };
        function layout() {
            const d = Math.min(window.devicePixelRatio || 1, 2);
            W = el.offsetWidth;
            H = el.offsetHeight;
            cv.width = Math.round(W * d);
            cv.height = Math.round(H * d);
            c.setTransform(d, 0, 0, d, 0, 0);
            const sal = box('salary'); const fam = box('family'); const bil = box('bills'); const sip = box('sips');
            const gol = box('goals'); const spd = box('spend'); const top = box('topgoal'); const saf = box('safety');
            const L = 9; const R = W - 9; const heat = {};
            Object.entries(edges.current).forEach(([k, e]) => { heat[k] = e.heat; });
            edges.current = {
                family: polyline([[fam.cx, sal.b], [fam.cx, fam.t]]),
                bills: polyline([[bil.cx, sal.b], [bil.cx, bil.t]]),
                sips: polyline([[sal.l, sal.cy], [L, sal.cy], [L, sip.cy], [sip.l, sip.cy]]),
                goals: polyline([[sal.r, sal.cy], [R, sal.cy], [R, gol.cy - 12], [gol.r, gol.cy - 12]]),
                spend: polyline([[W / 2, sal.b], [W / 2, spd.t]]),
                spendToGoals: polyline([[gol.cx, spd.t], [gol.cx, gol.b]]),
                goalsToTop: polyline([[gol.r, gol.cy + 12], [R, gol.cy + 12], [R, top.cy], [top.r, top.cy]]),
                spendToSafety: polyline([[saf.cx, spd.b], [saf.cx, saf.t]]),
                spendToTop: polyline([[top.cx, spd.b], [top.cx, top.t]]),
            };
            Object.keys(heat).forEach((k) => { if (edges.current[k]) edges.current[k].heat = heat[k]; });
        }
        layout();
        const observer = new ResizeObserver(layout);
        observer.observe(el);

        function comet(edge, p, radius, alpha) {
            const { glow, colour } = look.current;
            if (!glow) return;
            /* A smooth tapered tail, then one soft head. */
            const STEPS = 14;
            const tail = Math.min(TAIL_PX, edge.total * 0.8) / edge.total;
            c.strokeStyle = colour;
            c.lineCap = 'round';
            for (let i = STEPS; i > 0; i -= 1) {
                const a = pointAt(edge, Math.max(0, p - (tail * i) / STEPS));
                const b = pointAt(edge, Math.max(0, p - (tail * (i - 1)) / STEPS));
                const fade = 1 - i / (STEPS + 1);
                c.globalAlpha = alpha * fade * fade;
                c.lineWidth = Math.max(0.6, radius * 0.9 * fade);
                c.beginPath();
                c.moveTo(a[0], a[1]);
                c.lineTo(b[0], b[1]);
                c.stroke();
            }
            const head = pointAt(edge, p);
            const size = radius * 5;
            c.globalAlpha = alpha;
            c.drawImage(glow, head[0] - size / 2, head[1] - size / 2, size, size);
            c.globalAlpha = 1;
            c.lineCap = 'butt';
        }

        const still = reduced();
        let reveal = still || introPlayed ? 1.6 : 0;
        introPlayed = true;
        let time = 0;
        let last = performance.now();
        let raf = 0;
        let onScreen = true;
        const seen = new IntersectionObserver((e) => { onScreen = e[0].isIntersecting; });
        seen.observe(el);
        function frame(now) {
            raf = requestAnimationFrame(frame);
            const dt = Math.min(0.033, (now - last) / 1000);
            last = now;
            if (!onScreen || document.hidden) return;
            time += dt;
            reveal = Math.min(1.6, reveal + dt / 1.1);
            c.clearRect(0, 0, W, H);
            /* The intro draws outward from salary, one line after another. */
            Object.values(edges.current).forEach((e, idx) => {
                e.heat = Math.max(0, e.heat - dt * 0.9);
                const eased = 1 - (1 - clamp(reveal - idx * 0.07, 0, 1)) ** 3;
                if (eased <= 0) return;
                c.beginPath();
                for (let i = 0; i < e.pts.length; i += 1) {
                    if (e.len[i] > e.total * eased) { const q = pointAt(e, eased); c.lineTo(q[0], q[1]); break; }
                    if (i === 0) c.moveTo(e.pts[i][0], e.pts[i][1]); else c.lineTo(e.pts[i][0], e.pts[i][1]);
                }
                c.strokeStyle = `rgba(${look.current.line},${(0.34 + e.heat * 0.5).toFixed(2)})`;
                c.lineWidth = 1.25 + e.heat * 1;
                c.stroke();
                /* At rest, light moves only along the long lines, with a pause, so it never flickers beside the numbers. */
                if (!still && reveal >= 1.6 && e.total >= REST_MIN_LINE) {
                    const span = e.total + REST_PAUSE_PX;
                    const at = (time * REST_PX_PER_SECOND + idx * 97) % span;
                    if (at <= e.total) comet(e, at / e.total, 1.9, 0.7);
                }
            });
            const arrived = [];
            comets.current = comets.current.filter((d) => {
                const e = edges.current[d.name];
                if (!e) return false;
                d.p += dt / Math.max(SHORTEST_TRIP, e.total / TRAVEL_PX_PER_SECOND);
                e.heat = Math.min(1, e.heat + dt * 5);
                comet(e, Math.min(1, d.p), 4, 1);
                if (d.p >= 1) { if (d.onArrive) arrived.push(d.onArrive); return false; }
                return true;
            });
            arrived.forEach((fn) => fn());
        }
        raf = requestAnimationFrame(frame);
        return () => { cancelAnimationFrame(raf); observer.disconnect(); seen.disconnect(); };
    }, []);

    return (
        <div className="map" ref={root}>
            <canvas ref={canvas} aria-hidden="true" />
            <div className="map-grid">{children}</div>
        </div>
    );
});
