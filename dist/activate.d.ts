export interface ActivateOptions {
    /** Called for Escape and a backdrop click. */
    dismiss: () => void;
    /** Ignore backdrop clicks. Escape still dismisses. @default false */
    disableOverlayClose?: boolean;
    /**
     * Close the dialog as part of dismissing it. @default false
     *
     * Off suits the two cases this was written for: a controlled component whose
     * `open` prop is still true must not find its dialog shut, and a dialog
     * dismissed by navigating away should stay on screen until the next page
     * arrives rather than flashing the old one underneath.
     *
     * On is for a dialog that dismisses **within the same document** — one whose
     * close href differs only in the query string. There the owner has nothing to
     * wait for, and leaving the dialog up makes Escape look like it did nothing.
     *
     * It closes the dialog here rather than letting the browser's own default
     * action do it. The default action only exists behind a *trusted* Escape, so
     * leaning on it would leave the dialog open for anything else that dispatches
     * `cancel` — and would make the behaviour depend on an engine detail rather
     * than on this file.
     */
    closeOnDismiss?: boolean;
}
/**
 * Promote a `<dialog open>` to a real modal and wire its two dismissal paths.
 *
 * Returns a cleanup function that unbinds the listeners and closes the dialog,
 * which is what makes the browser hand focus back to whatever had it.
 */
export declare function activateDialog(dialog: HTMLDialogElement, { dismiss, disableOverlayClose, closeOnDismiss, }: ActivateOptions): () => void;
/** `matches(":modal")`, surviving an engine that does not know the selector. */
export declare function isModal(dialog: HTMLDialogElement): boolean;
/**
 * Put focus back in the dialog's own `autofocus` field.
 *
 * `showModal()` already runs the browser's dialog focusing steps, which focus a
 * descendant carrying `autofocus` — so why this? Because a server-rendered
 * dialog is usually reached by a fragment (`/library?add=1#add-product`), and
 * the browser re-runs its fragment scroll once the document has finished
 * loading. The fragment names the dialog, the dialog is focusable, so the
 * fragment takes focus back off the field a few milliseconds after the
 * promotion. Measured in Chromium at ~10ms, against a promotion at ~8ms;
 * happy-dom has no fragment scroll and cannot see it either way.
 *
 * Claimed on the next frame and again at `load`, because those are the two
 * moments the fragment scroll can land, and *only* while focus is still where
 * the promotion or the fragment left it — a reader who has moved on is not
 * yanked back. Nothing here runs for a dialog with no `autofocus` descendant,
 * which is most dialogs.
 */
export declare function claimAutofocus(dialog: HTMLDialogElement): void;
