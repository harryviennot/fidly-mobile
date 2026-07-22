import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams, router } from "expo-router";
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
      setError(err instanceof Error ? err.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, currentBusiness?.id, t]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  function handleGoHome() {
    router.replace("/lobby");
  }

  function handleGoBack() {
    router.back();
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

  // Fatal load error (no customer to show).
  if (error && !customer) {
    return (
      <StatusScreen
        icon={<WarningCircle size={48} color="#fff" weight="bold" />}
        iconColor="#dc2626"
        title={tCommon("error")}
        message={error}
        primary={{ label: tCommon("goHome"), onPress: handleGoHome }}
        secondary={{ label: tCommon("goBack"), onPress: handleGoBack }}
      />
    );
  }

  // Points: render the keypad immediately (customer/balance fill in from the
  // in-flight fetch — no waiting on the skeleton).
  if (programType === "points" && currentBusiness) {
    return (
      <PointsFlow
        customer={customer}
        loading={loading}
        setCustomer={setCustomer}
        businessId={currentBusiness.id}
        enrollmentId={id}
        fallbackRate={design?.points_per_currency_unit ?? null}
      />
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
    <StampFlow
      customer={customer}
      setCustomer={setCustomer}
      businessId={currentBusiness.id}
      enrollmentId={id}
    />
  );
}
