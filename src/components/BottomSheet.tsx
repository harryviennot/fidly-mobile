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
  type LayoutChangeEvent,
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

const BACKDROP_DURATION = 220;
const CLOSE_DURATION = 200;
// Pan-to-close is mobile-only — PanResponder drags are unreliable on web.
const ENABLE_PAN = Platform.OS !== "web";
// The native driver runs the slide on the UI thread; unsupported on web.
const USE_NATIVE = Platform.OS !== "web";
// Drag distance / velocity past which a downward swipe dismisses the sheet.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6;

/**
 * Cross-platform bottom sheet: RN Modal + Animated. Used on every platform
 * instead of @gorhom/bottom-sheet (which would not reliably present on the
 * native New-Architecture build).
 *
 * The slide travels the sheet's own measured height (not the screen height, so
 * short sheets don't teleport in from a mostly off-screen start) and runs on
 * the native driver with a near-critically-damped spring. The backdrop fades
 * as its own parallel animation, so it is correct for any sheet height. On
 * mobile, dragging down dismisses (whole sheet when `fullSheetDrag`, otherwise
 * the handle only so it never competes with a scrollable list in the body).
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
  // translateY: 0 = fully open, sheetHeight = fully closed (just off-screen).
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  // Measured on first layout; until then assume worst case (full screen).
  const sheetHeight = useRef(screenHeight);
  const hasMeasured = useRef(false);
  // Set when an open is requested before the sheet has been measured — the
  // open animation then starts from onLayout, once the real height is known.
  const pendingOpen = useRef(false);

  // Keep the latest onClose without rebuilding the PanResponder.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function animateOpen() {
    translateY.setValue(sheetHeight.current);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 26,
        stiffness: 280,
        mass: 0.9,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: BACKDROP_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();
  }

  function handleLayout(e: LayoutChangeEvent) {
    sheetHeight.current = Math.min(e.nativeEvent.layout.height, screenHeight);
    if (!hasMeasured.current) {
      hasMeasured.current = true;
      if (pendingOpen.current) {
        pendingOpen.current = false;
        animateOpen();
      }
    }
  }

  useEffect(() => {
    if (visible) {
      if (!mounted) {
        // Fresh mount: children re-layout, so wait for the measurement.
        hasMeasured.current = false;
        pendingOpen.current = true;
        setMounted(true);
      } else if (hasMeasured.current) {
        animateOpen();
      } else {
        pendingOpen.current = true;
      }
      return;
    }
    if (!mounted) return;
    pendingOpen.current = false;
    Animated.parallel([
      Animated.timing(translateY, {
        // +24 clears any shadow/overshoot at the top edge of the sheet.
        toValue: sheetHeight.current + 24,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();
    // Unmount on a timer rather than the animation's `finished` callback: if the
    // close animation is interrupted (e.g. a rapid reopen), the callback never
    // fires and the Modal would stay mounted with a transparent backdrop that
    // swallows all touches — a full-screen freeze. The timer always unmounts.
    // Park the sheet fully off-screen so a remount with taller content can't
    // flash before its first layout.
    const id = setTimeout(() => {
      setMounted(false);
      translateY.setValue(screenHeight);
    }, CLOSE_DURATION + 60);
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
            damping: 24,
            stiffness: 300,
            mass: 0.9,
            useNativeDriver: USE_NATIVE,
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  if (!mounted) return null;

  // Whole-sheet drag attaches the handlers to the surface; otherwise only the
  // handle zone is draggable.
  const sheetPan = ENABLE_PAN && fullSheetDrag ? panResponder.panHandlers : {};
  const handlePan = ENABLE_PAN && !fullSheetDrag ? panResponder.panHandlers : {};

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[styles.wrap, { transform: [{ translateY }] }]}
        pointerEvents="box-none"
      >
        <View style={sheetStyle} onLayout={handleLayout} {...sheetPan}>
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
