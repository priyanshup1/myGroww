/**
 * defaults.js — Initial seed data for first-load experience.
 * Used only when localStorage has no data for a given key.
 */

export const DEFAULT_INCOME = 100000; // ₹1,00,000/month
export const DEFAULT_FAMILY_CONTRIBUTION = 20000; // ₹20,000

export const DEFAULT_EF_ENTRIES = [];

export const DEFAULT_MONEY_FLOW = [
    {
        id: 'salary',
        label: 'Salary Account',
        description: 'Income holding — receives full salary',
        amount: 100000,
        color: '#1a7d6f',
    },
    {
        id: 'expenses',
        label: 'Expenses Account',
        description: 'Monthly spending — bills, food, lifestyle',
        amount: 40000,
        color: '#d4a574',
    },
    {
        id: 'investments',
        label: 'Investments + Emergency Fund',
        description: 'Wealth building — SIPs & safety net',
        amount: 60000,
        color: '#8b92a9',
    },
];

export const DEFAULT_INVESTMENT_CATEGORIES = [
    { id: 'idx', name: 'Index Funds', amount: 30000 },
    { id: 'flex', name: 'Flexi Cap', amount: 20000 },
    { id: 'small', name: 'Small Cap', amount: 10000 },
    { id: 'gold', name: 'Gold ETF', amount: 5000 },
];

export const DEFAULT_SIPS = [
    {
        id: 's1',
        fundName: 'Nifty 50 Index Fund',
        category: 'Index Funds',
        monthlySip: 10000,
        startDate: '2024-01-01',
        lumpsum: 50000,
        lumpsumDate: '2023-12-15',
    },
    {
        id: 's2',
        fundName: 'Parag Parikh Flexi Cap',
        category: 'Flexi Cap',
        monthlySip: 8000,
        startDate: '2024-02-01',
        lumpsum: 0,
        lumpsumDate: '',
    },
    {
        id: 's3',
        fundName: 'Nippon Small Cap',
        category: 'Small Cap',
        monthlySip: 5000,
        startDate: '2024-03-01',
        lumpsum: 10000,
        lumpsumDate: '2024-01-10',
    },
    {
        id: 's4',
        fundName: 'Nippon Gold ETF',
        category: 'Gold ETF',
        monthlySip: 2000,
        startDate: '2024-01-01',
        lumpsum: 5000,
        lumpsumDate: '2023-11-20',
    },
];

export const DEFAULT_EXPENSES = [
    {
        id: 'e1',
        date: '2026-03-01',
        category: 'Food',
        amount: 8000,
        notes: 'Groceries + dining',
    },
    {
        id: 'e2',
        date: '2026-03-05',
        category: 'Transport',
        amount: 3000,
        notes: 'Fuel + metro',
    },
    {
        id: 'e3',
        date: '2026-03-10',
        category: 'Utilities',
        amount: 4000,
        notes: 'Electricity, internet',
    },
    {
        id: 'e4',
        date: '2026-03-15',
        category: 'Entertainment',
        amount: 2000,
        notes: 'OTT + weekend',
    },
    {
        id: 'e5',
        date: '2026-03-20',
        category: 'Health',
        amount: 1500,
        notes: 'Gym',
    },
];

export const EXPENSE_CATEGORIES = [
    'Food',
    'Transport',
    'Utilities',
    'Entertainment',
    'Health',
    'Other',
];

export const SIP_CATEGORIES = [
    'Index Funds',
    'Flexi Cap',
    'Small Cap',
    'Large Cap',
    'Gold ETF',
    'Debt Fund',
    'International',
    'Other',
];
