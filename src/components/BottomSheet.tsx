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
  /**
   * When true, the whole sheet is draggable to dismiss (use for sheets WITHOUT
   * an internal scroll list). When false (default), only the top handle area is
   * draggable, so the gesture never competes with a scrollable body.
   */
  fullSheetDrag?: boolean;
}

const OPEN_DURATION = 240;
const CLOSE_DURATION = 200;
// Pan-to-close is mobile-only — PanResponder drags are unreliable on web.
const ENABLE_PAN = Platform.OS !== "web";
// Drag distance / velocity past which a downward swipe dismisses the sheet.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6;

/**
 * Cross-platform bottom sheet: RN Modal + Animated. Used on every platform
 * instead of @gorhom/bottom-sheet (which would not reliably present on the
 * native New-Architecture build). The backdrop opacity fades as the sheet
 * slides, derived from a single translateY value. On mobile, dragging down
 * dismisses it (whole sheet when `fullSheetDrag`, otherwise the handle only so
 * it never competes with a scrollable list in the body).
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  sheetStyle,
  handleColor = "rgba(0,0,0,0.2)",
  fullSheetDrag = false,
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
      return;
    }
    if (!mounted) return;
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // Unmount on a timer rather than the animation's `finished` callback: if the
    // close animation is interrupted (e.g. a rapid reopen), the callback never
    // fires and the Modal would stay mounted with a transparent backdrop that
    // swallows all touches — a full-screen freeze. The timer always unmounts.
    const id = setTimeout(() => setMounted(false), CLOSE_DURATION + 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Claim only clear downward drags so taps/horizontal moves still work.
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
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
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  if (!mounted) return null;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, screenHeight],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Whole-sheet drag attaches the handlers to the surface; otherwise only the
  // handle zone is draggable.
  const sheetPan = ENABLE_PAN && fullSheetDrag ? panResponder.panHandlers : {};
  const handlePan = ENABLE_PAN && !fullSheetDrag ? panResponder.panHandlers : {};

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[styles.wrap, { transform: [{ translateY }] }]}
        pointerEvents="box-none"
      >
        <View style={sheetStyle} {...sheetPan}>
          <View style={styles.dragZone} {...handlePan}>
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
  // Generous full-width hit area so the handle is easy to grab and drag.
  dragZone: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 14,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
});
