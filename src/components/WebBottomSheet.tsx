import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

interface WebBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Style for the sheet surface (background, radius, height/maxHeight, padding). */
  sheetStyle?: ViewStyle | ViewStyle[];
  /** Handle indicator color (drawn at the top of the sheet). */
  handleColor?: string;
}

const OPEN_DURATION = 240;
const CLOSE_DURATION = 180;

/**
 * Web-only bottom sheet: RN Modal + Animated. We use this instead of
 * @gorhom/bottom-sheet on web, where gorhom's reanimated/gesture-handler-based
 * gestures and dynamic sizing are unreliable. The backdrop opacity fades while
 * the sheet slides up (driven by one shared progress value), so the dim doesn't
 * visibly slide in. Native uses gorhom directly.
 */
export function WebBottomSheet({
  visible,
  onClose,
  children,
  sheetStyle,
  handleColor = "rgba(0,0,0,0.2)",
}: WebBottomSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const screenHeight = Dimensions.get("window").height;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[styles.wrap, { transform: [{ translateY }] }]}
        pointerEvents="box-none"
      >
        <View style={sheetStyle}>
          <View style={[styles.grabber, { backgroundColor: handleColor }]} />
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 12,
  },
});
