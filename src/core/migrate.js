/**
 * Moves data from the first version of the app into the ledger.
 * Old demo records are left behind, and the old keys stay in the browser untouched.
 */
import { addMonths, isValidISO, monthKey, parseFlexibleDate } from './dates';
import { EMERGENCY_FUND, createTx, stableId, validateTx } from './ledger';
import { toPaise } from './money';
import { STATE_VERSION, emptyState } from './state';

const DEMO_EXPENSE_IDS = new Set(['e1', 'e2', 'e3', 'e4', 'e5']);
const DEMO_FUND_IDS = new Set(['s1', 's2', 's3', 's4']);

const rupees = (v) => {
    const paise = toPaise(Number(v));
    return Number.isFinite(paise) && paise > 0 ? paise : 0;
};

function toStartDate(value) {
    if (/^\d{4}-\d{2}$/.test(String(value))) return `${value}-01`;
    return parseFlexibleDate(value);
}

/** @param {Object} old the old data by short key, such as income, expenses and sips */
export function migrateLegacy(old, today) {
    const state = emptyState();
    state.plan.salaryPaise = rupees(old.income);
    state.plan.familyContributionPaise = rupees(old.familyContribution);
    const txs = [];
    const add = (fields) => {
        const base = { source: 'manual', ...fields };
        txs.push(createTx({ ...base, id: stableId('old', base, txs.length) }));
    };

    (old.expenses ?? []).forEach((e) => {
        const paise = rupees(e.amount);
        if (DEMO_EXPENSE_IDS.has(e.id) || !paise || !isValidISO(e.date)) return;
        add({ date: e.date, amountPaise: paise, type: 'spend', category: e.category || 'Misc', description: e.notes || e.category || 'Expense' });
    });

    const log = old.monthlySIPLog ?? {};
    (old.sips ?? []).forEach((s) => {
        if (DEMO_FUND_IDS.has(s.id)) return;
        state.funds.push({ id: String(s.id), name: s.fundName || 'Fund', category: s.category || 'Other', monthlySipPaise: rupees(s.monthlySip), startDate: toStartDate(s.startDate) });
        const fields = { type: 'investment', fundId: String(s.id), category: s.category || 'Other' };
        const paid = Object.entries(log).filter(([, month]) => month?.[s.id]?.status === 'submitted' || month?.[s.id]?.status === 'saved');
        const start = toStartDate(s.startDate);
        if (rupees(s.lumpsum)) add({ ...fields, date: parseFlexibleDate(s.lumpsumDate) ?? start ?? today, amountPaise: rupees(s.lumpsum), description: `${s.fundName} lumpsum` });
        if (paid.length) {
            paid.forEach(([key, month]) => {
                const paise = rupees(month[s.id].amount);
                if (paise) add({ ...fields, date: `${key}-01`, amountPaise: paise, description: `${s.fundName} SIP` });
            });
        } else if (start && rupees(s.monthlySip)) {
            let months = 0;
            for (let d = start; d <= today; d = addMonths(d, 1)) months += 1;
            if (months) add({
                ...fields,
                date: start,
                amountPaise: rupees(s.monthlySip) * months,
                description: `${s.fundName} SIP estimate`,
                source: 'estimate',
                needsReview: true,
                reviewReason: `The old app assumed all ${months} SIPs were paid. Replace this with what you really paid.`,
            });
        }
    });

    (old.efMonthlyEntries ?? []).forEach((e) => {
        const paise = rupees(e.amount);
        if (!paise || !['saved', 'submitted'].includes(e.status) || !/^\d{4}-\d{2}$/.test(String(e.month))) return;
        add({ date: `${e.month}-01`, amountPaise: paise, type: 'savings', category: EMERGENCY_FUND, description: 'Emergency fund' });
    });

    const detailed = new Set(txs.filter((t) => t.type === 'spend').map((t) => monthKey(t.date)));
    Object.entries(old.history ?? {}).forEach(([key, entry]) => {
        const date = `${key}-01`;
        if (!isValidISO(date)) return;
        const spent = rupees(entry?.expenses);
        if (spent && !detailed.has(key)) {
            add({ date, amountPaise: spent, type: 'spend', category: 'Misc', description: 'Monthly total from old history', source: 'estimate', needsReview: true, reviewReason: 'This is a typed monthly total, not individual expenses.' });
        }
        const income = rupees(entry?.income);
        if (income) add({ date, amountPaise: income, flow: 'in', type: 'income', category: 'Salary', description: 'Salary from old history', source: 'estimate', needsReview: true, reviewReason: 'The exact salary date is not known.' });
    });

    state.transactions = txs;
    return state;
}

/** Reads the short keys of a v1 export or the old localStorage into the form migrateLegacy expects. */
export function legacyFromFlat(flat) {
    const history = {};
    Object.entries(flat).forEach(([key, value]) => {
        const m = key.match(/^history:monthly:(\d{4}-\d{2})$/);
        if (m) history[m[1]] = value;
    });
    return { ...flat, history };
}

const LEGACY_KEYS = ['income', 'familyContribution', 'expenses', 'sips', 'efMonthlyEntries', 'monthlySIPLog', 'moneyFlow'];

export function looksLegacy(data) {
    return Boolean(data) && typeof data === 'object' && !Array.isArray(data) && !data.state
        && (LEGACY_KEYS.some((k) => k in data) || Object.keys(data).some((k) => k.startsWith('history:')));
}

/**
 * Checks a backup completely before anything is changed.
 * @returns {{ok: true, state: Object} | {ok: false, errors: string[]}}
 */
export function readBackup(data, today) {
    if (looksLegacy(data)) return { ok: true, state: migrateLegacy(legacyFromFlat(data), today), legacy: true };
    if (!data || typeof data !== 'object' || data.app !== 'mygroww' || !data.state) {
        return { ok: false, errors: ['This file is not a myGroww backup, so nothing was changed.'] };
    }
    if (data.version > STATE_VERSION) return { ok: false, errors: ['This backup is from a newer version of myGroww.'] };
    const txs = data.state.transactions;
    if (!Array.isArray(txs)) return { ok: false, errors: ['This backup has no transaction list, so nothing was changed.'] };
    const errors = [];
    txs.forEach((t, i) => validateTx(t).forEach((e) => errors.push(`Record ${i + 1}: ${e}`)));
    if (errors.length) return { ok: false, errors: errors.slice(0, 10) };
    const base = emptyState();
    return {
        ok: true,
        state: { ...base, ...data.state, plan: { ...base.plan, ...data.state.plan }, card: { ...base.card, ...data.state.card } },
    };
}

export function makeBackup(state, exportedAt) {
    return { app: 'mygroww', version: STATE_VERSION, exportedAt, state };
}
