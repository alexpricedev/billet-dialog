# Changelog

All notable changes to this project are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0]

- Initial release: accessible confirm dialog for destructive actions.
  - `createDialog()` factory — each instance owns its overlay, key listener, and ARIA ids, so two bundled copies never fight over one document.
  - `Dialog` shared-instance facade for the one-dialog-per-app case. Nothing touches the DOM until the first prompt.
  - `wireConfirmForms()` gates `[data-confirm]` forms through one delegated `submit` listener. Without JavaScript the form posts as normal, so it stays progressive enhancement.
  - `alertdialog` semantics, focus starting on Cancel, Tab trapped between the two buttons, Escape and backdrop cancel, focus restored to the trigger on close.
  - Scoped `[data-bd-root]` stylesheet with `--bd-*` tokens. No `:root` rules, no global resets, and both buttons carry their own base so a host app's global `button` rule neither leaks in nor gets fought.
