import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { wireDialogLinks } from "../src/links";

/**
 * Dialog routes: a link to a URL that renders a dialog, opened over the page
 * rather than by loading it.
 *
 * happy-dom does not navigate, so `location.assign` and `location.reload` are
 * stubbed and asserted on — the same shape `upgrade.test.ts` uses. What is
 * pinned here is the decision: when the browser keeps the click, when the
 * fetch happens, and what every failure falls through to.
 */

const DIALOG = `
  <dialog id="d" open data-bd-root data-bd-close-href="/projects/7">
    <div class="bd-header">
      <h2 class="bd-title">Living room</h2>
      <a class="bd-close" href="/projects/7">×</a>
    </div>
    <div class="bd-body"><p>body</p></div>
  </dialog>`;

const page = (body: string, title = "Space") =>
  `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;

/** A `Response` shaped the way the file reads one, without a real network. */
const html = (
  body: string,
  { ok = true, url = "" }: { ok?: boolean; url?: string } = {},
) =>
  ({
    ok,
    url,
    text: () => Promise.resolve(body),
  }) as unknown as Response;

let assigned: string[] = [];
let reloaded = 0;

const link = (attrs = ""): HTMLAnchorElement => {
  document.body.innerHTML = `<a id="l" href="/projects/7/spaces/room/3" data-bd-link ${attrs}>Details</a>`;
  return document.getElementById("l") as HTMLAnchorElement;
};

const click = (node: Element, init: MouseEventInit = {}) =>
  node.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
  );

/** The fetch is awaited inside the click handler, so let the microtasks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const url = () => window.location.pathname + window.location.search;

/**
 * Swallow a click this file deliberately handed back to the browser.
 *
 * happy-dom implements an anchor's default action by *fetching* the href, so
 * every hand-off test would otherwise try to reach the network and log a
 * DOMException. Registered after `wireDialogLinks` so it runs second — a
 * capture-phase or earlier listener would set `defaultPrevented` first, and
 * the file under test would bail for the wrong reason.
 */
const swallowNavigation = () => {
  let handled = false;
  const block = (event: Event) => {
    // Read before we cancel it: this is whether the file under test claimed
    // the click, which is the thing each hand-off test is actually asserting.
    handled = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("click", block);
  return {
    get handled() {
      return handled;
    },
    stop: () => document.removeEventListener("click", block),
  };
};

beforeEach(() => {
  assigned = [];
  reloaded = 0;
  window.history.replaceState(null, "", "/projects/7");
  // happy-dom's `location` is read-only per property, so the two navigations
  // are replaced on the instance rather than the whole object swapped out.
  Object.defineProperty(window.location, "assign", {
    configurable: true,
    writable: true,
    value: (href: string) => assigned.push(href),
  });
  Object.defineProperty(window.location, "reload", {
    configurable: true,
    writable: true,
    value: () => {
      reloaded += 1;
    },
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  document.title = "";
  window.history.replaceState(null, "", "/projects/7");
});

describe("wireDialogLinks — what the browser keeps", () => {
  const handedBack = async (
    attrs: string,
    init: MouseEventInit = {},
  ): Promise<boolean> => {
    const fetch = mock(() => Promise.resolve(html(page(DIALOG))));
    const cleanup = wireDialogLinks({ fetch: fetch as unknown as typeof globalThis.fetch });
    const nav = swallowNavigation();
    const anchor = link(attrs);

    click(anchor, init);
    await settle();
    nav.stop();
    cleanup();

    return !nav.handled && fetch.mock.calls.length === 0;
  };

  test("a middle click", async () => {
    expect(await handedBack("", { button: 1 })).toBe(true);
  });

  test("Cmd, Ctrl, Shift and Alt", async () => {
    expect(await handedBack("", { metaKey: true })).toBe(true);
    expect(await handedBack("", { ctrlKey: true })).toBe(true);
    expect(await handedBack("", { shiftKey: true })).toBe(true);
    expect(await handedBack("", { altKey: true })).toBe(true);
  });

  test("a target or a download attribute", async () => {
    expect(await handedBack('target="_blank"')).toBe(true);
    expect(await handedBack("download")).toBe(true);
  });

  test("a cross-origin href", async () => {
    const fetch = mock(() => Promise.resolve(html(page(DIALOG))));
    const cleanup = wireDialogLinks({ fetch: fetch as unknown as typeof globalThis.fetch });
    const nav = swallowNavigation();
    document.body.innerHTML =
      '<a id="l" href="https://elsewhere.test/x" data-bd-link>Details</a>';

    click(document.getElementById("l") as Element);
    await settle();

    expect(nav.handled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    nav.stop();
    cleanup();
  });

  test("a link without data-bd-link", async () => {
    const fetch = mock(() => Promise.resolve(html(page(DIALOG))));
    const cleanup = wireDialogLinks({ fetch: fetch as unknown as typeof globalThis.fetch });
    const nav = swallowNavigation();
    document.body.innerHTML = '<a id="l" href="/projects/7/x">Details</a>';

    click(document.getElementById("l") as Element);
    await settle();

    expect(nav.handled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    nav.stop();
    cleanup();
  });

  test("a click something else already handled", async () => {
    const fetch = mock(() => Promise.resolve(html(page(DIALOG))));
    const cleanup = wireDialogLinks({ fetch: fetch as unknown as typeof globalThis.fetch });
    const anchor = link();
    anchor.addEventListener("click", (event) => event.preventDefault());

    click(anchor);
    await settle();

    expect(fetch).not.toHaveBeenCalled();
    cleanup();
  });
});

describe("wireDialogLinks — opening", () => {
  // A factory, not a `Promise`: a rejected promise built at the call site
  // would be unhandled until the click eventually awaited it, and Bun's test
  // runner fails the file on that.
  const open = async (
    responder: () => Promise<Response> = () => Promise.resolve(html(page(DIALOG))),
    opts: { onAdopt?: (d: HTMLDialogElement, s: Document) => void } = {},
  ) => {
    const requested: string[] = [];
    const fetch = mock((input: string) => {
      requested.push(String(input));
      return responder();
    });
    const cleanup = wireDialogLinks({
      ...opts,
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const anchor = link();
    click(anchor);
    await settle();
    return { cleanup, fetch, requested, anchor };
  };

  test("fetches the href, adopts the dialog and pushes the URL", async () => {
    document.title = "Project";
    const { cleanup, requested } = await open();

    expect(requested[0]).toContain("/projects/7/spaces/room/3");
    const dialog = document.querySelector("dialog[data-bd-root]");
    expect(dialog).not.toBeNull();
    expect(url()).toBe("/projects/7/spaces/room/3");
    expect(window.history.state).toEqual({
      bdLink: new URL("/projects/7/spaces/room/3", window.location.href).href,
    });
    // The fetched document's title, so the tab says where the reader is.
    expect(document.title).toBe("Space");

    cleanup();
  });

  test("calls onAdopt with the live dialog and the fetched document", async () => {
    let seen: HTMLDialogElement | null = null;
    let source: Document | null = null;
    const { cleanup } = await open(() => Promise.resolve(html(page(DIALOG))), {
      onAdopt: (d, s) => {
        seen = d;
        source = s;
      },
    });

    // In the document before the host's hook runs, so a `querySelector` from
    // the page's own island finds it.
    expect(seen).not.toBeNull();
    expect((seen as unknown as HTMLDialogElement).isConnected).toBe(true);
    expect((source as unknown as Document).title).toBe("Space");

    cleanup();
  });

  test("the loading hook is removed once the page has landed", async () => {
    const { cleanup, anchor } = await open();
    expect(anchor.hasAttribute("data-bd-loading")).toBe(false);
    cleanup();
  });

  test("a response with no dialog falls through to the navigation", async () => {
    const { cleanup } = await open(() => Promise.resolve(html(page("<p>nothing here</p>"))));

    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toContain("/projects/7/spaces/room/3");
    expect(url()).toBe("/projects/7");
    cleanup();
  });

  test("a non-ok response falls through to the navigation", async () => {
    const { cleanup } = await open(() => Promise.resolve(html(page(DIALOG), { ok: false })));

    expect(assigned).toHaveLength(1);
    expect(document.querySelector("dialog")).toBeNull();
    cleanup();
  });

  test("a redirect somewhere else falls through to the navigation", async () => {
    // A sign-in wall or a deleted row. Whatever its page contained, this URL
    // is not the dialog any more.
    const { cleanup } = await open(() =>
      Promise.resolve(html(page(DIALOG), { url: "https://example.test/login" })),
    );

    expect(assigned).toHaveLength(1);
    expect(document.querySelector("dialog")).toBeNull();
    cleanup();
  });

  test("a fragment on the href is not read as a redirect", async () => {
    // `/library?add=1#add-product` is the shape of a dialog route that also has
    // to work without JavaScript: the fragment is what scrolls the in-flow
    // panel into view. A fragment is never sent to the server, so the response
    // comes back without one — compared raw, every such link would fall
    // through to the navigation.
    const fetch = mock(() =>
      Promise.resolve(
        html(page(DIALOG), { url: "https://example.test/library?add=1" }),
      ),
    );
    const cleanup = wireDialogLinks({
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    document.body.innerHTML =
      '<a id="l" href="/library?add=1#add-product" data-bd-link>Add</a>';

    click(document.getElementById("l") as Element);
    await settle();

    expect(assigned).toHaveLength(0);
    expect(document.querySelector("dialog[data-bd-root]")).not.toBeNull();
    expect(window.location.pathname + window.location.search).toBe(
      "/library?add=1",
    );
    cleanup();
  });

  test("a rejected fetch falls through to the navigation", async () => {
    const { cleanup } = await open(() => Promise.reject(new Error("offline")));

    expect(assigned).toHaveLength(1);
    expect(url()).toBe("/projects/7");
    cleanup();
  });
});

