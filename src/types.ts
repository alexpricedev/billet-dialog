/** Copy shown in a single confirm prompt. */
export interface ConfirmOptions {
  /** Heading. The one required field — say what is about to happen. */
  title: string;
  /** Supporting line. Omitted entirely when absent (the element is hidden). */
  message?: string;
  /** Label on the affirmative button. Defaults to the instance's text. */
  confirmLabel?: string;
  /** Label on the safe button. Defaults to the instance's text. */
  cancelLabel?: string;
  /** Render the affirmative button in the destructive colour. */
  danger?: boolean;
}

/** Fallback copy for prompts that do not spell it out. */
export interface DialogTexts {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface DialogConfig {
  /**
   * Where the overlay is appended. Defaults to `document.body`. The element's
   * owning document is also where the Escape/Tab listener is bound, so an
   * iframe container works without extra wiring.
   */
  container?: HTMLElement;
  /** Overrides for the default labels. */
  texts?: Partial<DialogTexts>;
}

export interface WireFormsOptions {
  /** Where the delegated submit listener is bound. Defaults to `document`. */
  root?: Document | HTMLElement;
  /** Title used when a form omits `data-confirm-title`. */
  defaultTitle?: string;
  /** Confirm label used when a form omits `data-confirm-label`. */
  defaultConfirmLabel?: string;
  /** Cancel label for every prompt this wiring raises. */
  cancelLabel?: string;
}
