import type { DialogInstance } from "./dialog";
import type { WireFormsOptions } from "./types";

const submitForm = (form: HTMLFormElement) => {
  form.dataset.confirmed = "true";
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.submit();
  }
};

/**
 * Gate every `[data-confirm]` form behind `dialog`, through one delegated
 * listener. A form without JavaScript still posts straight through, so this
 * stays pure progressive enhancement.
 *
 * Attributes read off the form:
 * - `data-confirm` — the message, and the opt-in. Absent means untouched.
 * - `data-confirm-title` — heading override.
 * - `data-confirm-label` — confirm button override.
 * - `data-confirm-danger="false"` — drop the destructive styling.
 *
 * Returns a function that removes the listener.
 */
export function wireConfirmForms(
  dialog: DialogInstance,
  opts: WireFormsOptions = {},
): () => void {
  const root = opts.root ?? document;

  const onSubmit = (e: Event) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.confirm === undefined) return;
    // Set by submitForm below: this is the pass we already approved.
    if (form.dataset.confirmed === "true") return;

    e.preventDefault();
    void dialog
      .confirm({
        title: form.dataset.confirmTitle ?? opts.defaultTitle ?? "",
        message: form.dataset.confirm,
        confirmLabel: form.dataset.confirmLabel ?? opts.defaultConfirmLabel,
        cancelLabel: opts.cancelLabel,
        danger: form.dataset.confirmDanger !== "false",
      })
      .then((confirmed) => {
        if (confirmed) submitForm(form);
      })
      // A destroyed dialog must not leave an unhandled rejection behind. The
      // form simply stays unsubmitted, which is the safe outcome.
      .catch(() => {});
  };

  root.addEventListener("submit", onSubmit);
  return () => root.removeEventListener("submit", onSubmit);
}
