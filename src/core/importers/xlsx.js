/** Reads an .xlsx file into plain rows, on the user's own device. Nothing is uploaded. */
import { unzipSync, strFromU8 } from 'fflate';
import { addDays } from '../dates';

const decode = (s) => s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

function attrs(tag) {
    const out = {};
    for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = decode(m[2]);
    return out;
}

function textRuns(xml) {
    return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');
}

const BUILT_IN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function dateStyles(stylesXml) {
    if (!stylesXml) return [];
    const custom = {};
    for (const m of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) {
        const a = attrs(m[0]);
        custom[a.numFmtId] = a.formatCode;
    }
    const block = stylesXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/);
    if (!block) return [];
    return [...block[0].matchAll(/<xf\s[^>]*>/g)].map((m) => {
        const id = attrs(m[0]).numFmtId;
        if (BUILT_IN_DATE_FORMATS.has(Number(id))) return true;
        return /[dy]/i.test(String(custom[id] ?? '').replace(/"[^"]*"/g, ''));
    });
}

function serialToISO(serial) {
    return addDays('1899-12-30', Math.floor(serial));
}

/** @returns {Object<string, Array<Object<string, string|number>>>} sheet name to rows keyed by column letter */
export function readWorkbook(bytes) {
    const files = unzipSync(bytes);
    const read = (name) => (files[name] ? strFromU8(files[name]) : null);
    const workbook = read('xl/workbook.xml');
    if (!workbook) throw new Error('This is not a valid Excel file.');
    const shared = [...(read('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => (m[1] ? textRuns(m[1]) : ''));
    const isDate = dateStyles(read('xl/styles.xml'));
    const rels = {};
    for (const m of (read('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\s[^>]*>/g)) {
        const a = attrs(m[0]);
        rels[a.Id] = a.Target;
    }
    const sheets = {};
    for (const m of workbook.matchAll(/<sheet\s[^>]*>/g)) {
        const a = attrs(m[0]);
        const target = String(rels[a['r:id']] ?? '').replace(/^\//, '');
        const xml = read(target.startsWith('xl/') ? target : `xl/${target}`);
        if (!xml) continue;
        const rows = [];
        for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
            const cells = {};
            for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
                const ca = attrs(c[1]);
                const body = c[2] ?? '';
                const column = String(ca.r).replace(/\d/g, '');
                const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
                let value;
                if (ca.t === 's' && raw !== undefined) value = shared[Number(raw)];
                else if (ca.t === 'inlineStr') value = textRuns(body);
                else if (ca.t === 'str' && raw !== undefined) value = decode(raw);
                else if (raw !== undefined) {
                    const n = Number(raw);
                    value = isDate[Number(ca.s ?? 0)] && n > 20000 && n < 60000 ? serialToISO(n) : n;
                }
                if (value !== undefined && value !== '') cells[column] = value;
            }
            if (Object.keys(cells).length) rows.push(cells);
        }
        sheets[a.name] = rows;
    }
    return sheets;
}
