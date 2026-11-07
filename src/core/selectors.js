/**
 * Every number shown in the app comes from here, so no two pages can disagree.
 * All amounts are in paise.
 */
import { addDays, addMonths, daysBetween, formatDate, monthKey } from './dates';
import { buildSalaryCycles, cycleFor, daysLeftInCycle, inCycle, statementCycleFor } from './cycles';
import { EMERGENCY_FUND, debitOutEffect, netOut, spendEffect } from './ledger';
import { formatINR } from './money';
import { planGoals } from './goals';
import { dueItems, monthlySetAside } from './recurring';
import { budgetStatus, buildNudges, spendLessIdea } from './insights';

const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0);
const VERIFIED = ['bank_statement', 'card_statement'];

function spendOf(txs, { includeOneOffs = true } = {}) {
    return sum(txs.filter((t) => includeOneOffs || !t.oneOff), spendEffect);
}

function categoriesOf(txs) {
    const totals = {};
    txs.filter((t) => t.type === 'spend').forEach((t) => {
        const name = t.category || 'Misc';
        totals[name] = (totals[name] ?? 0) + spendEffect(t);
    });
    return Object.entries(totals).map(([name, amountPaise]) => ({ name, amountPaise })).sort((a, b) => b.amountPaise - a.amountPaise);
}

/** One cycle's figures, including how much of its salary the records explain. */
export function cycleSummary(state, cycle, today) {
    const txs = state.transactions.filter((t) => inCycle(t, cycle, today));
    const actualIncome = netOut(txs, 'income') * -1;
    const incomePaise = actualIncome || state.plan.salaryPaise;
    const debitOutPaise = sum(txs, debitOutEffect);
    const lines = txs.filter((t) => t.type !== 'income');
    const verifiedLines = lines.filter((t) => VERIFIED.includes(t.source)).length;
    return {
        cycle,
        txs,
        incomePaise,
        incomeIsExpected: !actualIncome,
        spendPaise: spendOf(txs),
        normalSpendPaise: spendOf(txs, { includeOneOffs: false }),
        oneOffPaise: spendOf(txs) - spendOf(txs, { includeOneOffs: false }),
        familyPaise: netOut(txs, 'family_contribution') + netOut(txs, 'family_support'),
        familyContributionPaise: netOut(txs, 'family_contribution'),
        familySupportPaise: netOut(txs, 'family_support'),
        investedPaise: netOut(txs, 'investment'),
        savedPaise: netOut(txs, 'savings'),
        loanPaise: netOut(txs, 'loan_emi'),
        insurancePaise: netOut(txs, 'insurance'),
        transfersPaise: netOut(txs, 'lent') + netOut(txs, 'person_transfer'),
        selfTransferPaise: netOut(txs, 'self_transfer'),
        cardBillPaise: netOut(txs, 'card_bill'),
        debitOutPaise,
        /** Salary the records do not explain. A large figure means entries are missing. */
        unexplainedPaise: incomePaise - debitOutPaise,
        verified: lines.length > 0 && verifiedLines / lines.length >= 0.8,
        categories: categoriesOf(txs),
    };
}

function nextCycleStart(cycle) {
    return cycle.end ? addDays(cycle.end, 1) : addMonths(cycle.start, 1);
}

function detectDuplicates(state) {
    const dismissed = new Set(state.dismissedDuplicates);
    const spends = state.transactions.filter((t) => t.type === 'spend' && t.flow === 'out').slice().sort((a, b) => a.date.localeCompare(b.date));
    const found = [];
    spends.forEach((a, i) => {
        for (let j = i + 1; j < spends.length; j += 1) {
            const b = spends[j];
            const gap = daysBetween(a.date, b.date);
            if (gap > 1) break;
            const sameDay = gap === 0 && a.description === b.description;
            const nearby = gap === 1 && a.amountPaise >= 10000;
            if (a.amountPaise === b.amountPaise && (sameDay || nearby)) {
                const key = `${a.id}|${b.id}`;
                if (!dismissed.has(key)) found.push({ key, a, b });
            }
        }
    });
    return found;
}

function emergencyFund(state, closed) {
    const balancePaise = netOutCategory(state.transactions, 'savings', EMERGENCY_FUND);
    const reliable = closed.filter((c) => c.verified);
    const basis = (reliable.length ? reliable : closed).slice(-3);
    const typicalSpend = basis.length ? sum(basis, (c) => c.normalSpendPaise) / basis.length : 0;
    const monthlyNeedPaise = Math.round(state.plan.familyContributionPaise + typicalSpend);
    const months = monthlyNeedPaise > 0 ? balancePaise / monthlyNeedPaise : null;
    const targetPaise = monthlyNeedPaise * state.plan.emergencyMonths;
    return {
        balancePaise,
        monthlyNeedPaise,
        months,
        targetPaise,
        gapPaise: Math.max(0, targetPaise - balancePaise),
        status: months === null ? 'unknown' : months >= state.plan.emergencyMonths ? 'green' : months >= 3 ? 'amber' : 'red',
    };
}

