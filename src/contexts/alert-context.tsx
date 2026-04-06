import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type AlertButton = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type AlertState = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
};

type AlertContextValue = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within AlertProvider");
  return ctx;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: "",
    buttons: [],
  });

  const alert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      if (Platform.OS !== "web") {
        Alert.alert(title, message, buttons);
        return;
      }
      setState({
        visible: true,
        title,
        message,
        buttons: buttons ?? [{ text: "OK" }],
      });
    },
    []
  );

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleButton = useCallback(
    (button: AlertButton) => {
      dismiss();
      button.onPress?.();
    },
    [dismiss]
  );

  return (
    <AlertContext.Provider value={{ alert }}>
      {children}
      {Platform.OS === "web" && (
        <Modal
          visible={state.visible}
          transparent
          animationType="fade"
          onRequestClose={dismiss}
        >
          <Pressable style={styles.backdrop} onPress={dismiss}>
            <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.title}>{state.title}</Text>
              {state.message && (
                <Text style={styles.message}>{state.message}</Text>
              )}
              <View style={styles.buttonRow}>
                {state.buttons.map((button, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [
                      styles.button,
                      button.style === "destructive" && styles.buttonDestructive,
                      button.style === "cancel" && styles.buttonCancel,
                      button.style !== "destructive" &&
                        button.style !== "cancel" &&
                        styles.buttonDefault,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handleButton(button)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        button.style === "destructive" &&
                          styles.buttonTextDestructive,
                        button.style === "cancel" && styles.buttonTextCancel,
                      ]}
                    >
                      {button.text ?? "OK"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#faf9f6",
    borderRadius: 16,
    padding: 24,
    width: 320,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2d3436",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDestructive: {
    backgroundColor: "#dc2626",
  },
  buttonCancel: {
    backgroundColor: "#e5e5e5",
  },
  buttonDefault: {
    backgroundColor: "#f97316",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  buttonTextDestructive: {
    color: "#fff",
  },
  buttonTextCancel: {
    color: "#4b5563",
  },
});
