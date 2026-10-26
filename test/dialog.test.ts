import { afterEach, describe, expect, test } from "bun:test";
import { createDialog, type DialogInstance } from "../src/dialog";

// The prompt is a native `<dialog>`, so the focus trap, the top layer, the
// inert page behind it and Escape itself are the browser's job and are not
// asserted here — happy-dom implements `showModal()` and `close()` but not the
// behaviour they trigger. What is testable is the wiring, and the wiring is
// what a refactor breaks.
//
// `cancel` is what a trusted Escape dispatches on a modal dialog, so that is
// how Escape is exercised below.

let dialog: DialogInstance | null = null;

const open = (config?: Parameters<typeof createDialog>[0]) => {
  dialog = createDialog(config);
  return dialog;
};

const root = () =>
  document.querySelector("[data-bd-root]") as HTMLDialogElement;
const cancelBtn = () =>
  document.querySelector(".bd-cancel") as HTMLButtonElement;
const confirmBtn = () =>
  document.querySelector(".bd-confirm") as HTMLButtonElement;

const pressEscape = (node: HTMLDialogElement) =>
  node.dispatchEvent(new Event("cancel", { cancelable: true }));

afterEach(() => {
  dialog?.destroy();
  dialog = null;
  document.body.innerHTML = "";
});