function netOutCategory(txs, type, category) {
    return netOut(txs.filter((t) => t.category === category), type);
}

function investments(state) {
    const txs = state.transactions.filter((t) => t.type === 'investment');
    const fundById = Object.fromEntries(state.funds.map((f) => [f.id, f]));
    const totals = {};
    const byFund = {};
    txs.forEach((t) => {
        const amount = t.flow === 'out' ? t.amountPaise : -t.amountPaise;
        const fund = fundById[t.fundId];
        const category = fund?.category ?? 'Not assigned to a fund';
        totals[category] = (totals[category] ?? 0) + amount;
        if (fund) byFund[fund.id] = (byFund[fund.id] ?? 0) + amount;
    });
    const totalPaise = netOut(txs, 'investment');
    const plannedMonthlyPaise = sum(state.funds, (f) => f.monthlySipPaise || 0);
    return {
        totalPaise,
        plannedMonthlyPaise,
        byFund,
        categories: Object.entries(totals).map(([name, amountPaise]) => ({ name, amountPaise })).sort((a, b) => b.amountPaise - a.amountPaise),
    };
}

/** Every calendar month with activity, for history and trends. */
function monthlyHistory(state) {
    const months = {};
    state.transactions.forEach((t) => {
        const key = monthKey(t.date);
        months[key] = months[key] ?? { key, spendPaise: 0, normalSpendPaise: 0, incomePaise: 0, investedPaise: 0, savedPaise: 0 };
        const m = months[key];
        const amount = t.flow === 'out' ? t.amountPaise : -t.amountPaise;
        m.spendPaise += spendEffect(t);
        if (!t.oneOff) m.normalSpendPaise += spendEffect(t);
        if (t.type === 'income') m.incomePaise -= amount;
        if (t.type === 'investment') m.investedPaise += amount;
        if (t.type === 'savings') m.savedPaise += amount;
    });
    return Object.values(months).sort((a, b) => a.key.localeCompare(b.key));
}

function buildInsights(s) {
    const list = [];
    const c = s.current;
    if (!s.transactions.length) {
        return [{ id: 'empty', status: 'amber', title: 'No data yet', detail: 'Import your statements or add your first expense to see your numbers here.' }];
    }
    list.push(s.safeToSpendPaise < 0
        ? { id: 'safe', status: 'red', title: `${formatINR(-s.safeToSpendPaise)} over this cycle`, detail: 'Your planned payments and card spending are more than the salary left this cycle.' }
        : { id: 'safe', status: 'green', title: `${formatINR(s.safeToSpendPaise)} safe to spend`, detail: `About ${formatINR(s.dailyPaise)} a day for the next ${s.daysLeft} days.` });
    const ef = s.emergency;
    list.push(ef.months === null
        ? { id: 'emergency', status: 'amber', title: 'Emergency cover not known yet', detail: 'Set your family contribution or import more data to calculate it.' }
        : { id: 'emergency', status: ef.status, title: `Emergency fund covers ${ef.months.toFixed(1)} months`, detail: `${formatINR(ef.balancePaise)} saved. Your ${s.plan.emergencyMonths}-month target is ${formatINR(ef.targetPaise)}.` });
    if (s.cardDataGap) {
        list.push({ id: 'card-gap', status: 'amber', title: `Card data stops at ${formatDate(s.cardDataThrough)}`, detail: 'Later card spending is not counted yet, so safe to spend may be too high. Import your newer statements.' });
    }
    if (s.cardOutstandingPaise > 0) {
        list.push({ id: 'card', status: 'amber', title: `${formatINR(s.cardOutstandingPaise)} on your card is unpaid`, detail: `This is already taken out of safe to spend. Your last statement's bill is due around ${formatDate(s.lastStatement.due)}.` });
    }
    if (c.incomePaise > 0) {
        const pct = Math.round((c.investedPaise / c.incomePaise) * 100);
        list.push({ id: 'invest', status: pct >= 10 ? 'green' : 'amber', title: `${pct}% of this cycle's income invested`, detail: `${formatINR(c.investedPaise)} of ${formatINR(c.incomePaise)} so far.` });
    }
    if (s.review.count > 0) {
        list.push({ id: 'review', status: 'amber', title: `${s.review.count === 1 ? '1 entry needs' : `${s.review.count} entries need`} a quick check`, detail: 'Confirming them makes every number here more accurate.' });
    }
    return list;
}

