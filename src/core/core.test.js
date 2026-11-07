import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { addMonths, parseFlexibleDate, toISO } from './dates';
import { buildSalaryCycles, cycleFor, daysLeftInCycle, statementCycleFor } from './cycles';
import { createTx, merchantKey, spendEffect, validateTx } from './ledger';
import { formatCompact, formatINR, toPaise } from './money';
import { addTx, categoriseMerchant, emptyState, mergeTransactions, removeFund, setPlan, upsertFund } from './state';
import { summarize } from './selectors';
import { importCSV, parseCSV } from './importers/csv';
import { importTracker } from './importers/tracker';
import { readWorkbook } from './importers/xlsx';
import { makeBackup, migrateLegacy, readBackup } from './migrate';
import { futurePrice, monthsBetween, monthsToReach, planGoal, project, requiredMonthly } from './goals';
import { dueDates, dueItems, monthlySetAside, paymentFor } from './recurring';
import { buildCalendar } from './calendar';
import { budgetStatus, cycleReview, topMerchants } from './insights';
import { removeGoal, setBudget, upsertById } from './state';
import { openVault, sealVault } from './vault';

/** All names and amounts here are made up. */
const salary = (date, rupees = 100000) => ({ date, amountPaise: toPaise(rupees), type: 'income', flow: 'in', category: 'Salary', description: 'Salary' });
const spend = (date, rupees, extra = {}) => ({ date, amountPaise: toPaise(rupees), type: 'spend', category: 'Food', description: 'Test cafe', ...extra });

function build(...items) {
    return items.reduce((state, item) => addTx(state, item), emptyState());
}

describe('money', () => {
    it('adds without floating-point drift', () => {
        const total = [0.1, 0.2, 29019.59, 448.44].map(toPaise).reduce((a, b) => a + b, 0);
        expect(total).toBe(2946833);
    });
    it('uses Indian digit grouping', () => {
        expect(formatINR(10000000)).toBe('₹1,00,000');
        expect(formatINR(1234550, { exact: true })).toBe('₹12,345.50');
        expect(formatCompact(12000000)).toBe('₹1.20 L');
    });
    it('reads money text and rejects junk', () => {
        expect(toPaise('₹1,234.50')).toBe(123450);
        expect(toPaise('Rs 500')).toBe(50000);
        expect(toPaise('abc')).toBeNaN();
    });
});

describe('dates', () => {
    it('keeps a late-night expense on its local date', () => {
        expect(toISO(new Date(2026, 11, 1, 0, 30))).toBe('2026-12-01');
    });
    it('clamps month ends', () => {
        expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    });
    it('reads Indian date formats as day first', () => {
        expect(parseFlexibleDate('04/09/2026')).toBe('2026-09-04');
        expect(parseFlexibleDate('4 Sep 2026')).toBe('2026-09-04');
        expect(parseFlexibleDate('29-May-26')).toBe('2026-05-29');
        expect(parseFlexibleDate('Jun 11', 2026)).toBe('2026-06-11');
        expect(parseFlexibleDate('31/02/2026')).toBeNull();
    });
});

describe('cycles', () => {
    const cycles = buildSalaryCycles(build(salary('2026-09-30'), salary('2026-10-30')).transactions);
    it('runs from one salary to the day before the next', () => {
        expect(cycles[0]).toMatchObject({ start: '2026-09-30', end: '2026-10-29' });
        expect(cycles[1]).toMatchObject({ start: '2026-10-30', end: null });
    });
    it('puts dates in the right cycle and falls back to the month', () => {
        expect(cycleFor(cycles, '2026-10-29').start).toBe('2026-09-30');
        expect(cycleFor(cycles, '2026-11-07').start).toBe('2026-10-30');
        expect(cycleFor([], '2026-11-07')).toMatchObject({ kind: 'calendar', start: '2026-11-01', end: '2026-11-30' });
    });
    it('counts days to the next expected salary', () => {
        expect(daysLeftInCycle(cycles[1], '2026-11-07')).toBe(23);
    });
    it('keeps statement cycles separate, with their own due date', () => {
        expect(statementCycleFor('2026-09-01')).toMatchObject({ start: '2026-08-24', end: '2026-09-23', due: '2026-10-13' });
        expect(statementCycleFor('2026-09-24')).toMatchObject({ start: '2026-09-24', end: '2026-10-23', due: '2026-11-13' });
    });
});

