import React, { useRef } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import GlassCard from '../components/GlassCard';
import DataControls from '../components/DataControls';
import BackButton from '../components/BackButton';
import { formatRupee } from '../components/EditableNumber';
import { SIP_CATEGORIES } from '../data/defaults';

function parseCoinCsv(text) {
    const lines = text.trim().split('\n');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;
        const fundName = cols[0] || `Fund ${i}`;
        const invested = parseFloat(cols[4]) || parseFloat(cols[3]) || parseFloat(cols[2]) || 0;

        const lower = fundName.toLowerCase();
        let category = 'Other';
        if (lower.includes('index') || lower.includes('nifty') || lower.includes('sensex')) category = 'Index Funds';
        else if (lower.includes('flexi') || lower.includes('multi')) category = 'Flexi Cap';
        else if (lower.includes('small')) category = 'Small Cap';
        else if (lower.includes('large')) category = 'Large Cap';
        else if (lower.includes('gold')) category = 'Gold ETF';
        else if (lower.includes('debt') || lower.includes('liquid') || lower.includes('overnight')) category = 'Debt Fund';
        else if (lower.includes('international') || lower.includes('global') || lower.includes('us')) category = 'International';

        rows.push({
            id: Date.now() + '_' + i,
            fundName,
            category,
            monthlySip: 0,
            startDate: '2026-03-01', // Default to current
            lumpsum: invested,
            lumpsumDate: '2026-03-01',
        });
    }
    return rows;
}

export default function SipTrackerPage() {
    const {
        sips,
        addSip,
        updateSip,
        deleteSip,
        setSips,
        totalMonthlySip,
        totalLumpsum,
        totalInvested,
        income,
        sipsWithTotals
    } = useFinanceData();
    const csvRef = useRef(null);

    function handleAddRow() {
        addSip({
            id: Date.now().toString(),
            fundName: 'New Fund',
            category: 'Index Funds',
            monthlySip: 0,
            startDate: '2026-03-01',
            lumpsum: 0,
            lumpsumDate: '',
        });
    }

    function handleCsvImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const imported = parseCoinCsv(ev.target.result);
            if (imported.length > 0) {
                setSips((prev) => [...prev, ...imported]);
                alert(`✓ Imported ${imported.length} funds from CSV`);
            } else {
                alert('No recognizable data found in CSV. Check format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    const sipRatio = income > 0 ? ((totalMonthlySip / income) * 100).toFixed(1) : 0;

    return (
        <div className="page-layout">
            <div className="page-header">
                <div className="container">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="flex items-center gap-3">
                            <BackButton />
                            <div>
                                <div className="section-title">SIP Tracker</div>
                                <h2 style={{ fontSize: 'clamp(1rem,2.5vw,1.35rem)' }}>📈 Mutual Fund SIPs</h2>
                            </div>
                        </div>
                        <DataControls />
                    </div>
                </div>
            </div>

            <div className="container" style={{ paddingTop: 32 }}>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'Monthly SIP Total', value: formatRupee(totalMonthlySip), sub: `${sipRatio}% of income` },
                        { label: 'Total Lumpsum', value: formatRupee(totalLumpsum), sub: 'One-time investments' },
                        { label: 'Calculated Total', value: formatRupee(totalInvested), sub: 'SIPs × months + Lumpsum' },
                    ].map((item) => (
                        <GlassCard key={item.label} className="animate-in" style={{ padding: '18px 22px' }}>
                            <div className="section-title mb-1">{item.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{item.value}</div>
                            <div className="label mt-1 opacity-60">{item.sub}</div>
                        </GlassCard>
                    ))}
                </div>

                {/* Table */}
                <GlassCard style={{ padding: '24px' }} className="animate-in stagger-2">
                    <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 10 }}>
                        <div className="section-title" style={{ margin: 0 }}>Fund List</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-icon" onClick={() => csvRef.current.click()}>
                                ↑ Import CSV
                            </button>
                            <button className="btn btn-primary btn-icon" onClick={handleAddRow}>+ Add Fund</button>
                            <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
                        </div>
                    </div>

                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fund Name</th>
                                    <th>Category</th>
                                    <th>SIP (₹)</th>
                                    <th>Start Date</th>
                                    <th>Lumpsum (₹)</th>
                                    <th>Calculated (₹)</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sipsWithTotals.map((sip) => (
                                    <tr key={sip.id}>
                                        <td>
                                            <input
                                                value={sip.fundName}
                                                onChange={(e) => updateSip(sip.id, 'fundName', e.target.value)}
                                                style={{ width: 140 }}
                                            />
                                        </td>
                                        <td>
                                            <select
                                                value={sip.category}
                                                onChange={(e) => updateSip(sip.id, 'category', e.target.value)}
                                                style={{ width: 110 }}
                                            >
                                                {SIP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={sip.monthlySip || 0}
                                                onChange={(e) => updateSip(sip.id, 'monthlySip', parseFloat(e.target.value) || 0)}
                                                style={{ width: 80 }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="date"
                                                value={sip.startDate || ''}
                                                onChange={(e) => updateSip(sip.id, 'startDate', e.target.value)}
                                                style={{ width: 115, fontSize: '0.75rem' }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={sip.lumpsum || 0}
                                                onChange={(e) => updateSip(sip.id, 'lumpsum', parseFloat(e.target.value) || 0)}
                                                style={{ width: 90 }}
                                            />
                                        </td>
                                        <td style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                            {formatRupee(sip.calculatedTotal)}
                                        </td>
                                        <td>
                                            <button className="btn btn-danger btn-icon" onClick={() => deleteSip(sip.id)}>✕</button>
                                        </td>
                                    </tr>
                                ))}
                                {sips.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
                                            No funds yet — click "+ Add Fund" or import a CSV
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2} style={{ fontWeight: 700, paddingTop: 12 }}>Total</td>
                                    <td style={{ fontWeight: 700, color: 'var(--accent-gold)', paddingTop: 12 }}>
                                        {formatRupee(totalMonthlySip)}
                                    </td>
                                    <td></td>
                                    <td style={{ fontWeight: 700, color: 'var(--accent-gold)', paddingTop: 12 }}>
                                        {formatRupee(totalLumpsum)}
                                    </td>
                                    <td style={{ fontWeight: 700, color: 'var(--accent-gold)', paddingTop: 12 }}>
                                        {formatRupee(totalInvested)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
