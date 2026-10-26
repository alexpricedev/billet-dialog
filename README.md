# @alexpricedev/billet-dialog

Accessible dialogs for the server-rendered web. Two things, one stylesheet:

1. **Confirm prompts** for destructive actions, gating `<form>` submissions as progressive enhancement — no JavaScript, and the form still posts.
2. **Content dialogs** your own templates render as HTML, promoted to real modals on load — no JavaScript, and they render as a bordered panel in flow.

Native `<dialog>`, zero dependencies, scoped CSS tokens. Framework-agnostic — designed to drop into Billet but works anywhere.

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

5. If the app already renders its own modals, move them onto the
   package's markup contract — see "Content dialogs". Use dialogAttrs()
   and BD rather than spelling the attributes and class names out.
   Delete the app's own dialog behaviour and CSS once it does; two
   dialog systems in one page is the thing this package exists to end.

6. Apply the README's Theming block: map this repo's existing
   --color-* / --font-* (or equivalent) tokens to --bd-* on
   [data-bd-root]. Otherwise the dialog ships in the package's default
   dark look instead of matching the site.

7. Verify with the repo's check/test commands, plus the /browse skill
   (or equivalent headless browser tool), for at least one gated
   action: click destructive button → dialog appears → Cancel leaves
   the record intact → click again → Confirm actually performs it.
   Check the server-rendered page still has the plain form in its
   HTML. Do not scaffold a new browser-test harness — use whatever's
   already wired in.

8. Open a PR.
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
- **Bundle side effects**: none on import. Appends one `<dialog data-bd-root>` to `<body>` on first `Dialog.confirm()` / `Dialog.wireForms()` / `createDialog()`
- **Server runtime**: none — this is a client-only package. Your server renders the markup; nothing here runs there
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

### 2. Turn on form gating, and upgrade server-rendered dialogs

Once, in your client entry:

```ts
import { Dialog, upgradeDialogs } from "@alexpricedev/billet-dialog";

Dialog.wireForms();
upgradeDialogs();
```

`wireForms` attaches one delegated `submit` listener to `document`. Every form carrying a `data-confirm` attribute is gated; every other form is untouched.

`upgradeDialogs` promotes every `<dialog data-bd-root open>` already in the page. It is a no-op on a page that has none, so it belongs in the entry rather than behind a route check.

Both return a function that undoes them, for page-scoped setups:

```ts
let teardown: Array<() => void> = [];

export function init() {
  teardown = [Dialog.wireForms(), upgradeDialogs()];
}

export function cleanup() {
  for (const undo of teardown) undo();
  teardown = [];
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

## Content dialogs

A confirm is one shape of dialog. The other is a panel your own template renders — a form, a table, a chooser — and that one cannot be built from a JavaScript API without losing the thing that makes it work without JavaScript.

So the package does not render it. **You** render it, as a `<dialog open>` carrying the attributes below, and `upgradeDialogs()` promotes it on load.

```html
<dialog open
        id="add-product"
        data-bd-root
        data-bd-size="lg"
        data-bd-close-href="/library"
        aria-labelledby="add-product-title">
  <div class="bd-header">
    <div class="bd-heading">
      <span class="bd-eyebrow">Library</span>
      <h2 class="bd-title" id="add-product-title">Add products</h2>
      <p class="bd-description">Three ways in. Pick one.</p>
    </div>
    <a class="bd-close" href="/library">
      <svg aria-hidden="true" …></svg>
      <span class="bd-sr-only">Close</span>
    </a>
  </div>
  <div class="bd-body">…</div>
  <div class="bd-footer">…</div>
</dialog>
```

### Dialog attributes

| Attribute | Required | Effect |
|---|---|---|
| `data-bd-root` | yes | The opt-in, and the element every CSS token is declared on. A dialog without it is upgraded by nothing and styled by nothing. |
| `data-bd-size` | no | `sm` \| `md` \| `lg` \| `xl`. Caps the width of the *promoted* dialog; in flow the container decides. Defaults to `md`. |
| `data-bd-close-href` | no | Where dismissing goes. Omit it and Escape and the backdrop do nothing — the dialog is the page's content, not an overlay on it. |
| `data-bd-no-overlay-close` | no | Backdrop clicks ignored. Escape still dismisses. |

`data-bd-close-href` is the whole no-JS story. Your close control is a real `<a>` pointing at the same URL, so a reader with no JavaScript dismisses the panel by following a link. Once `upgradeDialogs()` has run, Escape and the backdrop go to that URL too.

**And it knows the difference between the two kinds of URL.** `/library?add=1` closing to `/library` is the *same document*: the parameter is dropped with `history.replaceState` and nothing reloads, because reloading the page already on screen to hide an overlay costs a round trip for nothing. `/team/invites/new` closing to `/team` is a different document, so it navigates, with the dialog held open until the new page lands rather than flashing the old one underneath.

### Don't spell the contract out by hand

`dialogAttrs()` and `BD` are the contract as values, so a rename in this package is a type error in yours rather than a dialog that silently renders as an unstyled block:

```tsx
import { BD, dialogAttrs } from "@alexpricedev/billet-dialog";