describe('ledger rules', () => {
    it('rejects bad records', () => {
        expect(() => createTx({ date: '2026-13-01', amountPaise: 100 })).toThrow();
        expect(() => createTx({ date: '2026-01-01', amountPaise: 0 })).toThrow();
        expect(validateTx({})).not.toEqual([]);
    });
    it('only counts real spending as spending', () => {
        ['card_bill', 'investment', 'savings', 'self_transfer', 'family_contribution', 'loan_emi', 'insurance', 'person_transfer'].forEach((type) => {
            expect(spendEffect(createTx({ date: '2026-01-01', amountPaise: 100, type }))).toBe(0);
        });
        expect(spendEffect(createTx({ date: '2026-01-01', amountPaise: 100, type: 'spend', flow: 'in' }))).toBe(-100);
    });
    it('matches merchants despite noise', () => {
        expect(merchantKey('Mr S Kumar (UPI 123)')).toBe(merchantKey('S Kumar'));
    });
});

describe('summary', () => {
    const today = '2026-11-07';

    it('counts only the current cycle, not every expense ever', () => {
        const s = summarize(build(salary('2026-09-30'), spend('2026-10-05', 5000), salary('2026-10-30'), spend('2026-11-01', 1000)), today);
        expect(s.current.spendPaise).toBe(toPaise(1000));
    });

    it('never double counts a card purchase and its bill', () => {
        const s = summarize(build(
            salary('2026-10-30'),
            spend('2026-11-02', 3000, { account: 'credit' }),
            { date: '2026-11-03', amountPaise: toPaise(3000), type: 'card_bill', category: 'Card bill', description: 'Card bill' },
        ), today);
        expect(s.current.spendPaise).toBe(toPaise(3000));
        expect(s.cardOutstandingPaise).toBe(0);
        expect(s.safeToSpendPaise).toBe(toPaise(97000));
    });

    it('takes unpaid card spending out of safe to spend', () => {
        const s = summarize(build(salary('2026-10-30'), spend('2026-11-02', 4000, { account: 'credit' })), today);
        expect(s.cardOutstandingPaise).toBe(toPaise(4000));
        expect(s.safeToSpendPaise).toBe(toPaise(96000));
    });

    it('holds back family and SIP money that has not gone out yet', () => {
        let state = build(salary('2026-10-30'), spend('2026-11-01', 1000));
        state = setPlan(state, { familyContributionPaise: toPaise(50000) });
        state = upsertFund(state, { id: 'f1', name: 'Test fund', category: 'Index Funds', monthlySipPaise: toPaise(7000) });
        expect(summarize(state, today).safeToSpendPaise).toBe(toPaise(42000));
        state = addTx(state, { date: '2026-11-02', amountPaise: toPaise(50000), type: 'family_contribution', description: 'House' });
        expect(summarize(state, today).safeToSpendPaise).toBe(toPaise(42000));
    });

    it('nets refunds and money received', () => {
        const s = summarize(build(salary('2026-10-30'), spend('2026-11-01', 361), spend('2026-11-01', 361, { flow: 'in' })), today);
        expect(s.current.spendPaise).toBe(0);
    });

    it('keeps one-offs out of the normal month', () => {
        const s = summarize(build(salary('2026-10-30'), spend('2026-11-01', 2000), spend('2026-11-02', 17000, { oneOff: true, category: 'Vehicle' })), today);
        expect(s.current.spendPaise).toBe(toPaise(19000));
        expect(s.current.normalSpendPaise).toBe(toPaise(2000));
        expect(s.current.oneOffPaise).toBe(toPaise(17000));
    });

    it('investments are what was paid, so changing a SIP never rewrites the past', () => {
        let state = upsertFund(emptyState(), { id: 'f1', name: 'Test fund', category: 'Small Cap', monthlySipPaise: toPaise(10000) });
        state = addTx(state, { date: '2026-09-01', amountPaise: toPaise(10000), type: 'investment', fundId: 'f1', description: 'SIP' });
        const before = summarize(state, today).investments.totalPaise;
        state = upsertFund(state, { id: 'f1', monthlySipPaise: toPaise(5000) });
        expect(summarize(state, today).investments.totalPaise).toBe(before);
        expect(summarize(removeFund(state, 'f1'), today).investments.totalPaise).toBe(before);
    });

    it('a missed SIP lowers the total', () => {
        const state = upsertFund(emptyState(), { id: 'f1', name: 'Test fund', category: 'Index Funds', monthlySipPaise: toPaise(10000), startDate: '2024-01-01' });
        expect(summarize(state, today).investments.totalPaise).toBe(0);
    });

    it('emergency cover falls with withdrawals and never shows infinity', () => {
        let state = setPlan(emptyState(), { familyContributionPaise: toPaise(10000) });
        state = addTx(state, { date: '2026-09-01', amountPaise: toPaise(30000), type: 'savings', category: 'Emergency Fund', description: 'EF' });
        expect(summarize(state, today).emergency.months).toBe(3);
        state = addTx(state, { date: '2026-09-02', amountPaise: toPaise(10000), type: 'savings', flow: 'in', category: 'Emergency Fund', description: 'EF' });
        expect(summarize(state, today).emergency.months).toBe(2);
        expect(summarize(emptyState(), today).emergency.months).toBeNull();
    });

    it('a zero emergency fund can never read as healthy', () => {
        const state = setPlan(build(salary('2026-10-30')), { familyContributionPaise: toPaise(20000) });
        const item = summarize(state, today).insights.find((i) => i.id === 'emergency');
        expect(item.status).toBe('red');
    });

    it('shows how much salary the records do not explain', () => {
        const s = summarize(build(salary('2026-09-30'), spend('2026-10-01', 90000), salary('2026-10-30')), today);
        expect(s.cycles[0].unexplainedPaise).toBe(toPaise(10000));
    });

    it('marks a cycle verified only when it comes from statements', () => {
        const s = summarize(build(salary('2026-10-30'), spend('2026-11-01', 100, { source: 'bank_statement' })), today);
        expect(s.current.verified).toBe(true);
        const t = summarize(build(salary('2026-10-30'), spend('2026-11-01', 100, { source: 'chat' })), today);
        expect(t.current.verified).toBe(false);
    });

    it('finds likely duplicates for review', () => {
        const s = summarize(build(spend('2026-09-05', 306), spend('2026-09-05', 306)), today);
        expect(s.review.duplicates).toHaveLength(1);
        const state = build(spend('2026-09-05', 306), spend('2026-09-05', 306));
        const key = summarize(state, today).review.duplicates[0].key;
        expect(summarize({ ...state, dismissedDuplicates: [key] }, today).review.count).toBe(0);
    });

    it('names the card bill that is next due, not only the open statement', () => {
        const s = summarize(build(salary('2026-10-30')), today);
        expect(s.statement.due).toBe('2026-12-13');
        expect(s.lastStatement).toMatchObject({ start: '2026-09-24', end: '2026-10-23', due: '2026-11-13' });
    });

    it('works on an empty ledger', () => {
        const s = summarize(emptyState(), today);
        expect(s.safeToSpendPaise).toBe(0);
        expect(s.insights[0].id).toBe('empty');
    });
});

