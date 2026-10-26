import { afterEach, describe, expect, test } from "bun:test";
import { BD, DIALOG_SIZES, dialogAttrs } from "../src/markup";
import { upgradeDialogs } from "../src/upgrade";

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("dialogAttrs", () => {
  test("always carries the opt-in and a size", () => {
    expect(dialogAttrs()).toEqual({
      "data-bd-root": "",
      "data-bd-size": "md",
    });
  });

  test("takes the size it is given", () => {
    expect(dialogAttrs({ size: "xl" })["data-bd-size"]).toBe("xl");
  });

  test("emits the close href only when there is one", () => {
    expect(dialogAttrs({ closeHref: "/team" })["data-bd-close-href"]).toBe(
      "/team",
    );
    expect(dialogAttrs()).not.toHaveProperty("data-bd-close-href");
  });

  test("keeps an empty close href, which is a legitimate same-page target", () => {
    expect(dialogAttrs({ closeHref: "" })["data-bd-close-href"]).toBe("");
  });

  test("emits the backdrop opt-out only when asked", () => {
    expect(
      dialogAttrs({ disableOverlayClose: true }),
    ).toHaveProperty("data-bd-no-overlay-close", "");
    expect(dialogAttrs({ disableOverlayClose: false })).not.toHaveProperty(
      "data-bd-no-overlay-close",
    );
  });

  test("produces markup upgradeDialogs recognises", () => {
    // The point of the helper: a host spelling these out by hand is one typo
    // away from a dialog nothing promotes and nothing styles.
    window.history.replaceState(null, "", "/library?add=1");
    const dialog = document.createElement("dialog");
    for (const [name, value] of Object.entries(
      dialogAttrs({ size: "lg", closeHref: "/library" }),
    )) {
      dialog.setAttribute(name, value);
    }
    dialog.setAttribute("open", "");
    document.body.append(dialog);

    const cleanup = upgradeDialogs(document);
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));

    expect(window.location.search).toBe("");
    expect(dialog.open).toBe(false);
    cleanup();
  });
});

describe("BD", () => {
  test("names every part the stylesheet styles", () => {
    // A rename here without one in `styles.css` is the drift this exists to
    // prevent, so the two are pinned together.
    expect(Object.values(BD)).toEqual([
      "bd-header",
      "bd-heading",
      "bd-eyebrow",
      "bd-title",
      "bd-description",
      "bd-close",
      "bd-body",
      "bd-footer",
      "bd-sr-only",
      "bd-cancel",
      "bd-confirm",
      "is-danger",
    ]);
  });

  test("DIALOG_SIZES matches what the stylesheet caps", () => {
    expect(DIALOG_SIZES).toEqual(["sm", "md", "lg", "xl"]);
  });
});