describe("wireDialogLinks — dismissing", () => {
  const opened = async () => {
    const fetch = mock(() => Promise.resolve(html(page(DIALOG))));
    const cleanup = wireDialogLinks({ fetch: fetch as unknown as typeof globalThis.fetch });
    document.title = "Project";
    click(link());
    await settle();
    return {
      cleanup,
      dialog: document.querySelector("dialog[data-bd-root]") as HTMLDialogElement,
    };
  };

  test("Escape removes the node, restores the title and winds history back", async () => {
    const { cleanup, dialog } = await opened();

    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await settle();

    expect(dialog.isConnected).toBe(false);
    expect(document.title).toBe("Project");
    expect(url()).toBe("/projects/7");
    cleanup();
  });

  test("the close link inside the dialog is intercepted, not followed", async () => {
    const { cleanup, dialog } = await opened();

    const notCancelled = click(
      dialog.querySelector(".bd-close") as Element,
    );
    await settle();

    expect(notCancelled).toBe(false);
    expect(assigned).toHaveLength(0);
    expect(dialog.isConnected).toBe(false);
    expect(url()).toBe("/projects/7");
    cleanup();
  });

  test("a link inside the dialog that is not the close href still navigates", async () => {
    const { cleanup, dialog } = await opened();
    dialog.insertAdjacentHTML(
      "beforeend",
      '<a id="away" href="/library">Library</a>',
    );
    const nav = swallowNavigation();

    click(dialog.querySelector("#away") as Element);
    nav.stop();

    // Only the close href is intercepted; every other link in the dialog is
    // an ordinary link.
    expect(nav.handled).toBe(false);
    expect(dialog.isConnected).toBe(true);
    cleanup();
  });

  test("popstate tears down without winding history back again", async () => {
    const { cleanup, dialog } = await opened();

    // What Back does: the entry is gone before the event lands.
    window.history.replaceState(null, "", "/projects/7");
    window.dispatchEvent(new Event("popstate"));
    await settle();

    expect(dialog.isConnected).toBe(false);
    // A `history.back()` here would overshoot the page the reader came from.
    expect(url()).toBe("/projects/7");
    cleanup();
  });

  test("dismissing twice is one teardown", async () => {
    const { cleanup, dialog } = await opened();

    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await settle();

    expect(url()).toBe("/projects/7");
    cleanup();
  });

  test("forward into a dialog route with nothing on screen reloads", async () => {
    const cleanup = wireDialogLinks({
      fetch: (() => Promise.resolve(html(page(DIALOG)))) as unknown as typeof globalThis.fetch,
    });

    window.history.replaceState(
      { bdLink: "/projects/7/spaces/room/3" },
      "",
      "/projects/7/spaces/room/3",
    );
    window.dispatchEvent(new Event("popstate"));

    // The server renders that URL correctly; there is nothing to reconstruct.
    expect(reloaded).toBe(1);
    cleanup();
  });

  test("the cleanup unbinds the listener and tears down what is open", async () => {
    const { cleanup, dialog } = await opened();

    cleanup();
    expect(dialog.isConnected).toBe(false);

    const fetch = mock(() => Promise.resolve(html(page(DIALOG))));
    wireDialogLinks({ fetch: fetch as unknown as typeof globalThis.fetch })();
    const nav = swallowNavigation();
    click(link());
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    nav.stop();
  });
});
