import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import { fetchAppGate } from "../api/gate";

/**
 * Force-update gate. On launch (and when the app returns to the foreground) it
 * asks the backend whether this build is below the per-platform minimum. If so,
 * RootNavigator renders a blocking ForceUpdateScreen instead of the app.
 *
 * FAIL-OPEN: any error/timeout resolves to "ok". "unknown" is only the initial
 * pre-first-response value; both it and "ok" are non-blocking. A user is blocked
 * only on an explicit update_required=true.
 */
export type GateStatus = "unknown" | "ok" | "update_required";

interface UpdateGateContextType {
  status: GateStatus;
  storeUrl: string | null;
}

const UpdateGateContext = createContext<UpdateGateContextType | undefined>(undefined);

// Don't re-hit the endpoint on every quick background/foreground bounce.
const MIN_REFETCH_INTERVAL_MS = 30_000;

export function UpdateGateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("unknown");
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const lastCheckRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      lastCheckRef.current = Date.now();
      try {
        const gate = await fetchAppGate();
        if (cancelled) return;
        setStoreUrl(gate.store_url);
        setStatus(gate.update_required ? "update_required" : "ok");
      } catch {
        // Network error / timeout / bad response — never block the user.
        if (!cancelled) setStatus("ok");
      }
    }

    check();

    // Re-check on foreground (native only — the web build is never gated and
    // reloads fresh on its own).
    let subscription: { remove: () => void } | undefined;
    if (Platform.OS !== "web") {
      subscription = AppState.addEventListener("change", (state) => {
        if (
          state === "active" &&
          Date.now() - lastCheckRef.current > MIN_REFETCH_INTERVAL_MS
        ) {
          check();
        }
      });
    }

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return (
    <UpdateGateContext.Provider value={{ status, storeUrl }}>
      {children}
    </UpdateGateContext.Provider>
  );
}

export function useUpdateGate() {
  const context = useContext(UpdateGateContext);
  if (context === undefined) {
    throw new Error("useUpdateGate must be used within an UpdateGateProvider");
  }
  return context;
}
