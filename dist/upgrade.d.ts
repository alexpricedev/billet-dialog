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
export declare function upgradeDialogs(root?: ParentNode): () => void;
