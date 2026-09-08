import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "@/components/BottomSheet";
import { BlockButton, colors, radius, spacing, type } from "@/components/auth-ui";
import { JoinCodeInput } from "./JoinCodeInput";
import { JOIN_CODE_LENGTH, isValidJoinCode, sanitizeJoinCodeInput } from "@/lib/join-code";

interface JoinBusinessSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Add another shop from inside the app.
 *
 * People work in more than one place, and until now the only code field lived
 * behind a redirect that fires when you belong to nothing: someone already on a
 * team who was invited elsewhere four months later had nowhere to type their
 * code.
 *
 * The sheet is an entry point, not a second copy of the flow. A complete code
 * hands off to /join/[code] — the same route the emailed link opens — which
 * looks it up and shows the existing "Join Lustre?" confirmation full screen,
 * logo and all. Two code screens for one code would be worse than none.
 */
export function JoinBusinessSheet({ visible, onClose }: JoinBusinessSheetProps) {
  const router = useRouter();
  const { t } = useTranslation("join");
  const [code, setCode] = useState("");

  const submit = (candidate: string) => {
    const normalized = sanitizeJoinCodeInput(candidate);
    if (!isValidJoinCode(normalized)) return;
    setCode("");
    onClose();
    router.push(`/join/${normalized}`);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet} fullSheetDrag>
      <View style={styles.body}>
        <Text style={styles.title}>{t("addTitle")}</Text>
        <Text style={styles.text}>{t("addBody")}</Text>

        <View style={styles.field}>
          <JoinCodeInput value={code} onChange={setCode} onComplete={submit} />
        </View>

        <BlockButton
          variant="primary"
          title={t("codeSubmit")}
          onPress={() => submit(code)}
          disabled={code.length < JOIN_CODE_LENGTH}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  text: {
    ...type.body,
    color: colors.inkSoft,
  },
  field: {
    paddingVertical: spacing.md,
  },
});
