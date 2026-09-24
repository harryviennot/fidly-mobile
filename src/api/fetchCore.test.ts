/**
 * The transport core, exercised with its dependencies injected.
 *
 * `client.ts` itself cannot be unit tested: it imports `lib/supabase`, and
 * therefore react-native, whose Flow-typed entrypoint Bun cannot parse (see the
 * note in src/locales/i18n-catalogs.test.ts). So the logic lives here, in a
 * module that takes `fetch`, the auth headers and the session refresh as
 * arguments, and `client.ts` is the thin wiring that hands it the real ones.
 */

import { describe, expect, it } from "bun:test";
import { requestWithAuthRetry, type FetchCoreDeps } from "./fetchCore";
import { errorCode, errorStatus } from "../utils/apiErrors";

type Call = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

/** A session refresh that answers with a fresh token. */
const refreshOk = async () => ({
  data: { session: { access_token: "fresh-token" } },
  error: null,
});

function deps(overrides: Partial<FetchCoreDeps> & Pick<FetchCoreDeps, "fetchImpl">): FetchCoreDeps {
  return {
    baseUrl: "https://api.test",
    authHeaders: () => ({
      "Content-Type": "application/json",
      "X-Client-Platform": "ios",
      "X-App-Version": "2.3.0",
      Authorization: "Bearer stale-token",
    }),
    refreshSession: refreshOk,
    timeoutMs: 1000,
    refreshTimeoutMs: 1000,
    ...overrides,
  };
}

/** Records every call and answers from a queue. */
function recorder(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[calls.length - 1];
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as FetchCoreDeps["fetchImpl"];
  return { calls, fetchImpl };
}

describe("requestWithAuthRetry", () => {
  it("calls the base URL with the auth headers and returns the parsed body", async () => {
    const { calls, fetchImpl } = recorder([jsonResponse(200, { stamps: 3 })]);

    const result = await requestWithAuthRetry<{ stamps: number }>(
      "/stamps/b1/e1",
      { method: "POST", body: '{"client_key":"k-1"}' },
      deps({ fetchImpl })
    );

    expect(result).toEqual({ stamps: 3 });
    expect(calls[0].url).toBe("https://api.test/stamps/b1/e1");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>)["X-Client-Platform"]).toBe("ios");
  });

  it("lets the caller's headers win over the defaults", async () => {
    const { calls, fetchImpl } = recorder([jsonResponse(200, {})]);

    await requestWithAuthRetry("/x", { headers: { "X-App-Version": "9.9.9" } }, deps({ fetchImpl }));

    expect((calls[0].init.headers as Record<string, string>)["X-App-Version"]).toBe("9.9.9");
  });
});

