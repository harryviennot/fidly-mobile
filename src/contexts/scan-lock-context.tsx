import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Whether a counter mutation is in flight on the confirmation screen.
 *
 * The flows own the request; the ROUTE owns the ways out of it that are not
 * buttons. Backing out mid-request destroys the screen's key ledger, so
 * rescanning the same customer mints a fresh `client_key` and a first request
 * that lands late credits a second time. Dimming the X was never enough: iOS
 * has an interactive swipe from the left edge and Android has a hardware back
 * button, and both leave without touching any control this screen renders.
 *
 * So the flows publish the in-flight signal here, and the route reads it to
 * turn off its own gestures. Provider lives in the confirmation route, which is
 * the only place this exists.
 */
interface ScanLock {
  locked: boolean;
  setLocked: (locked: boolean) => void;
}

const ScanLockContext = createContext<ScanLock>({
  locked: false,
  // A flow rendered outside the provider (a test harness, a future screen)
  // still works; it simply has no navigation to lock.
  setLocked: () => {},
});

export function ScanLockProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const value = useMemo(() => ({ locked, setLocked }), [locked]);
  return <ScanLockContext.Provider value={value}>{children}</ScanLockContext.Provider>;
}

export function useScanLock(): ScanLock {
  return useContext(ScanLockContext);
}
