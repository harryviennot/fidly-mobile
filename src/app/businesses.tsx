import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useBusiness } from "@/contexts/business-context";
import { useAuth } from "@/contexts/auth-context";
import { CaretRight } from "phosphor-react-native";
import type { Membership } from "@/types/api";

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case "owner":
      return "#f97316";
    case "admin":
      return "#2563eb";
    default:
      return "#6b7280";
  }
}

function BusinessCard({
  membership,
  onPress,
}: {
  membership: Membership;
  onPress: () => void;
}) {
  const business = membership.business;
  if (!business) return null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardContent}>
        {business.logo_url ? (
          <Image source={{ uri: business.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>
              {business.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.businessName}>{business.name}</Text>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: getRoleBadgeColor(membership.role) },
            ]}
          >
            <Text style={styles.roleText}>
              {membership.role.charAt(0).toUpperCase() +
                membership.role.slice(1)}
            </Text>
          </View>
        </View>

        <CaretRight size={24} color="#ddd9d0" weight="bold" />
      </View>
    </TouchableOpacity>
  );
}

export default function BusinessesScreen() {
  const router = useRouter();
  const { memberships, loading, error, selectBusiness, refreshMemberships } =
    useBusiness();
  const { signOut } = useAuth();

  const handleSelectBusiness = (businessId: string) => {
    selectBusiness(businessId);
    router.replace("/lobby");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading businesses...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshMemberships}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (memberships.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>No Businesses</Text>
        <Text style={styles.emptyText}>
          You have not been added to any businesses yet.{"\n"}
          Contact your manager to get an invitation.
        </Text>
        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Choose a business to scan for</Text>

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

      <TouchableOpacity style={styles.signOutLink} onPress={signOut}>
        <Text style={styles.signOutLinkText}>Sign out</Text>
      </TouchableOpacity>
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
  header: {
    fontSize: 16,
    color: "#6b7280",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#faf9f6",
    borderRadius: 10,
    overflow: "hidden",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
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
    gap: 4,
  },
  businessName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#2d3436",
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
  },
  separator: {
    height: 12,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
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
  signOutLink: {
    padding: 16,
    alignItems: "center",
  },
  signOutLinkText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