describe('merchant memory', () => {
    it('applies a corrected category to the same merchant and future imports', () => {
        const state = build(spend('2026-09-01', 50, { id: 'a', category: 'Misc', description: 'Sharma Stores', needsReview: true }), spend('2026-09-02', 60, { id: 'b', category: 'Misc', description: 'Sharma Stores' }));
        const next = categoriseMerchant(state, 'a', 'Groceries');
        expect(next.transactions.every((t) => t.category === 'Groceries')).toBe(true);
        expect(next.transactions.find((t) => t.id === 'a').needsReview).toBe(false);
        const merged = mergeTransactions(next, [createTx(spend('2026-09-03', 70, { category: 'Misc', description: 'Sharma Stores' }))]);
        expect(merged.state.transactions[0].category).toBe('Groceries');
    });
});

describe('importing', () => {
    it('parses quoted CSV', () => {
        expect(parseCSV('a,"b,c","d ""e"""\n1,2,3')).toEqual([['a', 'b,c', 'd "e"'], ['1', '2', '3']]);
    });

    it('imports a card CSV, reports bad rows and marks refunds', () => {
        const { transactions, warnings } = importCSV('Date,Description,Amount,Category\n04/09/2026,Test Mart,"₹1,200.50",Groceries\nnot a date,Bad,10,\n05/09/2026,Refund,500 Cr,Groceries');
        expect(transactions).toHaveLength(2);
        expect(transactions[0]).toMatchObject({ date: '2026-09-04', amountPaise: 120050, account: 'credit', source: 'card_statement' });
        expect(transactions[1].flow).toBe('in');
        expect(warnings).toHaveLength(1);
    });

    it('rejects a CSV without the needed columns', () => {
        expect(() => importCSV('foo,bar\n1,2')).toThrow(/Date, Description and Amount/);
    });

    it('imports twice without duplicating, even for real repeated lines', () => {
        const csv = 'Date,Description,Amount\n2026-09-05,Bus,20\n2026-09-05,Bus,20';
        const first = mergeTransactions(emptyState(), importCSV(csv).transactions);
        expect(first.added).toBe(2);
        const second = mergeTransactions(first.state, importCSV(csv).transactions);
        expect(second.added).toBe(0);
        expect(second.skipped).toBe(2);
    });

    const sheets = {
        Summary: [
            { A: 'All amounts in Rs. Credit card bill payments are excluded (shown as a memo column).' },
            { A: 'Cycle', B: 'Period' },
            { A: 'Cycle 1', B: '30-Sep-26 to 29-Oct-26', L: 1 },
            { A: 'Cycle 2', B: '30-Oct-26 to date (in progress)', L: 1 },
            { A: 'CC memo: credit card bill payments from the debit account - Oct 5 Rs 4,000.' },
            { A: 'Cycle 1: salary of Rs 90,017 was credited on Sep 30 (not in the ledger).' },
        ],
        Notes: [{ A: 'Rs 90,000 was used as the opening balance for each cycle.' }],
        Ledger: [
            { A: 'Date', B: 'Cycle', C: 'Description', D: 'Group', E: 'Category', F: 'Amount (Rs)', G: 'Source', H: 'Notes' },
            { A: '2026-10-01', C: 'Sample Cafe', D: 'Expense', E: 'Dining', F: 300, G: 'Bank statement' },
            { A: '2026-10-02', C: 'Mystery spend', D: 'Expense', E: 'Misc', F: 40, G: 'Chat', H: 'Possible duplicate - please confirm' },
            { A: '2026-10-03', C: 'Bike repair', D: 'Expense', E: 'Vehicle', F: 15000, G: 'Chat' },
            { A: '2026-10-04', C: 'Refund', D: 'Expense', E: 'Dining', F: -100, G: 'Bank statement' },
            { A: '2026-10-05', C: 'A friend (lending)', D: 'Personal Transfers', E: 'Personal Transfers', F: 1000, G: 'Chat' },
            { A: '2026-10-06', C: 'Unknown person', D: 'Personal Transfers', E: 'Personal Transfers', F: 500, G: 'Bank statement', H: 'Purpose not confirmed' },
            { A: '2026-10-07', C: 'Emergency fund', D: 'Savings', E: 'Emergency Fund', F: 2000, G: 'Chat' },
            { A: 'junk', C: 'Bad line', D: 'Expense', F: 5 },
        ],
    };

    it('imports the tracker with the right types and review flags', () => {
        const { transactions: t, warnings } = importTracker(sheets);
        const find = (d) => t.find((x) => x.description === d);
        expect(find('Sample Cafe')).toMatchObject({ type: 'spend', source: 'bank_statement', needsReview: false });
        expect(find('Mystery spend').needsReview).toBe(true);
        expect(find('Bike repair').oneOff).toBe(true);
        expect(find('Refund').flow).toBe('in');
        expect(find('A friend (lending)').type).toBe('lent');
        expect(find('Unknown person')).toMatchObject({ type: 'person_transfer', needsReview: true });
        expect(find('Emergency fund').category).toBe('Emergency Fund');
        expect(find('Credit card bill payment')).toMatchObject({ date: '2026-10-05', type: 'card_bill', amountPaise: 400000 });
        const salaries = t.filter((x) => x.type === 'income');
        expect(salaries.map((x) => x.date)).toEqual(['2026-09-30', '2026-10-30']);
        expect(salaries[0]).toMatchObject({ amountPaise: 9001700, source: 'bank_statement', needsReview: false });
        expect(salaries[1]).toMatchObject({ amountPaise: 9000000, source: 'estimate', needsReview: true });
        expect(warnings.join()).toMatch(/line 9/);
    });

    it('rejects a workbook that is not the tracker', () => {
        expect(() => importTracker({ Sheet1: [] })).toThrow(/Ledger/);
    });

    it('reads a real xlsx file structure, including dates and shared text', () => {
        const bytes = zipSync({
            'xl/workbook.xml': strToU8('<workbook xmlns:r="x"><sheets><sheet name="Ledger" sheetId="1" r:id="rId1"/></sheets></workbook>'),
            'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
            'xl/sharedStrings.xml': strToU8('<sst><si><t>Tea &amp; snacks</t></si></sst>'),
            'xl/styles.xml': strToU8('<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'),
            'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" s="1"><v>46269</v></c><c r="B1" t="s"><v>0</v></c><c r="C1"><v>48.5</v></c><c r="D1"/></row></sheetData></worksheet>'),
        });
        expect(readWorkbook(bytes).Ledger[0]).toEqual({ A: '2026-09-04', B: 'Tea & snacks', C: 48.5 });
    });

    it('refuses a file that is not an Excel workbook', () => {
        expect(() => readWorkbook(zipSync({ 'a.txt': strToU8('x') }))).toThrow(/Excel/);
    });
});

