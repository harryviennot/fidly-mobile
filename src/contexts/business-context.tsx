import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { useAuth } from "./auth-context";
import { getUserMemberships } from "../api/memberships";
import type { Business, Membership } from "../types/api";

const SELECTED_BUSINESS_KEY = "selected_business_id";

interface BusinessContextType {
  memberships: Membership[];
  currentBusiness: Business | null;
  currentMembership: Membership | null;
  loading: boolean;
  /**
   * True once the membership list has actually been fetched for the current
   * user. An empty `memberships` only means "on no team" when this is true:
   * before the first fetch it means "not asked yet", and routing on the
   * difference is what stranded scanners on the join screen.
   */
  membershipsResolved: boolean;
  error: string | null;
  selectBusiness: (businessId: string) => void;
  refreshMemberships: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(
  undefined
);

// Storage helpers for cross-platform support (non-sensitive data uses AsyncStorage)
async function getStoredBusinessId(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(SELECTED_BUSINESS_KEY);
  }
  return AsyncStorage.getItem(SELECTED_BUSINESS_KEY);
}

async function setStoredBusinessId(businessId: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(SELECTED_BUSINESS_KEY, businessId);
    return;
  }
  await AsyncStorage.setItem(SELECTED_BUSINESS_KEY, businessId);
}

async function removeStoredBusinessId(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(SELECTED_BUSINESS_KEY);
    return;
  }
  await AsyncStorage.removeItem(SELECTED_BUSINESS_KEY);
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [currentMembership, setCurrentMembership] =
    useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  // The user whose memberships the state currently reflects.
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The list `selectBusiness` looks in, kept in a ref rather than read out of
  // state. Joining a shop refreshes the memberships and then selects the new
  // one in the same tick, and state does not exist yet at that point: the
  // callback still closed over the list from before the fetch, found no
  // membership for the shop just joined, and silently did nothing. An employee
  // adding a second shop stayed on the first one's lobby.
  const membershipsRef = useRef<Membership[]>([]);

  const applyMemberships = useCallback((data: Membership[]) => {
    membershipsRef.current = data;
    setMemberships(data);
  }, []);

  const selectBusiness = useCallback((businessId: string) => {
    const membership = membershipsRef.current.find(
      (m) => m.business_id === businessId
    );
    if (membership) {
      setCurrentMembership(membership);
      setCurrentBusiness(membership.business ?? null);
      setStoredBusinessId(businessId);
    }
  }, []);

  const refreshMemberships = useCallback(async () => {
    if (!userId) {
      applyMemberships([]);
      setCurrentBusiness(null);
      setCurrentMembership(null);
      setResolvedFor(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getUserMemberships(userId);
      applyMemberships(data);

      // Try to restore previously selected business
      const storedBusinessId = await getStoredBusinessId();
      const storedMembership = storedBusinessId
        ? data.find((m) => m.business_id === storedBusinessId)
        : null;

      if (storedMembership) {
        setCurrentMembership(storedMembership);
        setCurrentBusiness(storedMembership.business ?? null);
      } else if (data.length === 1) {
        // Auto-select if only one business
        setCurrentMembership(data[0]);
        setCurrentBusiness(data[0].business ?? null);
        if (data[0].business_id) {
          setStoredBusinessId(data[0].business_id);
        }
      } else {
        // Clear selection if no valid stored business
        setCurrentBusiness(null);
        setCurrentMembership(null);
        await removeStoredBusinessId();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load businesses");
    } finally {
      // Resolved either way: a failed fetch is still an answer, and leaving it
      // unresolved would freeze routing behind a transient network error.
      setResolvedFor(userId);
      setLoading(false);
    }
  }, [userId, applyMemberships]);

  // Fetch memberships when user changes
  useEffect(() => {
    refreshMemberships();
  }, [refreshMemberships]);

  // Clear business when user logs out
  useEffect(() => {
    if (!userId) {
      applyMemberships([]);
      setCurrentBusiness(null);
      setCurrentMembership(null);
      setResolvedFor(null);
      removeStoredBusinessId();
    }
  }, [userId, applyMemberships]);

  return (
    <BusinessContext.Provider
      value={{
        memberships,
        membershipsResolved: !!userId && resolvedFor === userId,
        currentBusiness,
        currentMembership,
        loading,
        error,
        selectBusiness,
        refreshMemberships,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
}
