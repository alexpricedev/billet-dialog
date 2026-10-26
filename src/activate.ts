/*
 * The behaviour half of the package, deliberately framework-free.
 *
 * Three callers share it and must not drift:
 *   - `dialog.ts`, for the confirm prompt this package builds itself.
 *   - `upgrade.ts`, for dialogs a *server* template rendered. Those never
 *     hydrate, so nothing would otherwise promote them.
 *   - a host framework's own component, through the exported `activateDialog`.
 *
 * Everything here is about one thing: a `<dialog>` with the `open` attribute is
 * **not** modal. It sits in normal flow with no backdrop, no focus trap, no
 * Escape handling and no inert background. `showModal()` gives all four, from
 * the browser, without a portal — which is why this package is a `<dialog>`
 * and not a positioned `<div>`.
 */

export interface ActivateOptions {
  /** Called for Escape and a backdrop click. */
  dismiss: () => void;
  /** Ignore backdrop clicks. Escape still dismisses. @default false */
  disableOverlayClose?: boolean;
  /**
   * Close the dialog as part of dismissing it. @default false
   *
   * Off suits the two cases this was written for: a controlled component whose
   * `open` prop is still true must not find its dialog shut, and a dialog
   * dismissed by navigating away should stay on screen until the next page
   * arrives rather than flashing the old one underneath.
   *
   * On is for a dialog that dismisses **within the same document** — one whose
   * close href differs only in the query string. There the owner has nothing to
   * wait for, and leaving the dialog up makes Escape look like it did nothing.
   *
   * It closes the dialog here rather than letting the browser's own default
   * action do it. The default action only exists behind a *trusted* Escape, so
   * leaning on it would leave the dialog open for anything else that dispatches
   * `cancel` — and would make the behaviour depend on an engine detail rather
   * than on this file.
   */
  closeOnDismiss?: boolean;
}

/**
 * Promote a `<dialog open>` to a real modal and wire its two dismissal paths.
 *
 * Returns a cleanup function that unbinds the listeners and closes the dialog,
 * which is what makes the browser hand focus back to whatever had it.
 */
export function activateDialog(
  dialog: HTMLDialogElement,
  {
    dismiss,
    disableOverlayClose = false,
    closeOnDismiss = false,
  }: ActivateOptions,
): () => void {
  // `close()` fires a `close` event and, on a modal dialog, moves focus. Track
  // the closes we cause so the listener below can tell them from a user's.
  //
  // A COUNTER, not a boolean flag, and this matters: the spec queues the
  // `close` event as an element task, so a real browser dispatches it *after*
  // the synchronous block that called `close()` has finished — and after this
  // function has added its listeners. A flag set and cleared around the call is
  // already false by the time the event lands, so the dialog's own setup close
  // reads as a user dismissal and, with a close href, immediately navigates
  // away. happy-dom dispatches synchronously and cannot catch that; it was
  // found in a browser.
  let pendingInternalCloses = 0;
  const closeQuietly = () => {
    if (!dialog.open) return;
    pendingInternalCloses += 1;
    dialog.close();
  };

  // Everything a dismissal does, in one place, so Escape and a backdrop click
  // cannot drift apart.
  const onDismiss = () => {
    // Through `closeQuietly`, so the `close` this fires is not read back as a
    // second, user-initiated dismissal.
    if (closeOnDismiss) closeQuietly();
    dismiss();
  };

  // Escape fires `cancel`. The default close is always prevented and the
  // dismissal driven from here — see `closeOnDismiss`.
  const onCancel = (event: Event) => {
    event.preventDefault();
    onDismiss();
  };

  // A click on the backdrop of a modal dialog reports the dialog itself as the
  // target, because `::backdrop` is a pseudo-element with no node of its own.
  // Anything inside the dialog reports that child.
  const onClick = (event: MouseEvent) => {
    if (disableOverlayClose || event.target !== dialog) return;
    onDismiss();
  };

  // Something closed the dialog without going through `dismiss` — a `<form
  // method="dialog">`, or `close()` from elsewhere. Tell the owner so its state
  // cannot disagree with what is on screen.
  const onClose = () => {
    if (pendingInternalCloses > 0) {
      pendingInternalCloses -= 1;
      return;
    }
    dismiss();
  };

  // Listeners go on BEFORE the promotion below, which closes the dialog. That
  // ordering is what makes the counter balance in both worlds: a browser queues
  // the `close` event and delivers it after this function returns, while
  // happy-dom dispatches it synchronously inside `close()`. Bind after the
  // promotion and the synchronous delivery is missed, the counter never comes
  // back down, and the next real close is swallowed.
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("click", onClick as EventListener);
  dialog.addEventListener("close", onClose);

  promote(dialog);

  return () => {
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("click", onClick as EventListener);
    dialog.removeEventListener("close", onClose);
    closeQuietly();
  };

  function promote(node: HTMLDialogElement): void {
    // `showModal()` throws InvalidStateError on a dialog that already has
    // `open` and is not modal — which is exactly the state a server render
    // leaves it in.
    //
    // `:modal` is checked rather than `open` so an already-promoted dialog is
    // left alone. happy-dom reports `:modal` as false even after `showModal()`,
    // which only costs a redundant close/re-open there.
    if (isModal(node)) return;
    closeQuietly();
    node.showModal();
    claimAutofocus(node);
  }
}

/** `matches(":modal")`, surviving an engine that does not know the selector. */
export function isModal(dialog: HTMLDialogElement): boolean {
  try {
    return dialog.matches(":modal");
  } catch {
    return false;
  }
}

/**
 * Put focus back in the dialog's own `autofocus` field.
 *
 * `showModal()` already runs the browser's dialog focusing steps, which focus a
 * descendant carrying `autofocus` — so why this? Because a server-rendered
 * dialog is usually reached by a fragment (`/library?add=1#add-product`), and
 * the browser re-runs its fragment scroll once the document has finished
 * loading. The fragment names the dialog, the dialog is focusable, so the
 * fragment takes focus back off the field a few milliseconds after the
 * promotion. Measured in Chromium at ~10ms, against a promotion at ~8ms;
 * happy-dom has no fragment scroll and cannot see it either way.
 *
 * Claimed on the next frame and again at `load`, because those are the two
 * moments the fragment scroll can land, and *only* while focus is still where
 * the promotion or the fragment left it — a reader who has moved on is not
 * yanked back. Nothing here runs for a dialog with no `autofocus` descendant,
 * which is most dialogs.
 */
export function claimAutofocus(dialog: HTMLDialogElement): void {
  const field = dialog.querySelector<HTMLElement>("[autofocus]");
  if (!field) return;

  const doc = dialog.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;

  const claim = () => {
    if (!dialog.open) return;
    const active = doc.activeElement;
    // `dialog.contains(dialog)` is false, so the two cases are spelled out: the
    // promotion leaves focus on the dialog, and the fragment scroll can leave
    // it on the body instead.
    if (active !== dialog && active !== doc.body) return;
    field.focus();
  };

  view.requestAnimationFrame(claim);
  if (doc.readyState !== "complete") {
    view.addEventListener("load", claim, { once: true });
  }
}
