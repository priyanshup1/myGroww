/**
 * The ledger is the single source of truth: every rupee is one transaction,
 * and every number in the app is calculated from these records.
 */
import { isValidISO } from './dates';

export const TX_TYPES = {
    spend: 'Spending',
    income: 'Income',
    family_contribution: 'Family contribution',
    family_support: 'Family support',
    investment: 'Investment',
    savings: 'Savings',
    loan_emi: 'Loan EMI',
    insurance: 'Insurance',
    lent: 'Money lent',
    person_transfer: 'Transfer to a person',
    self_transfer: 'Own account transfer',
    card_bill: 'Card bill payment',
};

export const ACCOUNTS = { debit: 'Debit account', credit: 'Credit card' };

export const SOURCES = {
    bank_statement: 'Bank statement',
    card_statement: 'Card statement',
    manual: 'Added by you',
    chat: 'Typed in chat',
    screenshot: 'Payment screenshot',
    estimate: 'Estimated',
};

export const SPEND_CATEGORIES = [
    'Food', 'Dining', 'Groceries', 'Travel', 'Fuel', 'Transport', 'Vehicle', 'Rent', 'Bills', 'Shopping',
    'Apparel', 'Health', 'Personal Care', 'Household', 'Entertainment', 'Gifts', 'Religious', 'Education', 'Misc',
];

export const SIP_CATEGORIES = ['Index Funds', 'Flexi Cap', 'Small Cap', 'Large Cap', 'Gold ETF', 'Debt Fund', 'International', 'Other'];

export const EMERGENCY_FUND = 'Emergency Fund';

/** Returns a list of readable problems. An empty list means the record is valid. */
export function validateTx(tx) {
    const errors = [];
    if (!tx || typeof tx !== 'object') return ['This record is not a transaction.'];
    if (!tx.id) errors.push('It has no id.');
    if (!isValidISO(tx.date)) errors.push(`"${tx.date}" is not a real date.`);
    if (!Number.isInteger(tx.amountPaise) || tx.amountPaise <= 0) errors.push('The amount must be more than ₹0.');
    if (!['in', 'out'].includes(tx.flow)) errors.push('Money must be going in or out.');
    if (!TX_TYPES[tx.type]) errors.push(`"${tx.type}" is not a known transaction type.`);
    if (!ACCOUNTS[tx.account]) errors.push(`"${tx.account}" is not a known account.`);
    return errors;
}

function hash(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i += 1) h = (h * 33 + text.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

/** The same line imported twice gets the same id, so re-importing never duplicates it. */
export function stableId(prefix, tx, occurrence = 0) {
    return `${prefix}_${hash(`${tx.date}|${tx.description}|${tx.amountPaise}|${tx.flow}|${occurrence}`)}`;
}

export function newId() {
    return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createTx(input) {
    const tx = {
        id: input.id ?? newId(),
        date: input.date,
        amountPaise: input.amountPaise,
        flow: input.flow ?? (input.type === 'income' ? 'in' : 'out'),
        type: input.type ?? 'spend',
        account: input.account ?? 'debit',
        category: input.category ?? '',
        description: input.description ?? '',
        source: input.source ?? 'manual',
        note: input.note ?? '',
        oneOff: Boolean(input.oneOff),
        needsReview: Boolean(input.needsReview),
        reviewReason: input.reviewReason ?? '',
        fundId: input.fundId ?? null,
        goalId: input.goalId ?? null,
        recurringId: input.recurringId ?? null,
        dueDate: input.dueDate ?? null,
    };
    const errors = validateTx(tx);
    if (errors.length) throw new Error(errors.join(' '));
    return tx;
}

/** What a record adds to spending. Card bills, SIPs and transfers are always ₹0 here. */
export function spendEffect(tx) {
    if (tx.type !== 'spend') return 0;
    return tx.flow === 'out' ? tx.amountPaise : -tx.amountPaise;
}

/** Money leaving (+) or returning to (-) the debit account. Card purchases do not touch it until the bill is paid. */
export function debitOutEffect(tx) {
    if (tx.account !== 'debit' || tx.type === 'income') return 0;
    return tx.flow === 'out' ? tx.amountPaise : -tx.amountPaise;
}

export function netOut(txs, type) {
    return txs
        .filter((t) => t.type === type)
        .reduce((sum, t) => sum + (t.flow === 'out' ? t.amountPaise : -t.amountPaise), 0);
}

/** Lowercase merchant name without noise, used to remember a category once it is corrected. */
export function merchantKey(description) {
    return String(description ?? '')
        .toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .replace(/\b(mr|mrs|ms|pvt|ltd|upi)\b/g, ' ')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
