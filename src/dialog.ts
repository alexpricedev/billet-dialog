import { activateDialog } from "./activate";
import { BD } from "./markup";
import type { ConfirmOptions, DialogConfig, DialogTexts } from "./types";

export const DEFAULT_TEXTS: DialogTexts = {
  title: "Are you sure?",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
};

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

// Instances get unique ARIA ids so two dialogs on one page never point a
// screen reader at each other's heading.
let seq = 0;

/**
 * Build an independent confirm prompt.
 *
 * The element is a native `<dialog>`, left closed until the first prompt, and
 * promoted with `showModal()` for each one. The top layer, the `::backdrop`,
 * the focus trap, the inert page behind and Escape all come from the browser
 * — which is the reason this is a `<dialog>` and not a positioned `<div>` with
 * a hand-rolled Tab cycle.
 */
export function createDialog(config: DialogConfig = {}): DialogInstance {
  const container = config.container ?? document.body;
  const doc = container.ownerDocument;
  const texts: DialogTexts = { ...DEFAULT_TEXTS, ...config.texts };
  const uid = ++seq;

  let pending: ((confirmed: boolean) => void) | null = null;
  let release: (() => void) | null = null;
  let lastFocused: HTMLElement | null = null;
  let destroyed = false;

  const dialog = doc.createElement("dialog");
  dialog.setAttribute("data-bd-root", "");
  dialog.setAttribute("data-bd-size", "sm");
  // `alertdialog` rather than the implicit `dialog`: this interrupts to ask a
  // question whose wrong answer is destructive, which is exactly the
  // distinction the role draws. `aria-modal` is set because `showModal()`
  // conveys modality to the browser but not, in every engine, to the tree.
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", `bd-title-${uid}`);
  dialog.setAttribute("aria-describedby", `bd-message-${uid}`);

  const header = doc.createElement("div");
  header.className = BD.header;

  const heading = doc.createElement("div");
  heading.className = BD.heading;

  const title = doc.createElement("h2");
  title.className = BD.title;
  title.id = `bd-title-${uid}`;

  const message = doc.createElement("p");
  message.className = BD.description;
  message.id = `bd-message-${uid}`;

  const footer = doc.createElement("div");
  footer.className = BD.footer;

  const cancelBtn = doc.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = BD.cancel;

  const confirmBtn = doc.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = BD.confirm;

  heading.append(title, message);
  header.append(heading);
  footer.append(cancelBtn, confirmBtn);
  dialog.append(header, footer);
  container.append(dialog);

  const settle = (confirmed: boolean) => {
    const resolve = pending;
    pending = null;
    // Unbinds the listeners and closes the dialog, in that order, so the close
    // is not read back as a second dismissal.
    release?.();
    release = null;
    lastFocused?.focus();
    lastFocused = null;
    resolve?.(confirmed);
  };

  cancelBtn.addEventListener("click", () => settle(false));
  confirmBtn.addEventListener("click", () => settle(true));

  return {
    element: dialog,

    isOpen: () => pending !== null,

    confirm(opts: ConfirmOptions): Promise<boolean> {
      if (destroyed) {
        return Promise.reject(
          new Error("billet-dialog: this dialog has been destroyed"),
        );
      }
      // A second prompt supersedes anything still open.
      if (pending) settle(false);

      return new Promise<boolean>((resolve) => {
        pending = resolve;
        title.textContent = opts.title || texts.title;
        message.textContent = opts.message ?? "";
        message.hidden = !opts.message;
        confirmBtn.textContent = opts.confirmLabel ?? texts.confirmLabel;
        cancelBtn.textContent = opts.cancelLabel ?? texts.cancelLabel;
        confirmBtn.classList.toggle(BD.danger, opts.danger === true);

        lastFocused =
          doc.activeElement instanceof HTMLElement ? doc.activeElement : null;

        // Promotes the dialog and wires Escape, the backdrop, and any close
        // that bypasses both. `closeOnDismiss` so a dismissal shuts the dialog
        // here — there is no owner to wait for and nowhere to navigate to.
        release = activateDialog(dialog, {
          dismiss: () => settle(false),
          closeOnDismiss: true,
        });

        // Focus the safe choice — a stray Enter must never destroy anything.
        // The browser's own dialog focusing steps would land here anyway, since
        // Cancel is the first focusable child, but the order of the two buttons
        // is a visual decision and this must not depend on it.
        cancelBtn.focus();
      });
    },

    destroy() {
      if (pending) settle(false);
      release?.();
      release = null;
      dialog.remove();
      destroyed = true;
    },
  };
}
