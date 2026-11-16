import { type DialogInstance } from "./dialog.js";
import type { ConfirmOptions, DialogConfig, WireFormsOptions } from "./types.js";
export { activateDialog, claimAutofocus, isModal } from "./activate.js";
export type { ActivateOptions } from "./activate.js";
export { createDialog, DEFAULT_TEXTS } from "./dialog.js";
export type { DialogInstance } from "./dialog.js";
export { wireConfirmForms } from "./forms.js";
export { wireDialogLinks } from "./links.js";
export type { DialogLinkOptions } from "./links.js";
export { BD, DIALOG_SIZES, dialogAttrs } from "./markup.js";
export type { ConfirmOptions, DialogAttrOptions, DialogConfig, DialogSize, DialogTexts, WireFormsOptions, } from "./types.js";
export { upgradeDialogs } from "./upgrade.js";
export declare const Dialog: {
    /**
     * Configure the shared instance before first use. Calling this after the
     * dialog exists rebuilds it, so a pending prompt resolves `false`.
     */
    init(config?: DialogConfig): DialogInstance;
    /** The shared instance, or `null` if nothing has built it yet. */
    current(): DialogInstance | null;
    /** Prompt through the shared instance, building it if needed. */
    confirm(opts: ConfirmOptions): Promise<boolean>;
    /** Wire `[data-confirm]` forms to the shared instance. */
    wireForms(opts?: WireFormsOptions): () => void;
    /** Tear the shared instance down. Safe when nothing was ever built. */
    destroy(): void;
};
export default Dialog;
