import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FinancialSnapshotPage from './pages/FinancialSnapshotPage';
import MoneyFlowPage from './pages/MoneyFlowPage';
import InvestmentAllocationPage from './pages/InvestmentAllocationPage';
import SipTrackerPage from './pages/SipTrackerPage';
import ExpenseTrackerPage from './pages/ExpenseTrackerPage';
import InsightsPage from './pages/InsightsPage';
import FamilyContributionPage from './pages/FamilyContributionPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/snapshot" element={<FinancialSnapshotPage />} />
      <Route path="/money-flow" element={<MoneyFlowPage />} />
      <Route path="/investments" element={<InvestmentAllocationPage />} />
      <Route path="/sip" element={<SipTrackerPage />} />
      <Route path="/expenses" element={<ExpenseTrackerPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/family" element={<FamilyContributionPage />} />
    </Routes>
  );
}
