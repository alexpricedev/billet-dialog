# @alexpricedev/billet-dialog

Accessible confirm dialog for destructive actions. Vanilla DOM, zero dependencies, scoped CSS tokens. Gates `<form>` submissions as progressive enhancement — no JavaScript, and the form still posts. Framework-agnostic — designed to drop into Billet but works anywhere.

## Copy this to your coding agent

Paste this into your agent (Claude Code, Cursor, etc.):

```text
Install and wire up @alexpricedev/billet-dialog in this repo.

1. Read the package README first:
   node_modules/@alexpricedev/billet-dialog/README.md
   (or https://github.com/alexpricedev/billet-dialog#readme).
   Follow its "Wire up in 3 steps" section. Adapt snippets to this
   repo's template / client-entry signatures where they differ —
   don't paste blindly.

2. If this repo has a CLAUDE.md or AGENTS.md, read it and respect its
   conventions (filenames, lint rules, where tests go). Those override
   anything generic in the package README.

3. Find every destructive action in the app — delete, revoke, cancel,
   remove, "reset all", anything irreversible or anything that breaks
   a link already shared. List them before you edit. Gate each one by
   adding data-confirm attributes to its form, per README step 3.

4. Keep the no-JS fallback intact. The form must still post normally
   when the dialog never loads. Do not convert forms to fetch/XHR,
   and do not move the guard into a click handler on the button.

5. Apply the README's Theming block: map this repo's existing
   --color-* / --font-* (or equivalent) tokens to --bd-* on
   [data-bd-root]. Otherwise the dialog ships in the package's default
   dark look instead of matching the site.

6. Verify with the repo's check/test commands, plus the /browse skill
   (or equivalent headless browser tool), for at least one gated
   action: click destructive button → dialog appears → Cancel leaves
   the record intact → click again → Confirm actually performs it.
   Check the server-rendered page still has the plain form in its
   HTML. Do not scaffold a new browser-test harness — use whatever's
   already wired in.

7. Open a PR.
   - Title: "Confirm before destructive actions" — but check
     `git log` first and adapt to the repo's commit convention if it
     uses one (e.g. conventional commits → `feat(dialog): confirm
     before destructive actions`). Commit conventions usually live in
     history, not in CLAUDE.md.
   - Body: the list of actions you gated + the verification steps you
     performed.
   - Screenshot: `gh pr create --body` can't embed local images.
     Capture the dialog with the browser tool and attach it as a
     follow-up PR comment (`gh pr comment <n> --body-file …`) or via
     the GitHub web UI.

Out of scope: replacing native window.confirm() calls in admin-only
tooling, toast/undo patterns, and any redesign of the actions
themselves.
```

## For AI agents

