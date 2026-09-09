import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,

} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useBusiness } from "@/contexts/business-context";
import { useSignOut } from "@/hooks/use-sign-out";
import { useAlert } from "@/contexts/alert-context";
import { CaretRight, PlusIcon } from "phosphor-react-native";
import { BusinessCardSkeleton } from "@/components/skeleton";
import { JoinBusinessSheet } from "@/components/join/JoinBusinessSheet";
import { selectPluralForm } from "@/utils/plural";
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
  const { t, i18n } = useTranslation("businesses");
  const { t: tCommon } = useTranslation("common");
  const { t: tJoin } = useTranslation("join");
  const { memberships, loading, error, selectBusiness, refreshMemberships } =
    useBusiness();
  const signOutToWelcome = useSignOut();
  const { alert } = useAlert();
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);

  const handleSignOut = () => {
    alert(
      tCommon("signOutConfirmTitle"),
      tCommon("signOutConfirmMessage"),
      [
        { text: tCommon("signOutConfirmNo"), style: "cancel" },
        { text: tCommon("signOutConfirmYes"), style: "destructive", onPress: signOutToWelcome },
      ]
    );
  };

  // Auto-select and redirect if only one business
  useEffect(() => {
    if (!loading && memberships.length === 1 && memberships[0].business_id) {
      selectBusiness(memberships[0].business_id);
      router.dismissTo("/lobby");
    }
  }, [loading, memberships, selectBusiness, router]);

  const handleSelectBusiness = (businessId: string) => {
    selectBusiness(businessId);
    // The lobby sent us here with `dismissTo`, so it is still underneath:
    // pushing a second one is how "switch shop" grew the stack every time.
    router.dismissTo("/lobby");
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

  // Nobody with an empty list stays here: the protected layout sends them to
  // the code screen, which is the same place they get sent from anywhere else
  // in the app. This screen used to answer that case itself, with its own
  // wording and its own buttons, so which screen a memberless employee saw
  // depended on whether they had just signed in or just reopened the app.
  // Blank for the one frame before the redirect lands.
  if (memberships.length === 0 || memberships.length === 1) {
    return (
      <View style={styles.container} />
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Title and actions stack rather than sharing a row. Crammed onto one
          line the join button sat flush against the heading at 402pt, and a
          longer translation ("Vos établissements") pushed sign out off the
          edge entirely — a documented exit, gone. */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>{t("header")}</Text>
          <Text style={styles.headerSubtitle}>
            {t(`subtitle_${selectPluralForm(i18n.language, memberships.length)}`, {
              count: memberships.length,
            })}
          </Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        {/* Adding a shop belongs at the top, next to the list it changes. As a
            footer link under the last card it was below the fold for anyone
            with more than a couple of shops. */}
        <TouchableOpacity
          style={styles.addBusinessButton}
          hitSlop={8}
          onPress={() => setJoinSheetOpen(true)}
        >
          <PlusIcon size={16} color="#2d3436" weight="bold" />
          <Text style={styles.addBusinessButtonText} numberOfLines={1}>
            {tJoin("addBusiness")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signOutTextButton} hitSlop={8} onPress={handleSignOut}>
          <Text style={styles.signOutTextButtonText}>{tCommon("signOut")}</Text>
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

      <JoinBusinessSheet
        visible={joinSheetOpen}
        onClose={() => setJoinSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0efe9",
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  addBusinessButton: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2d3436",
    backgroundColor: "#faf9f6",
  },
  signOutTextButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  signOutTextButtonText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "600",
  },
  addBusinessButtonText: {
    color: "#2d3436",
    fontSize: 14,
    fontWeight: "600",
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
});
