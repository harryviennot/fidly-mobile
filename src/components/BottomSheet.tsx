import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Style for the sheet surface (background, radius, height/maxHeight, padding). */
  sheetStyle?: ViewStyle | ViewStyle[];
  /** Handle indicator color (drawn at the top of the sheet). */
  handleColor?: string;
}

const OPEN_DURATION = 240;
const CLOSE_DURATION = 200;
// Pan-to-close is mobile-only — PanResponder drags are unreliable on web.
const ENABLE_PAN = Platform.OS !== "web";
// Drag distance / velocity past which a downward swipe dismisses the sheet.
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6;

/**
 * Cross-platform bottom sheet: RN Modal + Animated. Used on every platform
 * instead of @gorhom/bottom-sheet (which would not reliably present on the
 * native New-Architecture build). The backdrop opacity fades as the sheet
 * slides, derived from a single translateY value. On mobile, dragging the
 * handle down dismisses it; the drag zone is the handle only, so it never
 * competes with a scrollable list in the sheet body.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  sheetStyle,
  handleColor = "rgba(0,0,0,0.2)",
}: BottomSheetProps) {
  // Keep the Modal mounted through the close animation, then unmount.
  const [mounted, setMounted] = useState(visible);
  const screenHeight = Dimensions.get("window").height;
  // translateY: 0 = fully open, screenHeight = fully closed (off-screen).
  const translateY = useRef(new Animated.Value(screenHeight)).current;

  // Keep the latest onClose without rebuilding the PanResponder.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else if (mounted) {
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Claim only clear downward drags so taps still work.
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          onCloseRef.current(); // visible→false drives the slide-out animation
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, screenHeight],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[styles.wrap, { transform: [{ translateY }] }]}
        pointerEvents="box-none"
      >
        <View style={sheetStyle}>
          <View
            style={styles.dragZone}
            {...(ENABLE_PAN ? panResponder.panHandlers : {})}
          >
            <View style={[styles.grabber, { backgroundColor: handleColor }]} />
          </View>
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
  dragZone: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
