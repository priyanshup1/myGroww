import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemePicker } from '../components/ThemePicker';
import { ImportSection } from '../components/DataSection';
import { todayISO } from '../core/dates';
import { toPaise } from '../core/money';
import { addTx, setPlan } from '../core/state';
import { commit, useFinance } from '../store';

const finish = (change = (s) => s) => commit((st) => ({ ...change(st), setupDone: true }));

/** Three short steps, so the first screen you see already shows your own money. */
export default function WelcomePage() {
    const { state } = useFinance();
    const nav = useNavigate();
    const [step, setStep] = useState(0);
    const [salary, setSalary] = useState('');
    const [family, setFamily] = useState('');
    const [salaryCame, setSalaryCame] = useState(true);
    const [salaryDate, setSalaryDate] = useState(todayISO());
    const [error, setError] = useState('');
    useEffect(() => { if (state.setupDone) nav('/', { replace: true }); }, [state.setupDone, nav]);

    function next(e) {
        e.preventDefault();
        const s = salary === '' ? 0 : toPaise(salary);
        const f = family === '' ? 0 : toPaise(family);
        if (![s, f].every((v) => Number.isFinite(v) && v >= 0)) { setError('Enter amounts in rupees, like 50000.'); return; }
        setError('');
        setStep(2);
    }
    function startFresh() {
        const salaryPaise = salary === '' ? 0 : toPaise(salary);
        const familyContributionPaise = family === '' ? 0 : toPaise(family);
        finish((st) => {
            const planned = setPlan(st, { salaryPaise, familyContributionPaise });
            return salaryCame && salaryPaise > 0
                ? addTx(planned, { date: salaryDate, amountPaise: salaryPaise, flow: 'in', type: 'income', category: 'Salary', description: 'Salary' })
                : planned;
        });
    }
    return (
        <main className="main" style={{ maxWidth: 520, paddingBottom: 40 }}>
            <Toaster position="bottom-center" />
            <div className="page-in stack-l" key={step}>
                <div>
                    <p className="small mute">Step {step + 1} of 3</p>
                    <h1 className="page-title">{['Welcome to myGroww', 'Your monthly money', 'Bring in your data'][step]}</h1>
                </div>
                {step === 0 && (
                    <>
                        <p>See what is safe to spend after family, bills and savings, and how each rupee moves your goals closer. Your data stays on this device.</p>
                        <section><h2 className="section-title">Choose your look</h2><div className="card"><ThemePicker /></div></section>
                        <button type="button" className="btn btn-primary btn-block" onClick={() => setStep(1)}>Continue</button>
                    </>
                )}
                {step === 1 && (
                    <form onSubmit={next} className="stack">
                        <label className="field" htmlFor="w-salary">Monthly salary (₹)<input id="w-salary" inputMode="decimal" autoFocus value={salary} onChange={(e) => setSalary(e.target.value)} /></label>
                        <label className="field" htmlFor="w-family">Money you give family each month (₹)<input id="w-family" inputMode="decimal" placeholder="0" value={family} onChange={(e) => setFamily(e.target.value)} /></label>
                        <label className="check"><input id="w-came" type="checkbox" checked={salaryCame} onChange={(e) => setSalaryCame(e.target.checked)} />My latest salary has come in</label>
                        {salaryCame && <label className="field" htmlFor="w-date">It came on<input id="w-date" type="date" max={todayISO()} value={salaryDate} onChange={(e) => setSalaryDate(e.target.value)} /></label>}
                        {error && <p className="bad small" role="alert">{error}</p>}
                        <button type="submit" className="btn btn-primary btn-block">Continue</button>
                        <button type="button" className="btn btn-ghost btn-block" onClick={() => setStep(0)}>Back</button>
                    </form>
                )}
                {step === 2 && (
                    <>
                        <button type="button" className="btn btn-primary btn-block" onClick={startFresh}>Start fresh</button>
                        <div>
                            <h2 className="section-title">Or import what you have</h2>
                            <ImportSection onDone={() => finish((st) => setPlan(st, { salaryPaise: salary === '' ? 0 : toPaise(salary), familyContributionPaise: family === '' ? 0 : toPaise(family) }))} />
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
