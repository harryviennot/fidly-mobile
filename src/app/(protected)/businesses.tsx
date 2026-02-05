import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBusiness } from "@/contexts/business-context";
import { useAuth } from "@/contexts/auth-context";
import { CaretRight, SignOutIcon } from "phosphor-react-native";
import { BusinessCardSkeleton } from "@/components/skeleton";
import type { Membership } from "@/types/api";

function getRoleBadgeStyles(role: string): { bg: string; text: string; accent: string } {
  switch (role) {
    case "owner":
      return { bg: "rgba(249, 115, 22, 0.12)", text: "#ea580c", accent: "#f97316" };
    case "admin":
      return { bg: "rgba(37, 99, 235, 0.10)", text: "#2563eb", accent: "#2563eb" };
    default:
      return { bg: "rgba(107, 114, 128, 0.10)", text: "#6b7280", accent: "#6b7280" };
  }
}

function BusinessCard({
  membership,
  onPress,
}: {
  membership: Membership;
  onPress: () => void;
}) {
  const { t } = useTranslation("common");
  const business = membership.business;
  const badgeStyles = getRoleBadgeStyles(membership.role);
  const accentColor = (business?.settings?.backgroundColor as string) || "#f97316";

  if (!business) return null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardContent}>
        {business.logo_url ? (
          <View style={[styles.logoContainer, { backgroundColor: accentColor }]}>
            <Image
              source={business.logo_url}
              style={styles.logo}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        ) : (
          <View style={[styles.logoPlaceholder, { backgroundColor: accentColor }]}>
            <Text style={styles.logoPlaceholderText}>
              {business.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.businessName} numberOfLines={1}>{business.name}</Text>
          <View style={styles.cardMeta}>
            <View style={[styles.roleBadge, { backgroundColor: badgeStyles.bg }]}>
              <Text style={[styles.roleText, { color: badgeStyles.text }]}>
                {t(`roles.${membership.role}` as "roles.owner" | "roles.admin" | "roles.scanner")}
              </Text>
            </View>
            {membership.scans_count !== undefined && membership.scans_count > 0 && (
              <Text style={styles.scanCount}>
                {membership.scans_count} {membership.scans_count === 1 ? "scan" : "scans"}
              </Text>
            )}
          </View>
        </View>

        <CaretRight size={20} color="#ddd9d0" weight="bold" />
      </View>
    </TouchableOpacity>
  );
}

export default function BusinessesScreen() {
  const router = useRouter();
  const { t } = useTranslation("businesses");
  const { t: tCommon } = useTranslation("common");
  const { memberships, loading, error, selectBusiness, refreshMemberships } =
    useBusiness();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      tCommon("signOutConfirmTitle"),
      tCommon("signOutConfirmMessage"),
      [
        { text: tCommon("signOutConfirmNo"), style: "cancel" },
        { text: tCommon("signOutConfirmYes"), style: "destructive", onPress: signOut },
      ]
    );
  };

  // Auto-select and redirect if only one business
  useEffect(() => {
    if (!loading && memberships.length === 1 && memberships[0].business_id) {
      selectBusiness(memberships[0].business_id);
      router.replace("/lobby");
    }
  }, [loading, memberships, selectBusiness, router]);

  const handleSelectBusiness = (businessId: string) => {
    selectBusiness(businessId);
    router.push("/lobby");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t("header")}</Text>
        </View>
        <View style={styles.list}>
          <BusinessCardSkeleton delay={0} />
          <View style={styles.separator} />
          <BusinessCardSkeleton delay={100} />
          <View style={styles.separator} />
          <BusinessCardSkeleton delay={200} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshMemberships}>
          <Text style={styles.retryButtonText}>{tCommon("retry")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (memberships.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <Text style={styles.emptyTitle}>{t("empty.title")}</Text>
        <Text style={styles.emptyText}>
          {t("empty.message")}
        </Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>{tCommon("signOut")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (memberships.length === 1) {
    return (
      <View style={styles.container} />
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>{t("header")}</Text>
          <Text style={styles.headerSubtitle}>
            {t("subtitle", { count: memberships.length })}
          </Text>
        </View>
        <TouchableOpacity style={styles.signOutIconButton} hitSlop={12} onPress={handleSignOut}>
          <SignOutIcon size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={memberships}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BusinessCard
            membership={item}
            onPress={() => handleSelectBusiness(item.business_id)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0efe9",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f0efe9",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2d3436",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#faf9f6",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#2d3436",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf9f6",
  },
  logo: {
    width: 48,
    height: 48,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#f97316",
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  cardInfo: {
    flex: 1,
    gap: 6,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  businessName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#2d3436",
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  scanCount: {
    fontSize: 12,
    color: "#6b7280",
  },
  separator: {
    height: 12,
  },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#f97316",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2d3436",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  signOutButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  signOutButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  signOutIconButton: {
    padding: 8,
  },
});
