/**
 * Builds a calendar file of bills, SIPs and card due dates. The phone's own calendar
 * then reminds you even with the app closed, with no server involved.
 */
import { addDays, addMonths } from './dates';
import { formatINR } from './money';

const FREQ = { monthly: 'FREQ=MONTHLY', quarterly: 'FREQ=MONTHLY;INTERVAL=3', yearly: 'FREQ=YEARLY' };

const escapeText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = (iso) => iso.replace(/-/g, '');

function clampedDate(year, month, day) {
    const last = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/** The next date on or after today for this day of month, and month if it has one. */
function firstOccurrence(today, day, month) {
    const [y, m] = today.split('-').map(Number);
    if (month) {
        const date = clampedDate(y, month, day);
        return date >= today ? date : clampedDate(y + 1, month, day);
    }
    const date = clampedDate(y, m, day);
    return date >= today ? date : addMonths(date, 1);
}

function event({ uid, date, title, rrule, stamp }) {
    return [
        'BEGIN:VEVENT',
        `UID:${uid}@mygroww`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(date)}`,
        `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
        `SUMMARY:${escapeText(title)}`,
        rrule ? `RRULE:${rrule}` : null,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(title)}`,
        'TRIGGER:-PT9H',
        'END:VALARM',
        'END:VEVENT',
    ].filter(Boolean).join('\r\n');
}

export function buildCalendar(state, today, stamp = '20260101T000000Z') {
    const events = [];
    state.recurring.forEach((r) => {
        const anchor = r.frequency === 'monthly' ? null : r.dueMonth;
        events.push(event({ uid: r.id, date: firstOccurrence(today, r.dueDay ?? 1, anchor), title: `${r.name} ${formatINR(r.amountPaise)} due`, rrule: FREQ[r.frequency] ?? FREQ.monthly, stamp }));
    });
    state.funds.filter((f) => f.sipDay && f.monthlySipPaise > 0).forEach((f) => {
        events.push(event({ uid: f.id, date: firstOccurrence(today, f.sipDay), title: `${f.name} SIP ${formatINR(f.monthlySipPaise)}`, rrule: FREQ.monthly, stamp }));
    });
    if (state.card?.dueDay && state.transactions.some((t) => t.type === 'card_bill' || t.account === 'credit')) {
        events.push(event({ uid: 'card-bill', date: firstOccurrence(today, state.card.dueDay), title: 'Credit card bill due', rrule: FREQ.monthly, stamp }));
    }
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//myGroww//Reminders//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
}
