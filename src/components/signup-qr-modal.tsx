import { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { X } from "phosphor-react-native";
import { getBusinessSignupQR, type SignupQRResponse } from "@/api/businesses";

interface SignupQRModalProps {
  visible: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
}

export function SignupQRModal({
  visible,
  onClose,
  businessId,
  businessName,
}: SignupQRModalProps) {
  const [qrData, setQrData] = useState<SignupQRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && !qrData) {
      loadQRCode();
    }
  }, [visible]);

  const loadQRCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBusinessSignupQR(businessId);
      setQrData(data);
    } catch (err) {
      setError("Failed to load QR code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#666" weight="bold" />
          </TouchableOpacity>

          <Text style={styles.title}>{businessName}</Text>
          <Text style={styles.subtitle}>Scan to get your loyalty card</Text>

          <View style={styles.qrContainer}>
            {loading && <ActivityIndicator size="large" color="#8B5A2B" />}
            {error && <Text style={styles.errorText}>{error}</Text>}
            {qrData && (
              <Image
                source={{ uri: qrData.qr_code }}
                style={styles.qrCode}
                resizeMode="contain"
              />
            )}
          </View>

          {qrData && <Text style={styles.urlText}>{qrData.signup_url}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  qrContainer: {
    width: 280,
    height: 280,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  qrCode: {
    width: 280,
    height: 280,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
  urlText: {
    fontSize: 12,
    color: "#999",
    marginTop: 16,
  },
});
