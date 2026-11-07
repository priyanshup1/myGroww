/* eslint-env node */
/** Draws the app icon (three connected cards) into PNG files, with no image tools needed. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, sum]);
}

const BG = [10, 10, 11];
const GOLD = [217, 178, 106];
const segDist = (px, py, ax, ay, bx, by) => {
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
};

function coverage(x, y) {
    const A = [0.32, 0.34]; const B = [0.68, 0.34]; const C = [0.5, 0.68];
    const r = 0.085; const w = 0.022;
    const d = Math.min(
        Math.hypot(x - A[0], y - A[1]) - r,
        Math.hypot(x - B[0], y - B[1]) - r,
        Math.hypot(x - C[0], y - C[1]) - r,
        segDist(x, y, ...A, ...C) - w,
        segDist(x, y, ...B, ...C) - w,
    );
    return d <= 0;
}

function png(size) {
    const SS = 4;
    const raw = Buffer.alloc((size * 3 + 1) * size);
    for (let y = 0; y < size; y += 1) {
        const row = y * (size * 3 + 1);
        raw[row] = 0;
        for (let x = 0; x < size; x += 1) {
            let hit = 0;
            for (let i = 0; i < SS; i += 1) for (let j = 0; j < SS; j += 1) if (coverage((x + (i + 0.5) / SS) / size, (y + (j + 0.5) / SS) / size)) hit += 1;
            const f = hit / (SS * SS);
            for (let k = 0; k < 3; k += 1) raw[row + 1 + x * 3 + k] = Math.round(BG[k] + (GOLD[k] - BG[k]) * f);
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(__dirname, '..', 'public');
fs.mkdirSync(out, { recursive: true });
[['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]].forEach(([name, size]) => fs.writeFileSync(path.join(out, name), png(size)));
fs.writeFileSync(path.join(out, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0A0A0B"/><path d="M32 34 50 68M68 34 50 68" stroke="#D9B26A" stroke-width="4.4"/><circle cx="32" cy="34" r="8.5" fill="#D9B26A"/><circle cx="68" cy="34" r="8.5" fill="#D9B26A"/><circle cx="50" cy="68" r="8.5" fill="#D9B26A"/></svg>\n');
