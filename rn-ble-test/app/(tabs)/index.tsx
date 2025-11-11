import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
} from "react-native";
import {
  BleManager,
  Device,
  Characteristic,
  BleError,
} from "react-native-ble-plx";
import { Buffer } from "buffer";

const UART_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const UART_RX_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";

const manager = new BleManager();

export default function IndexScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [uartRxChar, setUartRxChar] = useState<Characteristic | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [text, setText] = useState("Hello from Expo Router");
  const [color, setColor] = useState("#00FFFF");

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
    if (isScanning || isConnecting || connectedDevice) return;

    setDevices({});
    setIsScanning(true);

    // Only scan for devices advertising the UART service
    manager.startDeviceScan([UART_SERVICE_UUID], null, (error, device) => {
      if (error) {
        console.log("Scan error:", error);
        setIsScanning(false);
        manager.stopDeviceScan();
        return;
      }
      if (!device || !device.id) return;

      console.log(
        "Found UART candidate:",
        device.name,
        (device as any).localName,
        device.id
      );

      setDevices((prev) => {
        if (prev[device.id]) return prev;
        return { ...prev, [device.id]: device };
      });
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 8000);
  };

  const connectToDevice = async (device: Device) => {
    if (isConnecting) return;

    setIsConnecting(true);
    setIsScanning(false);
    manager.stopDeviceScan();
    setUartRxChar(null);

    try {
      console.log("Connecting to", device.id, device.name);

      const connected = await manager.connectToDevice(device.id, {
        timeout: 8000,
      });

      console.log("Low-level connected:", connected.id);

      await connected.discoverAllServicesAndCharacteristics();

      // Find UART RX characteristic explicitly
      const chars = await connected.characteristicsForService(
        UART_SERVICE_UUID
      );

      console.log(
        "UART characteristics:",
        chars.map((c) => ({
          uuid: c.uuid,
          notif: c.isNotifiable,
          write: c.isWritableWithResponse,
          writeNR: c.isWritableWithoutResponse,
        }))
      );

      const rx = chars.find(
        (c) =>
          c.uuid.toLowerCase() === UART_RX_UUID.toLowerCase() &&
          (c.isWritableWithoutResponse || c.isWritableWithResponse)
      );

      if (!rx) {
        throw new Error("UART RX characteristic not found or not writable");
      }

      setConnectedDevice(connected);
      setUartRxChar(rx);

      Alert.alert(
        "Connected",
        `Connected to ${connected.name || connected.id}`
      );
    } catch (e: any) {
      const bleErr = e as BleError;
      console.log(
        "Connect error (full):",
        JSON.stringify(
          {
            message: bleErr.message,
            errorCode: bleErr.errorCode,
            attErrorCode: bleErr.attErrorCode,
            iosErrorCode: (bleErr as any).iosErrorCode,
          },
          null,
          2
        )
      );

      try {
        await manager.cancelDeviceConnection(device.id);
      } catch {}

      Alert.alert(
        "Connection failed",
        bleErr.message || "Could not connect to device."
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const sendText = async () => {
    if (!connectedDevice || !uartRxChar) {
      Alert.alert(
        "Not ready",
        "Make sure you're connected and UART RX is discovered."
      );
      return;
    }

    try {
      const payload = JSON.stringify({ text, color }) + "\n";
      const base64Data = Buffer.from(payload, "utf8").toString("base64");

      console.log("Writing to RX char:", uartRxChar.uuid, "payload:", payload);

      // Write directly via the characteristic object
      await uartRxChar.writeWithoutResponse(base64Data);

      // If something's wrong with writeWithoutResponse, fallback:
      // await uartRxChar.writeWithResponse(base64Data);

      console.log("Sent OK");
    } catch (e: any) {
      console.log("Write error:", e);
      Alert.alert("Error", e?.message || "Failed to send");
    }
  };

  const disconnect = async () => {
    if (!connectedDevice) return;
    try {
      await manager.cancelDeviceConnection(connectedDevice.id);
    } catch (e) {
      console.log("Disconnect error:", e);
    }
    setConnectedDevice(null);
    setUartRxChar(null);
  };

  const deviceList = Object.values(devices);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fausto BLE Badge</Text>
      <Text style={styles.label}>
        Status:{" "}
        {connectedDevice
          ? `Connected to ${connectedDevice.name || connectedDevice.id}`
          : isConnecting
          ? "Connecting..."
          : "Not connected"}
      </Text>

      <View style={styles.row}>
        <Button
          title={isScanning ? "Scanning..." : "Scan for Badge"}
          onPress={startScan}
          disabled={isScanning || !!connectedDevice || isConnecting}
        />
        {connectedDevice && <Button title="Disconnect" onPress={disconnect} />}
      </View>

      {!connectedDevice && (
        <FlatList
          data={deviceList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.deviceItem}
              onPress={() => connectToDevice(item)}
              disabled={isConnecting}
            >
              <Text style={styles.deviceName}>
                {item.name ||
                  (item as any).localName ||
                  "UART device (likely badge)"}
              </Text>
              <Text style={styles.deviceId}>{item.id}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.hint}>
              Tap "Scan for Badge". Only Nordic UART devices appear.
            </Text>
          }
        />
      )}

      <Text style={styles.sectionTitle}>Send text</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Text to show on badge"
      />
      <TextInput
        style={styles.input}
        value={color}
        onChangeText={setColor}
        placeholder="#RRGGBB color (e.g. #FF00FF)"
        autoCapitalize="none"
      />
      <Button
        title="Send to Badge"
        onPress={sendText}
        disabled={!connectedDevice || !uartRxChar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, gap: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 14, marginBottom: 4 },
  row: { flexDirection: "row", gap: 10, marginVertical: 8 },
  deviceItem: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 4,
  },
  deviceName: { fontWeight: "600" },
  deviceId: { fontSize: 10, color: "#666" },
  hint: { fontSize: 12, color: "#777", marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 4,
  },
});
