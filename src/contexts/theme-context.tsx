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
import { useBusiness } from "./business-context";
import { getActiveDesign } from "../api/designs";
import { getBusinessSignupQR, type SignupQRResponse } from "../api/businesses";
import {
  type ScannerTheme,
  DEFAULT_THEME,
  createThemeFromDesign,
} from "../types/theme";
import type { CardDesign } from "../types/api";

const THEME_CACHE_KEY = "theme_cache";
const QR_CACHE_KEY = "qr_cache";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData<T> {
  data: T;
  businessId: string;
  timestamp: number;
}

interface ThemeContextType {
  theme: ScannerTheme;
  design: CardDesign | null;
  loading: boolean;
  refreshTheme: () => Promise<void>;
  // QR code caching
  signupQR: SignupQRResponse | null;
  qrLoading: boolean;
  refreshQR: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Storage helpers
async function getCache<T>(key: string): Promise<CachedData<T> | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? localStorage.getItem(key)
        : await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedData<T>;
  } catch {
    return null;
  }
}

async function setCache<T>(
  key: string,
  data: T,
  businessId: string
): Promise<void> {
  const cached: CachedData<T> = {
    data,
    businessId,
    timestamp: Date.now(),
  };
  const raw = JSON.stringify(cached);
  if (Platform.OS === "web") {
    localStorage.setItem(key, raw);
  } else {
    await AsyncStorage.setItem(key, raw);
  }
}

function isCacheValid<T>(
  cache: CachedData<T> | null,
  businessId: string
): cache is CachedData<T> {
  if (!cache) return false;
  if (cache.businessId !== businessId) return false;
  return Date.now() - cache.timestamp < CACHE_DURATION_MS;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { currentBusiness } = useBusiness();
  const [theme, setTheme] = useState<ScannerTheme>(DEFAULT_THEME);
  const [design, setDesign] = useState<CardDesign | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupQR, setSignupQR] = useState<SignupQRResponse | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const refreshTheme = useCallback(async () => {
    if (!currentBusiness?.id) {
      setTheme(DEFAULT_THEME);
      setDesign(null);
      return;
    }

    setLoading(true);
    try {
      // Check cache first
      const cached = await getCache<CardDesign>(THEME_CACHE_KEY);
      if (isCacheValid(cached, currentBusiness.id)) {
        setDesign(cached.data);
        setTheme(createThemeFromDesign(cached.data));
        setLoading(false);
        return;
      }

      // Fetch fresh data
      const freshDesign = await getActiveDesign(currentBusiness.id);
      if (freshDesign) {
        setDesign(freshDesign);
        setTheme(createThemeFromDesign(freshDesign));
        await setCache(THEME_CACHE_KEY, freshDesign, currentBusiness.id);
      } else {
        setDesign(null);
        setTheme(DEFAULT_THEME);
      }
    } catch {
      // On error, try to use cached data even if stale
      const cached = await getCache<CardDesign>(THEME_CACHE_KEY);
      if (cached && cached.businessId === currentBusiness.id) {
        setDesign(cached.data);
        setTheme(createThemeFromDesign(cached.data));
      } else {
        setTheme(DEFAULT_THEME);
        setDesign(null);
      }
    } finally {
      setLoading(false);
    }
  }, [currentBusiness?.id]);

  const refreshQR = useCallback(async () => {
    if (!currentBusiness?.id) {
      setSignupQR(null);
      return;
    }

    setQrLoading(true);
    try {
      // Check cache first
      const cached = await getCache<SignupQRResponse>(QR_CACHE_KEY);
      if (isCacheValid(cached, currentBusiness.id)) {
        setSignupQR(cached.data);
        setQrLoading(false);
        return;
      }

      // Fetch fresh data
      const freshQR = await getBusinessSignupQR(currentBusiness.id);
      setSignupQR(freshQR);
      await setCache(QR_CACHE_KEY, freshQR, currentBusiness.id);
    } catch {
      // On error, try to use cached data even if stale
      const cached = await getCache<SignupQRResponse>(QR_CACHE_KEY);
      if (cached && cached.businessId === currentBusiness.id) {
        setSignupQR(cached.data);
      } else {
        setSignupQR(null);
      }
    } finally {
      setQrLoading(false);
    }
  }, [currentBusiness?.id]);

  // Fetch theme and QR when business changes
  useEffect(() => {
    refreshTheme();
    refreshQR();
  }, [refreshTheme, refreshQR]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        design,
        loading,
        refreshTheme,
        signupQR,
        qrLoading,
        refreshQR,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