describe("createDialog", () => {
  test("appends a closed dialog on creation, before any prompt", () => {
    open();

    expect(root()).not.toBeNull();
    expect(root().open).toBe(false);
  });

  test("is an alertdialog, not a plain dialog", () => {
    // The wrong answer to this question is destructive, which is the
    // distinction the role draws.
    open();

    expect(root().getAttribute("role")).toBe("alertdialog");
    expect(root().getAttribute("aria-modal")).toBe("true");
  });

  test("renders the supplied copy and opens the dialog", async () => {
    const d = open();
    const result = d.confirm({
      title: "Delete this list?",
      message: "This is permanent.",
      confirmLabel: "Delete list",
      danger: true,
    });

    expect(root().open).toBe(true);
    expect(d.isOpen()).toBe(true);
    expect(document.querySelector(".bd-title")?.textContent).toBe(
      "Delete this list?",
    );
    expect(document.querySelector(".bd-description")?.textContent).toBe(
      "This is permanent.",
    );
    expect(confirmBtn().textContent).toBe("Delete list");
    expect(confirmBtn().classList.contains("is-danger")).toBe(true);
    expect(cancelBtn().textContent).toBe("Cancel");

    cancelBtn().click();
    await result;
  });

  test("labels itself by the title and describes itself by the message", () => {
    open();

    const titleId = (document.querySelector(".bd-title") as HTMLElement).id;
    const descId = (document.querySelector(".bd-description") as HTMLElement)
      .id;

    expect(root().getAttribute("aria-labelledby")).toBe(titleId);
    expect(root().getAttribute("aria-describedby")).toBe(descId);
  });

  test("resolves true when the confirm button is clicked", async () => {
    const d = open();
    const result = d.confirm({ title: "Sure?" });
    confirmBtn().click();

    expect(await result).toBe(true);
    expect(root().open).toBe(false);
    expect(d.isOpen()).toBe(false);
  });

  test("resolves false when cancelled", async () => {
    const result = open().confirm({ title: "Sure?" });
    cancelBtn().click();

    expect(await result).toBe(false);
  });

  test("resolves false on Escape, and closes", async () => {
    const result = open().confirm({ title: "Sure?" });
    pressEscape(root());

    expect(await result).toBe(false);
    expect(root().open).toBe(false);
  });

  test("the browser's own close is not allowed to answer behind our back", () => {
    // `cancel`'s default action closes the dialog. We prevent it and drive the
    // close ourselves, because that default only exists behind a *trusted*
    // Escape — leaning on it would make the behaviour depend on an engine
    // detail rather than on `activate.ts`.
    const result = open().confirm({ title: "Sure?" });
    const event = new Event("cancel", { cancelable: true });
    root().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    void result;
  });

  test("resolves false when something closes the dialog directly", async () => {
    // A `<form method="dialog">` or a stray `close()`. The owner has to be told
    // or its state disagrees with what is on screen.
    const result = open().confirm({ title: "Sure?" });
    root().close();

    expect(await result).toBe(false);
  });

  test("resolves false when the backdrop is clicked", async () => {
    // A click on a modal dialog's backdrop reports the dialog itself as the
    // target, because `::backdrop` is a pseudo-element with no node of its own.
    const result = open().confirm({ title: "Sure?" });
    root().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(await result).toBe(false);
  });

  test("stays open when something inside it is clicked", async () => {
    const result = open().confirm({ title: "Sure?" });
    document
      .querySelector(".bd-title")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(root().open).toBe(true);
    confirmBtn().click();
    expect(await result).toBe(true);
  });

  test("ignores a stray cancel while closed", () => {
    open();
    expect(() => pressEscape(root())).not.toThrow();
    expect(root().open).toBe(false);
  });

  test("focuses the safe choice, never the destructive one", async () => {
    const result = open().confirm({ title: "Sure?", danger: true });

    expect(document.activeElement).toBe(cancelBtn());

    cancelBtn().click();
    await result;
  });

  test("hides the message paragraph when no message is given", async () => {
    const result = open().confirm({ title: "Sure?" });

    expect(
      (document.querySelector(".bd-description") as HTMLElement).hidden,
    ).toBe(true);

    cancelBtn().click();
    await result;
  });

  test("restores focus to the trigger on close", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const result = open().confirm({ title: "Sure?" });
    confirmBtn().click();
    await result;

    expect(document.activeElement).toBe(trigger);
  });

  test("a second prompt supersedes the one still open", async () => {
    const d = open();
    const first = d.confirm({ title: "First?" });
    const second = d.confirm({ title: "Second?" });

    expect(await first).toBe(false);
    expect(document.querySelector(".bd-title")?.textContent).toBe("Second?");
    expect(root().open).toBe(true);

    confirmBtn().click();
    expect(await second).toBe(true);
  });

  test("reuses a single dialog across prompts", async () => {
    const d = open();
    const first = d.confirm({ title: "Sure?" });
    cancelBtn().click();
    await first;

    const second = d.confirm({ title: "Sure again?" });
    expect(document.querySelectorAll("[data-bd-root]")).toHaveLength(1);
    expect(root().open).toBe(true);

    cancelBtn().click();
    await second;
  });

  test("takes fallback copy from the instance texts", async () => {
    const result = open({
      texts: { title: "Really?", confirmLabel: "Do it", cancelLabel: "Back" },
    }).confirm({ title: "" });

    expect(document.querySelector(".bd-title")?.textContent).toBe("Really?");
    expect(confirmBtn().textContent).toBe("Do it");
    expect(cancelBtn().textContent).toBe("Back");

    cancelBtn().click();
    await result;
  });

  test("mounts into a supplied container", () => {
    const host = document.createElement("div");
    document.body.append(host);
    open({ container: host });

    expect(host.querySelector("[data-bd-root]")).not.toBeNull();
  });

  test("gives each instance its own ARIA ids", () => {
    const a = createDialog();
    const b = createDialog();

    const ids = Array.from(document.querySelectorAll("[data-bd-root]")).map(
      (el) => el.getAttribute("aria-labelledby"),
    );
    expect(ids[0]).not.toBe(ids[1]);

    a.destroy();
    b.destroy();
  });

  test("two instances answer independently", async () => {
    const a = createDialog();
    const b = createDialog();

    const first = a.confirm({ title: "A?" });
    const second = b.confirm({ title: "B?" });

    (a.element.querySelector(".bd-confirm") as HTMLButtonElement).click();
    (b.element.querySelector(".bd-cancel") as HTMLButtonElement).click();

    expect(await first).toBe(true);
    expect(await second).toBe(false);

    a.destroy();
    b.destroy();
  });
});

describe("destroy", () => {
  test("removes the dialog and cancels a pending prompt", async () => {
    const d = createDialog();
    const result = d.confirm({ title: "Sure?" });
    d.destroy();

    expect(await result).toBe(false);
    expect(root()).toBeNull();
  });

  test("is safe to call twice", () => {
    const d = createDialog();
    d.destroy();
    expect(() => d.destroy()).not.toThrow();
  });

  test("rejects a prompt raised after destruction", async () => {
    const d = createDialog();
    d.destroy();

    expect(d.confirm({ title: "Sure?" })).rejects.toThrow("destroyed");
  });

  test("leaves other instances alone", async () => {
    const a = createDialog();
    const b = createDialog();
    a.destroy();

    const result = b.confirm({ title: "B?" });
    pressEscape(b.element);

    expect(await result).toBe(false);
    b.destroy();
  });
});
