/* eslint-env node */
/**
 * Runs a private tracker and card CSV through the real importers and prints totals to check by hand.
 * The files stay outside git. Usage:
 *   npx vite-node scripts/check-real-data.js <tracker.xlsx> [cards.csv] [familyContributionRupees]
 */
import { readFileSync } from 'node:fs';
import { readWorkbook } from '../src/core/importers/xlsx';
import { importTracker } from '../src/core/importers/tracker';
import { importCSV } from '../src/core/importers/csv';
import { emptyState, mergeTransactions, setPlan } from '../src/core/state';
import { summarize } from '../src/core/selectors';
import { todayISO } from '../src/core/dates';
import { formatINR, toPaise } from '../src/core/money';

const [trackerPath, cardPath, family] = process.argv.slice(2);
const tracker = importTracker(readWorkbook(new Uint8Array(readFileSync(trackerPath))));
let { state } = mergeTransactions(emptyState(), tracker.transactions);
const warnings = [...tracker.warnings];
if (cardPath) {
    const cards = importCSV(readFileSync(cardPath, 'utf8'));
    warnings.push(...cards.warnings);
    ({ state } = mergeTransactions(state, cards.transactions));
}
if (family) state = setPlan(state, { familyContributionPaise: toPaise(Number(family)) });
const s = summarize(state, todayISO());
const inr = (p) => formatINR(p, { exact: true });

console.log('Records', state.transactions.length, '| warnings', warnings.length);
warnings.forEach((w) => console.log('  ', w));
s.cycles.forEach((c) => {
    console.log(`Cycle ${c.cycle.index} from ${c.cycle.start}: income ${inr(c.incomePaise)} | debit out incl. card bill ${inr(c.debitOutPaise)} | card bill ${inr(c.cardBillPaise)} | spending ${inr(c.spendPaise)} | normal ${inr(c.normalSpendPaise)} | unexplained ${inr(c.unexplainedPaise)} | ${c.verified ? 'verified' : 'partial'}`);
});
console.log('Current cycle starts', s.current.cycle.start, '| days left', s.daysLeft);
console.log('Safe to spend', inr(s.safeToSpendPaise), '| a day', inr(s.dailyPaise), '| planned unpaid', inr(s.plannedUnpaidPaise), '| card unpaid', inr(s.cardOutstandingPaise));
console.log('Emergency fund', inr(s.emergency.balancePaise), '| monthly need', inr(s.emergency.monthlyNeedPaise), '| months', s.emergency.months?.toFixed(2));
console.log('Invested', inr(s.investments.totalPaise), '| recorded assets', inr(s.assetsPaise), '| lent', inr(s.lentPaise));
console.log('To review', s.review.flagged.length, 'flagged,', s.review.duplicates.length, 'possible duplicates');
s.review.duplicates.forEach((d) => console.log('   duplicate?', d.a.date, d.a.description, '/', d.b.date, d.b.description, inr(d.a.amountPaise)));
console.log('Statement now', s.statement.start, 'to', s.statement.end, 'due', s.statement.due);
