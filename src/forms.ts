import type { DialogInstance } from "./dialog";
import type { WireFormsOptions } from "./types";

const submitForm = (
  form: HTMLFormElement,
  submitter: HTMLElement | null,
): void => {
  form.dataset.confirmed = "true";
  try {
    // `requestSubmit(submitter)` because a submit button's own `name`/`value`
    // are part of the payload, and a bare resubmit drops them — which turns
    // "remove this row" into "save", silently, on the approved pass.
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit(isSubmitButton(submitter) ? submitter : undefined);
    } else {
      form.submit();
    }
  } finally {
    // The marker is for exactly one pass. `requestSubmit` dispatches the submit
    // event synchronously, so by here the listener has already waved it
    // through and the navigation is queued. Leaving it set would make a form
    // that stays on the page — one gated per *button*, with a row of them —
    // answer every later press without asking.
    delete form.dataset.confirmed;
  }
};

const isSubmitButton = (
  node: HTMLElement | null,
): node is HTMLButtonElement | HTMLInputElement =>
  (node instanceof HTMLButtonElement || node instanceof HTMLInputElement) &&
  node.type === "submit";

/** Where this submission's copy comes from: the button pressed, or the form. */
const sourceOf = (
  form: HTMLFormElement,
  submitter: HTMLElement | null,
): HTMLElement | null => {
  if (submitter && submitter.dataset["confirm"] !== undefined) return submitter;
  if (form.dataset.confirm !== undefined) return form;
  return null;
};

/**
 * Gate `[data-confirm]` submissions behind `dialog`, through one delegated
 * listener. A form without JavaScript still posts straight through, so this
 * stays pure progressive enhancement.
 *
 * Attributes read off the form **or off the submit button that was pressed**:
 * - `data-confirm` — the message, and the opt-in. Absent means untouched.
 * - `data-confirm-title` — heading override.
 * - `data-confirm-label` — confirm button override.
 * - `data-confirm-danger="false"` — drop the destructive styling.
 *
 * Putting them on the button is for the form that does more than one thing —
 * a table of rows with a Save and a trash on every row, all posting together
 * so nothing typed is lost. There, gating the *form* would gate Save as well.
 * A button's attributes win over the form's, so a form-level `data-confirm`
 * and one button that opts out of it is not expressible; that is deliberate,
 * because a form whose Save is gated and whose Delete is not is a bug.
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
    // Set by submitForm below: this is the pass we already approved.
    if (form.dataset.confirmed === "true") return;

    const submitter =
      "submitter" in e && e.submitter instanceof HTMLElement
        ? e.submitter
        : null;
    const source = sourceOf(form, submitter);
    if (!source) return;

    e.preventDefault();
    void dialog
      .confirm({
        title: source.dataset["confirmTitle"] ?? opts.defaultTitle ?? "",
        message: source.dataset["confirm"],
        confirmLabel:
          source.dataset["confirmLabel"] ?? opts.defaultConfirmLabel,
        cancelLabel: opts.cancelLabel,
        danger: source.dataset["confirmDanger"] !== "false",
      })
      .then((confirmed) => {
        if (confirmed) submitForm(form, submitter);
      })
      // A destroyed dialog must not leave an unhandled rejection behind. The
      // form simply stays unsubmitted, which is the safe outcome.
      .catch(() => {});
  };

  root.addEventListener("submit", onSubmit);
  return () => root.removeEventListener("submit", onSubmit);
}