describe('backups', () => {
    const today = '2026-11-07';
    it('round-trips', () => {
        const state = build(salary('2026-10-30'));
        const result = readBackup(JSON.parse(JSON.stringify(makeBackup(state, '2026-11-07T10:00:00'))), today);
        expect(result.ok).toBe(true);
        expect(result.state.transactions).toEqual(state.transactions);
    });
    it('refuses junk and damaged files without changing anything', () => {
        expect(readBackup({ hello: 'world' }, today).ok).toBe(false);
        expect(readBackup([1, 2], today).ok).toBe(false);
        expect(readBackup(null, today).ok).toBe(false);
        expect(readBackup({ app: 'mygroww', version: 2, state: { transactions: [{ id: 'x' }] } }, today).ok).toBe(false);
        expect(readBackup({ app: 'mygroww', version: 99, state: { transactions: [] } }, today).ok).toBe(false);
    });
});

describe('migrating the old app', () => {
    const today = '2026-11-07';
    it('leaves demo data behind and keeps real entries', () => {
        const state = migrateLegacy({
            income: 90000,
            familyContribution: 10000,
            expenses: [{ id: 'e1', date: '2026-03-01', category: 'Food', amount: 8000 }, { id: 'real', date: '2026-10-02', category: 'Food', amount: 250, notes: 'Lunch' }, { id: 'blank', date: '2026-10-03', amount: 0 }],
            sips: [{ id: 's1', fundName: 'Demo', monthlySip: 10000, startDate: '2024-01-01' }],
        }, today);
        expect(state.plan.salaryPaise).toBe(toPaise(90000));
        expect(state.transactions).toHaveLength(1);
        expect(state.transactions[0]).toMatchObject({ description: 'Lunch', amountPaise: 25000 });
        expect(state.funds).toHaveLength(0);
    });
    it('uses the SIP log when it exists, and flags estimates when it does not', () => {
        const logged = migrateLegacy({ sips: [{ id: 'f', fundName: 'Fund', monthlySip: 1000, startDate: '2026-01' }], monthlySIPLog: { '2026-09': { f: { amount: 900, status: 'submitted' } } } }, today);
        expect(logged.transactions).toHaveLength(1);
        expect(logged.transactions[0].amountPaise).toBe(90000);
        const estimated = migrateLegacy({ sips: [{ id: 'f', fundName: 'Fund', monthlySip: 1000, startDate: '2026-09' }] }, today);
        expect(estimated.transactions[0]).toMatchObject({ source: 'estimate', needsReview: true, amountPaise: 300000 });
    });
    it('skips draft emergency entries', () => {
        const state = migrateLegacy({ efMonthlyEntries: [{ month: '2026-09', amount: 500, status: 'draft' }, { month: '2026-10', amount: 700, status: 'saved' }] }, today);
        expect(state.transactions).toHaveLength(1);
        expect(state.transactions[0].category).toBe('Emergency Fund');
    });
});

