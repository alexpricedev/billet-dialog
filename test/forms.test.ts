import { afterEach, describe, expect, mock, test } from "bun:test";
import { createDialog, type DialogInstance } from "../src/dialog";
import { wireConfirmForms } from "../src/forms";
import type { WireFormsOptions } from "../src/types";

let dialog: DialogInstance | null = null;
let unwire: (() => void) | null = null;

const wire = (opts?: WireFormsOptions) => {
  dialog = createDialog();
  unwire = wireConfirmForms(dialog, opts);
  return dialog;
};

const root = () => document.querySelector("[data-bd-root]") as HTMLElement;
const cancelBtn = () => document.querySelector(".bd-cancel") as HTMLButtonElement;
const confirmBtn = () =>
  document.querySelector(".bd-confirm") as HTMLButtonElement;

// requestSubmit would drive a real navigation in happy-dom, so the resubmit is
// observed through a stub instead.
const setupForm = (attrs = "") => {
  const host = document.createElement("div");
  host.innerHTML = `
    <form method="post" action="/lists/abc/delete" ${attrs}>
      <button type="submit">Delete</button>
    </form>`;
  document.body.append(host);
  const form = host.querySelector("form") as HTMLFormElement;
  const requestSubmit = mock(() => {});
  Object.defineProperty(form, "requestSubmit", { value: requestSubmit });
  return { form, requestSubmit, host };
};

const submit = (form: HTMLFormElement) =>
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

const CONFIRM_ATTRS =
  'data-confirm="This is permanent." data-confirm-title="Delete this list?" data-confirm-label="Delete list"';

afterEach(() => {
  unwire?.();
  unwire = null;
  dialog?.destroy();
  dialog = null;
  document.body.innerHTML = "";
});

describe("wireConfirmForms", () => {
  test("intercepts a confirm-gated submit and shows the dialog", () => {
    wire();
    const { form, requestSubmit } = setupForm(CONFIRM_ATTRS);

    const notCancelled = submit(form);

    expect(notCancelled).toBe(false);
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(root().classList.contains("is-open")).toBe(true);
    expect(document.querySelector(".bd-title")?.textContent).toBe(
      "Delete this list?",
    );
    expect(document.querySelector(".bd-message")?.textContent).toBe(
      "This is permanent.",
    );
    expect(confirmBtn().textContent).toBe("Delete list");
    expect(confirmBtn().classList.contains("is-danger")).toBe(true);
  });

  test("submits the form once confirmed", async () => {
    wire();
    const { form, requestSubmit } = setupForm(CONFIRM_ATTRS);
    submit(form);

    confirmBtn().click();
    await Promise.resolve();

    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(form.dataset.confirmed).toBe("true");
  });

  test("does not submit when cancelled", async () => {
    wire();
    const { form, requestSubmit } = setupForm(CONFIRM_ATTRS);
    submit(form);

    cancelBtn().click();
    await Promise.resolve();

    expect(requestSubmit).not.toHaveBeenCalled();
    expect(form.dataset.confirmed).toBeUndefined();
  });

  test("lets the confirmed resubmit through untouched", () => {
    wire();
    const { form } = setupForm(CONFIRM_ATTRS);
    form.dataset.confirmed = "true";

    expect(submit(form)).toBe(true);
    expect(root().classList.contains("is-open")).toBe(false);
  });

  test("ignores forms without a data-confirm message", () => {
    wire();
    const { form } = setupForm();

    expect(submit(form)).toBe(true);
    expect(root().classList.contains("is-open")).toBe(false);
  });

  test("falls back to the dialog's own copy when only data-confirm is set", () => {
    wire();
    const { form } = setupForm('data-confirm="Gone for good."');
    submit(form);

    expect(document.querySelector(".bd-title")?.textContent).toBe(
      "Are you sure?",
    );
    expect(confirmBtn().textContent).toBe("Confirm");
    expect(cancelBtn().textContent).toBe("Cancel");
  });

  test("takes default copy from the wiring options", () => {
    wire({
      defaultTitle: "Really?",
      defaultConfirmLabel: "Do it",
      cancelLabel: "Back out",
    });
    const { form } = setupForm('data-confirm="Gone for good."');
    submit(form);

    expect(document.querySelector(".bd-title")?.textContent).toBe("Really?");
    expect(confirmBtn().textContent).toBe("Do it");
    expect(cancelBtn().textContent).toBe("Back out");
  });

  test("per-form attributes beat the wiring defaults", () => {
    wire({ defaultTitle: "Really?", defaultConfirmLabel: "Do it" });
    const { form } = setupForm(CONFIRM_ATTRS);
    submit(form);

    expect(document.querySelector(".bd-title")?.textContent).toBe(
      "Delete this list?",
    );
    expect(confirmBtn().textContent).toBe("Delete list");
  });

  test("drops the danger styling on data-confirm-danger=false", () => {
    wire();
    const { form } = setupForm(
      'data-confirm="All good." data-confirm-danger="false"',
    );
    submit(form);

    expect(confirmBtn().classList.contains("is-danger")).toBe(false);
  });

  test("only gates forms inside the given root", () => {
    const scope = document.createElement("div");
    document.body.append(scope);
    dialog = createDialog();
    unwire = wireConfirmForms(dialog, { root: scope });

    const { form } = setupForm(CONFIRM_ATTRS);

    expect(submit(form)).toBe(true);
    expect(root().classList.contains("is-open")).toBe(false);
  });

  test("the returned unwire detaches the handler", () => {
    wire();
    const { form, requestSubmit } = setupForm(CONFIRM_ATTRS);
    unwire?.();
    unwire = null;

    expect(submit(form)).toBe(true);
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(root().classList.contains("is-open")).toBe(false);
  });

  test("swallows the rejection when the dialog is destroyed first", async () => {
    const d = wire();
    const { form, requestSubmit } = setupForm(CONFIRM_ATTRS);
    d.destroy();

    expect(submit(form)).toBe(false);
    await Promise.resolve();

    expect(requestSubmit).not.toHaveBeenCalled();
  });
});
