import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getCustomer, addStamp } from '@/api/customers';
import type { Customer, StampResponse } from '@/types/api';

export default function StampScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [stamping, setStamping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<StampResponse | null>(null);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  async function loadCustomer() {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomer(id);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStamp() {
    if (!customer || stamping) return;

    try {
      setStamping(true);
      setError(null);
      const result = await addStamp(customer.id);
      setSuccess(result);
      setCustomer((prev) => prev ? { ...prev, stamps: result.stamps } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add stamp');
    } finally {
      setStamping(false);
    }
  }

  function handleDone() {
    router.back();
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8B5A2B" />
        <Text style={styles.loadingText}>Loading customer...</Text>
      </View>
    );
  }

  if (error && !customer) {
    return (
      <View style={styles.container}>
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>!</Text>
        </View>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Stamp Added!</Text>
        <Text style={styles.successMessage}>{success.message}</Text>

        <View style={styles.stampsDisplay}>
          <Text style={styles.stampsLabel}>Current Stamps</Text>
          <View style={styles.stampsRow}>
            {[...Array(10)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.stampDot,
                  i < success.stamps && styles.stampDotFilled,
                ]}
              />
            ))}
          </View>
          <Text style={styles.stampsCount}>{success.stamps} / 10</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>Scan Next Customer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {customer?.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.customerName}>{customer?.name}</Text>
        <Text style={styles.customerEmail}>{customer?.email}</Text>

        <View style={styles.stampsDisplay}>
          <Text style={styles.stampsLabel}>Current Stamps</Text>
          <View style={styles.stampsRow}>
            {[...Array(10)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.stampDot,
                  i < (customer?.stamps || 0) && styles.stampDotFilled,
                ]}
              />
            ))}
          </View>
          <Text style={styles.stampsCount}>{customer?.stamps || 0} / 10</Text>
        </View>

        {error && (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.stampButton, stamping && styles.stampButtonDisabled]}
        onPress={handleAddStamp}
        disabled={stamping || (customer?.stamps || 0) >= 10}
      >
        {stamping ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.stampButtonIcon}>☕</Text>
            <Text style={styles.stampButtonText}>
              {(customer?.stamps || 0) >= 10 ? 'Card Full!' : 'Add Stamp'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8B5A2B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  stampsDisplay: {
    alignItems: 'center',
    width: '100%',
  },
  stampsLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stampsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  stampDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    borderWidth: 2,
    borderColor: '#ccc',
  },
  stampDotFilled: {
    backgroundColor: '#8B5A2B',
    borderColor: '#6B4423',
  },
  stampsCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  stampButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginTop: 24,
    width: '100%',
    gap: 12,
  },
  stampButtonDisabled: {
    backgroundColor: '#ccc',
  },
  stampButtonIcon: {
    fontSize: 24,
  },
  stampButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIconText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  inlineError: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    width: '100%',
  },
  inlineErrorText: {
    color: '#C62828',
    textAlign: 'center',
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    color: '#fff',
    fontSize: 48,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#8B5A2B',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
