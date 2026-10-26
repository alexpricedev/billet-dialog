import type { DialogAttrOptions, DialogSize } from "./types";
/**
 * The class names the stylesheet owns.
 *
 * A host framework renders its own markup — this package cannot render Preact,
 * React or a server template — so the contract between that markup and
 * `styles.css` has to be published, or the two drift the first time either is
 * edited. Spell a class name out in a template and nothing fails; import it
 * from here and a rename is a type error.
 */
export declare const BD: {
    /** Header row: the heading block, plus the close control on the right. */
    readonly header: "bd-header";
    /** Column holding eyebrow, title and description. */
    readonly heading: "bd-heading";
    /** Small line above the title. Outside the accessible name. */
    readonly eyebrow: "bd-eyebrow";
    /** The `h2`. `aria-labelledby` should point at this and nothing else. */
    readonly title: "bd-title";
    /** Supporting line under the title, and the confirm prompt's message. */
    readonly description: "bd-description";
    /** Top-right dismiss control — a `<button>` or, server-side, an `<a>`. */
    readonly close: "bd-close";
    /** The scrolling content area. Omit it entirely for a confirm. */
    readonly body: "bd-body";
    /** Action row, pinned to the bottom and right-aligned. */
    readonly footer: "bd-footer";
    /** Visually hidden text, for a close control with only an icon. */
    readonly srOnly: "bd-sr-only";
    /** The confirm prompt's safe button. */
    readonly cancel: "bd-cancel";
    /** The confirm prompt's affirmative button. */
    readonly confirm: "bd-confirm";
    /** On the confirm button, for a destructive action. */
    readonly danger: "is-danger";
};
/**
 * The attributes that turn a `<dialog>` into one of ours.
 *
 * Spread onto the element; add `open` yourself, since only the caller knows
 * whether the dialog is being rendered open. `data-bd-root` is both the opt-in
 * `upgradeDialogs()` looks for and the element every CSS token is declared on,
 * so a dialog without it is styled by nothing and upgraded by nothing.
 *
 * ```tsx
 * <dialog open {...dialogAttrs({ size: "lg", closeHref: "/library" })}>
 * ```
 */
export declare function dialogAttrs({ size, closeHref, disableOverlayClose, }?: DialogAttrOptions): Record<string, string>;
/** The sizes `data-bd-size` accepts, for a host that wants to validate one. */
export declare const DIALOG_SIZES: readonly DialogSize[];