describe('goals', () => {
    const today = '2026-11-07';
    it('works out the monthly amount and the time, both ways round', () => {
        expect(requiredMonthly(toPaise(800000), 0, 24)).toBe(3333334);
        expect(monthsToReach(toPaise(800000), 0, toPaise(25000))).toBe(32);
    });
    it('needs less each month when returns are assumed', () => {
        const flat = requiredMonthly(toPaise(800000), 0, 24, 0);
        const withReturns = requiredMonthly(toPaise(800000), 0, 24, 10);
        expect(withReturns).toBeLessThan(flat);
        expect(monthsToReach(toPaise(100), 0, 0)).toBeNull();
    });
    it('a compounding plan really reaches the target', () => {
        const monthly = requiredMonthly(toPaise(500000), toPaise(50000), 36, 8);
        let balance = toPaise(50000);
        for (let m = 0; m < 36; m += 1) balance = balance * (1 + 0.08 / 12) + monthly;
        expect(balance).toBeGreaterThanOrEqual(toPaise(500000) - 1);
        expect(balance).toBeLessThan(toPaise(500100));
    });
    it('raises the target when prices are assumed to rise', () => {
        expect(futurePrice(toPaise(100000), 12, 10)).toBe(toPaise(110000));
        const flat = planGoal({ id: 'g', name: 'Car', targetPaise: toPaise(800000), targetDate: '2028-11-07', monthlyPaise: 0 }, 0, today);
        const rising = planGoal({ id: 'g', name: 'Car', targetPaise: toPaise(800000), targetDate: '2028-11-07', monthlyPaise: 0, priceRisePct: 5 }, 0, today);
        expect(rising.neededMonthlyPaise).toBeGreaterThan(flat.neededMonthlyPaise);
    });
    it('reports pace, finish date and being on track', () => {
        const p = planGoal({ id: 'g', name: 'Bike', targetPaise: toPaise(120000), targetDate: '2027-11-07', monthlyPaise: toPaise(5000) }, toPaise(20000), today);
        expect(p.paceMonths).toBe(20);
        expect(p.paceDate).toBe('2028-07-07');
        expect(p.onTrack).toBe(false);
        expect(monthsBetween(today, '2027-11-07')).toBe(12);
    });
    it('projects money put in and possible growth', () => {
        const flat = project(toPaise(100000), toPaise(1000), 2, 0);
        expect(flat[2]).toMatchObject({ putPaise: toPaise(124000), valuePaise: toPaise(124000), growthPaise: 0 });
        expect(project(toPaise(100000), toPaise(1000), 2, 10)[2].growthPaise).toBeGreaterThan(0);
    });
    it('counts contributions, holds back the monthly amount, and keeps money if a goal is removed', () => {
        let st = upsertById(build(salary('2026-10-30')), 'goals', { id: 'g1', name: 'Car', targetPaise: toPaise(800000), targetDate: '2028-11-07', monthlyPaise: toPaise(8000), openingPaise: toPaise(10000) });
        expect(summarize(st, today).safeToSpendPaise).toBe(toPaise(92000));
        st = addTx(st, { date: '2026-11-02', amountPaise: toPaise(8000), type: 'savings', goalId: 'g1', category: 'Goal', description: 'Car' });
        const s = summarize(st, today);
        expect(s.safeToSpendPaise).toBe(toPaise(92000));
        expect(s.goals.plans[0].savedPaise).toBe(toPaise(18000));
        const gone = removeGoal(st, 'g1');
        expect(gone.transactions.filter((x) => x.type === 'savings')).toHaveLength(1);
    });
    it('shows when goals compete for the same money', () => {
        let st = upsertById(emptyState(), 'goals', { id: 'a', name: 'Car', targetPaise: toPaise(240000), targetDate: '2028-11-07', monthlyPaise: toPaise(2000) });
        st = upsertById(st, 'goals', { id: 'b', name: 'House', targetPaise: toPaise(600000), targetDate: '2031-11-07', monthlyPaise: toPaise(2000) });
        const g = summarize(st, today).goals;
        expect(g.neededPaise).toBe(toPaise(20000));
        expect(g.shortfallPaise).toBe(toPaise(16000));
    });
});