describe("the request budget", () => {
  it("aborts the request once the budget is spent", async () => {
    // A cashier is holding up a queue: a request that has not answered inside
    // the budget has to become an outcome we can act on, not an open promise.
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })) as unknown as FetchCoreDeps["fetchImpl"];

    const err = await requestWithAuthRetry("/slow", {}, deps({ fetchImpl, timeoutMs: 20 })).catch(
      (e) => e
    );

    expect(errorCode(err)).toBe("REQUEST_TIMEOUT");
  });

  it("calls it a timeout whatever shape the aborted fetch rejects with", async () => {
    // React Native has changed the abort rejection's name and type across
    // versions. What we KNOW is that our own controller fired, so that is what
    // the verdict reads, not the error's name.
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new TypeError("Network request failed"))
        );
      })) as unknown as FetchCoreDeps["fetchImpl"];

    const err = await requestWithAuthRetry("/slow", {}, deps({ fetchImpl, timeoutMs: 20 })).catch(
      (e) => e
    );

    expect(errorCode(err)).toBe("REQUEST_TIMEOUT");
  });

  it("calls an immediate transport failure unreachable, not a timeout", async () => {
    // Nothing was sent, so there is nothing to reconcile: the two outcomes lead
    // to different screens and must never be confused.
    const { fetchImpl } = recorder([new TypeError("Network request failed")]);

    const err = await requestWithAuthRetry("/x", {}, deps({ fetchImpl })).catch((e) => e);

    expect(errorCode(err)).toBe("NETWORK_UNREACHABLE");
  });

  it("gives the retry its own full budget", async () => {
    const seen: (number | undefined)[] = [];
    let call = 0;
    const fetchImpl = ((_url: string, init: RequestInit) => {
      call += 1;
      if (call === 1) return Promise.resolve(jsonResponse(401, {}));
      return new Promise((_resolve, reject) => {
        const started = Date.now();
        init.signal?.addEventListener("abort", () => {
          seen.push(Date.now() - started);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    }) as unknown as FetchCoreDeps["fetchImpl"];

    const err = await requestWithAuthRetry("/x", {}, deps({ fetchImpl, timeoutMs: 30 })).catch(
      (e) => e
    );

    expect(errorCode(err)).toBe("REQUEST_TIMEOUT");
    expect(seen).toHaveLength(1);
  });
});

describe("the 401 refresh-and-retry", () => {
  it("retries ONCE with the refreshed token and the very same body", async () => {
    // The same body means the same client_key: the backend dedupes the retry
    // against the original, so a refresh mid-scan cannot cost a second credit.
    const { calls, fetchImpl } = recorder([
      jsonResponse(401, {}),
      jsonResponse(200, { stamps: 4 }),
    ]);

    const result = await requestWithAuthRetry<{ stamps: number }>(
      "/stamps/b1/e1",
      { method: "POST", body: '{"quantity":2,"client_key":"k-1"}' },
      deps({ fetchImpl })
    );

    expect(result).toEqual({ stamps: 4 });
    expect(calls).toHaveLength(2);
    expect(calls[1].init.body).toBe(calls[0].init.body);
    expect(calls[1].init.body).toContain('"client_key":"k-1"');
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer fresh-token"
    );
  });

  it("keeps the platform and version headers on the retry", async () => {
    // The backend records the scan's platform from these. A retried scan is
    // still a scan from this phone.
    const { calls, fetchImpl } = recorder([jsonResponse(401, {}), jsonResponse(200, {})]);

    await requestWithAuthRetry("/stamps/b1/e1", { method: "POST" }, deps({ fetchImpl }));

    const headers = calls[1].init.headers as Record<string, string>;
    expect(headers["X-Client-Platform"]).toBe("ios");
    expect(headers["X-App-Version"]).toBe("2.3.0");
  });

  it("retries exactly once, never in a loop", async () => {
    const { calls, fetchImpl } = recorder([jsonResponse(401, {}), jsonResponse(401, {})]);

    const err = await requestWithAuthRetry("/x", {}, deps({ fetchImpl })).catch((e) => e);

    expect(calls).toHaveLength(2);
    expect(errorStatus(err)).toBe(401);
  });

  it("gives up when the refresh itself stalls", async () => {
    // An expired session is exactly when this call is least likely to answer.
    const { calls, fetchImpl } = recorder([jsonResponse(401, {})]);

    const err = await requestWithAuthRetry(
      "/x",
      {},
      deps({
        fetchImpl,
        refreshTimeoutMs: 20,
        refreshSession: () => new Promise(() => {}),
      })
    ).catch((e) => e);

    expect(calls).toHaveLength(1);
    expect(errorStatus(err)).toBe(401);
  });

  it("gives up when the refresh answers without a session", async () => {
    const { calls, fetchImpl } = recorder([jsonResponse(401, {})]);

    const err = await requestWithAuthRetry(
      "/x",
      {},
      deps({
        fetchImpl,
        refreshSession: async () => ({ data: { session: null }, error: { message: "nope" } }),
      })
    ).catch((e) => e);

    expect(calls).toHaveLength(1);
    expect(errorStatus(err)).toBe(401);
  });
});

describe("error bodies", () => {
  it("raises the backend's code, not its English sentence", async () => {
    const { fetchImpl } = recorder([
      jsonResponse(402, {
        detail: { code: "CHECKOUT_REQUIRED", message: "Finish setting up your subscription." },
      }),
    ]);

    const err = await requestWithAuthRetry("/x", {}, deps({ fetchImpl })).catch((e) => e);

    expect(errorCode(err)).toBe("CHECKOUT_REQUIRED");
    expect(errorStatus(err)).toBe(402);
  });

  it("survives an error body that is not JSON at all", async () => {
    const notJson = {
      status: 502,
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    } as unknown as Response;
    const { fetchImpl } = recorder([notJson]);

    const err = await requestWithAuthRetry("/x", {}, deps({ fetchImpl })).catch((e) => e);

    expect(errorStatus(err)).toBe(502);
  });

  it("raises the 409 client-key conflict as its own code", async () => {
    // Our own bug if it ever fires: a key replayed against another enrollment
    // or another operation. It must never be swept in with the retryables.
    const { fetchImpl } = recorder([
      jsonResponse(409, { detail: { code: "CLIENT_KEY_CONFLICT", message: "..." } }),
    ]);

    const err = await requestWithAuthRetry("/x", {}, deps({ fetchImpl })).catch((e) => e);

    expect(errorCode(err)).toBe("CLIENT_KEY_CONFLICT");
  });
});
