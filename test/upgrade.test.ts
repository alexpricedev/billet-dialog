import { afterEach, describe, expect, test } from "bun:test";
import { upgradeDialogs } from "../src/upgrade";

/**
 * Server-rendered dialogs: markup a template emitted that nothing will ever
 * hydrate. `upgradeDialogs()` is the only thing that promotes them, and
 * `data-bd-close-href` is the only thing that makes them dismissable.
 *
 * happy-dom implements `showModal()` and `close()` but not the top layer, the
 * focus trap or Escape, so what is asserted here is the wiring. `cancel` is
 * what a trusted Escape dispatches on a modal dialog.
 */

const markup = (attrs: string) => `
  <dialog id="d" open data-bd-root ${attrs}>
    <div class="bd-header"><h2 class="bd-title">Add products</h2></div>
    <div class="bd-body"><p>body</p></div>
  </dialog>`;

const openAt = (url: string, attrs: string): HTMLDialogElement => {
  window.history.replaceState(null, "", url);
  document.body.innerHTML = markup(attrs);
  return document.getElementById("d") as HTMLDialogElement;
};

const pressEscape = (dialog: HTMLDialogElement) =>
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));

const clickBackdrop = (dialog: HTMLDialogElement) =>
  dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const url = () => window.location.pathname + window.location.search;

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("upgradeDialogs", () => {
  test("promotes a server-rendered dialog", () => {
    const dialog = openAt("/library?add=1", 'data-bd-close-href="/library"');
    expect(dialog.open).toBe(true);

    const cleanup = upgradeDialogs(document);

    // happy-dom reports `:modal` as false whatever happens, so what is pinned
    // here is that the dialog survived the close-and-reopen the promotion does.
    expect(dialog.open).toBe(true);
    cleanup();
  });

  test("leaves a dialog without data-bd-root alone", () => {
    window.history.replaceState(null, "", "/library?add=1");
    document.body.innerHTML =
      '<dialog id="d" open data-bd-close-href="/library"><p>body</p></dialog>';
    const dialog = document.getElementById("d") as HTMLDialogElement;

    const cleanup = upgradeDialogs(document);
    pressEscape(dialog);

    expect(url()).toBe("/library?add=1");
    cleanup();
  });

  test("a close href on the same page drops the parameter without reloading", () => {
    // `/library?add=1` closing to `/library` is the page already on screen.
    // Reloading it to hide an overlay costs a round trip for nothing, and the
    // parameter would sit in the URL for as long as the fetch took — refresh in
    // that window and the dialog comes back.
    const dialog = openAt("/library?add=1", 'data-bd-close-href="/library"');
    const cleanup = upgradeDialogs(document);

    pressEscape(dialog);

    expect(url()).toBe("/library");
    // Closed here and now, not when a navigation eventually lands.
    expect(dialog.open).toBe(false);
    cleanup();
  });

  test("a backdrop click does exactly the same", () => {
    const dialog = openAt("/library?add=1", 'data-bd-close-href="/library"');
    const cleanup = upgradeDialogs(document);

    clickBackdrop(dialog);

    expect(url()).toBe("/library");
    expect(dialog.open).toBe(false);
    cleanup();
  });

  test("a click inside the dialog is not a dismissal", () => {
    const dialog = openAt("/library?add=1", 'data-bd-close-href="/library"');
    const cleanup = upgradeDialogs(document);

    document
      .querySelector(".bd-title")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(url()).toBe("/library?add=1");
    expect(dialog.open).toBe(true);
    cleanup();
  });

  test("the dialog is closed by us, not by the event's default action", () => {
    // That default only exists behind a *trusted* Escape, so leaning on it
    // would leave the dialog open for anything else that dispatches `cancel`.
    const dialog = openAt("/library?add=1", 'data-bd-close-href="/library"');
    const cleanup = upgradeDialogs(document);

    const event = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);
    cleanup();
  });

  test("dismissing twice does not leave the history somewhere odd", () => {
    const dialog = openAt("/library?add=1", 'data-bd-close-href="/library"');
    const cleanup = upgradeDialogs(document);

    pressEscape(dialog);
    pressEscape(dialog);

    expect(url()).toBe("/library");
    cleanup();
  });

  test("a close href on another page is left to navigate", () => {
    // `/team/invites/new` closing to `/team` is a different page behind the
    // dialog, so it still needs the round trip — and the dialog stays up until
    // it arrives rather than flashing the old content.
    const dialog = openAt("/team/invites/new", 'data-bd-close-href="/team"');
    const cleanup = upgradeDialogs(document);

    pressEscape(dialog);

    // happy-dom does not navigate, so the URL is unchanged either way; what
    // this pins is that the same-document shortcut did not fire.
    expect(dialog.open).toBe(true);
    cleanup();
  });

  test("no close href means Escape does nothing", () => {
    const dialog = openAt("/library?add=1", "");
    const cleanup = upgradeDialogs(document);

    pressEscape(dialog);

    // The dialog is the page's content, not an overlay on it.
    expect(url()).toBe("/library?add=1");
    expect(dialog.open).toBe(true);
    cleanup();
  });

  test("no close href also means the backdrop does nothing", () => {
    const dialog = openAt("/library?add=1", "");
    const cleanup = upgradeDialogs(document);

    clickBackdrop(dialog);

    expect(dialog.open).toBe(true);
    cleanup();
  });

  test("data-bd-no-overlay-close keeps the backdrop inert and leaves Escape alone", () => {
    const dialog = openAt(
      "/library?add=1",
      'data-bd-close-href="/library" data-bd-no-overlay-close',
    );
    const cleanup = upgradeDialogs(document);

    clickBackdrop(dialog);
    expect(url()).toBe("/library?add=1");
    expect(dialog.open).toBe(true);

    pressEscape(dialog);
    expect(url()).toBe("/library");

    cleanup();
  });

  test("upgrades every open dialog it finds, and only the open ones", () => {
    window.history.replaceState(null, "", "/admin?delete=1");
    document.body.innerHTML = `
      <dialog id="a" open data-bd-root data-bd-close-href="/admin"></dialog>
      <dialog id="b" data-bd-root data-bd-close-href="/admin"></dialog>`;
    const a = document.getElementById("a") as HTMLDialogElement;
    const b = document.getElementById("b") as HTMLDialogElement;

    const cleanup = upgradeDialogs(document);

    expect(a.open).toBe(true);
    expect(b.open).toBe(false);

    pressEscape(a);
    expect(url()).toBe("/admin");

    cleanup();
  });

  test("scopes itself to the root it is given", () => {
    window.history.replaceState(null, "", "/admin?delete=1");
    document.body.innerHTML = `
      <div id="inside">
        <dialog id="a" open data-bd-root data-bd-close-href="/admin"></dialog>
      </div>
      <dialog id="b" open data-bd-root data-bd-close-href="/admin"></dialog>`;
    const outside = document.getElementById("b") as HTMLDialogElement;

    const cleanup = upgradeDialogs(
      document.getElementById("inside") as HTMLElement,
    );

    pressEscape(outside);
    expect(url()).toBe("/admin?delete=1");

    cleanup();
  });

  test("the cleanup unbinds the listeners and closes what it promoted", () => {
    const dialog = openAt("/library?add=1", 'data-bd-close-href="/library"');
    const cleanup = upgradeDialogs(document);

    cleanup();
    expect(dialog.open).toBe(false);

    // Re-open by hand: a stale listener would now dismiss it.
    dialog.setAttribute("open", "");
    pressEscape(dialog);
    expect(url()).toBe("/library?add=1");
  });

  test("returns a no-op cleanup when there is nothing to upgrade", () => {
    document.body.innerHTML = "<p>no dialogs here</p>";
    expect(() => upgradeDialogs(document)()).not.toThrow();
  });
});
