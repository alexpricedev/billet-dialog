import type { DialogInstance } from "./dialog";
import type { WireFormsOptions } from "./types";
/**
 * Gate every `[data-confirm]` form behind `dialog`, through one delegated
 * listener. A form without JavaScript still posts straight through, so this
 * stays pure progressive enhancement.
 *
 * Attributes read off the form:
 * - `data-confirm` — the message, and the opt-in. Absent means untouched.
 * - `data-confirm-title` — heading override.
 * - `data-confirm-label` — confirm button override.
 * - `data-confirm-danger="false"` — drop the destructive styling.
 *
 * Returns a function that removes the listener.
 */
export declare function wireConfirmForms(dialog: DialogInstance, opts?: WireFormsOptions): () => void;
