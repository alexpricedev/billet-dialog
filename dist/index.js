// src/activate.ts
function activateDialog(dialog, {
  dismiss,
  disableOverlayClose = false,
  closeOnDismiss = false
}) {
  let pendingInternalCloses = 0;
  const closeQuietly = () => {
    if (!dialog.open)
      return;
    pendingInternalCloses += 1;
    dialog.close();
  };
  const onDismiss = () => {
    if (closeOnDismiss)
      closeQuietly();
    dismiss();
  };
  const onCancel = (event) => {
    event.preventDefault();
    onDismiss();
  };
  const onClick = (event) => {
    if (disableOverlayClose || event.target !== dialog)
      return;
    onDismiss();
  };
  const onClose = () => {
    if (pendingInternalCloses > 0) {
      pendingInternalCloses -= 1;
      return;
    }
    dismiss();
  };
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("close", onClose);
  promote(dialog);
  return () => {
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("click", onClick);
    dialog.removeEventListener("close", onClose);
    closeQuietly();
  };
  function promote(node) {
    if (isModal(node))
      return;
    closeQuietly();
    node.showModal();
    claimAutofocus(node);
  }
}
function isModal(dialog) {
  try {
    return dialog.matches(":modal");
  } catch {
    return false;
  }
}
function claimAutofocus(dialog) {
  const field = dialog.querySelector("[autofocus]");
  if (!field)
    return;
  const doc = dialog.ownerDocument;
  const view = doc.defaultView;
  if (!view)
    return;
  const claim = () => {
    if (!dialog.open)
      return;
    const active = doc.activeElement;
    if (active !== dialog && active !== doc.body)
      return;
    field.focus();
  };
  view.requestAnimationFrame(claim);
  if (doc.readyState !== "complete") {
    view.addEventListener("load", claim, { once: true });
  }
}

// src/markup.ts
var BD = {
  header: "bd-header",
  heading: "bd-heading",
  eyebrow: "bd-eyebrow",
  title: "bd-title",
  description: "bd-description",
  close: "bd-close",
  body: "bd-body",
  footer: "bd-footer",
  srOnly: "bd-sr-only",
  cancel: "bd-cancel",
  confirm: "bd-confirm",
  danger: "is-danger"
};
function dialogAttrs({
  size = "md",
  closeHref,
  disableOverlayClose = false
} = {}) {
  const attrs = {
    "data-bd-root": "",
    "data-bd-size": size
  };
  if (closeHref !== undefined)
    attrs["data-bd-close-href"] = closeHref;
  if (disableOverlayClose)
    attrs["data-bd-no-overlay-close"] = "";
  return attrs;
}
var DIALOG_SIZES = ["sm", "md", "lg", "xl"];

// src/dialog.ts
var DEFAULT_TEXTS = {
  title: "Are you sure?",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel"
};
var seq = 0;
function createDialog(config = {}) {
  const container = config.container ?? document.body;
  const doc = container.ownerDocument;
  const texts = { ...DEFAULT_TEXTS, ...config.texts };
  const uid = ++seq;
  let pending = null;
  let release = null;
  let lastFocused = null;
  let destroyed = false;
  const dialog = doc.createElement("dialog");
  dialog.setAttribute("data-bd-root", "");
  dialog.setAttribute("data-bd-size", "sm");
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", `bd-title-${uid}`);
  dialog.setAttribute("aria-describedby", `bd-message-${uid}`);
  const header = doc.createElement("div");
  header.className = BD.header;
  const heading = doc.createElement("div");
  heading.className = BD.heading;
  const title = doc.createElement("h2");
  title.className = BD.title;
  title.id = `bd-title-${uid}`;
  const message = doc.createElement("p");
  message.className = BD.description;
  message.id = `bd-message-${uid}`;
  const footer = doc.createElement("div");
  footer.className = BD.footer;
  const cancelBtn = doc.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = BD.cancel;
  const confirmBtn = doc.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = BD.confirm;
  heading.append(title, message);
  header.append(heading);
  footer.append(cancelBtn, confirmBtn);
  dialog.append(header, footer);
  container.append(dialog);
  const settle = (confirmed) => {
    const resolve = pending;
    pending = null;
    release?.();
    release = null;
    lastFocused?.focus();
    lastFocused = null;
    resolve?.(confirmed);
  };
  cancelBtn.addEventListener("click", () => settle(false));
  confirmBtn.addEventListener("click", () => settle(true));
  return {
    element: dialog,
    isOpen: () => pending !== null,
    confirm(opts) {
      if (destroyed) {
        return Promise.reject(new Error("billet-dialog: this dialog has been destroyed"));
      }
      if (pending)
        settle(false);
      return new Promise((resolve) => {
        pending = resolve;
        title.textContent = opts.title || texts.title;
        message.textContent = opts.message ?? "";
        message.hidden = !opts.message;
        confirmBtn.textContent = opts.confirmLabel ?? texts.confirmLabel;
        cancelBtn.textContent = opts.cancelLabel ?? texts.cancelLabel;
        confirmBtn.classList.toggle(BD.danger, opts.danger === true);
        lastFocused = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
        release = activateDialog(dialog, {
          dismiss: () => settle(false),
          closeOnDismiss: true
        });
        cancelBtn.focus();
      });
    },
    destroy() {
      if (pending)
        settle(false);
      release?.();
      release = null;
      dialog.remove();
      destroyed = true;
    }
  };
}

