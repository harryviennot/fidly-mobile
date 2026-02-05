import {
  createContext,
  useContext,
  useEffect,
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
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [currentMembership, setCurrentMembership] =
    useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectBusiness = useCallback(
    (businessId: string) => {
      const membership = memberships.find((m) => m.business_id === businessId);
      if (membership) {
        setCurrentMembership(membership);
        setCurrentBusiness(membership.business ?? null);
        setStoredBusinessId(businessId);
      }
    },
    [memberships]
  );

  const refreshMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setCurrentBusiness(null);
      setCurrentMembership(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getUserMemberships(user.id);
      setMemberships(data);

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
      setLoading(false);
    }
  }, [user]);

  // Fetch memberships when user changes
  useEffect(() => {
    refreshMemberships();
  }, [refreshMemberships]);

  // Clear business when user logs out
  useEffect(() => {
    if (!user) {
      setMemberships([]);
      setCurrentBusiness(null);
      setCurrentMembership(null);
      removeStoredBusinessId();
    }
  }, [user]);

  return (
    <BusinessContext.Provider
      value={{
        memberships,
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