describe('recurring bills', () => {
    const today = '2026-11-07';
    it('finds monthly, quarterly and yearly dates, clamping short months', () => {
        expect(dueDates({ frequency: 'monthly', dueDay: 31 }, '2027-02-01', '2027-03-31')).toEqual(['2027-02-28', '2027-03-31']);
        expect(dueDates({ frequency: 'yearly', dueDay: 11, dueMonth: 6 }, '2026-01-01', '2027-12-31')).toEqual(['2026-06-11', '2027-06-11']);
        expect(dueDates({ frequency: 'quarterly', dueDay: 5, dueMonth: 2 }, '2026-01-01', '2026-12-31')).toEqual(['2026-02-05', '2026-05-05', '2026-08-05', '2026-11-05']);
    });
    it('shows the monthly set-aside for a yearly bill', () => {
        expect(monthlySetAside({ frequency: 'yearly', amountPaise: toPaise(28000) })).toBe(233334);
        expect(monthlySetAside({ frequency: 'monthly', amountPaise: 100 })).toBe(0);
    });
    it('holds back a bill due this cycle until it is marked paid, and only once', () => {
        let st = upsertById(build(salary('2026-10-30')), 'recurring', { id: 'r1', name: 'Electricity', amountPaise: toPaise(2000), frequency: 'monthly', dueDay: 12, category: 'Bills' });
        expect(summarize(st, today).safeToSpendPaise).toBe(toPaise(98000));
        const entry = dueItems(st, '2026-11-01', '2026-11-30', today)[0];
        expect(entry).toMatchObject({ due: '2026-11-12', paid: false, daysAway: 5 });
        st = addTx(st, paymentFor(entry, today));
        expect(dueItems(st, '2026-11-01', '2026-11-30', today)[0].paid).toBe(true);
        expect(summarize(st, today).safeToSpendPaise).toBe(toPaise(98000));
    });
    it('does not call a new bill overdue for dates before it was added', () => {
        const st = upsertById(emptyState(), 'recurring', { id: 'r1', name: 'Rent', amountPaise: 100, frequency: 'monthly', dueDay: 2, startDate: today });
        expect(dueItems(st, '2026-10-01', '2026-12-31', today).map((d) => d.due)).toEqual(['2026-12-02']);
    });
    it('flags overdue bills and a SIP due date', () => {
        let st = upsertById(emptyState(), 'recurring', { id: 'r1', name: 'Internet', amountPaise: 100, frequency: 'monthly', dueDay: 2 });
        st = upsertFund(st, { id: 'f', name: 'Index', category: 'Index Funds', monthlySipPaise: toPaise(500), sipDay: 10 });
        const items = dueItems(st, '2026-11-01', '2026-11-30', today);
        expect(items[0].overdue).toBe(true);
        expect(items[1]).toMatchObject({ kind: 'sip', paid: false });
        const s = summarize(st, today);
        expect(s.nudges.some((n) => n.tone === 'red')).toBe(true);
    });
    it('builds a valid calendar file with escaped text', () => {
        const st = upsertById(emptyState(), 'recurring', { id: 'r1', name: 'Rent, flat', amountPaise: toPaise(12000), frequency: 'yearly', dueDay: 31, dueMonth: 2 });
        const ics = buildCalendar(st, today);
        expect(ics).toContain('BEGIN:VCALENDAR');
        expect(ics).toContain('SUMMARY:Rent\\, flat ₹12\\,000 due');
        expect(ics).toContain('DTSTART;VALUE=DATE:20270228');
        expect(ics).toContain('RRULE:FREQ=YEARLY');
        expect(ics.split('BEGIN:VEVENT')).toHaveLength(2);
    });
});

