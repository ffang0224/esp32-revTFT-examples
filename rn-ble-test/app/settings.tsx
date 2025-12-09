import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { useBle } from "../contexts";
import { colors, spacing, borderRadius, typography, shadows } from "../constants/design";
import { Device } from "react-native-ble-plx";

const API_KEY_STORAGE_KEY = "openrouter_api_key";

export default function SettingsScreen() {
  const router = useRouter();
  const {
    connectedDevice,
    isConnecting,
    isScanning,
    devices,
    autoconnectFailed,
    startScan,
    connectToDevice,
    disconnect,
    rssi,
  } = useBle();

  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const section1Opacity = useRef(new Animated.Value(0)).current;
  const section1TranslateY = useRef(new Animated.Value(30)).current;
  const section2Opacity = useRef(new Animated.Value(0)).current;
  const section2TranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadApiKey();

    // Entrance animations
    Animated.stagger(150, [
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.parallel([
        Animated.timing(section1Opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(section1TranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
      Animated.parallel([
        Animated.timing(section2Opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(section2TranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
    ]).start();
  }, []);

  const loadApiKey = async () => {
    try {
      const envApiKey =
        Constants.expoConfig?.extra?.openRouterApiKey ||
        Constants.manifest?.extra?.openRouterApiKey ||
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

      if (envApiKey) {
        setApiKey(envApiKey);
        setApiKeyInput(envApiKey);
      } else {
        const savedKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
        if (savedKey) {
          setApiKey(savedKey);
          setApiKeyInput(savedKey);
        }
      }
    } catch (e) {
      console.log("Error loading API key:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      Alert.alert("Error", "Please enter an API key");
      return;
    }
    try {
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKeyInput.trim());
      setApiKey(apiKeyInput.trim());
      Alert.alert("Success", "API key saved");
    } catch (e: any) {
      Alert.alert("Error", `Failed to save API key: ${e.message}`);
    }
  };

  const clearApiKey = async () => {
    Alert.alert(
      "Clear API Key",
      "Are you sure you want to remove your API key?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
              setApiKey("");
              setApiKeyInput("");
            } catch (e: any) {
              Alert.alert("Error", `Failed to clear API key: ${e.message}`);
            }
          },
        },
      ]
    );
  };

  const deviceList = Object.values(devices);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </Animated.View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* BLE Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: section1Opacity,
              transform: [{ translateY: section1TranslateY }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Badge Connection</Text>

          {connectedDevice ? (
            <View style={styles.connectedCard}>
              <View style={styles.connectedInfo}>
                <View style={styles.connectedDot} />
                <View>
                  <Text style={styles.connectedName}>
                    {connectedDevice.name || "Badge"}
                  </Text>
                  {rssi !== null && (
                    <Text style={styles.connectedRssi}>Signal: {rssi}dBm</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {autoconnectFailed && (
                <View style={styles.warningCard}>
                  <Text style={styles.warningText}>
                    Auto-connect failed. Please scan manually.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.scanButton, (isScanning || isConnecting) && styles.buttonDisabled]}
                onPress={startScan}
                disabled={isScanning || isConnecting}
              >
                {isScanning ? (
                  <>
                    <ActivityIndicator size="small" color={colors.card} />
                    <Text style={styles.scanButtonText}>Scanning...</Text>
                  </>
                ) : (
                  <Text style={styles.scanButtonText}>Scan for Badge</Text>
                )}
              </TouchableOpacity>

              {deviceList.length > 0 && (
                <View style={styles.deviceList}>
                  <Text style={styles.deviceListTitle}>
                    Found {deviceList.length} device{deviceList.length !== 1 ? "s" : ""}
                  </Text>
                  {deviceList.map((device) => {
                    const isLikelyBadge =
                      (device.name && device.name.includes("Fausto")) ||
                      ((device as any).localName && (device as any).localName.includes("Fausto"));

                    return (
                      <TouchableOpacity
                        key={device.id}
                        style={[styles.deviceItem, isLikelyBadge && styles.deviceItemHighlighted]}
                        onPress={() => connectToDevice(device)}
                        disabled={isConnecting}
                      >
                        <View style={styles.deviceInfo}>
                          <Text style={styles.deviceName}>
                            {device.name || (device as any).localName || "Unnamed Device"}
                            {isLikelyBadge && " ⭐"}
                          </Text>
                          <Text style={styles.deviceId}>{device.id}</Text>
                        </View>
                        {device.rssi !== null && device.rssi !== undefined && (
                          <Text style={styles.deviceRssi}>{device.rssi}dBm</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* API Key Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: section2Opacity,
              transform: [{ translateY: section2TranslateY }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>OpenRouter API</Text>

          {isLoading ? (
            <ActivityIndicator />
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder="sk-or-v1-..."
                secureTextEntry
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.saveButton, !apiKeyInput.trim() && styles.buttonDisabled]}
                  onPress={saveApiKey}
                  disabled={!apiKeyInput.trim()}
                >
                  <Text style={styles.saveButtonText}>
                    {apiKey ? "Update" : "Save"}
                  </Text>
                </TouchableOpacity>

                {apiKey && (
                  <TouchableOpacity style={styles.clearButton} onPress={clearApiKey}>
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => Linking.openURL("https://openrouter.ai")}
              >
                <Text style={styles.linkText}>
                  Get your API key from openrouter.ai →
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  backText: {
    fontSize: 20,
    color: colors.text,
  },
  title: {
    ...typography.heading,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.subheading,
    marginBottom: spacing.md,
  },
  connectedCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.accentLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  connectedInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  connectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  connectedName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  connectedRssi: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  disconnectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disconnectText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
  },
  warningCard: {
    backgroundColor: "#FEF3C7",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  warningText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  scanButton: {
    backgroundColor: colors.accent,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  scanButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  deviceList: {
    marginTop: spacing.lg,
  },
  deviceListTitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  deviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  deviceItemHighlighted: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.accentLight,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  deviceId: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: "monospace",
  },
  deviceRssi: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  saveButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "600",
  },
  clearButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: "center",
  },
  clearButtonText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "600",
  },
  linkText: {
    fontSize: 13,
    color: colors.accent,
    textAlign: "center",
  },
});
