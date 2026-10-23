import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { resolveBusinessChip, type BusinessChipInput } from "@/utils/businessChip";

// Fallback chip colours (logo on paper, initials on muted). They are the
// chip contract shared with the dashboard, not this app's theme tokens, so a
// business reads the same on every surface.
const CHIP_PAPER = "#FAFAF8";
const CHIP_MUTED = "#F0EDE7";
const CHIP_MUTED_INK = "#5A5A5A";

interface BusinessChipProps {
  business: BusinessChipInput;
  // Chip height in points; the width is always 1.5x so every chip is 3:2.
  height: number;
}

// A business drawn as a small card: the server-built chip, else its logo
// contained on paper, else its initials. Decorative: the name is always
// written next to it.
export function BusinessChip({ business, height }: BusinessChipProps) {
  const chip = resolveBusinessChip(business);
  const radius = height * 0.17;

  const frameStyle = {
    width: height * 1.5,
    height,
    borderRadius: radius,
    backgroundColor:
      chip.kind === "chip" ? chip.background : chip.kind === "logo" ? CHIP_PAPER : CHIP_MUTED,
  };

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, frameStyle]}
    >
      {chip.kind === "chip" && (
        <Image
          source={chip.src}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      )}
      {chip.kind === "logo" && (
        <Image
          source={chip.src}
          style={[StyleSheet.absoluteFill, { margin: height * 0.16 }]}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      )}
      {chip.kind === "initials" && (
        <Text allowFontScaling={false} style={[styles.initials, { fontSize: height * 0.4 }]}>
          {chip.text}
        </Text>
      )}
      <View pointerEvents="none" style={[styles.hairline, { borderRadius: radius }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "700",
    color: CHIP_MUTED_INK,
  },
  hairline: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
});