export function summarize(state, today, prefs = {}) {
    const transactions = state.transactions;
    const cycles = buildSalaryCycles(transactions);
    const cycle = cycleFor(cycles, today);
    const current = cycleSummary(state, cycle, today);
    const allCycles = cycles.map((c) => cycleSummary(state, c, today));
    const closed = allCycles.filter((c) => c.cycle.end !== null);

    const plannedSip = sum(state.funds, (f) => f.monthlySipPaise || 0);
    const unpaidFamily = Math.max(0, state.plan.familyContributionPaise - current.familyContributionPaise);
    const unpaidSip = Math.max(0, plannedSip - current.investedPaise);
    const cycleEnd = addDays(nextCycleStart(cycle), -1);
    const due = dueItems(state, addDays(today, -30), addDays(today, 60), today);
    const billDueInCycle = due.filter((d) => d.kind === 'bill' && !d.paid && d.due >= cycle.start && d.due <= cycleEnd);
    const unpaidBills = sum(billDueInCycle.filter((d) => (d.item.account ?? 'debit') === 'debit'), (d) => d.amountPaise);
    const unpaidGoals = sum(state.goals, (g) => Math.max(0, (g.monthlyPaise || 0) - netOut(current.txs.filter((t) => t.goalId === g.id), 'savings')));
    const plannedUnpaidPaise = unpaidFamily + unpaidSip + unpaidBills + unpaidGoals;

    const cardPurchases = sum(transactions.filter((t) => t.account === 'credit'), spendEffect);
    const cardBills = netOut(transactions, 'card_bill');
    const cardOutstandingPaise = Math.max(0, cardPurchases - cardBills);

    const cashLeftPaise = current.incomePaise - current.debitOutPaise;
    const safeToSpendPaise = cashLeftPaise - plannedUnpaidPaise - cardOutstandingPaise;
    const daysLeft = daysLeftInCycle(cycle, today);
    const dailyPaise = Math.floor(Math.max(0, safeToSpendPaise) / daysLeft / 1000) * 1000;

    const duplicates = detectDuplicates(state);
    const flagged = transactions.filter((t) => t.needsReview);
    const emergency = emergencyFund(state, closed);
    const invest = investments(state);
    const savedOtherPaise = netOut(transactions, 'savings') - emergency.balancePaise;
    const lentPaise = netOut(transactions, 'lent');

    const statement = statementCycleFor(today, state.card);
    const lastStatement = statementCycleFor(addDays(statement.start, -1), state.card);
    const cardDates = transactions.filter((t) => t.account === 'credit').map((t) => t.date).sort();
    const cardDataThrough = cardDates[cardDates.length - 1] ?? null;
    const summary = {
        today,
        cardDataThrough,
        cardDataGap: Boolean(cardDataThrough) && cardDataThrough < lastStatement.start,
        plan: state.plan,
        transactions,
        cycles: allCycles,
        current,
        daysLeft,
        cashLeftPaise,
        unpaidFamilyPaise: unpaidFamily,
        unpaidSipPaise: unpaidSip,
        unpaidBillsPaise: unpaidBills,
        unpaidGoalsPaise: unpaidGoals,
        due,
        billsMonthlyPaise: sum(state.recurring.filter((r) => r.frequency === 'monthly'), (r) => r.amountPaise),
        setAsideMonthlyPaise: sum(state.recurring, monthlySetAside),
        plannedUnpaidPaise,
        cardOutstandingPaise,
        safeToSpendPaise,
        dailyPaise,
        emergency,
        investments: invest,
        lentPaise,
        /** What the records show you have put aside. Bank balances are not included. */
        assetsPaise: invest.totalPaise + emergency.balancePaise + savedOtherPaise,
        statement,
        lastStatement,
        months: monthlyHistory(state),
        review: { flagged, duplicates, count: flagged.length + duplicates.length },
    };
    summary.goals = planGoals(state, today);
    summary.previous = closed.filter((c) => c.cycle.end < cycle.start).slice(-1)[0] ?? null;
    summary.budgets = budgetStatus(state.budgets, current);
    summary.idea = spendLessIdea(current, summary.previous, summary.goals.plans.find((p) => !p.done));
    summary.nudges = buildNudges(summary, state, today, prefs);
    summary.unreviewed = closed.filter((c) => !state.reviewedCycles.includes(c.cycle.id)).slice(-1)[0] ?? null;
    summary.insights = buildInsights(summary);
    return summary;
}
