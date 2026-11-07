/** Reads a CSV of transactions, such as a card statement. Bad rows are reported, never guessed at. */
import { parseFlexibleDate } from '../dates';
import { ACCOUNTS, SOURCES, TX_TYPES, createTx, stableId } from '../ledger';
import { toPaise } from '../money';

export function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const source = String(text).replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '');
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (quoted) {
            if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && source[i + 1] === '\n') i += 1;
            row.push(cell); cell = '';
            if (row.some((c) => c.trim() !== '')) rows.push(row);
            row = [];
        } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    return rows;
}

const ALIASES = {
    date: ['date', 'transaction date', 'txn date', 'value date'],
    description: ['description', 'narration', 'particulars', 'details', 'merchant'],
    amount: ['amount', 'amount (rs)', 'amount (inr)', 'amt'],
    category: ['category'],
    account: ['account'],
    type: ['type'],
    flow: ['flow', 'cr/dr', 'dr/cr'],
    source: ['source'],
    note: ['note', 'notes'],
    oneoff: ['one-off', 'oneoff', 'one off'],
    review: ['review', 'needs review'],
};

function findColumns(header) {
    const cols = {};
    const names = header.map((h) => h.trim().toLowerCase());
    Object.entries(ALIASES).forEach(([key, options]) => {
        const at = names.findIndex((n) => options.includes(n));
        if (at !== -1) cols[key] = at;
    });
    return cols;
}

/**
 * @param {string} text the CSV file's contents
 * @param {{account?: string, source?: string}} defaults used for columns the file does not have
 */
export function importCSV(text, { account = 'credit', source = 'card_statement' } = {}) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('This CSV has no transactions in it.');
    const cols = findColumns(rows[0]);
    if (cols.date === undefined || cols.description === undefined || cols.amount === undefined) {
        throw new Error('The CSV needs Date, Description and Amount columns.');
    }
    const warnings = [];
    const seen = {};
    const transactions = [];
    rows.slice(1).forEach((row, i) => {
        const line = i + 2;
        const get = (key) => (cols[key] === undefined ? '' : String(row[cols[key]] ?? '').trim());
        const date = parseFlexibleDate(get('date'));
        const creditMark = /\bcr\b/i.test(get('amount')) || /^c/i.test(get('flow')) || /^in$/i.test(get('flow'));
        const paise = toPaise(get('amount').replace(/\b(cr|dr)\b/gi, ''));
        if (!date || !Number.isFinite(paise) || paise === 0) {
            warnings.push(`Line ${line} was skipped: "${get('date')}" or "${get('amount')}" could not be read.`);
            return;
        }
        const typeText = get('type');
        const type = TX_TYPES[typeText] ? typeText : 'spend';
        const accountText = get('account').toLowerCase();
        const sourceText = get('source').toLowerCase();
        const reason = get('review');
        const base = {
            date,
            amountPaise: Math.abs(paise),
            flow: paise < 0 || creditMark ? 'in' : 'out',
            type,
            account: ACCOUNTS[accountText] ? accountText : account,
            category: get('category') || 'Misc',
            description: get('description'),
            source: SOURCES[sourceText] ? sourceText : source,
            note: get('note'),
            oneOff: /^(y|yes|true|1)$/i.test(get('oneoff')),
        };
        const key = `${date}|${base.description}|${base.amountPaise}|${base.flow}`;
        seen[key] = (seen[key] ?? 0) + 1;
        transactions.push(createTx({ ...base, id: stableId('csv', base, seen[key] - 1), needsReview: Boolean(reason), reviewReason: reason }));
    });
    return { transactions, warnings };
}
