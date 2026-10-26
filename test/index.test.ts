import { afterEach, describe, expect, mock, test } from "bun:test";
import { Dialog } from "../src/index";

const root = () => document.querySelector("[data-bd-root]") as HTMLDialogElement;
const cancelBtn = () => document.querySelector(".bd-cancel") as HTMLButtonElement;
const confirmBtn = () =>
  document.querySelector(".bd-confirm") as HTMLButtonElement;

let unwire: (() => void) | null = null;

afterEach(() => {
  // Unwire first: a leaked delegated listener outlives the DOM reset and
  // would follow us into the next test file.
  unwire?.();
  unwire = null;
  Dialog.destroy();
  document.body.innerHTML = "";
});

describe("Dialog", () => {
  test("builds nothing until the first prompt", () => {
    expect(Dialog.current()).toBeNull();
    expect(root()).toBeNull();
  });

  test("confirm builds the shared instance on demand", async () => {
    const result = Dialog.confirm({ title: "Sure?" });

    expect(Dialog.current()).not.toBeNull();
    expect(root().open).toBe(true);

    confirmBtn().click();
    expect(await result).toBe(true);
  });

  test("reuses one instance across prompts", async () => {
    const first = Dialog.confirm({ title: "Sure?" });
    const instance = Dialog.current();
    cancelBtn().click();
    await first;

    const second = Dialog.confirm({ title: "Again?" });
    expect(Dialog.current()).toBe(instance);
    expect(document.querySelectorAll("[data-bd-root]")).toHaveLength(1);

    cancelBtn().click();
    await second;
  });

  test("init applies config and replaces an existing instance", async () => {
    const first = Dialog.confirm({ title: "Sure?" });
    Dialog.init({ texts: { cancelLabel: "Nope" } });

    expect(await first).toBe(false);
    expect(document.querySelectorAll("[data-bd-root]")).toHaveLength(1);

    const second = Dialog.confirm({ title: "Sure?" });
    expect(cancelBtn().textContent).toBe("Nope");

    cancelBtn().click();
    await second;
  });

  test("wireForms gates a data-confirm form through the shared instance", async () => {
    unwire = Dialog.wireForms();
    // Append rather than assign innerHTML — wireForms has already mounted the
    // shared overlay on <body>, and assigning would wipe it out.
    const form = document.createElement("form");
    form.dataset.confirm = "Permanent.";
    document.body.append(form);
    const requestSubmit = mock(() => {});
    Object.defineProperty(form, "requestSubmit", { value: requestSubmit });

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(root().open).toBe(true);

    confirmBtn().click();
    await Promise.resolve();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  test("destroy clears the instance and is safe when nothing was built", () => {
    Dialog.confirm({ title: "Sure?" });
    Dialog.destroy();

    expect(Dialog.current()).toBeNull();
    expect(root()).toBeNull();
    expect(() => Dialog.destroy()).not.toThrow();
  });
});
