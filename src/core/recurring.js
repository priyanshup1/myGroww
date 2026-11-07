/** Bills and other payments that repeat, including yearly ones such as insurance premiums. */
import { addMonths, daysBetween, monthKey } from './dates';

const STEP = { monthly: 1, quarterly: 3, yearly: 12 };

function dueOn(year, monthIndex, day) {
    const last = new Date(year, monthIndex + 1, 0).getDate();
    const d = new Date(year, monthIndex, Math.min(day, last));
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Every due date for an item between two dates, inclusive. */
export function dueDates(item, from, to) {
    const step = STEP[item.frequency] ?? 1;
    const anchor = (item.dueMonth ?? 1) - 1;
    const dates = [];
    let cursor = `${monthKey(from)}-01`;
    while (cursor <= to) {
        const [y, m] = cursor.split('-').map(Number);
        const monthIndex = m - 1;
        if (((monthIndex - anchor) % step + step) % step === 0) {
            const due = dueOn(y, monthIndex, item.dueDay ?? 1);
            if (due >= from && due <= to) dates.push(due);
        }
        cursor = addMonths(cursor, 1);
    }
    return dates;
}

/** The monthly amount to put aside so a yearly or quarterly bill is never a shock. */
export function monthlySetAside(item) {
    const step = STEP[item.frequency] ?? 1;
    return step > 1 ? Math.ceil(item.amountPaise / step) : 0;
}

function isPaid(transactions, item, due) {
    return transactions.some((t) => t.recurringId === item.id && t.dueDate === due);
}

/**
 * Bills and SIPs due in a window, each marked paid or not.
 * A SIP counts as paid when any investment for that fund falls in its month.
 */
export function dueItems(state, from, to, today) {
    const items = [];
    state.recurring.forEach((r) => {
        dueDates(r, from, to).filter((due) => !r.startDate || due >= r.startDate).forEach((due) => {
            items.push({ key: `${r.id}|${due}`, kind: 'bill', item: r, name: r.name, amountPaise: r.amountPaise, due, paid: isPaid(state.transactions, r, due) });
        });
    });
    state.funds.filter((f) => f.monthlySipPaise > 0 && f.sipDay).forEach((f) => {
        dueDates({ frequency: 'monthly', dueDay: f.sipDay }, from, to).forEach((due) => {
            const paid = state.transactions.some((t) => t.type === 'investment' && t.fundId === f.id && monthKey(t.date) === monthKey(due));
            items.push({ key: `${f.id}|${due}`, kind: 'sip', item: f, name: `${f.name} SIP`, amountPaise: f.monthlySipPaise, due, paid });
        });
    });
    return items
        .map((d) => ({ ...d, daysAway: daysBetween(today, d.due), overdue: !d.paid && d.due < today }))
        .sort((a, b) => a.due.localeCompare(b.due));
}

/** The ledger record for marking a due item as paid. */
export function paymentFor(entry, today) {
    if (entry.kind === 'sip') {
        return { date: today, amountPaise: entry.amountPaise, type: 'investment', fundId: entry.item.id, category: entry.item.category, description: entry.name };
    }
    const r = entry.item;
    return {
        date: today,
        amountPaise: r.amountPaise,
        type: r.type ?? 'spend',
        account: r.account ?? 'debit',
        category: r.category || 'Bills',
        description: r.name,
        recurringId: r.id,
        dueDate: entry.due,
    };
}
