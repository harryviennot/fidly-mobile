/**
 * Structured API errors.
 *
 * The backend sends `detail` in two shapes: a plain string (FastAPI's own 404s
 * and validation errors) or a dict `{code, message, ...}` for every gate
 * (`CHECKOUT_REQUIRED`, `BILLING_REQUIRED`, `LOCATION_REQUIRED`, ...). Throwing
 * `new Error(detail)` on the dict shape stringifies it to "[object Object]",
 * which is what employees used to see on the fatal error screen when a business
 * was gated. Always build errors through `toApiError`.
 *
 * Pure module with no React Native imports so it stays unit-testable.
 */

export class ApiError extends Error {
  /** Backend error code, e.g. "BILLING_REQUIRED". Absent on plain-string details. */
  readonly code?: string;
  readonly status: number;
  readonly detail?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/**
 * The request was sent and never answered inside its budget.
 *
 * NOT a failure: it may well have landed. The confirmation screens answer this
 * one by re-reading the customer and comparing (see utils/scanRecovery).
 */
export const REQUEST_TIMEOUT = "REQUEST_TIMEOUT";

/** Nothing left the phone, so there is nothing to reconcile. */
export const NETWORK_UNREACHABLE = "NETWORK_UNREACHABLE";

/** Status 0: no response ever existed, as opposed to a refused one. */
export function timeoutError(): ApiError {
  return new ApiError(REQUEST_TIMEOUT, 0, REQUEST_TIMEOUT);
}

export function unreachableError(): ApiError {
  return new ApiError(NETWORK_UNREACHABLE, 0, NETWORK_UNREACHABLE);
}

/** Pull the `detail` out of a parsed error body, whatever shape it arrived in. */
export function toApiError(
  body: unknown,
  status: number,
  fallback: string,
): ApiError {
  const detail = (body as { detail?: unknown } | null | undefined)?.detail;

  if (typeof detail === "string" && detail.length > 0) {
    return new ApiError(detail, status);
  }

  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    const code = typeof d.code === "string" ? d.code : undefined;
    const message =
      typeof d.message === "string" && d.message.length > 0
        ? d.message
        : (code ?? fallback);
    return new ApiError(message, status, code, d);
  }

  return new ApiError(fallback, status);
}
