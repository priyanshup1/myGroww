/** Budgets, month comparisons, the monthly review and gentle reminders. */
import { addDays, daysBetween, formatDate } from './dates';
import { merchantKey, spendEffect } from './ledger';
import { formatINR } from './money';

export function budgetStatus(budgets, cycle) {
    const spentBy = Object.fromEntries(cycle.categories.map((c) => [c.name, c.amountPaise]));
    const names = [...new Set([...Object.keys(budgets), ...cycle.categories.map((c) => c.name)])];
    return names.map((name) => {
        const limitPaise = budgets[name] ?? 0;
        const spentPaise = spentBy[name] ?? 0;
        return { name, limitPaise, spentPaise, over: limitPaise > 0 && spentPaise > limitPaise, share: limitPaise > 0 ? spentPaise / limitPaise : 0 };
    }).sort((a, b) => b.spentPaise - a.spentPaise);
}

/** Change by category against another cycle, at the same point when `dayLimit` is given. */
export function compareCategories(cycle, previous, dayLimit = null) {
    if (!previous) return [];
    const prevTxs = previous.txs.filter((t) => t.type === 'spend' && !t.oneOff && (dayLimit === null || daysBetween(previous.cycle.start, t.date) <= dayLimit));
    const before = {};
    prevTxs.forEach((t) => { before[t.category || 'Misc'] = (before[t.category || 'Misc'] ?? 0) + spendEffect(t); });
    const now = {};
    cycle.txs.filter((t) => t.type === 'spend' && !t.oneOff).forEach((t) => { now[t.category || 'Misc'] = (now[t.category || 'Misc'] ?? 0) + spendEffect(t); });
    return [...new Set([...Object.keys(before), ...Object.keys(now)])]
        .map((name) => ({ name, nowPaise: now[name] ?? 0, beforePaise: before[name] ?? 0, changePaise: (now[name] ?? 0) - (before[name] ?? 0) }))
        .sort((a, b) => b.changePaise - a.changePaise);
}

export function topMerchants(txs, limit = 5) {
    const totals = {};
    txs.filter((t) => t.type === 'spend' && !t.oneOff).forEach((t) => {
        const key = merchantKey(t.description) || t.description;
        const row = totals[key] ?? { name: t.description, amountPaise: 0, count: 0 };
        row.amountPaise += spendEffect(t);
        row.count += 1;
        totals[key] = row;
    });
    return Object.values(totals).sort((a, b) => b.amountPaise - a.amountPaise).slice(0, limit);
}

/** The largest thing that grew, as a plain fact plus what cutting it could do for the top goal. */
export function spendLessIdea(cycle, previous, topGoalPlan) {
    if (!previous) return null;
    const day = daysBetween(cycle.cycle.start, cycle.cycle.end ?? addDays(cycle.cycle.start, 30));
    const up = compareCategories(cycle, previous, day).find((c) => c.changePaise > 0 && c.beforePaise > 0);
    if (!up) return null;
    const movePaise = Math.ceil(up.changePaise / 10000) * 10000;
    let effect = '';
    if (topGoalPlan && !topGoalPlan.done && topGoalPlan.paceMonths !== null && topGoalPlan.goal.monthlyPaise > 0) {
        const remaining = topGoalPlan.targetPaise - topGoalPlan.savedPaise;
        const faster = Math.ceil(remaining / (topGoalPlan.goal.monthlyPaise + movePaise));
        const saved = topGoalPlan.paceMonths - faster;
        if (saved > 0) effect = ` Moving ${formatINR(movePaise)} a month to ${topGoalPlan.goal.name} gets it ${saved} ${saved === 1 ? 'month' : 'months'} sooner.`;
    }
    return { category: up.name, changePaise: up.changePaise, text: `${up.name} is ${formatINR(up.changePaise)} higher than last cycle.${effect}` };
}