<dialog open {...dialogAttrs({ size: "lg", closeHref: "/library" })}>
  <div className={BD.header}>
    <div className={BD.heading}>
      <h2 className={BD.title} id={titleId}>{title}</h2>
    </div>
  </div>
  <div className={BD.body}>{children}</div>
</dialog>
```

`dialogAttrs()` returns the attributes only. `open` is yours to add, because only you know whether this render is an open one.

### The two states, and why the second is not a bug

```
[data-bd-root]:modal              showModal() ran. Top layer, ::backdrop, the
                                  browser's focus trap, Escape, inert page.
[data-bd-root][open]:not(:modal)  The open attribute alone. Renders in flow as
                                  a bordered panel.
```

The second is what a server render leaves behind until `upgradeDialogs()` runs — and forever, on a page that ships no JavaScript. It is styled deliberately, and it is the reason a server template can render a dialog at all.

### `.bd-close` carries no visual style

Layout only (`flex-shrink`, `margin-inline-start`). A host with a button system puts its own classes on that control alongside `bd-close`, and two single-class rules are settled by stylesheet import order rather than specificity — so a visual default here would silently win or lose depending on where you put the `@import`. The confirm prompt this package builds has no close button, so nothing needs one.

## Multiple instances

`createDialog()` returns an independent confirm instance with its own element and its own ARIA ids. Reach for it when you need two at once, or one inside an iframe:

```ts
import { createDialog, wireConfirmForms } from "@alexpricedev/billet-dialog";

