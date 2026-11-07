/**
 * Two different kinds of cycle exist, and they are never mixed:
 *  - Salary cycle: one salary credit until the day before the next. Budgets use this.
 *  - Card statement cycle: set by the bank's closing date. Only card bills use this.
 */
import { addDays, addMonths, daysBetween, monthKey } from './dates';

function isSalary(tx) {
    return tx.type === 'income' && tx.flow === 'in' && String(tx.category).toLowerCase() === 'salary';
}

export function buildSalaryCycles(transactions) {
    const dates = [...new Set(transactions.filter(isSalary).map((t) => t.date))].sort();
    return dates.map((start, i) => ({
        id: `salary-${start}`,
        kind: 'salary',
        index: i + 1,
        start,
        end: dates[i + 1] ? addDays(dates[i + 1], -1) : null,
    }));
}

/** The cycle holding `date`. With no salary recorded it falls back to that calendar month. */
export function cycleFor(cycles, date) {
    const found = cycles.find((c) => date >= c.start && (c.end === null || date <= c.end));
    if (found) return found;
    const month = monthKey(date);
    const start = `${month}-01`;
    return { id: `month-${month}`, kind: 'calendar', index: null, start, end: addDays(addMonths(start, 1), -1) };
}

export function inCycle(tx, cycle, today) {
    const end = cycle.end ?? today;
    return tx.date >= cycle.start && tx.date <= end;
}

/** Days left including today, up to the expected next salary. Always at least 1. */
export function daysLeftInCycle(cycle, today) {
    const nextStart = cycle.end ? addDays(cycle.end, 1) : addMonths(cycle.start, 1);
    return Math.max(1, daysBetween(today, nextStart));
}

/** The statement cycle holding `date`. Closing on the 23rd means 24 Aug to 23 Sep, due the next month. */
export function statementCycleFor(date, { closeDay = 23, dueDay = 13 } = {}) {
    const day = Number(date.slice(8, 10));
    const firstOfMonth = `${monthKey(date)}-01`;
    const closeMonth = day > closeDay ? addMonths(firstOfMonth, 1) : firstOfMonth;
    const pad = (n) => String(n).padStart(2, '0');
    const end = `${monthKey(closeMonth)}-${pad(closeDay)}`;
    const start = addDays(addMonths(end, -1), 1);
    const due = `${monthKey(addMonths(closeMonth, 1))}-${pad(dueDay)}`;
    return { id: `statement-${end}`, kind: 'statement', start, end, due };
}
