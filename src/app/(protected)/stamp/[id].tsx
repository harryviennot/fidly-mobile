import { useState, useEffect, useCallback } from "react";
import { BackHandler } from "react-native";
import { loadErrorKey } from "@/utils/apiErrors";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { WarningCircle } from "phosphor-react-native";
import { getCustomer } from "@/api/customers";
import { useBusiness } from "@/contexts/business-context";
import { useTheme } from "@/contexts/theme-context";
import { CustomerCardSkeleton } from "@/components/skeleton";
import { ConfirmationScaffold } from "@/components/confirmation/ConfirmationScaffold";
import { StatusScreen } from "@/components/confirmation/StatusScreen";
import { StampFlow } from "@/components/confirmation/StampFlow";
import { PointsFlow } from "@/components/confirmation/PointsFlow";
import { ScanLockProvider, useScanLock } from "@/contexts/scan-lock-context";
import type { Customer } from "@/types/api";

/**
 * Confirmation screen dispatcher. Resolves the scanned QR to a customer, then
 * routes to the stamp or points flow. While the customer is loading, the
 * cached active design's `card_type` drives optimistic routing (the points
 * keypad opens instantly); once the customer snapshot arrives, ITS program
 * type is authoritative — the design cache lives 24h and goes stale when a
 * business converts its program type, and trusting it would silently run the
 * wrong flow (a ticket price becoming +1 stamp). A detected mismatch also
 * force-refreshes the cached design so the very next scan is clean.
 *
 * Owns the single customer fetch + the shared loading skeleton and load-error
 * screen, so each flow receives a loaded customer (points renders its keypad
 * immediately while the header populates).
 */
export default function StampScreen() {
  // The provider wraps the screen so the flows below can publish "a request is
  // in flight" and this route can act on it.
  return (
    <ScanLockProvider>
      <ConfirmationRoute />
    </ScanLockProvider>
  );
}

function ConfirmationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation("stamp");
  const { t: tCommon } = useTranslation("common");
  const { currentBusiness } = useBusiness();
  const { theme, design, refreshTheme } = useTheme();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomer = useCallback(async () => {
    if (!currentBusiness?.id) {
      setError(t("errors.noBusinessSelected"));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomer(currentBusiness.id, id);
      setCustomer(data);
    } catch (err) {
      // The backend's 404 detail is the English "Customer not found"; rendering
      // it put an English banner on a French screen. Map the code instead.
      setError(t(loadErrorKey(err) as never));
    } finally {
      setLoading(false);
    }
  }, [id, currentBusiness?.id, t]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  // Every way off this screen has to be shut while a scan is in flight, not
  // just the buttons. Leaving unmounts the flow and with it the key ledger, so
  // the rescan that follows mints a NEW client_key: a first request that lands
  // late then credits a second time, which is the exact double stamp the key
  // exists to prevent. The X and Cancel are dimmed by the flows; these two are
  // the ways out that touch no control at all.
  const { locked } = useScanLock();
  useEffect(() => {
    if (!locked) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [locked]);

  function handleGoHome() {
    // Unwinds the scanner too: the lobby is below both of these.
    router.dismissTo("/lobby");
  }

  // Program type: the fresh per-customer snapshot is authoritative; the
  // cached design only covers the gap while the customer loads (keypad-first).
  const programType = customer?.program?.type ?? design?.card_type;

  // Stale-cache self-heal: the business converted its program type since the
  // design was cached — force-refetch the active design (new card_type, new
  // theme, new points rate) so subsequent scans route correctly on open.
  const freshType = customer?.program?.type;
  const cachedType = design?.card_type;
  useEffect(() => {
    if (freshType && cachedType && freshType !== cachedType) {
      refreshTheme(true);
    }
  }, [freshType, cachedType, refreshTheme]);

  // `gestureEnabled` covers the iOS interactive swipe from the left edge; the
  // BackHandler above covers Android. Both are screen-level, so they are set
  // here rather than in the layout that has no idea a request is running.
  const lockNavigation = <Stack.Screen options={{ gestureEnabled: !locked }} />;

  // Fatal load error (no customer to show).
  if (error && !customer) {
    return (
      <StatusScreen
        icon={<WarningCircle size={48} color="#fff" weight="bold" />}
        iconColor="#dc2626"
        title={tCommon("error")}
        message={error}
        primary={{ label: tCommon("goHome"), onPress: handleGoHome }}
        // Retry, not Go back. A failed load is usually a dropped request, and
        // the fix for that is the same request again, not walking back to the
        // camera to rescan the card that is already in our hand.
        secondary={{ label: tCommon("retry"), onPress: loadCustomer }}
      />
    );
  }

  // Points: render the keypad immediately (customer/balance fill in from the
  // in-flight fetch — no waiting on the skeleton).
  if (programType === "points" && currentBusiness) {
    return (
      <>
        {lockNavigation}
        <PointsFlow
          customer={customer}
          loading={loading}
          setCustomer={setCustomer}
          businessId={currentBusiness.id}
          enrollmentId={id}
          fallbackRate={design?.points_per_currency_unit ?? null}
        />
      </>
    );
  }

  // Stamp / unknown: wait for the customer before rendering the flow.
  if (loading || !customer || !currentBusiness) {
    return (
      <ConfirmationScaffold>
        <CustomerCardSkeleton
          totalStamps={design?.total_stamps ?? 10}
          theme={{ surface: theme.surface, text: theme.text }}
        />
      </ConfirmationScaffold>
    );
  }

  return (
    <>
      {lockNavigation}
      <StampFlow
        customer={customer}
        setCustomer={setCustomer}
        businessId={currentBusiness.id}
        enrollmentId={id}
      />
    </>
  );
}
