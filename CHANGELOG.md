# Changelog

All notable changes to this project are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

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
- `bun run build` — the package now ships `dist/` with declarations rather than raw TypeScript, so a consumer's `tsc --noEmit` no longer typechecks our sources.

### Changed

- **The dialog is a native `<dialog>` promoted with `showModal()`**, not a `<div>` overlay. The focus trap, the top layer, the `::backdrop`, Escape and the inert page behind it are now the browser's. The hand-rolled Tab cycle is gone — it toggled between exactly two buttons, which is wrong the moment a dialog holds a form field.
- `instance.element` is the `<dialog>` rather than an overlay wrapper.
- `.bd-message` is now `.bd-description`, and `.bd-actions` is now `.bd-footer` — one vocabulary for both kinds of dialog.
- The panel's own `.bd-dialog` class is gone; `[data-bd-root]` is the panel.
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
