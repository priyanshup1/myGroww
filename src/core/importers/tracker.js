/**
 * Turns the debit account tracker workbook into ledger records.
 * Anything the sheet itself marks as unsure is imported but flagged for review, never silently trusted.
 */
import { parseFlexibleDate } from '../dates';
import { EMERGENCY_FUND, createTx, stableId } from '../ledger';
import { toPaise } from '../money';

const TYPE_BY_GROUP = {
    expense: 'spend',
    'family support': 'family_support',
    'family contribution': 'family_contribution',
    insurance: 'insurance',
    'loan emi': 'loan_emi',
    investment: 'investment',
    savings: 'savings',
    'personal transfers': 'person_transfer',
    'self transfer': 'self_transfer',
};

const SOURCE_BY_NAME = { chat: 'chat', screenshot: 'screenshot', 'bank statement': 'bank_statement' };

/** A single purchase this large is treated as a one-off, so it does not distort your normal month. */
const ONE_OFF_FROM_PAISE = 1000000;

const REVIEW_NOTE = /possible duplicate|please confirm|not confirmed|unconfirmed|not provided|assumed/i;
const LENDING = /lend/i;

function headerMap(row) {
    const map = {};
    Object.entries(row).forEach(([column, label]) => { map[String(label).trim().toLowerCase()] = column; });
    return map;
}

function textOf(rows) {
    return rows.map((r) => Object.values(r).join(' ')).join('\n');
}

function reviewFor(type, description, note) {
    if (REVIEW_NOTE.test(note)) return note;
    if (type === 'spend' && /no description/i.test(description)) return 'What was this spend for?';
    return '';
}

function ledgerRecords(rows, warnings) {
    const head = headerMap(rows[0] ?? {});
    const col = (row, name) => row[head[name]];
    if (!head.date || !head.description || !head.group || !head['amount (rs)']) {
        throw new Error('The Ledger sheet needs Date, Description, Group and Amount (Rs) columns.');
    }
    const seen = {};
    const records = [];
    rows.slice(1).forEach((row, i) => {
        const line = i + 2;
        const date = parseFlexibleDate(col(row, 'date'));
        const signed = Number(col(row, 'amount (rs)'));
        const group = String(col(row, 'group') ?? '').trim().toLowerCase();
        let type = TYPE_BY_GROUP[group];
        if (!date || !Number.isFinite(signed) || signed === 0 || !type) {
            warnings.push(`Ledger line ${line} was skipped: it has an unreadable date, amount or group.`);
            return;
        }
        const description = String(col(row, 'description') ?? '').trim();
        const note = String(col(row, 'notes') ?? '').trim();
        const category = String(col(row, 'category') ?? '').trim();
        if (type === 'person_transfer' && LENDING.test(`${description} ${note}`)) type = 'lent';
        const amountPaise = toPaise(Math.abs(signed));
        const base = {
            date,
            amountPaise,
            flow: signed < 0 ? 'in' : 'out',
            type,
            account: 'debit',
            description,
            category: type === 'savings' && /emergency/i.test(category) ? EMERGENCY_FUND : category,
            source: SOURCE_BY_NAME[String(col(row, 'source') ?? '').trim().toLowerCase()] ?? 'chat',
            note,
            oneOff: type === 'spend' && signed > 0 && amountPaise >= ONE_OFF_FROM_PAISE,
        };
        const reason = reviewFor(type, description, note);
        const key = `${date}|${description}|${amountPaise}|${base.flow}`;
        seen[key] = (seen[key] ?? 0) + 1;
        records.push(createTx({
            ...base,
            id: stableId('trk', base, seen[key] - 1),
            needsReview: Boolean(reason),
            reviewReason: reason,
        }));
    });
    return records;
}

/** Salary is not a ledger line in the tracker, so it comes from the cycle start dates on the Summary sheet. */
function salaryRecords(summaryRows, notesText, year, warnings) {
    const assumed = notesText.match(/Rs\s*([\d,]+)\s*was used as the opening balance/i);
    const fallback = assumed ? toPaise(assumed[1]) : 0;
    const confirmed = {};
    for (const m of notesText.matchAll(/salary(?:\s+credit)?(?:\s+of)?\s+(?:Rs\s*([\d,]+)\s+was credited on\s+([A-Z][a-z]{2} \d{1,2})|on ([A-Z][a-z]{2} \d{1,2}) per the bank was Rs\s*([\d,]+))/gi)) {
        const date = parseFlexibleDate(m[2] ?? m[3], year);
        if (date) confirmed[date] = toPaise(m[1] ?? m[4]);
    }
    const records = [];
    summaryRows.forEach((row) => {
        const cycle = String(row.A ?? '');
        const period = String(row.B ?? '');
        const start = period.match(/^(\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+to/);
        if (!/^cycle\s+\d/i.test(cycle) || !start) return;
        const date = parseFlexibleDate(start[1]);
        const amountPaise = confirmed[date] ?? fallback;
        if (!date || !amountPaise) {
            warnings.push(`No salary amount was found for ${cycle}.`);
            return;
        }
        const known = Boolean(confirmed[date]);
        const base = { date, amountPaise, flow: 'in', type: 'income', account: 'debit', category: 'Salary', description: 'Salary' };
        records.push(createTx({
            ...base,
            id: stableId('trk', base),
            source: known ? 'bank_statement' : 'estimate',
            needsReview: !known,
            reviewReason: known ? '' : 'Salary amount and date are taken from the tracker. Confirm them from your bank statement.',
        }));
    });
    return records;
}

/** Card bill payments appear as "Jun 11 Rs 22,876; Jul 8 Rs 9,000" in the tracker's notes. */
function cardBillRecords(summaryRows, year) {
    const text = textOf(summaryRows);
    const payment = /([A-Z][a-z]{2} \d{1,2}) Rs\s*[\d,]+/;
    const line = text.split('\n').find((l) => /credit card bill payments/i.test(l) && payment.test(l)) ?? '';
    const records = [];
    for (const m of line.matchAll(/([A-Z][a-z]{2} \d{1,2}) Rs\s*([\d,]+)/g)) {
        const date = parseFlexibleDate(m[1], year);
        const base = { date, amountPaise: toPaise(m[2]), flow: 'out', type: 'card_bill', account: 'debit', category: 'Card bill', description: 'Credit card bill payment' };
        records.push(createTx({ ...base, id: stableId('trk', base), source: 'chat' }));
    }
    return records;
}

export function importTracker(sheets) {
    if (!sheets.Ledger) throw new Error('This workbook has no Ledger sheet, so it does not look like the debit tracker.');
    const warnings = [];
    const ledger = ledgerRecords(sheets.Ledger, warnings);
    const year = Number((ledger[0]?.date ?? '').slice(0, 4)) || undefined;
    const notesText = `${textOf(sheets.Summary ?? [])}\n${textOf(sheets.Notes ?? [])}`;
    const salary = salaryRecords(sheets.Summary ?? [], notesText, year, warnings);
    const bills = cardBillRecords(sheets.Summary ?? [], year);
    if (!salary.length) warnings.push('No salary dates were found, so cycles will fall back to calendar months.');
    return { transactions: [...salary, ...bills, ...ledger], warnings };
}
