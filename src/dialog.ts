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
  /** The overlay element, in case a host needs to inspect or restyle it. */
  readonly element: HTMLElement;
  /**
   * Remove the overlay and its listener. A pending prompt resolves `false`.
   * Safe to call more than once; every later `confirm` rejects.
   */
  destroy(): void;
}

// Instances get unique ARIA ids so two dialogs on one page never point a
// screen reader at each other's heading.
let seq = 0;

export function createDialog(config: DialogConfig = {}): DialogInstance {
  const container = config.container ?? document.body;
  const doc = container.ownerDocument;
  const texts: DialogTexts = { ...DEFAULT_TEXTS, ...config.texts };
  const uid = ++seq;

  let pending: ((confirmed: boolean) => void) | null = null;
  let lastFocused: HTMLElement | null = null;
  let destroyed = false;

  const overlay = doc.createElement("div");
  overlay.setAttribute("data-bd-root", "");
  overlay.className = "bd-overlay";

  const panel = doc.createElement("div");
  panel.className = "bd-dialog";
  panel.setAttribute("role", "alertdialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", `bd-title-${uid}`);
  panel.setAttribute("aria-describedby", `bd-message-${uid}`);

  const title = doc.createElement("h2");
  title.className = "bd-title";
  title.id = `bd-title-${uid}`;

  const message = doc.createElement("p");
  message.className = "bd-message";
  message.id = `bd-message-${uid}`;

  const actions = doc.createElement("div");
  actions.className = "bd-actions";

  const cancelBtn = doc.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "bd-cancel";

  const confirmBtn = doc.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "bd-confirm";

  actions.append(cancelBtn, confirmBtn);
  panel.append(title, message, actions);
  overlay.append(panel);
  container.append(overlay);

  const settle = (confirmed: boolean) => {
    const resolve = pending;
    pending = null;
    overlay.classList.remove("is-open");
    lastFocused?.focus();
    lastFocused = null;
    resolve?.(confirmed);
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (!pending) return;
    if (e.key === "Escape") {
      e.preventDefault();
      settle(false);
      return;
    }
    // Two focusable controls, so the trap is just a toggle between them.
    if (e.key === "Tab") {
      e.preventDefault();
      const next =
        doc.activeElement === cancelBtn ? confirmBtn : cancelBtn;
      next.focus();
    }
  };

  cancelBtn.addEventListener("click", () => settle(false));
  confirmBtn.addEventListener("click", () => settle(true));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) settle(false);
  });
  doc.addEventListener("keydown", onKeydown);

  return {
    element: overlay,

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
        confirmBtn.classList.toggle("is-danger", opts.danger === true);

        lastFocused =
          doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
        overlay.classList.add("is-open");
        // Focus the safe choice — a stray Enter must never destroy anything.
        cancelBtn.focus();
      });
    },

    destroy() {
      if (pending) settle(false);
      doc.removeEventListener("keydown", onKeydown);
      overlay.remove();
      destroyed = true;
    },
  };
}
