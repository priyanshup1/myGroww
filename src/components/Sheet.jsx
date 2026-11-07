import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';

const isWide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], textarea:not([disabled])';

/** A bottom sheet you can flick away. On laptops it becomes a centred dialog. */
export function Sheet({ open, onClose, label, children }) {
    const panel = useRef(null);
    const controls = useDragControls();
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        const onKey = (e) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab' || !panel.current) return;
            const items = [...panel.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        const timer = setTimeout(() => {
            if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus();
        }, 30);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
            previous?.focus?.();
        };
    }, [open, onClose]);
    const wide = isWide();
    const startDrag = (e) => { if (e.target.closest('[data-drag]') && !e.target.closest('button')) controls.start(e); };
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div key="backdrop" className="backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
                    <motion.div
                        key="sheet"
                        ref={panel}
                        tabIndex={-1}
                        className="sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-label={label}
                        initial={wide ? { opacity: 0, scale: 0.97 } : { y: '100%' }}
                        animate={wide ? { opacity: 1, scale: 1 } : { y: 0 }}
                        exit={wide ? { opacity: 0, scale: 0.98 } : { y: '100%' }}
                        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                        drag={wide ? false : 'y'}
                        dragListener={false}
                        dragControls={controls}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0.04, bottom: 0.7 }}
                        onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 500) onClose(); }}
                        onPointerDown={startDrag}
                    >
                        <div className="sheet-handle" data-drag><i /></div>
                        <div className="sheet-body">{children}</div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
