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

const root = () => document.querySelector("[data-bd-root]") as HTMLDialogElement;
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
    expect(root().open).toBe(true);
    expect(document.querySelector(".bd-title")?.textContent).toBe(
      "Delete this list?",
    );
    expect(document.querySelector(".bd-description")?.textContent).toBe(
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
    // The marker is set for the resubmit and cleared straight after it, so a
    // form still on the page asks again next time rather than waving the
    // second press through. `requestSubmit` is a spy here, so nothing
    // navigates and the cleared state is observable.
    expect(form.dataset.confirmed).toBeUndefined();
  });

  test("lets the approved resubmit through without a second prompt", async () => {
    wire();
    const host = document.createElement("div");
    host.innerHTML = `<form method="post" action="/x" ${CONFIRM_ATTRS}>
      <button type="submit">Delete</button></form>`;
    document.body.append(host);
    const form = host.querySelector("form") as HTMLFormElement;
    // What the real `requestSubmit` does: dispatch `submit` again, from inside
    // `submitForm`, while the marker is set.
    Object.defineProperty(form, "requestSubmit", {
      value: () => submit(form),
    });

    submit(form);
    confirmBtn().click();
    await Promise.resolve();

    // One prompt, not two: the second pass saw the marker and returned.
    expect(root().open).toBe(false);
    expect(form.dataset.confirmed).toBeUndefined();
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
    expect(root().open).toBe(false);
  });

  test("ignores forms without a data-confirm message", () => {
    wire();
    const { form } = setupForm();

    expect(submit(form)).toBe(true);
    expect(root().open).toBe(false);
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
    expect(root().open).toBe(false);
  });

  test("the returned unwire detaches the handler", () => {
    wire();
    const { form, requestSubmit } = setupForm(CONFIRM_ATTRS);
    unwire?.();
    unwire = null;

    expect(submit(form)).toBe(true);
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(root().open).toBe(false);
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

describe("gating one button rather than the whole form", () => {
  /**
   * The case this exists for: a table of rows that is one form with one Save,
   * so nothing typed is lost, and a trash on every row submitting the same
   * form with its own `name`/`value`. Gating the form would gate Save too.
   */
  const setupRowForm = () => {
    const host = document.createElement("div");
    host.innerHTML = `
      <form method="post" action="/work/save">
        <input name="rate" value="23" />
        <button type="submit" name="remove" value="line-3"
                data-confirm="The line goes."
                data-confirm-title="Remove this line?"
                data-confirm-label="Remove">Remove</button>
        <button type="submit">Save</button>
      </form>`;
    document.body.append(host);
    const form = host.querySelector("form") as HTMLFormElement;
    const buttons = Array.from(host.querySelectorAll("button"));
    const requestSubmit = mock((_submitter?: HTMLElement) => {});
    Object.defineProperty(form, "requestSubmit", { value: requestSubmit });
    return {
      form,
      remove: buttons[0] as HTMLButtonElement,
      save: buttons[1] as HTMLButtonElement,
      requestSubmit,
    };
  };

  const submitWith = (form: HTMLFormElement, submitter: HTMLElement | null) => {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "submitter", { value: submitter });
    return form.dispatchEvent(event);
  };

  test("prompts when the gated button is the submitter", async () => {
    wire();
    const { form, remove, requestSubmit } = setupRowForm();

    const notCancelled = submitWith(form, remove);

    expect(notCancelled).toBe(false);
    expect(root().open).toBe(true);
    expect(document.querySelector(".bd-title")?.textContent).toBe(
      "Remove this line?",
    );
    expect(confirmBtn().textContent).toBe("Remove");

    confirmBtn().click();
    await Promise.resolve();

    expect(requestSubmit).toHaveBeenCalledTimes(1);
    // With the submitter, or the approved pass posts as a plain Save and the
    // row is never removed.
    expect(requestSubmit).toHaveBeenCalledWith(remove);
  });

  test("leaves the form's other submit button alone", () => {
    wire();
    const { form, save } = setupRowForm();

    const notCancelled = submitWith(form, save);

    expect(notCancelled).toBe(true);
    expect(root().open).toBe(false);
  });

  test("a form with no data-confirm and no gated submitter is untouched", () => {
    wire();
    const { form } = setupRowForm();

    expect(submitWith(form, null)).toBe(true);
    expect(root().open).toBe(false);
  });

  test("the button's copy wins over the form's", async () => {
    wire();
    const host = document.createElement("div");
    host.innerHTML = `
      <form method="post" action="/x" data-confirm="form copy"
            data-confirm-title="Form?">
        <button type="submit" data-confirm="button copy"
                data-confirm-title="Button?">Go</button>
      </form>`;
    document.body.append(host);
    const form = host.querySelector("form") as HTMLFormElement;
    const button = host.querySelector("button") as HTMLButtonElement;
    Object.defineProperty(form, "requestSubmit", { value: mock(() => {}) });

    submitWith(form, button);

    expect(document.querySelector(".bd-title")?.textContent).toBe("Button?");
    expect(document.querySelector(".bd-description")?.textContent).toBe(
      "button copy",
    );

    cancelBtn().click();
    await Promise.resolve();
  });
});
