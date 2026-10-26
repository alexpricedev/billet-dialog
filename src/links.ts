import { activateDialog } from "./activate";

/*
 * Dialog routes: open a modal over the page instead of loading a new one.
 *
 * A *modal route* is a URL whose only job is to render a page with one dialog
 * open — `/projects/7/spaces/room/3` is the project overview plus the space
 * details. Following it is a full navigation, so the page behind the dialog is
 * re-fetched, re-rendered and scrolled to the top before the dialog appears,
 * and dismissing it costs a second load back.
 *
 * This file fetches that URL instead, lifts the dialog out of the response,
 * shows it over what is already on screen and puts the URL in the address bar.
 * Back, Escape and the close link all return to the page underneath with its
 * scroll position untouched, because it never went anywhere.
 *
 * Two promises hold the whole thing up:
 *
 *   - **The navigation is the floor.** Every failure — a non-ok response, a
 *     redirect somewhere else, no dialog in the body, a thrown fetch — falls
 *     through to `location.assign(href)`. This can only ever be faster than
 *     following the link, never a dead end.
 *   - **The link stays a real link.** `data-bd-link` is an enhancement on top
 *     of a URL that really renders the dialog server-side, so a page with no
 *     JavaScript, a middle click and a Cmd-click all keep working.
 */

/** The opt-in. Nothing can be known about a URL without fetching it, so the
 *  host declares which of its links are dialog routes. */
const LINK_SELECTOR = "a[data-bd-link][href]";

const DIALOG_SELECTOR = "dialog[data-bd-root][open]";

/** Set on the link while its page is in flight. A styling hook; we draw nothing. */
const LOADING_ATTR = "data-bd-loading";

export interface DialogLinkOptions {
  /** Called with the dialog after it is in the document, before promotion. */
  onAdopt?: (dialog: HTMLDialogElement, source: Document) => void;
  /** Override for tests. @default globalThis.fetch */
  fetch?: typeof fetch;
}

/** The history entry this file writes, so a `popstate` can be recognised. */
interface LinkState {
  bdLink?: string;
}

interface OpenDialog {
  href: string;
  /** `viaPopstate` skips the `history.back()`: the browser already moved. */
  close: (viaPopstate: boolean) => void;
}

/**
 * Turn every `<a data-bd-link>` into an in-place dialog open.
 *
 * Returns a cleanup that removes both listeners and tears down any dialog
 * still on screen.
 */
