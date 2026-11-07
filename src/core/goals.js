/**
 * Goal and future maths. Every result uses assumptions the person chose.
 * These are estimates to plan with, not predictions or advice.
 */
import { addMonths, daysBetween } from './dates';

/** Whole months from `from` to `to`, at least 1 when `to` is in the future. */
export function monthsBetween(from, to) {
    if (to <= from) return 0;
    return Math.max(1, Math.round(daysBetween(from, to) / 30.44));
}

/** Monthly saving that reaches `targetPaise`, with returns compounding monthly. */
export function requiredMonthly(targetPaise, savedPaise, months, annualReturnPct = 0) {
    if (months <= 0) return Math.max(0, targetPaise - savedPaise);
    const r = annualReturnPct / 100 / 12;
    if (r === 0) return Math.max(0, Math.ceil((targetPaise - savedPaise) / months));
    const growth = (1 + r) ** months;
    const needed = targetPaise - savedPaise * growth;
    if (needed <= 0) return 0;
    return Math.ceil((needed * r) / (growth - 1));
}

const FOREVER = 1200;

/** Months to reach the target at a monthly saving. Null if it would never get there. */
export function monthsToReach(targetPaise, savedPaise, monthlyPaise, annualReturnPct = 0) {
    if (savedPaise >= targetPaise) return 0;
    const r = annualReturnPct / 100 / 12;
    if (monthlyPaise <= 0 && r === 0) return null;
    if (r === 0) return Math.ceil((targetPaise - savedPaise) / monthlyPaise);
    let balance = savedPaise;
    for (let m = 1; m <= FOREVER; m += 1) {
        balance = balance * (1 + r) + monthlyPaise;
        if (balance >= targetPaise) return m;
    }
    return null;
}

/** Where a balance could be after each year, split into money put in and possible growth. */
export function project(startPaise, monthlyPaise, years, annualReturnPct = 0) {
    const r = annualReturnPct / 100 / 12;
    const points = [];
    for (let y = 0; y <= years; y += 1) {
        const m = y * 12;
        const put = startPaise + monthlyPaise * m;
        const growth = r === 0 ? 1 : (1 + r) ** m;
        const value = r === 0 ? put : startPaise * growth + (monthlyPaise * (growth - 1)) / r;
        points.push({ year: y, putPaise: Math.round(put), valuePaise: Math.round(value), growthPaise: Math.round(value - put) });
    }
    return points;
}

/** What a price could be by a date, given yearly price rises. */
export function futurePrice(pricePaise, months, annualRisePct = 0) {
    return Math.round(pricePaise * (1 + annualRisePct / 100) ** (months / 12));
}

export function goalSaved(transactions, goal) {
    const contributions = transactions
        .filter((t) => t.goalId === goal.id)
        .reduce((sum, t) => sum + (t.flow === 'out' ? t.amountPaise : -t.amountPaise), 0);
    return (goal.openingPaise ?? 0) + contributions;
}

export function planGoal(goal, savedPaise, today) {
    const months = monthsBetween(today, goal.targetDate);
    const returnPct = goal.returnPct ?? 0;
    const targetPaise = futurePrice(goal.targetPaise, months, goal.priceRisePct ?? 0);
    const monthly = goal.monthlyPaise ?? 0;
    const paceMonths = monthsToReach(targetPaise, savedPaise, monthly);
    const paceWithReturns = monthsToReach(targetPaise, savedPaise, monthly, returnPct);
    const finish = (m) => (m === null ? null : addMonths(today, m));
    const onTrack = paceMonths !== null && paceMonths <= months;
    return {
        goal,
        savedPaise,
        targetPaise,
        months,
        progress: targetPaise > 0 ? Math.min(1, savedPaise / targetPaise) : 0,
        neededMonthlyPaise: requiredMonthly(targetPaise, savedPaise, months),
        neededWithReturnsPaise: requiredMonthly(targetPaise, savedPaise, months, returnPct),
        paceMonths,
        paceDate: finish(paceMonths),
        paceWithReturnsDate: finish(paceWithReturns),
        onTrack,
        done: savedPaise >= targetPaise,
    };
}

/** All goals together, including whether they compete for the same money. */
export function planGoals(state, today) {
    const plans = state.goals.map((g) => planGoal(g, goalSaved(state.transactions, g), today));
    const open = plans.filter((p) => !p.done);
    const neededPaise = open.reduce((sum, p) => sum + p.neededMonthlyPaise, 0);
    const plannedPaise = open.reduce((sum, p) => sum + (p.goal.monthlyPaise ?? 0), 0);
    return { plans, neededPaise, plannedPaise, shortfallPaise: Math.max(0, neededPaise - plannedPaise) };
}
