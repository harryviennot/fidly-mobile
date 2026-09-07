import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  QrCodeIcon,
  CameraIcon,
  StampIcon,
  CoinsIcon,
  MapPinIcon,
} from "phosphor-react-native";
import { useBusiness } from "@/contexts/business-context";
import { useTheme } from "@/contexts/theme-context";
import { useLocation } from "@/contexts/location-context";
import {
  buildOnboardingSlides,
  type OnboardingSlide,
  type ProgramType,
} from "@/lib/scanner-onboarding";
import { markOnboardingSeen } from "@/lib/onboarding-store";

const ICONS: Record<OnboardingSlide, typeof QrCodeIcon> = {
  counterQr: QrCodeIcon,
  scanning: CameraIcon,
  stamp: StampIcon,
  points: CoinsIcon,
  locations: MapPinIcon,
};

/**
 * The short tour a new employee gets after joining, and on their first lobby
 * visit for a shop they haven't seen yet.
 *
 * Program-aware: the stamp and points engines are different jobs at the
 * counter, so exactly one of those slides ever appears.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation("onboarding");
  const { width } = useWindowDimensions();
  const { currentBusiness } = useBusiness();
  const { theme, design } = useTheme();
  const { requiresLocation, scannableLocations } = useLocation();

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const programType = (design?.card_type as ProgramType | undefined) ?? null;
  const slides = useMemo(
    () =>
      buildOnboardingSlides({
        programType,
        showLocations: requiresLocation && scannableLocations.length > 1,
      }),
    [programType, requiresLocation, scannableLocations.length]
  );

  const finish = useCallback(async () => {
    if (currentBusiness?.id) {
      await markOnboardingSeen(currentBusiness.id, programType);
    }
    router.replace("/lobby");
  }, [currentBusiness?.id, programType, router]);

  const handleNext = useCallback(() => {
    if (index >= slides.length - 1) {
      void finish();
      return;
    }
    const next = index + 1;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  }, [index, slides.length, width, finish]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      if (page !== index) setIndex(page);
    },
    [index, width]
  );

  const isLast = index >= slides.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={finish} hitSlop={12}>
          <Text style={styles.skip}>{t("skip")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.pager}
      >
        {slides.map((slide) => {
          const Icon = ICONS[slide];
          return (
            <View key={slide} style={[styles.slide, { width }]}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Icon size={40} color={theme.primaryText} weight="fill" />
              </View>
              <Text style={styles.title}>{t(`${slide}.title` as "scanning.title")}</Text>
              <Text style={styles.body}>{t(`${slide}.body` as "scanning.body")}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View
              key={slide}
              style={[
                styles.dot,
                i === index && { backgroundColor: theme.primary, width: 20 },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleNext}
        >
          <Text style={[styles.buttonText, { color: theme.primaryText }]}>
            {isLast ? t("done") : t("next")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0efe9" },
  topBar: { alignItems: "flex-end", paddingHorizontal: 20, paddingVertical: 12 },
  skip: { fontSize: 15, color: "#6b7280", fontWeight: "500" },
  pager: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 20,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2d3436",
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 420,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 20 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d1cdc4",
  },
  button: {
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
