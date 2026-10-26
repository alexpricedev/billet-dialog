# Changelog

All notable changes to this project are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.1]

### Fixed

- `wireDialogLinks()` read a **fragment on the href as a redirect** and fell through to the plain navigation. A fragment is never sent to the server, so `response.url` comes back without one — and a dialog route very often carries one, because `/library?add=1#add-product` is what scrolls the in-flow panel into view on a page with no JavaScript. Every such link navigated instead of opening in place. The fragment is now dropped from both sides of that comparison, and kept in the address bar.

## [0.3.0]

### Added

- `wireDialogLinks(opts?)` — **dialog routes**. An `<a data-bd-link>` pointing at a URL whose page renders a dialog now opens that dialog *over* the current page: the URL is fetched, the `dialog[data-bd-root][open]` is adopted out of the response, promoted, and `pushState`d into the address bar. Back, Escape and the close link return to the page underneath with its scroll position untouched. Every failure path — non-ok, a redirect elsewhere, no dialog in the body, a thrown fetch — falls through to `location.assign(href)`, and every ordinary way of opening a link (middle click, Cmd/Ctrl/Shift/Alt, `target`, `download`, cross-origin) is handed back to the browser. `opts.onAdopt(dialog, source)` is the host's seam for re-running the scripts the dialog's content needs; the package does not execute `<script>` from the fetched document.
- `data-bd-loading`, set on the link while its page is in flight. A styling hook; the package draws nothing with it.
- An entry transition for the promoted dialog and its backdrop, via `@starting-style` and `allow-discrete`, with four tokens: `--bd-enter-duration`, `--bd-enter-ease`, `--bd-enter-from-y`, `--bd-enter-from-scale`. The whole block sits inside `@media (prefers-reduced-motion: no-preference)`, so reduced motion keeps the instant appearance, and `[data-bd-root][open]:not(:modal)` is untouched — the in-flow panel is page content and must not animate on load.

## [0.2.0]

The package now covers every dialog on a server-rendered site, not just the confirm prompt. Breaking, because the element and the class names both changed.

### Added

- `upgradeDialogs(root?)` — promotes every `<dialog data-bd-root open>` a server template rendered, and wires `data-bd-close-href`. `root` may be the dialog itself, for a framework component that holds the ref. A close href pointing at the *same document* drops the query parameter with `history.replaceState` instead of reloading the page behind the dialog; a different document still navigates, with the dialog held open until it lands.
- `dialogAttrs()` and `BD` — the markup contract as values, so a host framework's template cannot drift from the stylesheet.
- `activateDialog()` and `claimAutofocus()` — the promotion and dismissal wiring on its own, for a framework component that manages `open` itself.
- Content-dialog structure in the stylesheet: `.bd-header`, `.bd-heading`, `.bd-eyebrow`, `.bd-title`, `.bd-description`, `.bd-close`, `.bd-body`, `.bd-footer`, `.bd-sr-only`.
- Four width caps via `data-bd-size` (`sm`/`md`/`lg`/`xl`), applied to the promoted dialog only — in flow the container decides.
- A styled in-flow state, `[data-bd-root][open]:not(:modal)`: what a server-rendered dialog looks like before the upgrade runs, and forever on a page with no JavaScript.
- A scroll lock, `:root:has([data-bd-root]:modal)`. `showModal()` makes the page inert but does not stop it scrolling.
- A full token set for typography, spacing and the confirm prompt's buttons — `--bd-title-*`, `--bd-description-*`, `--bd-eyebrow-*`, `--bd-header-gap`, `--bd-heading-gap`, `--bd-header-pad-bottom`, `--bd-body-inset`, `--bd-footer-pad-top`, `--bd-flow-margin`, `--bd-viewport-inset*`, `--bd-border-width`, `--bd-btn-*` (including `--bd-btn-min-height`, for a host whose buttons are a control height rather than padding). Every value in the stylesheet is now a token, so a host can match its own design system without writing a selector. That is the contract: a rule you have to add in your app is a missing token here.
- `bun run build` — the package now ships `dist/` with declarations rather than raw TypeScript, so a consumer's `tsc --noEmit` no longer typechecks our sources.

- `data-confirm` may go on a submit **button** rather than the form, for a form that does more than one thing — a table of rows with one Save and a trash on each row. The approved resubmit goes through `requestSubmit(submitter)`, so the button's `name`/`value` survive it.

### Changed

- **The dialog is a native `<dialog>` promoted with `showModal()`**, not a `<div>` overlay. The focus trap, the top layer, the `::backdrop`, Escape and the inert page behind it are now the browser's. The hand-rolled Tab cycle is gone — it toggled between exactly two buttons, which is wrong the moment a dialog holds a form field.
- `instance.element` is the `<dialog>` rather than an overlay wrapper.
- `.bd-message` is now `.bd-description`, and `.bd-actions` is now `.bd-footer` — one vocabulary for both kinds of dialog.
- The panel's own `.bd-dialog` class is gone; `[data-bd-root]` is the panel.
- `data-confirmed` is removed again as soon as the approved resubmit has been dispatched. A form gated per button stays on the page, and the marker would have waved every later press through.
- `is-open` is gone. Open state is the `open` attribute, as the platform has it.

### Removed

- `--bd-z` — a dialog in the top layer does not need a z-index.
- `--bd-max-w` — replaced by `--bd-max-w-sm` through `--bd-max-w-xl`.

## [0.1.0]

- Initial release: accessible confirm dialog for destructive actions.
  - `createDialog()` factory — each instance owns its overlay, key listener, and ARIA ids, so two bundled copies never fight over one document.
  - `Dialog` shared-instance facade for the one-dialog-per-app case. Nothing touches the DOM until the first prompt.
  - `wireConfirmForms()` gates `[data-confirm]` forms through one delegated `submit` listener. Without JavaScript the form posts as normal, so it stays progressive enhancement.
  - `alertdialog` semantics, focus starting on Cancel, Tab trapped between the two buttons, Escape and backdrop cancel, focus restored to the trigger on close.
  - Scoped `[data-bd-root]` stylesheet with `--bd-*` tokens. No `:root` rules, no global resets, and both buttons carry their own base so a host app's global `button` rule neither leaks in nor gets fought.