describe('budgets and reviews', () => {
    const today = '2026-11-07';
    it('compares spending with budgets and removes a cleared budget', () => {
        let st = build(salary('2026-10-30'), spend('2026-11-01', 1200));
        st = setBudget(st, 'Food', toPaise(1000));
        const row = summarize(st, today).budgets.find((b) => b.name === 'Food');
        expect(row).toMatchObject({ spentPaise: toPaise(1200), over: true });
        expect(budgetStatus(setBudget(st, 'Food', 0).budgets, summarize(st, today).current)[0].limitPaise).toBe(0);
    });
    it('finds the top merchants, without one-offs', () => {
        const st = build(salary('2026-10-30'), spend('2026-11-01', 50, { description: 'Cafe A' }), spend('2026-11-02', 70, { description: 'Cafe A' }), spend('2026-11-02', 9000, { description: 'Big', oneOff: true }));
        const top = topMerchants(summarize(st, today).current.txs);
        expect(top).toHaveLength(1);
        expect(top[0]).toMatchObject({ name: 'Cafe A', amountPaise: toPaise(120), count: 2 });
    });
    it('writes a review of a finished cycle and offers one to look at', () => {
        const st = build(salary('2026-08-30'), spend('2026-09-01', 100), salary('2026-09-30'), spend('2026-10-01', 300), salary('2026-10-30'));
        const s = summarize(st, today);
        expect(s.previous.cycle.start).toBe('2026-09-30');
        expect(s.unreviewed.cycle.start).toBe('2026-09-30');
        expect(cycleReview(s.cycles[1], s.cycles[0])[0].detail).toContain('₹200 more');
        expect(summarize({ ...st, reviewedCycles: [s.unreviewed.cycle.id] }, today).unreviewed.cycle.start).toBe('2026-08-30');
    });
    it('offers a spend-less idea that names the effect on the top goal', () => {
        let st = build(salary('2026-09-30'), spend('2026-10-01', 1000), salary('2026-10-30'), spend('2026-11-01', 3000));
        st = upsertById(st, 'goals', { id: 'g', name: 'Car', targetPaise: toPaise(120000), targetDate: '2030-11-07', monthlyPaise: toPaise(1000) });
        expect(summarize(st, today).idea.text).toContain('sooner');
    });
    it('nudges for a backup, but not on an empty app', () => {
        expect(summarize(emptyState(), today).nudges).toHaveLength(0);
        const s = summarize(build(salary('2026-10-30')), today);
        expect(s.nudges.some((n) => n.id === 'backup')).toBe(true);
        expect(summarize(build(salary('2026-10-30')), today, { lastBackup: '2026-11-01' }).nudges.some((n) => n.id === 'backup')).toBe(false);
    });
});

describe('encrypted data file', () => {
    const data = { app: 'mygroww', note: 'Made-up Person sent 12345', list: new Array(5000).fill('x') };
    it('opens with the right passphrase and hides the contents', async () => {
        const vault = await sealVault(data, 'correct-horse');
        const text = JSON.stringify(vault);
        expect(text).not.toContain('Made-up');
        expect(atob(vault.data)).not.toContain('Made-up');
        expect(await openVault(vault, 'correct-horse')).toEqual(data);
    }, 30000);
    it('refuses a wrong passphrase and a tampered file', async () => {
        const vault = await sealVault({ a: 1 }, 'right');
        await expect(openVault(vault, 'wrong')).rejects.toThrow(/passphrase/);
        const bytes = atob(vault.data);
        const flipped = btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1));
        await expect(openVault({ ...vault, data: flipped }, 'right')).rejects.toThrow();
    }, 30000);
    it('refuses a file that is not a vault', async () => {
        await expect(openVault({ hello: 1 }, 'x')).rejects.toThrow(/not a myGroww/);
    });
});
