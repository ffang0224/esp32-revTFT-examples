import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
} from "react-native";
import {
  BleManager,
  Device,
  Characteristic,
  BleError,
} from "react-native-ble-plx";
import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as UPNG from "upng-js";

// Constants
const UART_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const UART_RX_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
const AUTO_CONNECT_DEVICE_ID = "98B09776-ED44-C4D3-1E87-68B04161BDBB";
const CONNECTED_DEVICE_STORAGE_KEY = "last_connected_device_id";
const MAX_CONNECTION_RETRIES = 3;
const CONNECTION_TIMEOUT = 15000;
const SCAN_TIMEOUT = 15000;

interface BleContextType {
  // Connection state
  isScanning: boolean;
  isConnecting: boolean;
  connectedDevice: Device | null;
  autoconnectFailed: boolean;
  connectionRetryCount: number;
  rssi: number | null;
  devices: Record<string, Device>;
  
  // Actions
  startScan: () => Promise<void>;
  connectToDevice: (device: Device) => Promise<void>;
  disconnect: () => Promise<void>;
  autoConnect: (retryCount?: number) => Promise<void>;
  
  // Image sending
  sendImageToBadge: (imageUrl: string, prophecyText: string) => Promise<void>;
  isSendingImage: boolean;
}

const BleContext = createContext<BleContextType | null>(null);

const manager = new BleManager();

