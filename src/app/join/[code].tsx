import { useLocalSearchParams } from "expo-router";
import { JoinScreen } from "@/components/join/JoinScreen";

/**
 * The emailed link, opened natively: https://stampeo.app/join/ABCD3F arrives
 * here as a Universal Link on iOS or an App Link on Android, with the code
 * already in the path. The same path is claimed in the AASA file served by the
 * showcase.
 */
export default function JoinCodeRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <JoinScreen initialCode={typeof code === "string" ? code : undefined} />;
}
