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
