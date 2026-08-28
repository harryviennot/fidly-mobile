/**
 * Earning-limit ("cap") decisions shared by the stamp and points flows.
 */

/** What pressing "Add anyway" on the limit screen should do next. */
export type WaiveAction = "resubmit" | "return-to-entry";

interface WaiveInput {
  /**
   * True when the limit screen is showing because the server refused a scan the
   * employee had already filled in and sent (409 EARNING_CAP_REACHED), rather
   * than because the pre-scan snapshot said the customer was already full.
   */
  rejectedRequest: boolean;
  /** Is what's still on the entry screen worth sending? (amount > 0 / quantity >= 1) */
  inputReady: boolean;
}

/**
 * A manager waiving the limit has already made the decision the entry screen
 * would ask for again. When the block came from a rejected request the amount
 * (or quantity) is still on screen and already confirmed, so re-send it: going
 * back to the entry screen to press the same button a second time turns one
 * scan into three steps. When nothing was ever sent there is nothing to
 * re-send, so the entry screen is exactly where the employee needs to land.
 */
export function resolveWaiveAction({ rejectedRequest, inputReady }: WaiveInput): WaiveAction {
  return rejectedRequest && inputReady ? "resubmit" : "return-to-entry";
}
