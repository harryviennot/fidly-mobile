import { useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SignInIcon, TicketIcon } from "phosphor-react-native";
import { AuthScreen, BlockButton, colors } from "@/components/auth-ui";
import { CreateBusinessSheet } from "@/components/auth/CreateBusinessSheet";

/**
 * The first screen of the app, and the only place the two audiences split.
 *
 * Employees vastly outnumber owners here (an owner signs up once, on a laptop,
 * and every member of their staff arrives through this screen), so joining a
 * team is the primary action and creating a business is a text link that opens
 * a sheet rather than the web. Signing in sits between them: it needs no
 * explanation to the person who wants it, and is noise to everyone else.
 */
export default function WelcomeScreen() {
  const { t } = useTranslation("welcome");
  const router = useRouter();
  const [businessSheetOpen, setBusinessSheetOpen] = useState(false);

  const goToJoin = () => router.push("/join");

  return (
    <>
      <AuthScreen
        title={t("title")}
        subtitle={t("subtitle")}
        footer={
          <BlockButton
            variant="quiet"
            title={t("businessLink")}
            onPress={() => setBusinessSheetOpen(true)}
          />
        }
      >
        <BlockButton
          variant="primary"
          title={t("joinTitle")}
          subtitle={t("joinSubtitle")}
          icon={<TicketIcon size={24} color={colors.onBrand} weight="fill" />}
          onPress={goToJoin}
          testID="welcome-join"
        />
        <BlockButton
          variant="outline"
          title={t("signInTitle")}
          subtitle={t("signInSubtitle")}
          icon={<SignInIcon size={24} color={colors.ink} weight="regular" />}
          onPress={() => router.push("/login")}
          testID="welcome-sign-in"
        />
      </AuthScreen>

      <CreateBusinessSheet
        visible={businessSheetOpen}
        onClose={() => setBusinessSheetOpen(false)}
        onUseCode={goToJoin}
      />
    </>
  );
}
