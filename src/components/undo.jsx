import toast from 'react-hot-toast';
import { commit } from '../store';

/** Applies a change and offers Undo for a few seconds. */
export function changeWithUndo(message, change) {
    let before;
    commit((state) => { before = state; return change(state); });
    toast((t) => (
        <span className="row">
            {message}
            <button type="button" className="btn btn-ghost btn-small" onClick={() => { commit(() => before); toast.dismiss(t.id); }}>Undo</button>
        </span>
    ), { duration: 6000 });
}
