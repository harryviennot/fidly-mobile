import Animated from "react-native-reanimated";
import { View, StyleSheet } from "react-native";

const GRID_SIZE = 9;
const SQUARE_SIZE = 16;
const GAP = 6;

const waveAnimation = {
  "0%": { opacity: 0.2 },
  "50%": { opacity: 0.8 },
  "100%": { opacity: 0.2 },
};

// Fixed pattern mimicking QR code structure with finder patterns in corners
// 1 = visible square, 0 = empty
const QR_PATTERN = [
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 1, 0, 0, 1, 1, 0, 1],
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
  [0, 0, 0, 1, 0, 1, 0, 0, 0],
  [1, 0, 1, 1, 1, 0, 1, 0, 1],
  [0, 1, 0, 0, 1, 1, 0, 0, 0],
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 1, 1, 0, 1, 1, 0, 1],
  [1, 1, 1, 0, 0, 0, 1, 1, 1],
];

export function QRCodeSkeleton() {
  return (
    <View style={styles.container}>
      {QR_PATTERN.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((visible, colIndex) =>
            visible ? (
              <Animated.View
                key={colIndex}
                style={[
                  styles.square,
                  {
                    animationName: waveAnimation,
                    animationDuration: "900ms",
                    animationIterationCount: "infinite",
                    animationTimingFunction: "ease-in-out",
                    animationDelay: `${(rowIndex + colIndex) * 60}ms`,
                  },
                ]}
              />
            ) : (
              <View key={colIndex} style={styles.emptySquare} />
            )
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    gap: GAP,
  },
  row: {
    flexDirection: "row",
    gap: GAP,
  },
  square: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    borderRadius: 3,
    backgroundColor: "#e8e6e1",
  },
  emptySquare: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
  },
});
