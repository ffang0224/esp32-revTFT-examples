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
  Subscription,
} from "react-native-ble-plx";
import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as UPNG from "upng-js";

// Constants
const UART_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const UART_RX_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
const UART_TX_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
const CONNECTED_DEVICE_STORAGE_KEY = "last_connected_device_id";
const BADGE_NAME_PREFIX = "fausto";
const MAX_CONNECTION_RETRIES = 3;
const AUTOCONNECT_DIRECT_TIMEOUT = 4000;
const AUTOCONNECT_SCAN_TIMEOUT = 10000;
const MANUAL_SCAN_TIMEOUT = 8000;
const RETRY_DELAY_MS = 2000;
const CONNECTION_TIMEOUT = 15000;

// Transfer states
type TransferStage =
  | "idle"
  | "preparing"
  | "sending_start"
  | "sending_chunks"
  | "waiting_ack"
  | "done"
  | "error";

interface TransferState {
  stage: TransferStage;
  transferId: string | null;
  bytesSent: number;
  bytesTotal: number;
  chunkIndex: number;
  chunkCount: number;
  progress: number;
  error: string | null;
}

interface BatteryData {
  mv: number;
  pct: number;
  tmp: number | null;
  src: string;
  timestamp: number;
}

const getDeviceName = (device: Device) =>
  (device.name || (device as any).localName || "").trim();

const hasUartService = (device: Device) => {
  const serviceUUIDs = (device as any).serviceUUIDs as string[] | undefined;
  if (!Array.isArray(serviceUUIDs)) return false;
  return serviceUUIDs.some(
    (uuid) => typeof uuid === "string" && uuid.toLowerCase() === UART_SERVICE_UUID.toLowerCase()
  );
};

const matchesBadgeCandidate = (device: Device, targetId: string | null) => {
  const name = getDeviceName(device).toLowerCase();
  return (
    (targetId !== null && device.id === targetId) ||
    name.includes(BADGE_NAME_PREFIX) ||
    hasUartService(device)
  );
};

const getScanOptions = () =>
  Platform.OS === "android"
    ? ({ allowDuplicates: false, scanMode: 2 } as any) // 2 = low-latency mode on Android
    : ({ allowDuplicates: true } as any);

interface BleContextType {
  // Connection state
  isScanning: boolean;
  isConnecting: boolean;
  connectedDevice: Device | null;
  autoconnectFailed: boolean;
  connectionRetryCount: number;
  rssi: number | null;
  devices: Record<string, Device>;

  // Transfer state
  transferState: TransferState;

  // Battery state
  batteryData: BatteryData | null;
  isFetchingBattery: boolean;

  // Actions
  startScan: () => Promise<void>;
  connectToDevice: (device: Device) => Promise<void>;
  disconnect: () => Promise<void>;
  autoConnect: (retryCount?: number) => Promise<void>;

  // Image sending
  sendImageToBadge: (imageUrl: string, prophecyText: string) => Promise<boolean>;
  isSendingImage: boolean;
  prepareImageBuffer: (imageUrl: string) => Promise<{
    binaryData: Uint8Array;
    width: number;
    height: number;
  } | null>;
  cancelTransfer: () => void;

  // Battery
  fetchBatteryData: () => Promise<void>;

  // Legacy compatibility
  imageBuffer: Uint8Array | null;
  imageDimensions: { width: number; height: number } | null;
}

const BleContext = createContext<BleContextType | null>(null);

const manager = new BleManager();