const frame = document.querySelector("iframe")!.contentDocument!;
const dialog = createDialog({ container: frame.body });
const unwire = wireConfirmForms(dialog, { root: frame });
```

`upgradeDialogs(root)` takes the same treatment — pass the iframe's document, or any subtree.

## Theming

Every value is a token declared on `[data-bd-root]`. Re-declare the ones you care about — on `[data-bd-root]`, or on any ancestor, since custom properties inherit:

```css
[data-bd-root] {
  --bd-surface: var(--color-ground);
  --bd-border: var(--color-edge);
  --bd-fg: var(--color-bone);
  --bd-muted: var(--color-text-secondary);
  --bd-eyebrow: var(--color-text-secondary);
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
| `--bd-muted` | `#b5b0ba` | Description, cancel button at rest |
| `--bd-eyebrow` | `#b5b0ba` | The line above the title |
| `--bd-accent` / `--bd-accent-hover` / `--bd-accent-fg` | `#e5b35b` / `#f0c87e` / `#0c0b0e` | Confirm button, non-danger |
| `--bd-danger` / `--bd-danger-hover` / `--bd-danger-fg` | `#f0776b` / `#f39288` / `#0c0b0e` | Confirm button, danger |
| `--bd-scrim` | `rgba(0,0,0,0.7)` | `::backdrop` |
| `--bd-font` | system stack | Everything |
| `--bd-radius` / `--bd-radius-sm` | `14px` / `8px` | Panel / buttons |
| `--bd-shadow` | `0 12px 40px rgba(0,0,0,0.4)` | Panel |
| `--bd-max-w-sm` … `-xl` | `26rem` / `32rem` / `44rem` / `68rem` | The four `data-bd-size` caps |
| `--bd-pad` / `--bd-gap` | `1.75rem` / `0.5rem` | Panel padding, button gap |

The stylesheet has no `:root` token rules and no bare element selectors. Both confirm buttons carry their own base styles, so a host app's global `button` rule neither leaks in nor gets fought.

The one selector that reaches outside the dialog is the scroll lock, `:root:has([data-bd-root]:modal)`. `showModal()` makes the page inert but does not stop it scrolling, so a wheel over the backdrop slides the document under the scrim. The rule is gated on one of our dialogs being modal, so it can do nothing to a page that is not showing one.

## API reference

### `Dialog.confirm(opts): Promise<boolean>`

Prompt through the shared instance, building it if needed. Resolves `true` only when the confirm button is clicked. Cancel, Escape, and a backdrop click all resolve `false`.

### `Dialog.wireForms(opts?): () => void`

Gate `[data-confirm]` forms through the shared instance. Returns the unwire function.

### `upgradeDialogs(root?): () => void`

Promote every `<dialog data-bd-root open>` under `root` (default `document`) and wire its `data-bd-close-href`. Returns a function that unbinds the listeners and closes what it promoted.

`root` may be the dialog itself, which is the natural call from a framework component that has just rendered one and holds the ref — `querySelectorAll` does not match the node it is called on, so that case is handled explicitly.

### `dialogAttrs(opts?): Record<string, string>`

The attributes for a server-rendered dialog. `opts.size`, `opts.closeHref`, `opts.disableOverlayClose`.

### `BD`

The class names the stylesheet owns, as a frozen map. `DIALOG_SIZES` is the matching list of sizes.

### `activateDialog(dialog, opts): () => void`

The promotion and dismissal wiring on its own, for a framework component that manages `open` itself. `opts.dismiss` (required), `opts.disableOverlayClose`, `opts.closeOnDismiss`. Returns a cleanup that unbinds and closes — which is what hands focus back.

### `Dialog.init(config?)` / `Dialog.current()` / `Dialog.destroy()`

Manage the shared confirm instance. `init` replaces an existing one, resolving any pending prompt `false`.

### `createDialog(config?): DialogInstance`

An independent confirm instance. `config.container` (default `document.body`) is where it mounts. `config.texts` overrides the default `title` / `confirmLabel` / `cancelLabel`.

### `wireConfirmForms(dialog, opts?): () => void`

Gate `[data-confirm]` forms through a specific instance. `opts.root` (default `document`) scopes the delegation; `opts.defaultTitle`, `opts.defaultConfirmLabel`, and `opts.cancelLabel` set per-wiring fallback copy.

### `instance.confirm(opts)` / `instance.isOpen()` / `instance.element` / `instance.destroy()`

Per-instance equivalents. `element` is the `<dialog>`. `confirm` on a destroyed instance rejects.

### `ConfirmOptions`

| Field | Type | Notes |
|---|---|---|
| `title` | `string` | Required. Empty string falls back to the instance's text. |
| `message` | `string?` | Omitted entirely when absent — the element is hidden, not blank. |
| `confirmLabel` | `string?` | Defaults to the instance's text. |
| `cancelLabel` | `string?` | Defaults to the instance's text. |
| `danger` | `boolean?` | Destructive colour on the confirm button. |

## Accessibility

- The confirm prompt is `role="alertdialog"` with `aria-modal="true"`, wired to its title and message through `aria-labelledby` / `aria-describedby`. Each instance gets unique ids.
- A content dialog is left as the implicit `dialog` role; label it yourself with `aria-labelledby` pointing at your `.bd-title` and nothing else, so the eyebrow stays out of the accessible name.
- The focus trap, Escape, the inert page behind and the top layer are the browser's, from `showModal()` — not a hand-rolled Tab cycle.
- Focus starts on **Cancel**, never on the destructive choice — a stray Enter must not destroy anything.
- Focus returns to the triggering element on close.
- `claimAutofocus` re-claims an `autofocus` field after the browser's fragment scroll steals it, which is what a dialog reached by `#id` would otherwise suffer.

## Common pitfalls

- **Moving the guard to the button's click handler** breaks the no-JS fallback and misses Enter-to-submit. Gate the form's `submit` event, which is what this package does.
- **Converting the form to `fetch`** also breaks the fallback. Leave the form a form.
- **Rendering a content dialog without `open`** leaves it hidden with nothing to promote. `upgradeDialogs()` only looks at `[open]`.
- **Keeping your own modal CSS as well.** Two stylesheets styling one dialog is settled by import order, which nobody reads. Delete yours.
- **Assigning `document.body.innerHTML` after the dialog mounts** wipes it out from under the instance. Append instead.
- **Two copies of the package at different versions** each mount their own element. Dedupe your lockfile.

## Verifying the install

```ts
Dialog.wireForms();
document.querySelector("[data-bd-root]"); // → <dialog data-bd-root …>
```

In a browser: click a gated button, confirm the dialog appears with focus on Cancel, press Escape, and check the record still exists. For a content dialog, load its URL with JavaScript disabled and check the panel renders in flow with a working close link.

## Development

```bash
bun install
bun run check   # tsc --noEmit && bun test
bun run build   # dist/index.js + .d.ts + styles.css
```

`dist/` is committed, not gitignored. It is what makes a git dependency
(`github:alexpricedev/billet-dialog#<sha>`) install and work without a build
step on the consumer's side — Bun blocks lifecycle scripts by default, and a
`prepare` that shells out to `tsc` would need this package's devDependencies,
which a dependency install does not get. **Run `bun run build` and commit the
result in the same commit as any `src/` change**, or a consumer pinned to that
SHA gets stale code.

## License

MIT
