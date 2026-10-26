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
var submitForm = (form) => {
  form.dataset.confirmed = "true";
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.submit();
  }
};
function wireConfirmForms(dialog, opts = {}) {
  const root = opts.root ?? document;
  const onSubmit = (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement))
      return;
    if (form.dataset.confirm === undefined)
      return;
    if (form.dataset.confirmed === "true")
      return;
    e.preventDefault();
    dialog.confirm({
      title: form.dataset.confirmTitle ?? opts.defaultTitle ?? "",
      message: form.dataset.confirm,
      confirmLabel: form.dataset.confirmLabel ?? opts.defaultConfirmLabel,
      cancelLabel: opts.cancelLabel,
      danger: form.dataset.confirmDanger !== "false"
    }).then((confirmed) => {
      if (confirmed)
        submitForm(form);
    }).catch(() => {});
  };
  root.addEventListener("submit", onSubmit);
  return () => root.removeEventListener("submit", onSubmit);
}
// src/upgrade.ts
function upgradeDialogs(root = document) {
  const cleanups = Array.from(root.querySelectorAll("dialog[data-bd-root][open]")).map((dialog) => {
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
  wireConfirmForms
};
