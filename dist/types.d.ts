/** Copy shown in a single confirm prompt. */
export interface ConfirmOptions {
    /** Heading. The one required field — say what is about to happen. */
    title: string;
    /** Supporting line. Omitted entirely when absent (the element is hidden). */
    message?: string;
    /** Label on the affirmative button. Defaults to the instance's text. */
    confirmLabel?: string;
    /** Label on the safe button. Defaults to the instance's text. */
    cancelLabel?: string;
    /** Render the affirmative button in the destructive colour. */
    danger?: boolean;
}
/** Fallback copy for prompts that do not spell it out. */
export interface DialogTexts {
    title: string;
    confirmLabel: string;
    cancelLabel: string;
}
export interface DialogConfig {
    /**
     * Where the dialog is appended. Defaults to `document.body`. The element's
     * owning document is also where the dialog lives, so an iframe container
     * works without extra wiring.
     */
    container?: HTMLElement;
    /** Overrides for the default labels. */
    texts?: Partial<DialogTexts>;
}
export interface WireFormsOptions {
    /** Where the delegated submit listener is bound. Defaults to `document`. */
    root?: Document | HTMLElement;
    /** Title used when a form omits `data-confirm-title`. */
    defaultTitle?: string;
    /** Confirm label used when a form omits `data-confirm-label`. */
    defaultConfirmLabel?: string;
    /** Cancel label for every prompt this wiring raises. */
    cancelLabel?: string;
}
/**
 * Width caps, applied to the promoted dialog only — in flow the container
 * decides. `sm`, `md` and `lg` are reading measures; `xl` is for a dialog
 * holding a table rather than a sentence, and takes the viewport up to a point.
 */
export type DialogSize = "sm" | "md" | "lg" | "xl";
/** What `dialogAttrs()` needs to describe a server-rendered dialog. */
export interface DialogAttrOptions {
    /** @default "md" */
    size?: DialogSize;
    /**
     * Where dismissing goes. Same document (query only) → the parameter is
     * dropped with `replaceState` and nothing reloads. Different document →
     * a navigation, with the dialog held open until it lands.
     *
     * Omit it and Escape and the backdrop do nothing: there is nowhere to
     * dismiss *to*, because the dialog is the page's content rather than an
     * overlay on top of it.
     */
    closeHref?: string;
    /** Ignore backdrop clicks. Escape still dismisses. @default false */
    disableOverlayClose?: boolean;
}
