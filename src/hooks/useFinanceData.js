/**
 * useFinanceData.js — Central reactive data hook
 * All UI reads/writes flow through here.
 * Components call this hook; they never touch storage.js directly.
 */

import { useState, useEffect, useCallback } from 'react';
import { getData, setData } from '../data/storage';
import {
    DEFAULT_INCOME,
    DEFAULT_EMERGENCY_FUND,
    DEFAULT_MONEY_FLOW,
    DEFAULT_INVESTMENT_CATEGORIES,
    DEFAULT_SIPS,
    DEFAULT_EXPENSES,
    DEFAULT_FAMILY_CONTRIBUTION,
} from '../data/defaults';

function usePersistedState(key, defaultValue) {
    const [state, setState] = useState(() => {
        const stored = getData(key);
        return stored !== null ? stored : defaultValue;
    });

    const set = useCallback(
        (value) => {
            setState(value);
            setData(key, typeof value === 'function' ? value(getData(key) ?? defaultValue) : value);
        },
        [key, defaultValue]
    );

    return [state, set];
}

export function useFinanceData() {
    const [income, setIncome] = usePersistedState('income', DEFAULT_INCOME);
    const [emergencyFund, setEmergencyFund] = usePersistedState('emergencyFund', DEFAULT_EMERGENCY_FUND);
    const [moneyFlow, setMoneyFlow] = usePersistedState('moneyFlow', DEFAULT_MONEY_FLOW);
    const [sips, setSips] = usePersistedState('sips', DEFAULT_SIPS);
    const [expenses, setExpenses] = usePersistedState('expenses', DEFAULT_EXPENSES);
    const [familyContribution, setFamilyContribution] = usePersistedState('familyContribution', DEFAULT_FAMILY_CONTRIBUTION);

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getMonthsBetween = (start, end) => {
        if (!start) return 0;
        const s = new Date(start);
        const e = new Date(end);
        if (isNaN(s) || isNaN(e)) return 0;
        return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
    };

    const TODAY = '2026-03-29'; // Use current project time for consistency

    // ─── Derived values ───────────────────────────────────────────────────────

    // 1. Calculate individual fund totals
    const sipsWithTotals = sips.map(s => {
        const months = getMonthsBetween(s.startDate, TODAY);
        const sipTotal = (Number(s.monthlySip) || 0) * Math.max(0, months);
        const lumpsumTotal = Number(s.lumpsum) || 0;
        return { ...s, calculatedTotal: sipTotal + lumpsumTotal };
    });

    // 2. Derive investment categories from funds
    const investmentCategories = Object.values(sipsWithTotals.reduce((acc, s) => {
        const cat = s.category || 'Other';
        if (!acc[cat]) acc[cat] = { id: cat, name: cat, amount: 0 };
        acc[cat].amount += s.calculatedTotal;
        return acc;
    }, {}));

    const totalInvested = sipsWithTotals.reduce((s, c) => s + c.calculatedTotal, 0);
    const totalLumpsum = sips.reduce((s, si) => s + (Number(si.lumpsum) || 0), 0);
    const totalMonthlySip = sips.reduce((s, si) => s + (Number(si.monthlySip) || 0), 0);

    // Small cap allocation %
    const smallCapAmount = investmentCategories
        .filter((c) => c.name.toLowerCase().includes('small'))
        .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const smallCapPct = totalInvested > 0 ? (smallCapAmount / totalInvested) * 100 : 0;

    // ─── Derived values for Quick Summary ─────────────────────────────────────
    const amountRetained = Math.max(0, income - familyContribution);
    const familyPctOfIncome = income > 0 ? (familyContribution / income) * 100 : 0;

    const monthlyExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expenseRatioOfRetained = amountRetained > 0 ? (monthlyExpenses / amountRetained) * 100 : 0;

    const sipRatioOfRetained = amountRetained > 0 ? (totalMonthlySip / amountRetained) * 100 : 0;
    const wealthBuildingPctOfIncome = income > 0 ? (totalMonthlySip / income) * 100 : 0;

    const moneyLeft = amountRetained - monthlyExpenses - totalMonthlySip;

    const emergencyGap = (monthlyExpenses * 6) - emergencyFund;
    const monthsCovered = monthlyExpenses > 0 ? (emergencyFund / monthlyExpenses).toFixed(1) : '∞';

    const activeSipsCount = sips.filter(s => (Number(s.monthlySip) || 0) > 0).length;

    const netWorth = totalInvested + emergencyFund;

    // ─── SIP helpers ─────────────────────────────────────────────────────────
    const addSip = (row) => setSips((prev) => [...prev, row]);
    const updateSip = (id, field, value) =>
        setSips((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    const deleteSip = (id) => setSips((prev) => prev.filter((s) => s.id !== id));

    // ─── Expense helpers ──────────────────────────────────────────────────────
    const addExpense = (row) => setExpenses((prev) => [...prev, row]);
    const updateExpense = (id, field, value) =>
        setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    const deleteExpense = (id) => setExpenses((prev) => prev.filter((e) => e.id !== id));

    // ─── Category helpers (Disabled as categories are now derived) ───────────
    const setInvestmentCategories = () => { console.warn('Categories are now derived from SIPs. Use updateSip instead.'); };
    const addCategory = () => { };
    const updateCategory = () => { };
    const deleteCategory = () => { };

    // ─── Money flow helpers ───────────────────────────────────────────────────
    const updateFlowNode = (id, field, value) =>
        setMoneyFlow((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)));

    // ─── Money flow consistency (Sync salary node with amountRetained) ───────
    const syncedMoneyFlow = moneyFlow.map(node =>
        node.id === 'salary' ? { ...node, amount: amountRetained } : node
    );

    return {
        // raw state
        income, setIncome,
        emergencyFund, setEmergencyFund,
        moneyFlow: syncedMoneyFlow, setMoneyFlow, updateFlowNode,
        investmentCategories, setInvestmentCategories,
        addCategory, updateCategory, deleteCategory,
        sips, setSips, addSip, updateSip, deleteSip,
        expenses, setExpenses, addExpense, updateExpense, deleteExpense,
        familyContribution, setFamilyContribution,
        // derived
        totalInvested,
        totalLumpsum,
        netWorth,
        monthlyExpenses,
        monthsCovered,
        totalMonthlySip,
        smallCapPct,
        // New specific metrics
        amountRetained,
        familyPctOfIncome,
        expenseRatioOfRetained,
        sipRatioOfRetained,
        moneyLeft,
        emergencyGap,
        activeSipsCount,
        wealthBuildingPctOfIncome,
        sipsWithTotals,
    };
}
