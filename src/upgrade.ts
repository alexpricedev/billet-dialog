import { activateDialog } from "./activate";

/**
 * Promote every `<dialog data-bd-root open>` in `root`, once, at page load.
 *
 * This is the entry point for **server-rendered** dialogs — the ones a template
 * emitted as HTML and that no framework will ever hydrate. Until this runs, a
 * `<dialog open>` is a bordered panel in normal flow. That is a working state,
 * not a broken one: it is what a page with no JavaScript gets, and it is why a
 * server template can render a dialog at all.
 *
 * `data-bd-close-href` is the seam. It is what lets a dialog with no script
 * behind it still be dismissable — the close control is a real link, and once
 * this has run Escape and the backdrop go to the same URL.
 *
 * Returns a function that unbinds every listener and closes every dialog it
 * promoted.
 */
export function upgradeDialogs(root: ParentNode = document): () => void {
  const cleanups = Array.from(
    root.querySelectorAll<HTMLDialogElement>("dialog[data-bd-root][open]"),
  ).map((dialog) => {
    const href = dialog.dataset.bdCloseHref;
    const view = dialog.ownerDocument.defaultView ?? window;

    // Does dismissing mean fetching a different page, or only dropping a query
    // parameter off this one?
    //
    // `/library?add=1` closing to `/library` is the second: the page behind the
    // dialog is the page already on screen, and reloading it to hide an overlay
    // costs a round trip and a re-render for nothing. Worse, the `cancel`
    // handler holds the dialog open until that navigation commits, so Escape
    // looks like it did nothing and the URL keeps its parameter for as long as
    // the fetch takes.
    //
    // `/team/invites/new` closing to `/team` is the first, and does need the
    // navigation — the content behind it is genuinely different.
    const target = href ? new URL(href, view.location.href) : null;
    const sameDocument =
      target !== null &&
      target.origin === view.location.origin &&
      target.pathname === view.location.pathname;

    return activateDialog(dialog, {
      // Without a close href there is nowhere to dismiss *to*: the dialog is
      // the page's content, not an overlay on top of it. Escape and the
      // backdrop then do nothing, which is the honest behaviour.
      dismiss: () => {
        if (!target) return;
        if (sameDocument) {
          // `replaceState`, not `pushState`: opening the dialog was a link, so
          // Back should return to wherever the reader came from rather than
          // reopening a dialog they just dismissed.
          view.history.replaceState(view.history.state, "", target);
          return;
        }
        view.location.assign(target.href);
      },
      disableOverlayClose:
        !href || dialog.dataset.bdNoOverlayClose !== undefined,
      closeOnDismiss: sameDocument,
    });
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
