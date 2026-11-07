const PATHS = {
    home: <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M7.4 8 11 15.8M16.6 8 13 15.8" /></>,
    activity: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    plan: <><circle cx="5" cy="18.5" r="2" /><circle cx="19" cy="5.5" r="2" /><path d="M7 18.5h6a3 3 0 0 0 3-3v-7a3 3 0 0 1 1.2-2.4" /></>,
    wealth: <><path d="M4 20h16" /><path d="M6 15.5 10 11l3 3 5-6.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <path d="m15 5-7 7 7 7" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    edit: <path d="M4 20h4L19 9l-4-4L4 16v4Z" />,
    trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    del: <><path d="M9 5h11v14H9l-6-7 6-7Z" /><path d="m12 9.5 5 5M17 9.5l-5 5" /></>,
};

export function Icon({ name, size = 24 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {PATHS[name]}
        </svg>
    );
}
