import React from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import '@fontsource/bodoni-moda/500.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/sora/400.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import './prefs';
import './index.css';
import { Shell } from './components/Shell';
import HomePage from './pages/HomePage';
import ActivityPage from './pages/ActivityPage';
import PlanPage from './pages/PlanPage';
import WealthPage from './pages/WealthPage';
import ReviewPage from './pages/ReviewPage';
import MonthReviewPage from './pages/MonthReviewPage';
import SettingsPage from './pages/SettingsPage';
import WelcomePage from './pages/WelcomePage';

const moved = (to) => ({ element: <Navigate to={to} replace /> });

const router = createBrowserRouter([
    { path: '/welcome', element: <WelcomePage /> },
    {
        path: '/',
        element: <Shell />,
        children: [
            { index: true, element: <HomePage /> },
            { path: 'activity', element: <ActivityPage /> },
            { path: 'plan', element: <PlanPage /> },
            { path: 'wealth', element: <WealthPage /> },
            { path: 'review', element: <ReviewPage /> },
            { path: 'month', element: <MonthReviewPage /> },
            { path: 'settings', element: <SettingsPage /> },
            { path: 'expenses', ...moved('/activity') },
            { path: 'history', ...moved('/activity?tab=history') },
            { path: 'insights', ...moved('/') },
            { path: 'snapshot', ...moved('/plan?tab=income') },
            { path: 'family', ...moved('/plan?tab=income') },
            { path: 'money-flow', ...moved('/plan?tab=income') },
            { path: 'sip', ...moved('/wealth?tab=sips') },
            { path: 'investments', ...moved('/wealth') },
            { path: 'emergency-fund', ...moved('/wealth?tab=safety') },
            { path: 'import', ...moved('/settings') },
            { path: '*', ...moved('/') },
        ],
    },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>,
);

/** Kept so Settings can offer the browser's own install prompt. */
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.installPrompt = e;
    window.dispatchEvent(new Event('mygroww-installable'));
});