export function BleProvider({ children }: { children: React.ReactNode }) {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [lastKnownDeviceId, setLastKnownDeviceId] = useState<string | null>(null);
  const [uartRxChar, setUartRxChar] = useState<Characteristic | null>(null);
  const [uartTxChar, setUartTxChar] = useState<Characteristic | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoconnectFailed, setAutoconnectFailed] = useState(false);
  const [connectionRetryCount, setConnectionRetryCount] = useState(0);
  const [rssi, setRssi] = useState<number | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);

  // Transfer state
  const [transferState, setTransferState] = useState<TransferState>({
    stage: "idle",
    transferId: null,
    bytesSent: 0,
    bytesTotal: 0,
    chunkIndex: 0,
    chunkCount: 0,
    progress: 0,
    error: null,
  });

  // Battery state
  const [batteryData, setBatteryData] = useState<BatteryData | null>(null);
  const [isFetchingBattery, setIsFetchingBattery] = useState(false);

  // Legacy compatibility
  const [imageBuffer, setImageBuffer] = useState<Uint8Array | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Refs
  const autoConnectRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanReasonRef = useRef<"autoconnect" | "manual" | null>(null);
  const scanCandidateCountRef = useRef(0);
  const autoconnectRunIdRef = useRef(0);
  const manualDisconnectRef = useRef(false);
  const autoConnectRef = useRef<(retryCount?: number) => Promise<void>>(async () => {});
  const txSubscriptionRef = useRef<Subscription | null>(null);
  const pendingAckResolveRef = useRef<((value: { stage: string; ok: boolean; extra?: any }) => void) | null>(null);
  const transferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTransferIdRef = useRef<string | null>(null);
  const receiveBufferRef = useRef<string>("");

  const clearAutoConnectRetryTimer = useCallback(() => {
    if (autoConnectRetryTimerRef.current) {
      clearTimeout(autoConnectRetryTimerRef.current);
      autoConnectRetryTimerRef.current = null;
    }
  }, []);

  const clearScanTimeout = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  const clearTransferTimeout = useCallback(() => {
    if (transferTimeoutRef.current) {
      clearTimeout(transferTimeoutRef.current);
      transferTimeoutRef.current = null;
    }
  }, []);

  const stopScan = useCallback(
    (reason: string) => {
      clearScanTimeout();
      try {
        manager.stopDeviceScan();
      } catch {}
      if (scanReasonRef.current) {
        console.log(
          `[BLE][scan] stop (${scanReasonRef.current}) reason=${reason} candidates=${scanCandidateCountRef.current}`
        );
      }
      scanReasonRef.current = null;
      setIsScanning(false);
    },
    [clearScanTimeout]
  );

  // Parse incoming BLE messages
  const parseIncomingData = useCallback((data: string) => {
    receiveBufferRef.current += data;
    const lines = receiveBufferRef.current.split("\n");
    receiveBufferRef.current = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        console.log(`[BLE RX] ${line.substring(0, 100)}`);

        // Handle ACK messages
        if (msg.t === "ack" && msg.id) {
          const { id, st, ok, ...extra } = msg;
          if (pendingAckResolveRef.current && id === currentTransferIdRef.current) {
            pendingAckResolveRef.current({ stage: st, ok: ok === 1 || ok === true, extra });
          }
        }

        // Handle progress messages
        if (msg.t === "prog" && msg.id === currentTransferIdRef.current) {
          setTransferState((prev) => ({
            ...prev,
            progress: msg.pct || 0,
            bytesSent: msg.rx || prev.bytesSent,
          }));
        }

        // Handle battery telemetry
        if (msg.t === "bat") {
          const batteryInfo: BatteryData = {
            mv: msg.mv || 0,
            pct: msg.pct || 0,
            tmp: msg.tmp || null,
            src: msg.src || "unknown",
            timestamp: Date.now(),
          };
          setBatteryData(batteryInfo);
          setIsFetchingBattery(false);
        }
      } catch (e) {
        // Not valid JSON, ignore or log
        console.log(`[BLE RX] raw: ${line.substring(0, 100)}`);
      }
    }
  }, []);

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
          } catch {
            clearInterval(rssiInterval);
          }
        }, 5000);

        await device.discoverAllServicesAndCharacteristics();
        const chars = await device.characteristicsForService(UART_SERVICE_UUID);

        // Find RX characteristic (write)
        const rx = chars.find(
          (c) =>
            c.uuid.toLowerCase() === UART_RX_UUID.toLowerCase() &&
            (c.isWritableWithoutResponse || c.isWritableWithResponse)
        );

        // Find TX characteristic (notify)
        const tx = chars.find(
          (c) =>
            c.uuid.toLowerCase() === UART_TX_UUID.toLowerCase() &&
            c.isNotifiable
        );

        if (!rx) {
          throw new Error("UART RX characteristic not found or not writable");
        }

        setConnectedDevice(device);
        setUartRxChar(rx);
        setIsConnecting(false);
        setAutoconnectFailed(false);
        setConnectionRetryCount(0);
        manualDisconnectRef.current = false;

        // Set up TX notification subscription
        if (tx) {
          setUartTxChar(tx);
          try {
            if (txSubscriptionRef.current) {
              txSubscriptionRef.current.remove();
            }
            txSubscriptionRef.current = manager.monitorCharacteristicForDevice(
              device.id,
              UART_SERVICE_UUID,
              UART_TX_UUID,
              (error, characteristic) => {
              if (error) {
                const message = error.message || "Unknown monitor error";
                const isExpectedDisconnect =
                  message.toLowerCase().includes("cancelled") ||
                  message.toLowerCase().includes("disconnected");
                if (!isExpectedDisconnect) {
                  console.log("TX monitor error:", message, (error as any).reason || "");
                }
                return;
              }
              if (characteristic?.value) {
                try {
                  const decoded = Buffer.from(characteristic.value, "base64").toString("utf-8");
                  parseIncomingData(decoded);
                } catch (e) {
                  console.log("TX decode error:", e);
                }
              }
            }
            );
            console.log("TX notification subscribed");
          } catch (e) {
            console.log("Failed to subscribe to TX notifications:", e);
          }
        }

        try {
          await SecureStore.setItemAsync(CONNECTED_DEVICE_STORAGE_KEY, device.id);
          setLastKnownDeviceId(device.id);
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
    [parseIncomingData]
  );

  const autoConnect = useCallback(
    async (retryCount: number = 0) => {
      if (connectedDevice) return;
      if (scanReasonRef.current === "manual") return;
      if (isConnecting && retryCount === 0) return;

      try {
        const runId = ++autoconnectRunIdRef.current;
        const isCurrentRun = () => autoconnectRunIdRef.current === runId;
        const targetId = lastKnownDeviceId;

        setAutoconnectFailed(false);
        setIsConnecting(true);
        setConnectionRetryCount(retryCount);

        const connectionDelay =
          retryCount > 0 ? Math.min(1000 * Math.pow(2, retryCount - 1), 5000) : 0;
        if (connectionDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, connectionDelay));
        }

        const scheduleRetry = () => {
          clearAutoConnectRetryTimer();
          if (retryCount < MAX_CONNECTION_RETRIES) {
            const nextRetry = retryCount + 1;
            autoConnectRetryTimerRef.current = setTimeout(() => {
              autoConnect(nextRetry);
            }, RETRY_DELAY_MS);
            console.log(
              `[BLE][autoconnect] scheduled retry ${nextRetry + 1}/${MAX_CONNECTION_RETRIES + 1}`
            );
          } else {
            setIsConnecting(false);
            setAutoconnectFailed(true);
            console.log("[BLE][autoconnect] exhausted retries");
          }
        };

        clearAutoConnectRetryTimer();
        stopScan("autoconnect-restart");
        console.log(
          `[BLE][autoconnect] attempt ${retryCount + 1}/${MAX_CONNECTION_RETRIES + 1}, target=${
            targetId || "none"
          }`
        );

        if (targetId) {
          try {
            console.log(`[BLE][autoconnect] direct connect -> ${targetId}`);
            const connected = await manager.connectToDevice(targetId, {
              timeout: AUTOCONNECT_DIRECT_TIMEOUT,
            });
            if (!isCurrentRun()) {
              await manager.cancelDeviceConnection(connected.id).catch(() => {});
              return;
            }
            console.log(`[BLE][autoconnect] direct connect success -> ${connected.id}`);
            await handleDeviceConnection(connected, retryCount > 0);
            return;
          } catch (directError: any) {
            console.log(
              `[BLE][autoconnect] direct connect failed -> ${
                directError?.message || String(directError)
              }`
            );
          }
        }

        let connectInProgress = false;
        scanReasonRef.current = "autoconnect";
        scanCandidateCountRef.current = 0;
        setIsScanning(true);
        console.log(`[BLE][scan] start (autoconnect) target=${targetId || "none"}`);

        try {
          manager.startDeviceScan(null, getScanOptions(), async (error, device) => {
            if (!isCurrentRun()) return;
            if (error) {
              console.log("[BLE][scan] autoconnect error:", error.message);
              stopScan("autoconnect-scan-error");
              scheduleRetry();
              return;
            }

            if (!device || connectInProgress) return;
            if (!matchesBadgeCandidate(device, targetId)) return;

            connectInProgress = true;
            scanCandidateCountRef.current += 1;
            const source = targetId && device.id === targetId ? "known-id" : "name-match";
            console.log(
              `[BLE][scan] candidate #${scanCandidateCountRef.current} (${source}) ${device.id} (${getDeviceName(
                device
              ) || "Unnamed"})`
            );

            stopScan("candidate-found");
            try {
              console.log(`[BLE][autoconnect] connect from scan (${source}) -> ${device.id}`);
              const connected = await manager.connectToDevice(device.id, {
                timeout: CONNECTION_TIMEOUT,
              });
              if (!isCurrentRun()) {
                await manager.cancelDeviceConnection(connected.id).catch(() => {});
                return;
              }
              await handleDeviceConnection(connected, retryCount > 0);
            } catch (scanConnectError: any) {
              console.log(
                `[BLE][autoconnect] scan-connect failed -> ${
                  scanConnectError?.message || String(scanConnectError)
                }`
              );
              if (isCurrentRun()) {
                scheduleRetry();
              }
            }
          });
        } catch (scanStartError: any) {
          console.log(
            `[BLE][scan] failed to start autoconnect scan -> ${
              scanStartError?.message || String(scanStartError)
            }`
          );
          stopScan("autoconnect-start-failed");
          scheduleRetry();
          return;
        }

        clearScanTimeout();
        scanTimeoutRef.current = setTimeout(() => {
          if (!isCurrentRun()) return;
          stopScan("autoconnect-timeout");
          scheduleRetry();
        }, AUTOCONNECT_SCAN_TIMEOUT);
      } catch (e: any) {
        console.log("[BLE][autoconnect] fatal error:", e);
        if (retryCount < MAX_CONNECTION_RETRIES) {
          clearAutoConnectRetryTimer();
          autoConnectRetryTimerRef.current = setTimeout(() => autoConnect(retryCount + 1), RETRY_DELAY_MS);
        } else {
          setIsConnecting(false);
          stopScan("autoconnect-fatal");
          setAutoconnectFailed(true);
        }
      }
    },
    [
      clearAutoConnectRetryTimer,
      clearScanTimeout,
      connectedDevice,
      handleDeviceConnection,
      isConnecting,
      lastKnownDeviceId,
      stopScan,
    ]
  );

  useEffect(() => {
    autoConnectRef.current = autoConnect;
  }, [autoConnect]);

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
      try {
        const savedDeviceId = await SecureStore.getItemAsync(CONNECTED_DEVICE_STORAGE_KEY);
        if (savedDeviceId) {
          setLastKnownDeviceId(savedDeviceId);
          console.log(`[BLE] Loaded saved device ID: ${savedDeviceId}`);
        } else {
          console.log("[BLE] No saved device ID found");
        }
      } catch (e) {
        console.log("Could not load saved device ID:", e);
      }
    })();

    return () => {
      autoconnectRunIdRef.current += 1;
      clearAutoConnectRetryTimer();
      clearScanTimeout();
      clearTransferTimeout();
      if (txSubscriptionRef.current) {
        txSubscriptionRef.current.remove();
        txSubscriptionRef.current = null;
      }
      try {
        manager.stopDeviceScan();
      } catch {}
      manager.destroy();
    };
  }, [clearAutoConnectRetryTimer, clearScanTimeout, clearTransferTimeout]);

  useEffect(() => {
    if (!lastKnownDeviceId) return;

    const deviceDisconnectedSubscription = manager.onDeviceDisconnected(
      lastKnownDeviceId,
      (error, device) => {
        console.log(`[BLE] Device disconnected: ${device?.id || lastKnownDeviceId}`, error);
        stopScan("device-disconnected");
        setConnectedDevice(null);
        setUartRxChar(null);
        setUartTxChar(null);
        setRssi(null);
        setIsConnecting(false);
        if (txSubscriptionRef.current) {
          txSubscriptionRef.current.remove();
          txSubscriptionRef.current = null;
        }

        if (manualDisconnectRef.current) {
          manualDisconnectRef.current = false;
          console.log("[BLE] Manual disconnect requested; skipping autoconnect.");
          return;
        }

        if (scanReasonRef.current === "manual") return;
        clearAutoConnectRetryTimer();
        autoConnectRetryTimerRef.current = setTimeout(() => {
          autoConnectRef.current(0);
        }, RETRY_DELAY_MS);
      }
    );

    return () => {
      deviceDisconnectedSubscription.remove();
    };
  }, [clearAutoConnectRetryTimer, lastKnownDeviceId, stopScan]);

  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      console.log("BLE State updated:", state);
      if (state === "PoweredOn") {
        setTimeout(() => {
          autoConnectRef.current(0);
        }, 500);
      }
    }, true);

    return () => subscription.remove();
  }, []);

  const startScan = async () => {
    if (connectedDevice) return;

    autoconnectRunIdRef.current += 1;
    clearAutoConnectRetryTimer();
    stopScan("manual-scan-requested");

    setAutoconnectFailed(false);
    setConnectionRetryCount(0);
    setIsConnecting(false);
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
    scanReasonRef.current = "manual";
    scanCandidateCountRef.current = 0;
    setIsScanning(true);
    console.log("[BLE][scan] start (manual)");

    try {
      manager.startDeviceScan(null, getScanOptions(), (error, device) => {
        if (error) {
          console.log("[BLE][scan] manual error:", error.message);
          stopScan("manual-scan-error");
          return;
        }

        if (!device) return;
        if (!matchesBadgeCandidate(device, lastKnownDeviceId)) return;

        setDevices((prev) => {
          const existing = prev[device.id];
          if (existing && existing.name === device.name && existing.rssi === device.rssi) {
            return prev;
          }
          if (!existing) {
            scanCandidateCountRef.current += 1;
            console.log(
              `[BLE][scan] manual candidate #${scanCandidateCountRef.current} ${device.id} (${getDeviceName(
                device
              ) || "Unnamed"})`
            );
          }
          return { ...prev, [device.id]: device };
        });
      });
    } catch (err: any) {
      Alert.alert("Start Scan Exception", err.message);
      stopScan("manual-start-exception");
      return;
    }

    clearScanTimeout();
    scanTimeoutRef.current = setTimeout(() => {
      stopScan("manual-timeout");
    }, MANUAL_SCAN_TIMEOUT);
  };

  const connectToDevice = async (device: Device) => {
    if (isConnecting) return;

    autoconnectRunIdRef.current += 1;
    clearAutoConnectRetryTimer();
    setIsConnecting(true);
    stopScan("manual-connect");
    setUartRxChar(null);
    setUartTxChar(null);

    try {
      console.log(`[BLE][connect] manual -> ${device.id}`);
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
    manualDisconnectRef.current = true;
    try {
      await manager.cancelDeviceConnection(connectedDevice.id);
    } catch (e) {
      console.log("Disconnect error:", e);
    }
    setIsConnecting(false);
    setConnectedDevice(null);
    setUartRxChar(null);
    setUartTxChar(null);
    setRssi(null);
    if (txSubscriptionRef.current) {
      txSubscriptionRef.current.remove();
      txSubscriptionRef.current = null;
    }
  };

  const cancelTransfer = useCallback(() => {
    clearTransferTimeout();
    pendingAckResolveRef.current = null;
    currentTransferIdRef.current = null;
    setTransferState({
      stage: "idle",
      transferId: null,
      bytesSent: 0,
      bytesTotal: 0,
      chunkIndex: 0,
      chunkCount: 0,
      progress: 0,
      error: null,
    });
    setIsSendingImage(false);
  }, [clearTransferTimeout]);

  const prepareImageBuffer = useCallback(async (imageUrl: string): Promise<{
    binaryData: Uint8Array;
    width: number;
    height: number;
  } | null> => {
    try {
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

      let min = 255, max = 0;
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

      setImageBuffer(binaryData);
      setImageDimensions({ width, height });

      return { binaryData, width, height };
    } catch (e: any) {
      console.error("Prepare image error:", e);
      return null;
    }
  }, []);

  const sendImageToBadge = useCallback(async (imageUrl: string, prophecyText: string): Promise<boolean> => {
    if (!connectedDevice) {
      Alert.alert("Not Connected", "Please connect to your badge first");
      return false;
    }

    setIsSendingImage(true);
    clearTransferTimeout();

    // Generate unique transfer ID
    const transferId = `tx${Date.now().toString(36).slice(-6)}`;
    currentTransferIdRef.current = transferId;

    try {
      // Check connection
      const isDeviceConnected = await connectedDevice.isConnected();
      if (!isDeviceConnected) {
        throw new Error("Device disconnected. Please reconnect.");
      }

      // Get or re-acquire characteristic
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

      // Prepare image buffer
      setTransferState({
        stage: "preparing",
        transferId,
        bytesSent: 0,
        bytesTotal: 0,
        chunkIndex: 0,
        chunkCount: 0,
        progress: 0,
        error: null,
      });

      const prepared = await prepareImageBuffer(imageUrl);
      if (!prepared) {
        throw new Error("Failed to prepare image");
      }

      const { binaryData, width, height } = prepared;
      const CHUNK_SIZE = 180;
      const chunkCount = Math.ceil(binaryData.length / CHUNK_SIZE);

      setTransferState({
        stage: "sending_start",
        transferId,
        bytesSent: 0,
        bytesTotal: binaryData.length,
        chunkIndex: 0,
        chunkCount,
        progress: 0,
        error: null,
      });

      // Send start command with new compact format
      const startCmd =
        JSON.stringify({
          t: "img",
          id: transferId,
          w: width,
          h: height,
          len: binaryData.length,
          p: prophecyText.trim(),
        }) + "\n";

      if (!char.isWritableWithoutResponse && !char.isWritableWithResponse) {
        throw new Error("Characteristic is no longer writable");
      }

      // Set up ACK waiter
      const startAckPromise = new Promise<{ stage: string; ok: boolean }>((resolve, reject) => {
        pendingAckResolveRef.current = resolve;
        transferTimeoutRef.current = setTimeout(() => {
          pendingAckResolveRef.current = null;
          reject(new Error("Start ACK timeout"));
        }, 5000);
      });

      await char.writeWithoutResponse(Buffer.from(startCmd).toString("base64"));
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Wait for start ACK
      const startAck = await startAckPromise;
      if (!startAck.ok) {
        throw new Error(`Start rejected: ${startAck.stage}`);
      }

      // Send chunks
      setTransferState({
        stage: "sending_chunks",
        transferId,
        bytesSent: 0,
        bytesTotal: binaryData.length,
        chunkIndex: 0,
        chunkCount,
        progress: 0,
        error: null,
      });

      let offset = 0;
      let chunkIndex = 0;

      while (offset < binaryData.length) {
        const isStillConnected = await connectedDevice.isConnected();
        if (!isStillConnected) {
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
        chunkIndex++;

        setTransferState((prev) => ({
          ...prev,
          bytesSent: Math.min(offset, binaryData.length),
          chunkIndex,
          progress: Math.round((chunkIndex / chunkCount) * 50), // 0-50% for sending
        }));

        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // Wait for completion ACK
      setTransferState((prev) => ({
        ...prev,
        stage: "waiting_ack",
        progress: 60,
      }));

      const doneAckPromise = new Promise<{ stage: string; ok: boolean }>((resolve, reject) => {
        pendingAckResolveRef.current = resolve;
        transferTimeoutRef.current = setTimeout(() => {
          pendingAckResolveRef.current = null;
          reject(new Error("Completion ACK timeout"));
        }, 15000); // E-ink refresh takes time
      });

      const doneAck = await doneAckPromise;

      if (doneAck.ok) {
        setTransferState({
          stage: "done",
          transferId,
          bytesSent: binaryData.length,
          bytesTotal: binaryData.length,
          chunkIndex,
          chunkCount,
          progress: 100,
          error: null,
        });
        return true;
      } else {
        throw new Error(`Transfer failed: ${doneAck.stage}`);
      }
    } catch (e: any) {
      console.error("Send Image Error:", e);
      setTransferState((prev) => ({
        ...prev,
        stage: "error",
        error: e.message,
        progress: 0,
      }));
      return false;
    } finally {
      clearTransferTimeout();
      pendingAckResolveRef.current = null;
      setIsSendingImage(false);
    }
  }, [connectedDevice, uartRxChar, prepareImageBuffer, clearTransferTimeout]);

  const fetchBatteryData = useCallback(async () => {
    if (!connectedDevice || !uartRxChar) {
      Alert.alert("Not Connected", "Please connect to your badge first");
      return;
    }

    setIsFetchingBattery(true);

    try {
      const isDeviceConnected = await connectedDevice.isConnected();
      if (!isDeviceConnected) {
        throw new Error("Device disconnected");
      }

      const cmd = JSON.stringify({ t: "bat" }) + "\n";
      await uartRxChar.writeWithoutResponse(Buffer.from(cmd).toString("base64"));

      // If nothing comes back, stop the spinner after a short timeout.
      setTimeout(() => {
        setIsFetchingBattery((prev) => (prev ? false : prev));
      }, 4000);
    } catch (e: any) {
      console.error("Fetch battery error:", e);
      Alert.alert("Error", e.message || "Failed to fetch battery data");
      setIsFetchingBattery(false);
    }
  }, [connectedDevice, uartRxChar]);

  // Auto-fetch battery once on successful connect
  useEffect(() => {
    if (connectedDevice && uartRxChar && !batteryData) {
      fetchBatteryData();
    }
  }, [connectedDevice, uartRxChar, batteryData, fetchBatteryData]);

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
        transferState,
        batteryData,
        isFetchingBattery,
        startScan,
        connectToDevice,
        disconnect,
        autoConnect,
        sendImageToBadge,
        isSendingImage,
        prepareImageBuffer,
        cancelTransfer,
        fetchBatteryData,
        imageBuffer,
        imageDimensions,
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
