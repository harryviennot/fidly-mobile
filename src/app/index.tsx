import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? "/lobby" : "/login"} />;
}
