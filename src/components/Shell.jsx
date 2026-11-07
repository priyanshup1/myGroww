import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MotionConfig } from 'motion/react';
import { useFinance } from '../store';
import { getPrefs, setPrefs } from '../prefs';
import { Icon } from './icons';
import { AddSheet, openAdd } from './AddSheet';

const NAV = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/activity', label: 'Activity', icon: 'activity' },
    { to: '/plan', label: 'Plan', icon: 'plan' },
    { to: '/wealth', label: 'Wealth', icon: 'wealth' },
];

const link = (n) => (
    <NavLink key={n.to} to={n.to} end={n.end} viewTransition className="nav-link" aria-label={n.label}>
        <Icon name={n.icon} />
        <span>{n.label}</span>
    </NavLink>
);

/** Shows today's due items as a notification once a day, if notifications were turned on. */
function useDailyReminder(s, today) {
    useEffect(() => {
        const prefs = getPrefs();
        if (!prefs.notify || prefs.lastNotified === today || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const due = s.due.filter((d) => !d.paid && d.daysAway <= 0);
        if (!due.length) return;
        const body = due.slice(0, 3).map((d) => d.name).join(', ');
        const title = due.length === 1 ? '1 payment is due' : `${due.length} payments are due`;
        setPrefs({ lastNotified: today });
        if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: '/icon-192.png' }));
        else new Notification(title, { body });
    }, [s.due, today]);
}

export function Shell() {
    const { state, s, today } = useFinance();
    const location = useLocation();
    const navigate = useNavigate();
    useDailyReminder(s, today);
    useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
    useEffect(() => {
        if (!state.setupDone && state.transactions.length === 0 && location.pathname !== '/welcome') navigate('/welcome', { replace: true });
    }, [state.setupDone, state.transactions.length, location.pathname, navigate]);

    return (
        <MotionConfig reducedMotion="user">
            <div className="app">
                <nav className="rail" aria-label="Main">
                    <div className="brand">myGroww</div>
                    {NAV.map(link)}
                    <button type="button" className="btn btn-primary add-wide" onClick={() => openAdd()}><Icon name="plus" size={20} />Add money</button>
                    <div className="bottom">
                        <NavLink to="/settings" viewTransition className="nav-link"><Icon name="settings" /><span>Settings</span></NavLink>
                    </div>
                </nav>
                <main className="main" key={location.pathname}>
                    <div className="page-in"><Outlet /></div>
                </main>
                <nav className="bottom-nav" aria-label="Main">
                    {link(NAV[0])}
                    {link(NAV[1])}
                    <button type="button" className="nav-add" aria-label="Add money" onClick={() => openAdd()}><Icon name="plus" size={26} /></button>
                    {link(NAV[2])}
                    {link(NAV[3])}
                </nav>
            </div>
            <AddSheet />
            <Toaster
                position="bottom-center"
                containerStyle={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
                toastOptions={{ style: { background: 'var(--surface-2)', color: 'var(--ink)', boxShadow: '0 10px 28px var(--drop)', borderRadius: 14 }, success: { iconTheme: { primary: 'var(--accent)', secondary: 'var(--on-accent)' } } }}
            />
        </MotionConfig>
    );
}
