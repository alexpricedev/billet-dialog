import type { ConfirmOptions, DialogConfig, DialogTexts } from "./types";
export declare const DEFAULT_TEXTS: DialogTexts;
export interface DialogInstance {
    /**
     * Open the dialog and resolve with the user's answer. Escape, the backdrop,
     * and the cancel button all resolve `false`; only the confirm button
     * resolves `true`. A second call supersedes a prompt still on screen, which
     * resolves `false` first.
     */
    confirm(opts: ConfirmOptions): Promise<boolean>;
    /** True while a prompt is awaiting an answer. */
    isOpen(): boolean;
    /** The dialog element, in case a host needs to inspect or restyle it. */
    readonly element: HTMLDialogElement;
    /**
     * Remove the dialog and its listeners. A pending prompt resolves `false`.
     * Safe to call more than once; every later `confirm` rejects.
     */
    destroy(): void;
}
/**
 * Build an independent confirm prompt.
 *
 * The element is a native `<dialog>`, left closed until the first prompt, and
 * promoted with `showModal()` for each one. The top layer, the `::backdrop`,
 * the focus trap, the inert page behind and Escape all come from the browser
 * — which is the reason this is a `<dialog>` and not a positioned `<div>` with
 * a hand-rolled Tab cycle.
 */
export declare function createDialog(config?: DialogConfig): DialogInstance;
