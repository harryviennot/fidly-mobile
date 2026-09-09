import { Stack } from "expo-router";
import { AUTH_TRANSITION } from "@/lib/transitions";

/**
 * `welcome` is the anchor, not `login`. When `Stack.Protected` flips this group
 * back on (a sign-out, or a session that failed to restore), expo-router mounts
 * the group at its initial route: that must be the screen offering both doors,
 * not the sign-in form, or signing out would strand a new employee on a
 * password field for an account they do not have.
 */
export const unstable_settings = {
  initialRouteName: "welcome",
};

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...AUTH_TRANSITION }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
