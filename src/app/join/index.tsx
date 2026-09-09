import { useLocalSearchParams } from "expo-router";
import { JoinScreen } from "@/components/join/JoinScreen";

/**
 * Joining a shop with a code, with none supplied. Reached from the login
 * screen, the no-account screen, and the business picker.
 *
 * `?code=` is still read here for the web build, where the emailed link lands
 * as a query string rather than as a native path match.
 */
export default function JoinIndexRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <JoinScreen initialCode={typeof code === "string" ? code : undefined} />;
}