/** A finished cycle in plain sentences. */
export function cycleReview(cycle, previous) {
    const lines = [];
    const change = previous ? cycle.normalSpendPaise - previous.normalSpendPaise : null;
    lines.push({
        id: 'spend',
        title: `You spent ${formatINR(cycle.spendPaise)}`,
        detail: change === null
            ? 'This is your first cycle, so there is nothing to compare yet.'
            : `Normal spending was ${formatINR(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than the cycle before.`,
    });
    if (cycle.oneOffPaise > 0) lines.push({ id: 'oneoff', title: `${formatINR(cycle.oneOffPaise)} was one-offs`, detail: 'Kept apart from your normal month.' });
    if (cycle.categories[0]) lines.push({ id: 'top', title: `${cycle.categories[0].name} was your largest category`, detail: `${formatINR(cycle.categories[0].amountPaise)} of your spending.` });
    if (cycle.familyPaise > 0) lines.push({ id: 'family', title: `${formatINR(cycle.familyPaise)} went to family`, detail: 'Taken out first, before your own spending.' });
    lines.push({ id: 'built', title: `${formatINR(cycle.investedPaise + cycle.savedPaise)} went to your future`, detail: `${formatINR(cycle.investedPaise)} invested and ${formatINR(cycle.savedPaise)} saved.` });
    if (cycle.unexplainedPaise > 100000 && !cycle.verified) lines.push({ id: 'gap', title: `${formatINR(cycle.unexplainedPaise)} of salary is not explained`, detail: 'Some entries are probably missing. A bank statement would fill the gap.' });
    return lines;
}

/**
 * Short reminders for the home screen, most urgent first.
 * @param {{lastBackup?: string}} prefs
 */
export function buildNudges(s, state, today, prefs = {}) {
    const list = [];
    s.due.filter((d) => d.overdue).slice(0, 3).forEach((d) => list.push({ id: `over-${d.key}`, tone: 'red', text: `${d.name} was due ${formatDate(d.due)}`, entry: d }));
    s.due.filter((d) => !d.paid && d.daysAway >= 0 && d.daysAway <= 3).slice(0, 3).forEach((d) => list.push({ id: `soon-${d.key}`, tone: 'amber', text: `${d.name} is due ${d.daysAway === 0 ? 'today' : d.daysAway === 1 ? 'tomorrow' : `in ${d.daysAway} days`}`, entry: d }));
    const cardDue = daysBetween(today, s.lastStatement.due);
    if (s.transactions.some((t) => t.account === 'credit') && cardDue >= 0 && cardDue <= 7 && !s.transactions.some((t) => t.type === 'card_bill' && t.date > s.lastStatement.end)) {
        list.push({ id: 'card', tone: 'amber', text: `Your card bill should be due around ${formatDate(s.lastStatement.due)}`, to: '/settings' });
    }
    const lastCycleStart = s.cycles.length ? s.cycles[s.cycles.length - 1].cycle.start : null;
    if (state.plan.salaryPaise > 0 && (!lastCycleStart || daysBetween(lastCycleStart, today) > 33)) {
        list.push({ id: 'salary', tone: 'amber', text: 'Has your salary come in? Record it to start a new cycle.', action: 'salary' });
    }
    const dates = s.transactions.filter((t) => t.source === 'manual').map((t) => t.date).sort();
    if (s.transactions.length && dates.length && daysBetween(dates[dates.length - 1], today) >= 3) {
        list.push({ id: 'log', tone: 'amber', text: `Nothing added for ${daysBetween(dates[dates.length - 1], today)} days. Anything to log?`, action: 'add' });
    }
    if (s.transactions.length && (!prefs.lastBackup || daysBetween(prefs.lastBackup, today) >= 14)) {
        list.push({ id: 'backup', tone: 'amber', text: prefs.lastBackup ? 'It has been a while since your last backup.' : 'You have no backup yet. Browser data can be cleared.', to: '/settings' });
    }
    return list;
}