- **Package**: `@alexpricedev/billet-dialog`
- **Install**: `bun add @alexpricedev/billet-dialog`
- **Peer deps**: none
- **Bundle side effects**: none on import. Appends one `<div data-bd-root>` to `<body>` on first `Dialog.confirm()` / `Dialog.wireForms()` / `createDialog()`
- **Server runtime**: none — this is a client-only package
- **Wiring**: 3 client steps — see [Wire up in 3 steps](#wire-up-in-3-steps)
- **Verify install**: `bun test` in the consumer should still pass; `document.querySelector('[data-bd-root]')` returns a node after the first prompt

## Install

```bash
bun add @alexpricedev/billet-dialog
# or: npm install / pnpm add / yarn add
```

## Wire up in 3 steps

### 1. Import the CSS once

In your global stylesheet (e.g. `src/client/style.css`):

```css
@import "@alexpricedev/billet-dialog/styles.css";
```

Or in your client entry, if your bundler handles CSS imports from JS:

```ts
import "@alexpricedev/billet-dialog/styles.css";
```

### 2. Turn on form gating

Once, in your client entry:

```ts
import { Dialog } from "@alexpricedev/billet-dialog";

Dialog.wireForms();
```

That attaches one delegated `submit` listener to `document`. Every form carrying a `data-confirm` attribute is gated; every other form is untouched. `wireForms` returns a function that removes the listener, for page-scoped setups:

```ts
let unwire: (() => void) | null = null;

export function init() {
  unwire = Dialog.wireForms();
}

export function cleanup() {
  unwire?.();
  unwire = null;
  Dialog.destroy();
}
```

### 3. Mark the destructive forms

Server-render the form exactly as before, plus the attributes:

```html
<form method="post" action="/lists/abc/delete"
      data-confirm="Deleting this list is permanent, and its link will stop working for anyone you've shared it with."
      data-confirm-title="Delete this list?"
      data-confirm-label="Delete list">
  <button type="submit">Delete</button>
</form>
```

Without JavaScript the form posts on the first click, exactly as it did before. With JavaScript the submit is held, the dialog opens, and the form only posts if the user confirms.

## Form attributes

| Attribute | Required | Effect |
|---|---|---|
| `data-confirm` | yes | The message, and the opt-in. A form without it is never gated. |
| `data-confirm-title` | no | Heading. Falls back to `defaultTitle`, then `"Are you sure?"`. |
| `data-confirm-label` | no | Confirm button label. Falls back to `defaultConfirmLabel`, then `"Confirm"`. |
| `data-confirm-danger` | no | Set to `"false"` to drop the destructive colour. Anything else (including absent) keeps it. |
| `data-confirmed` | — | Set by the library on the approved resubmit. Do not set it yourself; it is the "let this one through" marker. |

## Prompting directly

For a destructive action that isn't a form submit:

```ts
import { Dialog } from "@alexpricedev/billet-dialog";

const ok = await Dialog.confirm({
  title: "Revoke this invite?",
  message: "The link stops working immediately.",
  confirmLabel: "Revoke",
  danger: true,
});

if (ok) await revoke();
```

`Dialog` is a shared, lazily-built instance — the common case of one dialog per app. Nothing touches the DOM until the first prompt.

## Multiple instances

`createDialog()` returns an independent instance with its own overlay, its own listener, and its own ARIA ids. Reach for it when you need two dialogs at once, or one inside an iframe:

```ts
import { createDialog, wireConfirmForms } from "@alexpricedev/billet-dialog";

const frame = document.querySelector("iframe")!.contentDocument!;
const dialog = createDialog({ container: frame.body });
const unwire = wireConfirmForms(dialog, { root: frame });
```

The keyboard listener binds to the container's owning document, so this works without extra wiring.

## Theming

Every value is a token declared on `[data-bd-root]`. Re-declare the ones you care about — on `[data-bd-root]`, or on any ancestor, since custom properties inherit:

```css
[data-bd-root] {
  --bd-surface: var(--color-ground);
  --bd-border: var(--color-edge);
  --bd-fg: var(--color-bone);
  --bd-muted: var(--color-text-secondary);
  --bd-accent: var(--color-primary);
  --bd-accent-hover: var(--color-primary-hover);
  --bd-accent-fg: var(--color-on-primary);
  --bd-danger: var(--color-danger);
  --bd-danger-fg: var(--color-void);
  --bd-font: var(--font-body);
  --bd-radius: var(--radius);
  --bd-radius-sm: var(--radius-sm);
  --bd-shadow: var(--shadow);
}
```

| Token | Default | What it colours |
|---|---|---|
| `--bd-surface` | `#121114` | Panel background |
| `--bd-border` | `#2c2934` | Panel border, cancel button border |
| `--bd-fg` | `#ece9e2` | Title, cancel button on hover |
| `--bd-muted` | `#b5b0ba` | Message, cancel button at rest |
| `--bd-accent` / `--bd-accent-hover` / `--bd-accent-fg` | `#e5b35b` / `#f0c87e` / `#0c0b0e` | Confirm button, non-danger |
| `--bd-danger` / `--bd-danger-hover` / `--bd-danger-fg` | `#f0776b` / `#f39288` / `#0c0b0e` | Confirm button, danger |
| `--bd-scrim` | `rgba(0,0,0,0.7)` | Backdrop |
| `--bd-font` | system stack | Everything |
| `--bd-radius` / `--bd-radius-sm` | `14px` / `8px` | Panel / buttons |
| `--bd-shadow` | `0 12px 40px rgba(0,0,0,0.4)` | Panel |
| `--bd-z` | `2147483000` | Overlay stacking |
| `--bd-max-w` / `--bd-pad` / `--bd-gap` | `26rem` / `1.75rem` / `0.5rem` | Panel width, padding, button gap |

The stylesheet has no `:root` rules, no global resets, and no bare element selectors. Both buttons carry their own base styles, so a host app's global `button` rule neither leaks in nor gets fought.

## API reference

### `Dialog.confirm(opts): Promise<boolean>`

Prompt through the shared instance, building it if needed. Resolves `true` only when the confirm button is clicked. Cancel, Escape, and a backdrop click all resolve `false`.

### `Dialog.wireForms(opts?): () => void`

Gate `[data-confirm]` forms through the shared instance. Returns the unwire function.

### `Dialog.init(config?): DialogInstance`

Configure the shared instance up front. Calling it when one already exists replaces it, resolving any pending prompt `false`.

### `Dialog.current(): DialogInstance | null`

The shared instance, or `null` if nothing has built it yet.

### `Dialog.destroy(): void`

Tear the shared instance down. Safe when nothing was ever built.

### `createDialog(config?): DialogInstance`

An independent instance. `config.container` (default `document.body`) is where the overlay mounts and whose document gets the key listener. `config.texts` overrides the default `title` / `confirmLabel` / `cancelLabel`.

### `wireConfirmForms(dialog, opts?): () => void`

Gate `[data-confirm]` forms through a specific instance. `opts.root` (default `document`) scopes the delegation; `opts.defaultTitle`, `opts.defaultConfirmLabel`, and `opts.cancelLabel` set per-wiring fallback copy.

### `instance.confirm(opts)` / `instance.isOpen()` / `instance.element` / `instance.destroy()`

Per-instance equivalents. `confirm` on a destroyed instance rejects.

### `ConfirmOptions`

| Field | Type | Notes |
|---|---|---|
| `title` | `string` | Required. Empty string falls back to the instance's text. |
| `message` | `string?` | Omitted entirely when absent — the element is hidden, not blank. |
| `confirmLabel` | `string?` | Defaults to the instance's text. |
| `cancelLabel` | `string?` | Defaults to the instance's text. |
| `danger` | `boolean?` | Destructive colour on the confirm button. |

## Accessibility

- Panel is `role="alertdialog"` with `aria-modal="true"`, wired to the title and message through `aria-labelledby` / `aria-describedby`. Each instance gets unique ids.
- Focus starts on **Cancel**, never on the destructive choice — a stray Enter must not destroy anything.
- Tab is trapped between the two buttons.
- Escape and a backdrop click both cancel.
- Focus returns to the triggering element on close.

## Common pitfalls

- **Assigning `document.body.innerHTML` after the dialog mounts** wipes the overlay out from under it. Append instead.
- **Moving the guard to the button's click handler** breaks the no-JS fallback and misses Enter-to-submit. Gate the form's `submit` event, which is what this package does.
- **Converting the form to `fetch`** also breaks the fallback. Leave the form a form.
- **Forgetting the CSS import** leaves an unstyled, un-hidden dialog: the overlay's `display: none` lives in the stylesheet.
- **Two copies of the package at different versions** each mount their own overlay. Dedupe your lockfile.

## Verifying the install

```ts
Dialog.wireForms();
document.querySelector("[data-bd-root]"); // → <div data-bd-root class="bd-overlay">
```

In a browser: click a gated button, confirm the dialog appears with focus on Cancel, press Escape, and check the record still exists.

## Development

```bash
bun install
bun run check   # tsc --noEmit && bun test
```

## License

MIT
