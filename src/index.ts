import { createDialog, type DialogInstance } from "./dialog";
import { wireConfirmForms } from "./forms";
import type { ConfirmOptions, DialogConfig, WireFormsOptions } from "./types";

export { activateDialog, claimAutofocus, isModal } from "./activate";
export type { ActivateOptions } from "./activate";
export { createDialog, DEFAULT_TEXTS } from "./dialog";
export type { DialogInstance } from "./dialog";
export { wireConfirmForms } from "./forms";
export { BD, DIALOG_SIZES, dialogAttrs } from "./markup";
export type {
  ConfirmOptions,
  DialogAttrOptions,
  DialogConfig,
  DialogSize,
  DialogTexts,
  WireFormsOptions,
} from "./types";
export { upgradeDialogs } from "./upgrade";

// A shared instance for the common case: one app, one dialog. Built on first
// use so importing the package never touches the DOM. Reach for
// `createDialog` directly when you need two of them, or one inside an iframe.
let shared: DialogInstance | null = null;
let sharedConfig: DialogConfig = {};

const ensure = (): DialogInstance => {
  shared ??= createDialog(sharedConfig);
  return shared;
};

export const Dialog = {
  /**
   * Configure the shared instance before first use. Calling this after the
   * dialog exists rebuilds it, so a pending prompt resolves `false`.
   */
  init(config: DialogConfig = {}): DialogInstance {
    if (shared) shared.destroy();
    sharedConfig = config;
    shared = createDialog(config);
    return shared;
  },

  /** The shared instance, or `null` if nothing has built it yet. */
  current(): DialogInstance | null {
    return shared;
  },

  /** Prompt through the shared instance, building it if needed. */
  confirm(opts: ConfirmOptions): Promise<boolean> {
    return ensure().confirm(opts);
  },

  /** Wire `[data-confirm]` forms to the shared instance. */
  wireForms(opts: WireFormsOptions = {}): () => void {
    return wireConfirmForms(ensure(), opts);
  },

  /** Tear the shared instance down. Safe when nothing was ever built. */
  destroy(): void {
    shared?.destroy();
    shared = null;
  },
};

export default Dialog;
