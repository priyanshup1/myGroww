import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import HomePage from './pages/HomePage';
import FinancialSnapshotPage from './pages/FinancialSnapshotPage';
import MoneyFlowPage from './pages/MoneyFlowPage';
import InvestmentAllocationPage from './pages/InvestmentAllocationPage';
import SipTrackerPage from './pages/SipTrackerPage';
import ExpenseTrackerPage from './pages/ExpenseTrackerPage';
import InsightsPage from './pages/InsightsPage';
import FamilyContributionPage from './pages/FamilyContributionPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import EmergencyFundPage from './pages/EmergencyFundPage';
import ImportPage from './pages/ImportPage';
import ReviewPage from './pages/ReviewPage';

export default function App() {
  return (
    <>
      <Toaster position="bottom-center" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' } }} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/snapshot" element={<FinancialSnapshotPage />} />
        <Route path="/money-flow" element={<MoneyFlowPage />} />
        <Route path="/investments" element={<InvestmentAllocationPage />} />
        <Route path="/sip" element={<SipTrackerPage />} />
        <Route path="/expenses" element={<ExpenseTrackerPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/family" element={<FamilyContributionPage />} />
        <Route path="/history" element={<TransactionHistoryPage />} />
        <Route path="/emergency-fund" element={<EmergencyFundPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/review" element={<ReviewPage />} />
      </Routes>
    </>
  );
}
