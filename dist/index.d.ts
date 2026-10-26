import { type DialogInstance } from "./dialog";
import type { ConfirmOptions, DialogConfig, WireFormsOptions } from "./types";
export { activateDialog, claimAutofocus, isModal } from "./activate";
export type { ActivateOptions } from "./activate";
export { createDialog, DEFAULT_TEXTS } from "./dialog";
export type { DialogInstance } from "./dialog";
export { wireConfirmForms } from "./forms";
export { BD, DIALOG_SIZES, dialogAttrs } from "./markup";
export type { ConfirmOptions, DialogAttrOptions, DialogConfig, DialogSize, DialogTexts, WireFormsOptions, } from "./types";
export { upgradeDialogs } from "./upgrade";
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
