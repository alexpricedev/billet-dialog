import { afterEach, describe, expect, test } from "bun:test";
import { createDialog, type DialogInstance } from "../src/dialog";

let dialog: DialogInstance | null = null;

const open = (config?: Parameters<typeof createDialog>[0]) => {
  dialog = createDialog(config);
  return dialog;
};

const root = () => document.querySelector("[data-bd-root]") as HTMLElement;
const cancelBtn = () => document.querySelector(".bd-cancel") as HTMLButtonElement;
const confirmBtn = () =>
  document.querySelector(".bd-confirm") as HTMLButtonElement;

const press = (key: string) =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );

afterEach(() => {
  dialog?.destroy();
  dialog = null;
  document.body.innerHTML = "";
});

describe("createDialog", () => {
  test("appends a hidden overlay on creation, before any prompt", () => {
    open();

    expect(root()).not.toBeNull();
    expect(root().classList.contains("is-open")).toBe(false);
  });

  test("renders the supplied copy and opens the overlay", async () => {
    const d = open();
    const result = d.confirm({
      title: "Delete this list?",
      message: "This is permanent.",
      confirmLabel: "Delete list",
      danger: true,
    });

    expect(root().classList.contains("is-open")).toBe(true);
    expect(d.isOpen()).toBe(true);
    expect(document.querySelector(".bd-title")?.textContent).toBe(
      "Delete this list?",
    );
    expect(document.querySelector(".bd-message")?.textContent).toBe(
      "This is permanent.",
    );
    expect(confirmBtn().textContent).toBe("Delete list");
    expect(confirmBtn().classList.contains("is-danger")).toBe(true);
    expect(cancelBtn().textContent).toBe("Cancel");

    cancelBtn().click();
    await result;
  });

  test("resolves true when the confirm button is clicked", async () => {
    const d = open();
    const result = d.confirm({ title: "Sure?" });
    confirmBtn().click();

    expect(await result).toBe(true);
    expect(root().classList.contains("is-open")).toBe(false);
    expect(d.isOpen()).toBe(false);
  });

  test("resolves false when cancelled", async () => {
    const result = open().confirm({ title: "Sure?" });
    cancelBtn().click();

    expect(await result).toBe(false);
  });

  test("resolves false on Escape", async () => {
    const result = open().confirm({ title: "Sure?" });
    press("Escape");

    expect(await result).toBe(false);
  });

  test("resolves false when the backdrop is clicked", async () => {
    const result = open().confirm({ title: "Sure?" });
    root().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(await result).toBe(false);
  });

  test("keeps the panel open when the panel itself is clicked", async () => {
    const result = open().confirm({ title: "Sure?" });
    document
      .querySelector(".bd-dialog")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(root().classList.contains("is-open")).toBe(true);
    confirmBtn().click();
    expect(await result).toBe(true);
  });

  test("ignores stray keys while closed", () => {
    open();
    expect(() => press("Escape")).not.toThrow();
    expect(root().classList.contains("is-open")).toBe(false);
  });

  test("focuses cancel first and traps Tab between the two buttons", async () => {
    const result = open().confirm({ title: "Sure?" });
    expect(document.activeElement).toBe(cancelBtn());

    press("Tab");
    expect(document.activeElement).toBe(confirmBtn());

    press("Tab");
    expect(document.activeElement).toBe(cancelBtn());

    cancelBtn().click();
    await result;
  });

  test("hides the message paragraph when no message is given", async () => {
    const result = open().confirm({ title: "Sure?" });

    expect((document.querySelector(".bd-message") as HTMLElement).hidden).toBe(
      true,
    );

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

    confirmBtn().click();
    expect(await second).toBe(true);
  });

  test("reuses a single overlay across prompts", async () => {
    const d = open();
    const first = d.confirm({ title: "Sure?" });
    cancelBtn().click();
    await first;

    const second = d.confirm({ title: "Sure again?" });
    expect(document.querySelectorAll("[data-bd-root]")).toHaveLength(1);

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

    const ids = Array.from(document.querySelectorAll(".bd-dialog")).map((el) =>
      el.getAttribute("aria-labelledby"),
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
  test("removes the overlay and cancels a pending prompt", async () => {
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

  test("detaches its key listener, leaving other instances alone", async () => {
    const a = createDialog();
    const b = createDialog();
    a.destroy();

    const result = b.confirm({ title: "B?" });
    press("Escape");

    expect(await result).toBe(false);
    b.destroy();
  });
});
