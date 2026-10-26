export interface DialogLinkOptions {
    /** Called with the dialog after it is in the document, before promotion. */
    onAdopt?: (dialog: HTMLDialogElement, source: Document) => void;
    /** Override for tests. @default globalThis.fetch */
    fetch?: typeof fetch;
}
/**
 * Turn every `<a data-bd-link>` into an in-place dialog open.
 *
 * Returns a cleanup that removes both listeners and tears down any dialog
 * still on screen.
 */
export declare function wireDialogLinks({ onAdopt, fetch: fetchImpl, }?: DialogLinkOptions): () => void;
