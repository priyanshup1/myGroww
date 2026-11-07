/** The saved app state, and the pure functions that change it. */
import { createTx, merchantKey, validateTx } from './ledger';

export const STATE_VERSION = 2;

export function emptyState() {
    return {
        version: STATE_VERSION,
        transactions: [],
        funds: [],
        goals: [],
        recurring: [],
        budgets: {},
        reviewedCycles: [],
        setupDone: false,
        merchantRules: {},
        dismissedDuplicates: [],
        plan: {
            salaryPaise: 0,
            familyContributionPaise: 0,
            emergencyMonths: 6,
        },
        card: { closeDay: 23, dueDay: 13 },
    };
}

export function addTx(state, input) {
    return { ...state, transactions: [createTx(input), ...state.transactions] };
}

export function updateTx(state, id, patch) {
    const transactions = state.transactions.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        const errors = validateTx(next);
        if (errors.length) throw new Error(errors.join(' '));
        return next;
    });
    return { ...state, transactions };
}

export function removeTx(state, id) {
    return { ...state, transactions: state.transactions.filter((t) => t.id !== id) };
}

export function setPlan(state, patch) {
    return { ...state, plan: { ...state.plan, ...patch } };
}

export function upsertFund(state, fund) {
    const exists = state.funds.some((f) => f.id === fund.id);
    return {
        ...state,
        funds: exists ? state.funds.map((f) => (f.id === fund.id ? { ...f, ...fund } : f)) : [...state.funds, fund],
    };
}

/** Removing a fund keeps its past investments: that money was still invested. */
export function removeFund(state, id) {
    return {
        ...state,
        funds: state.funds.filter((f) => f.id !== id),
        transactions: state.transactions.map((t) => (t.fundId === id ? { ...t, fundId: null } : t)),
    };
}

export function upsertById(state, key, item) {
    const list = state[key];
    const exists = list.some((x) => x.id === item.id);
    return { ...state, [key]: exists ? list.map((x) => (x.id === item.id ? { ...x, ...item } : x)) : [...list, item] };
}

export function removeById(state, key, id) {
    return { ...state, [key]: state[key].filter((x) => x.id !== id) };
}

/** Removing a goal keeps its money as ordinary savings, so nothing vanishes from your records. */
export function removeGoal(state, id) {
    return {
        ...state,
        goals: state.goals.filter((g) => g.id !== id),
        transactions: state.transactions.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
    };
}

export function setBudget(state, category, paise) {
    const budgets = { ...state.budgets };
    if (paise > 0) budgets[category] = paise;
    else delete budgets[category];
    return { ...state, budgets };
}

/** Corrects a category and remembers it for every other line from the same merchant. */
export function categoriseMerchant(state, id, category) {
    const target = state.transactions.find((t) => t.id === id);
    if (!target) return state;
    const key = merchantKey(target.description);
    return {
        ...state,
        merchantRules: key ? { ...state.merchantRules, [key]: category } : state.merchantRules,
        transactions: state.transactions.map((t) => {
            if (t.id === id) return { ...t, category, needsReview: false, reviewReason: '' };
            if (key && t.type === 'spend' && merchantKey(t.description) === key && (t.category === 'Misc' || !t.category)) {
                return { ...t, category };
            }
            return t;
        }),
    };
}

/** Adds imported records. An id already in the ledger is skipped, so importing twice is safe. */
export function mergeTransactions(state, incoming) {
    const known = new Set(state.transactions.map((t) => t.id));
    const fresh = incoming.filter((t) => !known.has(t.id)).map((t) => {
        const rule = t.type === 'spend' && (!t.category || t.category === 'Misc') ? state.merchantRules[merchantKey(t.description)] : null;
        return rule ? { ...t, category: rule } : t;
    });
    return {
        state: { ...state, transactions: [...fresh, ...state.transactions] },
        added: fresh.length,
        skipped: incoming.length - fresh.length,
    };
}