export function BleProvider({ children }: { children: React.ReactNode }) {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [uartRxChar, setUartRxChar] = useState<Characteristic | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoconnectFailed, setAutoconnectFailed] = useState(false);
  const [connectionRetryCount, setConnectionRetryCount] = useState(0);
  const [rssi, setRssi] = useState<number | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);

  const handleDeviceConnection = useCallback(
    async (device: Device, isRetry: boolean = false) => {
      try {
        console.log("Low-level connected:", device.id, isRetry ? "(retry)" : "");

        try {
          const updatedDevice = await device.readRSSI();
          if (updatedDevice.rssi !== null && updatedDevice.rssi !== undefined) {
            setRssi(updatedDevice.rssi);
          }
        } catch (rssiError) {
          console.log("Could not read RSSI:", rssiError);
        }

        const rssiInterval = setInterval(async () => {
          try {
            const isConnected = await device.isConnected();
            if (isConnected) {
              const updatedDevice = await device.readRSSI();
              if (updatedDevice.rssi !== null && updatedDevice.rssi !== undefined) {
                setRssi(updatedDevice.rssi);
              }
            } else {
              clearInterval(rssiInterval);
            }
          } catch (e) {
            clearInterval(rssiInterval);
          }
        }, 5000);

        await device.discoverAllServicesAndCharacteristics();
        const chars = await device.characteristicsForService(UART_SERVICE_UUID);

        const rx = chars.find(
          (c) =>
            c.uuid.toLowerCase() === UART_RX_UUID.toLowerCase() &&
            (c.isWritableWithoutResponse || c.isWritableWithResponse)
        );

        if (!rx) {
          throw new Error("UART RX characteristic not found or not writable");
        }

        setConnectedDevice(device);
        setUartRxChar(rx);
        setIsConnecting(false);
        setAutoconnectFailed(false);
        setConnectionRetryCount(0);

        try {
          await SecureStore.setItemAsync(CONNECTED_DEVICE_STORAGE_KEY, device.id);
        } catch (e) {
          console.log("Could not save device ID:", e);
        }

        console.log("Connected successfully to", device.name || device.id);
      } catch (e: any) {
        console.log("Connection setup error:", e);
        try {
          await manager.cancelDeviceConnection(device.id);
        } catch {}
        setIsConnecting(false);
        throw e;
      }
    },
    []
  );

  const autoConnect = useCallback(
    async (retryCount: number = 0) => {
      if (isConnecting || connectedDevice) return;

      try {
        console.log(
          `Attempting autoconnect to ${AUTO_CONNECT_DEVICE_ID} (attempt ${retryCount + 1}/${MAX_CONNECTION_RETRIES + 1})`
        );
        setAutoconnectFailed(false);
        setIsConnecting(true);
        setConnectionRetryCount(retryCount);

        const connectionDelay =
          retryCount > 0 ? Math.min(1000 * Math.pow(2, retryCount - 1), 5000) : 0;
        if (connectionDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, connectionDelay));
        }

        try {
          const device = await manager.connectToDevice(AUTO_CONNECT_DEVICE_ID, {
            timeout: CONNECTION_TIMEOUT,
          });
          console.log("Direct connection successful:", device.id);
          await handleDeviceConnection(device, retryCount > 0);
          return;
        } catch (directError: any) {
          console.log("Direct connection failed, will scan:", directError.message);
          if (directError.errorCode === 201 || directError.errorCode === 202) {
            // Connection timeout or device not found - proceed to scan
          } else if (retryCount < MAX_CONNECTION_RETRIES) {
            console.log(`Retrying connection (${retryCount + 1}/${MAX_CONNECTION_RETRIES})`);
            return autoConnect(retryCount + 1);
          }
        }

        let foundDevice: Device | null = null;
        const scanTimeout = setTimeout(() => {
          manager.stopDeviceScan();
          setIsScanning(false);
          if (!foundDevice) {
            console.log("Autoconnect: Device not found during scan");
            if (retryCount < MAX_CONNECTION_RETRIES) {
              console.log(`Retrying scan (${retryCount + 1}/${MAX_CONNECTION_RETRIES})`);
              setTimeout(() => autoConnect(retryCount + 1), 2000);
            } else {
              setIsConnecting(false);
              setAutoconnectFailed(true);
            }
          }
        }, SCAN_TIMEOUT);

        setIsScanning(true);

        const scanCallback = (error: BleError | null, device: Device | null) => {
          if (error) {
            console.log("Scan error during autoconnect:", error);
            clearTimeout(scanTimeout);
            setIsScanning(false);
            if (retryCount < MAX_CONNECTION_RETRIES) {
              setTimeout(() => autoConnect(retryCount + 1), 2000);
            } else {
              setIsConnecting(false);
              setAutoconnectFailed(true);
            }
            return;
          }

          if (device && device.id === AUTO_CONNECT_DEVICE_ID) {
            foundDevice = device;
            clearTimeout(scanTimeout);
            manager.stopDeviceScan();
            setIsScanning(false);
            handleDeviceConnection(device, retryCount > 0);
          }
        };

        try {
          manager.startDeviceScan(
            [UART_SERVICE_UUID],
            { allowDuplicates: false },
            (error, device) => {
              if (error) {
                console.log("Scan error during autoconnect:", error);
                manager.stopDeviceScan();
                manager.startDeviceScan(null, { allowDuplicates: false }, scanCallback);
                return;
              }

              if (device && device.id === AUTO_CONNECT_DEVICE_ID) {
                foundDevice = device;
                clearTimeout(scanTimeout);
                manager.stopDeviceScan();
                setIsScanning(false);
                handleDeviceConnection(device, retryCount > 0);
              }
            }
          );
        } catch (scanError) {
          console.log("Service UUID scan failed, scanning all devices:", scanError);
          manager.startDeviceScan(null, { allowDuplicates: false }, scanCallback);
        }
      } catch (e: any) {
        console.log("Autoconnect error:", e);
        if (retryCount < MAX_CONNECTION_RETRIES) {
          setTimeout(() => autoConnect(retryCount + 1), 2000);
        } else {
          setIsConnecting(false);
          setIsScanning(false);
          setAutoconnectFailed(true);
        }
      }
    },
    [isConnecting, connectedDevice, handleDeviceConnection]
  );

  useEffect(() => {
    (async () => {
      if (Constants.appOwnership === "expo") {
        Alert.alert(
          "Expo Go Detected",
          "Bluetooth Low Energy (BLE) does NOT work in Expo Go. You must use a Development Build."
        );
      }

      if (Platform.OS === "android") {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            "android.permission.BLUETOOTH_SCAN" as any,
            "android.permission.BLUETOOTH_CONNECT" as any,
          ]);
        } catch (e) {
          console.log("Permission error:", e);
        }
      }

      const deviceDisconnectedSubscription = manager.onDeviceDisconnected(
        AUTO_CONNECT_DEVICE_ID,
        (error, device) => {
          console.log("Device disconnected:", device?.id, error);
          setConnectedDevice(null);
          setUartRxChar(null);
          setRssi(null);
          if (device) {
            setTimeout(() => {
              autoConnect();
            }, 2000);
          }
        }
      );

      return () => {
        deviceDisconnectedSubscription.remove();
      };
    })();

    return () => {
      manager.destroy();
    };
  }, []);

  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      console.log("BLE State updated:", state);
      if (state === "PoweredOn") {
        setTimeout(() => {
          autoConnect(0);
        }, 500);
      }
    }, true);

    return () => subscription.remove();
  }, [autoConnect]);

  const startScan = async () => {
    if (isScanning || isConnecting || connectedDevice) return;

    setAutoconnectFailed(false);
    const state = await manager.state();

    if (state === "Unauthorized") {
      Alert.alert(
        "Permission Error",
        "Bluetooth permission is denied. Please enable it in system settings.",
        [
          {
            text: "Open Settings",
            onPress: () => {
              if (Platform.OS === "ios") {
                Linking.openURL("app-settings:");
              } else {
                Linking.openSettings();
              }
            },
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    if (state !== "PoweredOn") {
      Alert.alert("Bluetooth not ready", `Current state: ${state}`);
      return;
    }

    setDevices({});
    setIsScanning(true);

    const startAllDeviceScan = () => {
      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          console.log("Scan callback error:", error);
          setIsScanning(false);
          manager.stopDeviceScan();
          return;
        }

        if (device) {
          setDevices((prev) => {
            if (prev[device.id] && prev[device.id].name === device.name) return prev;
            return { ...prev, [device.id]: device };
          });
        }
      });
    };

    try {
      try {
        manager.startDeviceScan(
          [UART_SERVICE_UUID],
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              manager.stopDeviceScan();
              startAllDeviceScan();
              return;
            }

            if (device) {
              setDevices((prev) => {
                if (prev[device.id] && prev[device.id].name === device.name) return prev;
                return { ...prev, [device.id]: device };
              });
            }
          }
        );
      } catch (serviceScanError) {
        startAllDeviceScan();
      }
    } catch (err: any) {
      Alert.alert("Start Scan Exception", err.message);
      setIsScanning(false);
    }

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 15000);
  };

  const connectToDevice = async (device: Device) => {
    if (isConnecting) return;

    setIsConnecting(true);
    setIsScanning(false);
    manager.stopDeviceScan();
    setUartRxChar(null);

    try {
      const connected = await manager.connectToDevice(device.id, {
        timeout: CONNECTION_TIMEOUT,
      });

      await handleDeviceConnection(connected);
      setAutoconnectFailed(false);
      Alert.alert("Connected", `Connected to ${connected.name || connected.id}`);
    } catch (e: any) {
      const bleErr = e as BleError;
      try {
        await manager.cancelDeviceConnection(device.id);
      } catch {}

      let errorMessage = bleErr.message || "Could not connect to device.";
      if (bleErr.errorCode === 201) {
        errorMessage = "Connection timeout. Make sure the device is nearby and powered on.";
      } else if (bleErr.errorCode === 202) {
        errorMessage = "Device not found. Try scanning again.";
      }

      Alert.alert("Connection failed", errorMessage);
    } finally {
      setIsConnecting(false);
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

  const sendImageToBadge = async (imageUrl: string, prophecyText: string) => {
    if (!connectedDevice) {
      Alert.alert("Not Connected", "Please connect to your badge first");
      return;
    }

    setIsSendingImage(true);

    try {
      if (!connectedDevice.isConnected()) {
        throw new Error("Device disconnected. Please reconnect.");
      }

      let char = uartRxChar;
      if (!char) {
        console.log("Re-acquiring UART characteristic...");
        await connectedDevice.discoverAllServicesAndCharacteristics();
        const chars = await connectedDevice.characteristicsForService(UART_SERVICE_UUID);
        const foundChar = chars.find(
          (c) =>
            c.uuid.toLowerCase() === UART_RX_UUID.toLowerCase() &&
            (c.isWritableWithoutResponse || c.isWritableWithResponse)
        );
        if (!foundChar) {
          throw new Error("UART RX characteristic not found");
        }
        char = foundChar;
        setUartRxChar(foundChar);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const squareSize = 122;
      const manipResult = await manipulateAsync(
        imageUrl,
        [{ resize: { width: squareSize, height: squareSize } }],
        { compress: 1, format: SaveFormat.PNG, base64: false }
      );

      const response = await fetch(manipResult.uri);
      const arrayBuffer = await response.arrayBuffer();

      const png = UPNG.decode(arrayBuffer);
      const rgba = UPNG.toRGBA8(png)[0];
      const data = new Uint8Array(rgba);

      const width = png.width;
      const height = png.height;

      console.log(`Processing image: ${width}x${height}`);

      const grayscale = new Float32Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        grayscale[i] = r * 0.2126 + g * 0.7152 + b * 0.0722;
      }

      let min = 255,
        max = 0;
      for (let i = 0; i < grayscale.length; i++) {
        if (grayscale[i] < min) min = grayscale[i];
        if (grayscale[i] > max) max = grayscale[i];
      }

      if (max - min > 50) {
        const contrastFactor = 255 / (max - min);
        for (let i = 0; i < grayscale.length; i++) {
          grayscale[i] = (grayscale[i] - min) * contrastFactor;
          grayscale[i] = Math.max(0, Math.min(255, grayscale[i]));
        }
      }

      const dithered = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const oldPixel = grayscale[idx];
          const newPixel = oldPixel < 128 ? 0 : 255;
          dithered[idx] = newPixel;

          const error = oldPixel - newPixel;

          if (x < width - 1) {
            grayscale[idx + 1] += error * (7 / 16);
          }
          if (y < height - 1) {
            if (x > 0) {
              grayscale[idx + width - 1] += error * (3 / 16);
            }
            grayscale[idx + width] += error * (5 / 16);
            if (x < width - 1) {
              grayscale[idx + width + 1] += error * (1 / 16);
            }
          }
        }
      }

      const binaryData = new Uint8Array(Math.ceil((width * height) / 8));

      for (let i = 0; i < width * height; i++) {
        if (dithered[i] < 128) {
          const byteIndex = Math.floor(i / 8);
          const bitIndex = 7 - (i % 8);
          binaryData[byteIndex] |= 1 << bitIndex;
        }
      }

      const startCmd =
        JSON.stringify({
          cmd: "image_start",
          w: width,
          h: height,
          len: binaryData.length,
          prompt: prophecyText.trim(),
        }) + "\n";

      if (!char.isWritableWithoutResponse && !char.isWritableWithResponse) {
        throw new Error("Characteristic is no longer writable");
      }

      await char.writeWithoutResponse(Buffer.from(startCmd).toString("base64"));
      await new Promise((resolve) => setTimeout(resolve, 200));

      const CHUNK_SIZE = 180;
      let offset = 0;

      while (offset < binaryData.length) {
        if (!connectedDevice.isConnected()) {
          throw new Error("Device disconnected during transmission");
        }

        const end = Math.min(offset + CHUNK_SIZE, binaryData.length);
        const chunk = binaryData.slice(offset, end);
        const base64Chunk = Buffer.from(chunk).toString("base64");

        try {
          await char.writeWithoutResponse(base64Chunk);
        } catch (chunkError: any) {
          console.error(`Error sending chunk at offset ${offset}:`, chunkError);
          try {
            await connectedDevice.discoverAllServicesAndCharacteristics();
            const chars = await connectedDevice.characteristicsForService(UART_SERVICE_UUID);
            const foundChar = chars.find(
              (c) =>
                c.uuid.toLowerCase() === UART_RX_UUID.toLowerCase() &&
                (c.isWritableWithoutResponse || c.isWritableWithResponse)
            );
            if (foundChar) {
              char = foundChar;
              setUartRxChar(foundChar);
              await foundChar.writeWithoutResponse(base64Chunk);
            } else {
              throw new Error("Could not re-acquire characteristic");
            }
          } catch (reacquireError) {
            throw new Error(`Failed to send chunk: ${reacquireError}`);
          }
        }

        offset += CHUNK_SIZE;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      console.log(`Image sent completely: ${width}x${height}`);
      Alert.alert("Success", "Prophecy sent to badge!");
    } catch (e: any) {
      console.error("Send Image Error:", e);
      Alert.alert("Error", "Failed to send image: " + e.message);
    } finally {
      setIsSendingImage(false);
    }
  };

  return (
    <BleContext.Provider
      value={{
        isScanning,
        isConnecting,
        connectedDevice,
        autoconnectFailed,
        connectionRetryCount,
        rssi,
        devices,
        startScan,
        connectToDevice,
        disconnect,
        autoConnect,
        sendImageToBadge,
        isSendingImage,
      }}
    >
      {children}
    </BleContext.Provider>
  );
}

export function useBle() {
  const context = useContext(BleContext);
  if (!context) {
    throw new Error("useBle must be used within a BleProvider");
  }
  return context;
}
