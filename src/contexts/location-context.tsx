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
import * as Location from "expo-location";
import { useBusiness } from "./business-context";
import { getScannableLocations, matchLocation } from "../api/locations";
import type { ScannerLocation } from "../types/api";

const SELECTED_LOCATION_KEY_PREFIX = "selected_location_id:";

export type PermissionStatus = "granted" | "denied" | "undetermined";

export interface ProximitySuggestion {
  location: ScannerLocation;
  distanceMeters: number;
}

interface LocationContextType {
  scannableLocations: ScannerLocation[];
  requiresLocation: boolean;
  scope: "all" | "assigned" | null;
  selectedLocation: ScannerLocation | null;
  loading: boolean;
  error: string | null;
  /** Pro multi-location business where this user has zero accessible locations. */
  isStranded: boolean;
  selectLocation: (locationId: string) => void;
  // ── GPS (assistive, never blocks scanning) ──
  proximitySuggestion: ProximitySuggestion | null;
  dismissSuggestion: () => void;
  /** Read the current OS permission state WITHOUT prompting. */
  getPermissionStatus: () => Promise<PermissionStatus>;
  /** Request permission (may show the OS prompt) then run a proximity check. */
  requestLocationAndCheck: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Per-business storage so each business remembers its own last-used location.
async function getStoredLocationId(businessId: string): Promise<string | null> {
  const key = `${SELECTED_LOCATION_KEY_PREFIX}${businessId}`;
  if (Platform.OS === "web") return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}

async function setStoredLocationId(businessId: string, locationId: string): Promise<void> {
  const key = `${SELECTED_LOCATION_KEY_PREFIX}${businessId}`;
  if (Platform.OS === "web") {
    localStorage.setItem(key, locationId);
    return;
  }
  await AsyncStorage.setItem(key, locationId);
}

// GPS over the web requires a secure context (HTTPS). When the hosted app is
// served over plain HTTP, skip location entirely — scanning + the manual picker
// still work fully.
function gpsUnavailableOnWeb(): boolean {
  return (
    Platform.OS === "web" &&
    typeof globalThis !== "undefined" &&
    globalThis.isSecureContext === false
  );
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id ?? null;

  const [scannableLocations, setScannableLocations] = useState<ScannerLocation[]>([]);
  const [requiresLocation, setRequiresLocation] = useState(false);
  const [scope, setScope] = useState<"all" | "assigned" | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<ScannerLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proximitySuggestion, setProximitySuggestion] =
    useState<ProximitySuggestion | null>(null);

  const isStranded = requiresLocation && scannableLocations.length === 0;

  const selectLocation = useCallback(
    (locationId: string) => {
      const loc = scannableLocations.find((l) => l.id === locationId);
      if (!loc || !businessId) return;
      setSelectedLocation(loc);
      setStoredLocationId(businessId, loc.id);
      // Clear any stale suggestion once the user has a deliberate choice.
      setProximitySuggestion(null);
    },
    [scannableLocations, businessId]
  );

  const dismissSuggestion = useCallback(() => setProximitySuggestion(null), []);

  // Fetch the scannable set whenever the active business changes.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!businessId) {
        setScannableLocations([]);
        setRequiresLocation(false);
        setScope(null);
        setSelectedLocation(null);
        setProximitySuggestion(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getScannableLocations(businessId);
        if (cancelled) return;

        setScannableLocations(data.locations);
        setRequiresLocation(data.requires_location);
        setScope(data.scope);

        // Auto-select: previously-stored → primary → first. Never blocks.
        const stored = await getStoredLocationId(businessId);
        if (cancelled) return;
        const chosen =
          data.locations.find((l) => l.id === stored) ??
          data.locations.find((l) => l.is_primary) ??
          data.locations[0] ??
          null;
        setSelectedLocation(chosen);
        if (chosen) setStoredLocationId(businessId, chosen.id);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load locations");
        setScannableLocations([]);
        setRequiresLocation(false);
        setScope(null);
        setSelectedLocation(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const getPermissionStatus = useCallback(async (): Promise<PermissionStatus> => {
    if (gpsUnavailableOnWeb()) return "denied";
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status as PermissionStatus;
    } catch {
      return "denied";
    }
  }, []);

  const requestLocationAndCheck = useCallback(async () => {
    // Everything here is best-effort: any failure leaves scanning untouched.
    if (!businessId || gpsUnavailableOnWeb()) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const match = await matchLocation(
        businessId,
        pos.coords.latitude,
        pos.coords.longitude
      );
      if (!match) return;

      // Only suggest a switch to a location the user can actually access AND
      // that differs from the current selection.
      const target = scannableLocations.find((l) => l.id === match.location_id);
      if (target && target.id !== selectedLocation?.id) {
        setProximitySuggestion({ location: target, distanceMeters: match.distance_meters });
      }
    } catch {
      // GPS unavailable / timed out / denied mid-flow — silently ignore.
    }
  }, [businessId, scannableLocations, selectedLocation?.id]);

  return (
    <LocationContext.Provider
      value={{
        scannableLocations,
        requiresLocation,
        scope,
        selectedLocation,
        loading,
        error,
        isStranded,
        selectLocation,
        proximitySuggestion,
        dismissSuggestion,
        getPermissionStatus,
        requestLocationAndCheck,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}
