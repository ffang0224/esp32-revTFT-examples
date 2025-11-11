import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { BleManager, Device } from "react-native-ble-plx";
import { Buffer } from "buffer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemeColor } from "@/hooks/use-theme-color";

const UART_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const UART_RX_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"; // App -> ESP32

const manager = new BleManager();

export default function IndexScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [text, setText] = useState("Hello from Expo Router");
  const [color, setColor] = useState("#00FFFF");

  // Permissions (Android)
  useEffect(() => {
    (async () => {
      if (Platform.OS === "android") {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          "android.permission.BLUETOOTH_SCAN" as any,
          "android.permission.BLUETOOTH_CONNECT" as any,
        ]);
      }
    })();

    return () => {
      manager.destroy();
    };
  }, []);

  const startScan = () => {
    setDevices({});
    setIsScanning(true);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log("Scan error", error);
        setIsScanning(false);
        return;
      }
      if (!device) return;

      if (device.name === "FaustoBadge" || device.localName === "FaustoBadge") {
        setDevices((prev) => ({ ...prev, [device.id]: device }));
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 8000);
  };

  const connectToDevice = async (device: Device) => {
    try {
      const connected = await manager.connectToDevice(device.id, {
        autoConnect: true,
      });
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      Alert.alert("Connected", `Connected to ${device.name || device.id}`);
    } catch (e) {
      console.error("Connect error", e);
      Alert.alert("Error", "Failed to connect");
    } finally {
      manager.stopDeviceScan();
      setIsScanning(false);
    }
  };

  const sendText = async () => {
    if (!connectedDevice) {
      Alert.alert("Not connected", "Connect to FaustoBadge first.");
      return;
    }

    try {
      const payload = JSON.stringify({ text, color }) + "\n";
      const base64Data = Buffer.from(payload, "utf8").toString("base64");

      await connectedDevice.writeCharacteristicWithoutResponseForService(
        UART_SERVICE_UUID,
        UART_RX_UUID,
        base64Data
      );

      Alert.alert("Sent", "Message sent to badge");
    } catch (e) {
      console.error("Write error", e);
      Alert.alert("Error", "Failed to send");
    }
  };

  const disconnect = async () => {
    if (!connectedDevice) return;
    try {
      await manager.cancelDeviceConnection(connectedDevice.id);
    } catch (e) {
      console.error("Disconnect error", e);
    }
    setConnectedDevice(null);
  };

  const deviceList = Object.values(devices);
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const borderColor = useThemeColor({}, "icon");
  const cardBackground = useThemeColor(
    { light: "#F5F5F5", dark: "#1E1E1E" },
    "background"
  );

  // Validate hex color
  const isValidColor = /^#[0-9A-F]{6}$/i.test(color);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Fausto BLE Badge
          </ThemedText>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor: connectedDevice
                    ? "#4CAF50"
                    : isScanning
                    ? "#FF9800"
                    : "#9E9E9E",
                },
              ]}
            />
            <ThemedText style={styles.statusText}>
              {connectedDevice
                ? `Connected to ${connectedDevice.name || "Device"}`
                : isScanning
                ? "Scanning..."
                : "Not connected"}
            </ThemedText>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              isScanning && styles.buttonDisabled,
              { backgroundColor: tintColor },
            ]}
            onPress={startScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <IconSymbol name="magnifyingglass" size={20} color="#fff" />
            )}
            <ThemedText
              style={[
                styles.buttonText,
                { color: "#fff" },
              ]}
            >
              {isScanning ? "Scanning..." : "Scan for Badge"}
            </ThemedText>
          </TouchableOpacity>

          {connectedDevice && (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: borderColor }]}
              onPress={disconnect}
            >
              <IconSymbol name="xmark.circle.fill" size={20} color={textColor} />
              <ThemedText style={styles.buttonText}>Disconnect</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Device List */}
        {!connectedDevice && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Available Devices
            </ThemedText>
            {deviceList.length > 0 ? (
              <FlatList
                data={deviceList}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.deviceCard,
                      { backgroundColor: cardBackground, borderColor: borderColor },
                    ]}
                    onPress={() => connectToDevice(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.deviceCardContent}>
                      <IconSymbol
                        name="antenna.radiowaves.left.and.right"
                        size={24}
                        color={tintColor}
                      />
                      <View style={styles.deviceInfo}>
                        <ThemedText type="defaultSemiBold" style={styles.deviceName}>
                          {item.name || "Unnamed Device"}
                        </ThemedText>
                        <ThemedText style={styles.deviceId}>{item.id}</ThemedText>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={[styles.emptyState, { borderColor: borderColor }]}>
                <IconSymbol
                  name="antenna.radiowaves.left.and.right"
                  size={32}
                  color={borderColor}
                />
                <ThemedText style={styles.hint}>
                  {isScanning
                    ? "Searching for FaustoBadge..."
                    : 'Tap "Scan for Badge" to find devices'}
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Send Text Section */}
        {connectedDevice && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Send Message
            </ThemedText>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Text</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: cardBackground,
                    borderColor: borderColor,
                    color: textColor,
                  },
                ]}
                value={text}
                onChangeText={setText}
                placeholder="Text to show on badge"
                placeholderTextColor={borderColor}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Color</ThemedText>
              <View style={styles.colorInputRow}>
                <View
                  style={[
                    styles.colorPreview,
                    {
                      backgroundColor: isValidColor ? color : "#000000",
                      borderColor: borderColor,
                    },
                  ]}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.colorInput,
                    {
                      backgroundColor: cardBackground,
                      borderColor: isValidColor ? "#4CAF50" : borderColor,
                      color: textColor,
                    },
                  ]}
                  value={color}
                  onChangeText={setColor}
                  placeholder="#RRGGBB (e.g. #FF00FF)"
                  placeholderTextColor={borderColor}
                  autoCapitalize="none"
                  maxLength={7}
                />
              </View>
              {!isValidColor && color.length > 0 && (
                <ThemedText style={styles.errorText}>
                  Invalid color format
                </ThemedText>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: isValidColor ? tintColor : borderColor,
                  opacity: isValidColor ? 1 : 0.5,
                },
              ]}
              onPress={sendText}
              disabled={!isValidColor}
            >
              <IconSymbol name="paperplane.fill" size={20} color="#fff" />
              <ThemedText style={[styles.buttonText, { color: "#fff" }]}>
                Send to Badge
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  deviceCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  deviceCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    opacity: 0.6,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    gap: 12,
  },
  hint: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  colorInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  colorPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
  },
  colorInput: {
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    color: "#F44336",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