// src/forms.ts
var submitForm = (form, submitter) => {
  form.dataset.confirmed = "true";
  try {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit(isSubmitButton(submitter) ? submitter : undefined);
    } else {
      form.submit();
    }
  } finally {
    delete form.dataset.confirmed;
  }
};
var isSubmitButton = (node) => (node instanceof HTMLButtonElement || node instanceof HTMLInputElement) && node.type === "submit";
var sourceOf = (form, submitter) => {
  if (submitter && submitter.dataset["confirm"] !== undefined)
    return submitter;
  if (form.dataset.confirm !== undefined)
    return form;
  return null;
};
function wireConfirmForms(dialog, opts = {}) {
  const root = opts.root ?? document;
  const onSubmit = (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement))
      return;
    if (form.dataset.confirmed === "true")
      return;
    const submitter = "submitter" in e && e.submitter instanceof HTMLElement ? e.submitter : null;
    const source = sourceOf(form, submitter);
    if (!source)
      return;
    e.preventDefault();
    dialog.confirm({
      title: source.dataset["confirmTitle"] ?? opts.defaultTitle ?? "",
      message: source.dataset["confirm"],
      confirmLabel: source.dataset["confirmLabel"] ?? opts.defaultConfirmLabel,
      cancelLabel: opts.cancelLabel,
      danger: source.dataset["confirmDanger"] !== "false"
    }).then((confirmed) => {
      if (confirmed)
        submitForm(form, submitter);
    }).catch(() => {});
  };
  root.addEventListener("submit", onSubmit);
  return () => root.removeEventListener("submit", onSubmit);
}
// src/links.ts
var LINK_SELECTOR = "a[data-bd-link][href]";
var DIALOG_SELECTOR = "dialog[data-bd-root][open]";
var LOADING_ATTR = "data-bd-loading";
function wireDialogLinks({
  onAdopt,
  fetch: fetchImpl
} = {}) {
  const doc = document;
  const view = doc.defaultView ?? window;
  const request = fetchImpl ?? ((input, init) => view.fetch(input, init));
  let current = null;
  const navigate = (href) => {
    view.location.assign(href);
  };
  const state = () => view.history.state ?? null;
  const adopt = (found, source, href) => {
    current?.close(true);
    const dialog = doc.adoptNode(found);
    doc.body.append(dialog);
    const previousTitle = doc.title;
    if (source.title)
      doc.title = source.title;
    view.history.pushState({ bdLink: href }, "", href);
    onAdopt?.(dialog, source);
    const closeHref = dialog.dataset.bdCloseHref;
    const closeTarget = closeHref ? new URL(closeHref, view.location.href).href : null;
    const onDialogClick = (event) => {
      if (closeTarget === null || event.defaultPrevented)
        return;
      const anchor = event.target?.closest?.("a[href]");
      const target = anchor?.getAttribute("href");
      if (!target)
        return;
      if (new URL(target, view.location.href).href !== closeTarget)
        return;
      event.preventDefault();
      close(false);
    };
    let closed = false;
    let release = null;
    const close = (viaPopstate) => {
      if (closed)
        return;
      closed = true;
      if (current?.href === href)
        current = null;
      dialog.removeEventListener("click", onDialogClick);
      release?.();
      dialog.remove();
      doc.title = previousTitle;
      if (!viaPopstate && state()?.bdLink === href)
        view.history.back();
    };
    dialog.addEventListener("click", onDialogClick);
    current = { href, close };
    release = activateDialog(dialog, {
      dismiss: () => close(false),
      closeOnDismiss: true
    });
  };
  const open = async (href, link) => {
    link.setAttribute(LOADING_ATTR, "");
    try {
      const response = await request(href, {
        credentials: "same-origin",
        headers: { Accept: "text/html" }
      });
      if (!response.ok)
        return navigate(href);
      const landed = response.url ? new URL(response.url, view.location.href).href : href;
      if (landed !== new URL(href, view.location.href).href) {
        return navigate(href);
      }
      const source = new DOMParser().parseFromString(await response.text(), "text/html");
      const found = source.querySelector(DIALOG_SELECTOR);
      if (!found)
        return navigate(href);
      adopt(found, source, href);
    } catch {
      navigate(href);
    } finally {
      link.removeAttribute(LOADING_ATTR);
    }
  };
  const onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0)
      return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = event.target?.closest?.(LINK_SELECTOR);
    if (!link)
      return;
    if (link.hasAttribute("target") || link.hasAttribute("download"))
      return;
    const href = link.getAttribute("href");
    if (!href)
      return;
    const url = new URL(href, view.location.href);
    if (url.origin !== view.location.origin)
      return;
    event.preventDefault();
    open(url.href, link);
  };
  const onPopState = () => {
    if (current) {
      if (state()?.bdLink !== current.href)
        current.close(true);
      return;
    }
    if (state()?.bdLink)
      view.location.reload();
  };
  doc.addEventListener("click", onClick);
  view.addEventListener("popstate", onPopState);
  return () => {
    doc.removeEventListener("click", onClick);
    view.removeEventListener("popstate", onPopState);
    current?.close(true);
  };
}
// src/upgrade.ts
var SELECTOR = "dialog[data-bd-root][open]";
var targets = (root) => {
  const found = Array.from(root.querySelectorAll(SELECTOR));
  return root instanceof Element && root.matches(SELECTOR) ? [root, ...found] : found;
};
function upgradeDialogs(root = document) {
  const cleanups = targets(root).map((dialog) => {
    const href = dialog.dataset.bdCloseHref;
    const view = dialog.ownerDocument.defaultView ?? window;
    const target = href ? new URL(href, view.location.href) : null;
    const sameDocument = target !== null && target.origin === view.location.origin && target.pathname === view.location.pathname;
    return activateDialog(dialog, {
      dismiss: () => {
        if (!target)
          return;
        if (sameDocument) {
          view.history.replaceState(view.history.state, "", target);
          return;
        }
        view.location.assign(target.href);
      },
      disableOverlayClose: !href || dialog.dataset.bdNoOverlayClose !== undefined,
      closeOnDismiss: sameDocument
    });
  });
  return () => {
    for (const cleanup of cleanups)
      cleanup();
  };
}

// src/index.ts
var shared = null;
var sharedConfig = {};
var ensure = () => {
  shared ??= createDialog(sharedConfig);
  return shared;
};
var Dialog = {
  init(config = {}) {
    if (shared)
      shared.destroy();
    sharedConfig = config;
    shared = createDialog(config);
    return shared;
  },
  current() {
    return shared;
  },
  confirm(opts) {
    return ensure().confirm(opts);
  },
  wireForms(opts = {}) {
    return wireConfirmForms(ensure(), opts);
  },
  destroy() {
    shared?.destroy();
    shared = null;
  }
};
var src_default = Dialog;
export {
  BD,
  DEFAULT_TEXTS,
  DIALOG_SIZES,
  Dialog,
  activateDialog,
  claimAutofocus,
  createDialog,
  src_default as default,
  dialogAttrs,
  isModal,
  upgradeDialogs,
  wireConfirmForms,
  wireDialogLinks
};