export function wireDialogLinks({
  onAdopt,
  fetch: fetchImpl,
}: DialogLinkOptions = {}): () => void {
  const doc = document;
  const view = doc.defaultView ?? window;
  // Narrower than `typeof fetch` on purpose: this file only ever calls it one
  // way, and the global type carries a `preconnect` property no override has.
  const request: (input: string, init: RequestInit) => Promise<Response> =
    fetchImpl ?? ((input, init) => view.fetch(input, init));

  let current: OpenDialog | null = null;

  const navigate = (href: string): void => {
    view.location.assign(href);
  };

  const state = (): LinkState | null =>
    (view.history.state as LinkState | null) ?? null;

  /** An absolute URL with its fragment removed. */
  const withoutHash = (value: string): string => {
    const url = new URL(value, view.location.href);
    url.hash = "";
    return url.href;
  };

  const adopt = (
    found: HTMLDialogElement,
    source: Document,
    href: string,
  ): void => {
    // Replacing one adopted dialog with another: drop the first without
    // winding history back, because the second is about to push over it.
    current?.close(true);

    const dialog = doc.adoptNode(found);
    doc.body.append(dialog);

    const previousTitle = doc.title;
    if (source.title) doc.title = source.title;

    // `pushState`, not `replaceState`: the dialog is a place, and Back is how
    // a reader expects to leave one.
    view.history.pushState({ bdLink: href } satisfies LinkState, "", href);

    // The host's seam for re-running whatever scripts the dialog's content
    // needs. This file does not execute `<script>` from the fetched document
    // and will not — adopting markup is safe, running code is the host's call.
    onAdopt?.(dialog, source);

    // The `×` and Cancel are real links to `data-bd-close-href` — that is the
    // no-JS dismissal. Left alone they would navigate and undo the whole
    // point, so they are intercepted here and turned into a teardown.
    const closeHref = dialog.dataset.bdCloseHref;
    const closeTarget = closeHref
      ? new URL(closeHref, view.location.href).href
      : null;

    const onDialogClick = (event: MouseEvent) => {
      if (closeTarget === null || event.defaultPrevented) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      const target = anchor?.getAttribute("href");
      if (!target) return;
      if (new URL(target, view.location.href).href !== closeTarget) return;
      event.preventDefault();
      close(false);
    };

    let closed = false;
    let release: (() => void) | null = null;

    // One teardown, guarded so it cannot run twice: `activateDialog` calls
    // `dismiss` for Escape, the backdrop *and* a stray `close()`, and the
    // close-link intercept and `popstate` reach it too.
    const close = (viaPopstate: boolean): void => {
      if (closed) return;
      closed = true;
      if (current?.href === href) current = null;

      dialog.removeEventListener("click", onDialogClick as EventListener);
      release?.();
      dialog.remove();
      doc.title = previousTitle;

      // Only when our entry is still the one on top. A `popstate` already
      // moved off it, and a second `back()` would overshoot the page the
      // reader came from.
      if (!viaPopstate && state()?.bdLink === href) view.history.back();
    };

    dialog.addEventListener("click", onDialogClick as EventListener);
    current = { href, close };

    release = activateDialog(dialog, {
      dismiss: () => close(false),
      // Nothing to wait for: the page behind the dialog is already on screen.
      closeOnDismiss: true,
    });
  };

  const open = async (href: string, link: Element): Promise<void> => {
    link.setAttribute(LOADING_ATTR, "");
    try {
      const response = await request(href, {
        credentials: "same-origin",
        headers: { Accept: "text/html" },
      });
      if (!response.ok) return navigate(href);

      // A redirect that landed somewhere else is the server saying this URL is
      // not the dialog any more — a sign-in wall, a deleted row. Follow it for
      // real rather than showing whatever its page happened to contain.
      //
      // The fragment is dropped from both sides first. A dialog route very
      // often carries one — `/library?add=1#add-product` is what scrolls the
      // in-flow panel into view without JavaScript — and a fragment is never
      // sent to the server, so `response.url` comes back without it. Compare
      // the two raw and every such link reads as a redirect and falls through
      // to the navigation this file exists to avoid.
      if (withoutHash(response.url || href) !== withoutHash(href)) {
        return navigate(href);
      }

      const source = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      const found = source.querySelector<HTMLDialogElement>(DIALOG_SELECTOR);
      if (!found) return navigate(href);

      adopt(found, source, href);
    } catch {
      navigate(href);
    } finally {
      link.removeAttribute(LOADING_ATTR);
    }
  };

  // Every ordinary way of opening a link is handed back to the browser
  // untouched: a new tab, a new window, a download, a different origin.
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link = (event.target as Element | null)?.closest?.(
      LINK_SELECTOR,
    ) as HTMLAnchorElement | null;
    if (!link) return;
    if (link.hasAttribute("target") || link.hasAttribute("download")) return;

    const href = link.getAttribute("href");
    if (!href) return;

    const url = new URL(href, view.location.href);
    if (url.origin !== view.location.origin) return;

    event.preventDefault();
    void open(url.href, link);
  };

  const onPopState = (): void => {
    if (current) {
      // Back off our entry — or forward past it onto another one.
      if (state()?.bdLink !== current.href) current.close(true);
      return;
    }
    // Forward *into* a dialog route after closing it. The server renders that
    // URL correctly and there is nothing here to reconstruct.
    if (state()?.bdLink) view.location.reload();
  };

  doc.addEventListener("click", onClick as EventListener);
  view.addEventListener("popstate", onPopState);

  return () => {
    doc.removeEventListener("click", onClick as EventListener);
    view.removeEventListener("popstate", onPopState);
    current?.close(true);
  };
}
