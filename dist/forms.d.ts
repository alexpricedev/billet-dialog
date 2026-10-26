import type { DialogInstance } from "./dialog";
import type { WireFormsOptions } from "./types";
/**
 * Gate `[data-confirm]` submissions behind `dialog`, through one delegated
 * listener. A form without JavaScript still posts straight through, so this
 * stays pure progressive enhancement.
 *
 * Attributes read off the form **or off the submit button that was pressed**:
 * - `data-confirm` — the message, and the opt-in. Absent means untouched.
 * - `data-confirm-title` — heading override.
 * - `data-confirm-label` — confirm button override.
 * - `data-confirm-danger="false"` — drop the destructive styling.
 *
 * Putting them on the button is for the form that does more than one thing —
 * a table of rows with a Save and a trash on every row, all posting together
 * so nothing typed is lost. There, gating the *form* would gate Save as well.
 * A button's attributes win over the form's, so a form-level `data-confirm`
 * and one button that opts out of it is not expressible; that is deliberate,
 * because a form whose Save is gated and whose Delete is not is a bug.
 *
 * Returns a function that removes the listener.
 */
export declare function wireConfirmForms(dialog: DialogInstance, opts?: WireFormsOptions): () => void;
