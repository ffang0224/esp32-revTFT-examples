import React, { useEffect, useState, useCallback } from "react";
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
  ScrollView,
  ActivityIndicator,
  Linking,
  Image,
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
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as UPNG from 'upng-js';

import { generateText, generateImage } from "../../services/openrouter";

const UART_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const UART_RX_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
const AUTO_CONNECT_DEVICE_ID = "98B09776-ED44-C4D3-1E87-68B04161BDBB";

const manager = new BleManager();
const API_KEY_STORAGE_KEY = "openrouter_api_key";
const CONNECTED_DEVICE_STORAGE_KEY = "last_connected_device_id";
const MAX_CONNECTION_RETRIES = 3;
const CONNECTION_TIMEOUT = 15000; // Increased from 5000ms
const SCAN_TIMEOUT = 15000; // Increased from 10000ms

const HALFTONE_PROMPT_PREFIX = "A coarse halftone black-and-white illustration made for a 250×122 e-ink display. Pure 1-bit monochrome, no grayscale. Very large halftone dots arranged on a visible grid. High contrast silhouettes with simplified shapes, strong blacks, and blown-out whites. Sharp edges, no anti-aliasing, no smooth gradients. Retro digital newspaper look, bitmap texture, heavy dithering, blocky pixel clusters. Composition must remain readable at extremely low resolution.\n\n";

export default function IndexScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [uartRxChar, setUartRxChar] = useState<Characteristic | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoconnectFailed, setAutoconnectFailed] = useState(false);
  const [text, setText] = useState("Hello from Expo Router");
  const [color, setColor] = useState("#00FFFF");
  
  // OpenRouter state
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiKeySection, setShowApiKeySection] = useState(false);
  
  // Image Generation State
  const [generationMode, setGenerationMode] = useState<"text" | "image">("text");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<string>("21:9"); // Default to closest supported ratio to badge (250x122 ≈ 2.05:1, closest is 21:9 = 2.33:1)
  const [connectionRetryCount, setConnectionRetryCount] = useState(0);
  const [rssi, setRssi] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (Constants.appOwnership === "expo") {
        Alert.alert(
          "Expo Go Detected",
          "Bluetooth Low Energy (BLE) does NOT work in Expo Go. You must use a Development Build.\n\nRun 'npx expo run:android' or 'npx expo run:ios' to build the native app."
        );
      }

      if (Platform.OS === "android") {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            "android.permission.BLUETOOTH_SCAN" as any,
            "android.permission.BLUETOOTH_CONNECT" as any,
          ]);
          console.log("Permissions:", granted);
        } catch (e) {
          console.log("Permission error:", e);
        }
      }

      try {
        const state = await manager.state();
        console.log("BLE Manager State on Mount:", state);
      } catch (e) {
        console.log("Error checking BLE state:", e);
      }
      
      // Load API key from environment variable first, then from secure store
      try {
        // Check for environment variable (from .env file or app.config.js)
        const envApiKey =
          Constants.expoConfig?.extra?.openRouterApiKey ||
          Constants.manifest?.extra?.openRouterApiKey ||
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
        
        if (envApiKey) {
          setApiKey(envApiKey);
          console.log("Loaded API key from environment variable");
        } else {
          // Fall back to secure store
          const savedKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
          if (savedKey) {
            setApiKey(savedKey);
            console.log("Loaded API key from secure store");
          }
        }
      } catch (e) {
        console.log("Error loading API key:", e);
      }

      // Monitor for device disconnections
      const deviceDisconnectedSubscription = manager.onDeviceDisconnected(
        AUTO_CONNECT_DEVICE_ID,
        (error, device) => {
          console.log("Device disconnected:", device?.id, error);
          setConnectedDevice(null);
          setUartRxChar(null);
          setRssi(null);
          // Auto-reconnect after a short delay
          if (device) {
            setTimeout(() => {
              if (!connectedDevice && !isConnecting) {
                console.log("Attempting auto-reconnect after disconnect");
                autoConnect();
              }
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

  const handleDeviceConnection = useCallback(async (device: Device, isRetry: boolean = false) => {
    try {
      console.log("Low-level connected:", device.id, isRetry ? "(retry)" : "");

      // Monitor RSSI for connection quality
      // readRSSI() returns a Device object with updated RSSI property
      try {
        const updatedDevice = await device.readRSSI();
        if (updatedDevice.rssi !== null && updatedDevice.rssi !== undefined) {
          setRssi(updatedDevice.rssi);
          console.log("Device RSSI:", updatedDevice.rssi);
        }
      } catch (rssiError) {
        console.log("Could not read RSSI:", rssiError);
        // RSSI might not be available, that's okay
      }

      // Set up periodic RSSI monitoring
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
      }, 5000); // Check RSSI every 5 seconds

      await device.discoverAllServicesAndCharacteristics();

      // Find UART RX characteristic explicitly
      const chars = await device.characteristicsForService(UART_SERVICE_UUID);

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

      setConnectedDevice(device);
      setUartRxChar(rx);
      setIsConnecting(false);
      setAutoconnectFailed(false);
      setConnectionRetryCount(0);

      // Store successful connection
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
      throw e; // Re-throw to allow retry logic
    }
  }, []);

  const autoConnect = useCallback(async (retryCount: number = 0) => {
    if (isConnecting || connectedDevice) return;

    try {
      console.log(`Attempting autoconnect to ${AUTO_CONNECT_DEVICE_ID} (attempt ${retryCount + 1}/${MAX_CONNECTION_RETRIES + 1})`);
      setAutoconnectFailed(false);
      setIsConnecting(true);
      setConnectionRetryCount(retryCount);

      // Try to connect directly first (works if device was previously connected)
      // Use exponential backoff for retries
      const connectionDelay = retryCount > 0 ? Math.min(1000 * Math.pow(2, retryCount - 1), 5000) : 0;
      if (connectionDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, connectionDelay));
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
        // If it's a timeout or connection error, proceed to scan
        // If it's a different error, might want to retry
        if (directError.errorCode === 201 || directError.errorCode === 202) {
          // Connection timeout or device not found - proceed to scan
        } else if (retryCount < MAX_CONNECTION_RETRIES) {
          // Retry for other errors
          console.log(`Retrying connection (${retryCount + 1}/${MAX_CONNECTION_RETRIES})`);
          return autoConnect(retryCount + 1);
        }
      }

      // If direct connection fails, scan for the device
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
      
      // Define scan callback first
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
      
      // Try scanning with service UUID filter first (more efficient)
      try {
        manager.startDeviceScan(
          [UART_SERVICE_UUID],
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              console.log("Scan error during autoconnect:", error);
              // Fall back to scanning all devices
              manager.stopDeviceScan();
              manager.startDeviceScan(
                null,
                { allowDuplicates: false },
                scanCallback
              );
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
        // If service UUID scan fails, fall back to scanning all devices
        console.log("Service UUID scan failed, scanning all devices:", scanError);
        manager.startDeviceScan(
          null,
          { allowDuplicates: false },
          scanCallback
        );
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
  }, [isConnecting, connectedDevice, handleDeviceConnection]);

  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      console.log("BLE State updated:", state);
      if (state === "PoweredOn") {
        // Auto-connect to the target device
        // Reduced delay - BLE is usually ready faster
        setTimeout(() => {
          autoConnect(0);
        }, 500); // Reduced from 1000ms
      }
    }, true);

    return () => subscription.remove();
  }, [autoConnect]);

  const startScan = async () => {
    if (isScanning || isConnecting || connectedDevice) return;

    // Reset autoconnect failed state when starting manual scan
    setAutoconnectFailed(false);

    // Check state explicitly
    const state = await manager.state();
    console.log("Start scan requested. Current state:", state);

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
      Alert.alert("Bluetooth not ready", `Current state: ${state}. Make sure Bluetooth is turned on.`);
      return;
    }

    setDevices({});
    setIsScanning(true);

    // Define scan callback function first
    const startAllDeviceScan = () => {
      manager.startDeviceScan(
        null,
        { allowDuplicates: false }, // Changed to false for better performance
        (error, device) => {
          if (error) {
            console.log("Scan callback error:", error);
            if (error.errorCode === 601) { // Location services disabled on Android
              Alert.alert("Location Required", "Please enable location services for Bluetooth scanning.");
            } else {
              Alert.alert("Scan Error", error.message);
            }
            setIsScanning(false);
            manager.stopDeviceScan();
            return;
          }
          
          if (device) {
            setDevices((prev) => {
              if (prev[device.id] && prev[device.id].name === device.name) return prev;
              if (!prev[device.id] || (!prev[device.id].name && device.name)) {
                console.log("New/Updated Device:", device.id, device.name, device.localName);
              }
              return { ...prev, [device.id]: device };
            });
          }
        }
      );
    };

    try {
      // Try scanning with service UUID filter first (more efficient and faster)
      try {
        manager.startDeviceScan(
          [UART_SERVICE_UUID],
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              console.log("Service UUID scan error, falling back to all devices:", error);
              // Fall back to scanning all devices
              manager.stopDeviceScan();
              startAllDeviceScan();
              return;
            }
            
            if (device) {
              setDevices((prev) => {
                if (prev[device.id] && prev[device.id].name === device.name) return prev;
                if (!prev[device.id] || (!prev[device.id].name && device.name)) {
                  console.log("New/Updated Device:", device.id, device.name, device.localName);
                }
                return { ...prev, [device.id]: device };
              });
            }
          }
        );
      } catch (serviceScanError) {
        console.log("Service UUID scan not supported, scanning all devices:", serviceScanError);
        startAllDeviceScan();
      }
    } catch (err: any) {
      console.error("startDeviceScan exception:", err);
      Alert.alert("Start Scan Exception", err.message);
      setIsScanning(false);
    }

    // Stop after 15 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
      console.log("Scan stopped automatically");
    }, 15000);
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
        timeout: CONNECTION_TIMEOUT, // Use same timeout as autoconnect
      });

      await handleDeviceConnection(connected);
      setAutoconnectFailed(false);

      Alert.alert(
        "Connected",
        `Connected to ${connected.name || connected.id}${rssi ? `\nSignal: ${rssi} dBm` : ""}`
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

      let errorMessage = bleErr.message || "Could not connect to device.";
      
      // Provide more helpful error messages
      if (bleErr.errorCode === 201) {
        errorMessage = "Connection timeout. Make sure the device is nearby and powered on.";
      } else if (bleErr.errorCode === 202) {
        errorMessage = "Device not found. Try scanning again.";
      } else if (bleErr.errorCode === 203) {
        errorMessage = "Device disconnected. Please try again.";
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

  const saveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      Alert.alert("Error", "Please enter an API key");
      return;
    }
    try {
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKeyInput.trim());
      setApiKey(apiKeyInput.trim());
      setShowApiKeySection(false);
      Alert.alert("Success", "API key saved securely");
    } catch (e: any) {
      Alert.alert("Error", `Failed to save API key: ${e.message}`);
    }
  };

  const generateAIContent = async () => {
    if (!apiKey) {
      Alert.alert("API Key Required", "Please configure your OpenRouter API key first");
      setShowApiKeySection(true);
      return;
    }

    if (!aiPrompt.trim()) {
      Alert.alert("Error", "Please enter a prompt");
      return;
    }

    // Connection check only needed for Text mode immediate send
    // For Image mode, we can generate first then connect/send
    if (generationMode === "text" && (!connectedDevice || !uartRxChar)) {
      Alert.alert("Not Connected", "Please connect to your badge first");
      return;
    }

    setIsGenerating(true);
    setGeneratedImageUrl(null);
    
    try {
      if (generationMode === "text") {
        const generated = await generateText(
          apiKey,
          aiPrompt,
          "openai/gpt-5.1",
          "Generate a random, concise prediction about the dilemma. Maximum 40 characters. Be brief and direct."
        );
        // Truncate to 40 characters to match badge display limit
        const truncatedGenerated = generated.slice(0, 40).trim();
        setText(truncatedGenerated);
        
        // Auto-send to badge
        const payload = JSON.stringify({ text: truncatedGenerated, color }) + "\n";
        const base64Data = Buffer.from(payload, "utf8").toString("base64");
        await uartRxChar?.writeWithoutResponse(base64Data);
        
        Alert.alert("Sent!", "Prediction generated and sent to badge");
      } else {
        // IMAGE MODE
        // Prepend halftone prompt prefix to user's input
        const fullPrompt = HALFTONE_PROMPT_PREFIX + aiPrompt;
        const imageUrl = await generateImage(apiKey, fullPrompt, "google/gemini-2.5-flash-image-preview", imageAspectRatio);
        console.log("Generated Image URL:", imageUrl);
        setGeneratedImageUrl(imageUrl);
      }
    } catch (e: any) {
      console.error("Generation error:", e);
      Alert.alert("Error", e.message || "Failed to generate content");
    } finally {
      setIsGenerating(false);
    }
  };

  const sendImageToBadge = async () => {
    if (!connectedDevice) {
      Alert.alert("Not Connected", "Please connect to your badge first");
      return;
    }
    if (!generatedImageUrl) return;

    setIsSendingImage(true);

    try {
      // Verify connection is still active
      if (!connectedDevice.isConnected()) {
        throw new Error("Device disconnected. Please reconnect.");
      }

      // Re-acquire characteristic if needed (handles stale characteristic issue)
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

      // Small delay to ensure previous image processing is complete on device
      // Also gives BLE stack time to clear any pending operations
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 1. Resize image to square (122x122) for left side of split display
      // Display is 250x122, so left side will be 122x122 (square), right side 128x122 for text
      const squareSize = 122;
      console.log(`Resizing image to square: ${squareSize}x${squareSize}`);
      
      // 2. Resize to square (crops to center if needed)
      const manipResult = await manipulateAsync(
        generatedImageUrl,
        [{ resize: { width: squareSize, height: squareSize } }],
        { compress: 1, format: SaveFormat.PNG, base64: false }
      );

      // 4. Fetch the resized image as ArrayBuffer
      const response = await fetch(manipResult.uri);
      const arrayBuffer = await response.arrayBuffer();

      // 5. Decode PNG to RGBA using UPNG
      const png = UPNG.decode(arrayBuffer);
      const rgba = UPNG.toRGBA8(png)[0]; // UPNG returns array of frames, get first
      const data = new Uint8Array(rgba);
      
      const width = png.width;
      const height = png.height;
      
      console.log(`Processing image: ${width}x${height}`);

      // 6. Convert to grayscale with proper luminance weights (better quality)
      const grayscale = new Float32Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        // Use ITU-R BT.709 luminance weights for better quality
        grayscale[i] = r * 0.2126 + g * 0.7152 + b * 0.0722;
      }

      // 6.5. Apply contrast enhancement for better e-ink display
      // Find min/max for adaptive contrast
      let min = 255, max = 0;
      for (let i = 0; i < grayscale.length; i++) {
        if (grayscale[i] < min) min = grayscale[i];
        if (grayscale[i] > max) max = grayscale[i];
      }
      
      // Apply contrast stretch if there's room for improvement
      if (max - min > 50) {
        const contrastFactor = 255 / (max - min);
        for (let i = 0; i < grayscale.length; i++) {
          grayscale[i] = (grayscale[i] - min) * contrastFactor;
          // Clamp to 0-255
          grayscale[i] = Math.max(0, Math.min(255, grayscale[i]));
        }
      }

      // 7. Apply Floyd-Steinberg dithering for better visual quality
      const dithered = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const oldPixel = grayscale[idx];
          const newPixel = oldPixel < 128 ? 0 : 255;
          dithered[idx] = newPixel;
          
          const error = oldPixel - newPixel;
          
          // Distribute error to neighboring pixels (Floyd-Steinberg)
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

      // 8. Convert dithered image to 1-bit packed binary
      const binaryData = new Uint8Array(Math.ceil((width * height) / 8));
      
      for (let i = 0; i < width * height; i++) {
        // dithered[i] == 0 means black (1), 255 means white (0)
        if (dithered[i] < 128) {
          // Set bit to 1 for black
          const byteIndex = Math.floor(i / 8);
          const bitIndex = 7 - (i % 8); // MSB first
          binaryData[byteIndex] |= (1 << bitIndex);
        }
      }

      // 5. Send Start Command with prompt text
      const startCmd = JSON.stringify({ 
        cmd: "image_start", 
        w: width, 
        h: height,
        len: binaryData.length,
        prompt: aiPrompt.trim() // Include the prompt text
      }) + "\n";
      
      // Verify char is still valid before sending
      if (!char.isWritableWithoutResponse && !char.isWritableWithResponse) {
        throw new Error("Characteristic is no longer writable");
      }
      
      await char.writeWithoutResponse(Buffer.from(startCmd).toString("base64"));
      
      // Wait a bit for device to get ready
      await new Promise(resolve => setTimeout(resolve, 200));

      // 6. Send chunks
      const CHUNK_SIZE = 180; // Safe BLE MTU
      let offset = 0;
      
      while (offset < binaryData.length) {
        // Verify connection before each chunk
        if (!connectedDevice.isConnected()) {
          throw new Error("Device disconnected during transmission");
        }
        
        const end = Math.min(offset + CHUNK_SIZE, binaryData.length);
        const chunk = binaryData.slice(offset, end);
        // Convert chunk to Base64
        const base64Chunk = Buffer.from(chunk).toString("base64");
        
        try {
          await char.writeWithoutResponse(base64Chunk);
        } catch (chunkError: any) {
          console.error(`Error sending chunk at offset ${offset}:`, chunkError);
          // Try to re-acquire characteristic
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
        // Small delay to prevent flooding
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      console.log(`Image sent completely: ${width}x${height} (square, left side with prompt on right)`);
      Alert.alert("Success", `Image sent to badge!\n${width}x${height} square (left) + prompt (right)`);
      
    } catch (e: any) {
      console.error("Send Image Error:", e);
      Alert.alert("Error", "Failed to send image: " + e.message);
    } finally {
      setIsSendingImage(false);
    }
  };

  const deviceList = Object.values(devices);

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🔮 Oracle Badge</Text>
          <View style={[styles.statusBadge, connectedDevice && styles.statusBadgeConnected]}>
            <View style={[styles.statusDot, connectedDevice && styles.statusDotConnected]} />
            <Text style={styles.statusText}>
              {connectedDevice
                ? `Connected${rssi !== null ? ` (${rssi} dBm)` : ""}`
                : isConnecting
                ? `Connecting...${connectionRetryCount > 0 ? ` (${connectionRetryCount + 1})` : ""}`
                : "Disconnected"}
            </Text>
          </View>
        </View>

        {/* Connection Section */}
        <View style={styles.card}>
          {!connectedDevice ? (
            <>
              {autoconnectFailed && (
                <View style={styles.autoconnectFailedMessage}>
                  <Text style={styles.autoconnectFailedText}>
                    ⚠️ Autoconnect failed. Please scan manually to find your badge.
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.primaryButton, (isScanning || isConnecting) && styles.primaryButtonDisabled]}
                onPress={startScan}
                disabled={isScanning || isConnecting}
              >
                {isScanning ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>Scanning...</Text>
                  </>
                ) : (
                  <Text style={styles.primaryButtonText}>🔍 Scan for Badge</Text>
                )}
              </TouchableOpacity>

              {deviceList.length > 0 && (
                <View style={styles.deviceList}>
                  <Text style={styles.deviceListHeader}>
                    Found {deviceList.length} device{deviceList.length !== 1 ? 's' : ''}
                  </Text>
                  {deviceList.map((item) => {
                    const isLikelyBadge = (item.name && item.name.includes("Fausto")) || 
                                          ((item as any).localName && (item as any).localName.includes("Fausto"));
                    
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.deviceItem, isLikelyBadge && styles.deviceItemHighlighted]}
                        onPress={() => connectToDevice(item)}
                        disabled={isConnecting}
                      >
                        <View style={styles.deviceItemContent}>
                          <Text style={styles.deviceName}>
                            {item.name || (item as any).localName || "Unnamed Device"}
                            {isLikelyBadge && " ⭐"}
                          </Text>
                          <Text style={styles.deviceId}>{item.id}</Text>
                          {item.rssi !== null && item.rssi !== undefined && (
                            <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={disconnect}
            >
              <Text style={styles.secondaryButtonText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Generation Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✨ Generate</Text>
          
          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
             <TouchableOpacity 
               style={[styles.modeButton, generationMode === "text" && styles.modeButtonActive]}
               onPress={() => setGenerationMode("text")}
             >
               <Text style={[styles.modeButtonText, generationMode === "text" && styles.modeButtonTextActive]}>Text</Text>
             </TouchableOpacity>
             <TouchableOpacity 
               style={[styles.modeButton, generationMode === "image" && styles.modeButtonActive]}
               onPress={() => setGenerationMode("image")}
             >
               <Text style={[styles.modeButtonText, generationMode === "image" && styles.modeButtonTextActive]}>Image</Text>
             </TouchableOpacity>
          </View>

          {!apiKey ? (
            <View style={styles.apiKeyPrompt}>
              <Text style={styles.hint}>Configure API key to generate content</Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowApiKeySection(true)}
              >
                <Text style={styles.linkButtonText}>Configure API Key →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>{generationMode === "text" ? "Your Dilemma" : "Image Prompt"}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder={generationMode === "text" ? "Share your dilemma..." : "Describe an image..."}
                multiline
                numberOfLines={4}
                placeholderTextColor="#999"
              />

              {/* Aspect Ratio Selector for Image Mode */}
              {generationMode === "image" && (
                <View style={styles.aspectRatioContainer}>
                  <Text style={styles.label}>Aspect Ratio</Text>
                  <View style={styles.aspectRatioButtons}>
                    {[
                      { value: "21:9", label: "Badge (21:9)", description: "Closest to badge display" },
                      { value: "16:9", label: "Wide (16:9)", description: "Landscape" },
                      { value: "1:1", label: "Square (1:1)", description: "Classic" },
                      { value: "4:3", label: "Standard (4:3)", description: "Traditional" },
                      { value: "3:4", label: "Portrait (3:4)", description: "Vertical" },
                    ].map((ratio) => (
                      <TouchableOpacity
                        key={ratio.value}
                        style={[
                          styles.aspectRatioButton,
                          imageAspectRatio === ratio.value && styles.aspectRatioButtonActive,
                        ]}
                        onPress={() => setImageAspectRatio(ratio.value)}
                      >
                        <Text
                          style={[
                            styles.aspectRatioButtonText,
                            imageAspectRatio === ratio.value && styles.aspectRatioButtonTextActive,
                          ]}
                        >
                          {ratio.label}
                        </Text>
                        <Text style={styles.aspectRatioDescription}>{ratio.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, (isGenerating || !aiPrompt.trim()) && styles.primaryButtonDisabled]}
                onPress={generateAIContent}
                disabled={isGenerating || !aiPrompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>Generating...</Text>
                  </>
                ) : (
                  <Text style={styles.primaryButtonText}>🔮 Generate {generationMode === "text" ? "& Send" : "Image"}</Text>
                )}
              </TouchableOpacity>

              {/* Image Preview & Send */}
              {generationMode === "image" && generatedImageUrl && (
                <View style={styles.imagePreviewContainer}>
                  <Text style={styles.label}>Preview (Badge: 250×122px):</Text>
                  <View style={styles.badgePreviewFrame}>
                    <Image 
                      source={{ uri: generatedImageUrl }} 
                      style={styles.generatedImage} 
                      resizeMode="contain"
                    />
                    <View style={styles.badgePreviewOverlay}>
                      <Text style={styles.badgePreviewText}>Badge Display Area</Text>
                    </View>
                  </View>
                  <Text style={styles.hint}>
                    Image will be resized to fit badge display while preserving aspect ratio
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.sendImageButton, (!connectedDevice || isSendingImage) && styles.primaryButtonDisabled]}
                    onPress={sendImageToBadge}
                    disabled={!connectedDevice || isSendingImage}
                  >
                     {isSendingImage ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                          <Text style={styles.primaryButtonText}>Sending...</Text>
                        </>
                     ) : (
                        <Text style={styles.primaryButtonText}>📲 Send to E-ink</Text>
                     )}
                  </TouchableOpacity>
                </View>
              )}

              {generationMode === "text" && !connectedDevice && (
                <Text style={styles.hint}>Connect to badge first to send text</Text>
              )}
            </>
          )}
        </View>

        {/* API Key Settings */}
        {showApiKeySection && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>⚙️ API Settings</Text>
              <TouchableOpacity onPress={() => setShowApiKeySection(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="sk-or-v1-..."
              secureTextEntry={true}
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={saveApiKey}>
                <Text style={styles.secondaryButtonText}>Save</Text>
              </TouchableOpacity>
              {apiKey && (
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={async () => {
                    try {
                      await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
                      setApiKey("");
                      setApiKeyInput("");
                      setShowApiKeySection(false);
                      Alert.alert("Success", "API key cleared");
                    } catch (e: any) {
                      Alert.alert("Error", `Failed to clear API key: ${e.message}`);
                    }
                  }}
                >
                  <Text style={styles.dangerButtonText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.hint}>
              Get your API key from{" "}
              <Text style={styles.link} onPress={() => Linking.openURL("https://openrouter.ai")}>
                openrouter.ai
              </Text>
            </Text>
          </View>
        )}

        {!showApiKeySection && apiKey && (
          <TouchableOpacity
            style={styles.settingsLink}
            onPress={() => {
              setApiKeyInput(apiKey);
              setShowApiKeySection(true);
            }}
          >
            <Text style={styles.settingsLinkText}>⚙️ API Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { 
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  container: { 
    flex: 1, 
    padding: 20, 
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  title: { 
    fontSize: 32, 
    fontWeight: "700", 
    marginBottom: 12,
    color: "#1d1d1f",
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusBadgeConnected: {
    backgroundColor: "#e8f5e9",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#999",
    marginRight: 8,
  },
  statusDotConnected: {
    backgroundColor: "#4caf50",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1d1d1f",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fafafa",
    fontSize: 16,
    color: "#1d1d1f",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 8,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: "#cbd5e1",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  secondaryButtonText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  dangerButtonText: {
    color: "#dc2626",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  deviceList: {
    marginTop: 16,
  },
  deviceListHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
    textAlign: "center",
  },
  deviceItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  deviceItemHighlighted: {
    borderColor: "#6366f1",
    borderWidth: 2,
    backgroundColor: "#eef2ff",
  },
  deviceItemContent: {
    flex: 1,
  },
  deviceName: {
    fontWeight: "600",
    fontSize: 16,
    color: "#1d1d1f",
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 11,
    color: "#999",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 4,
  },
  deviceRssi: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  hint: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    textAlign: "center",
  },
  link: {
    color: "#6366f1",
    fontWeight: "600",
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  colorInput: {
    flex: 1,
  },
  colorPreview: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  apiKeyPrompt: {
    alignItems: "center",
    paddingVertical: 20,
  },
  linkButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  linkButtonText: {
    color: "#6366f1",
    fontSize: 15,
    fontWeight: "600",
  },
  settingsLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  settingsLinkText: {
    color: "#6366f1",
    fontSize: 14,
    fontWeight: "500",
  },
  closeButton: {
    fontSize: 20,
    color: "#999",
    fontWeight: "300",
  },
  charCounter: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  charCounterWarning: {
    color: "#dc2626",
  },
  inputWarning: {
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  warningText: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: -8,
    marginBottom: 8,
    fontWeight: "500",
  },
  autoconnectFailedMessage: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  autoconnectFailedText: {
    fontSize: 14,
    color: "#92400e",
    lineHeight: 20,
  },
  // New Styles
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeButtonText: {
    fontWeight: "600",
    color: "#64748b",
    fontSize: 14,
  },
  modeButtonTextActive: {
    color: "#6366f1",
  },
  imagePreviewContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  badgePreviewFrame: {
    width: 250,
    height: 122,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#6366f1",
    borderStyle: "dashed",
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  generatedImage: {
    width: "100%",
    height: "100%",
  },
  badgePreviewOverlay: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: "rgba(99, 102, 241, 0.8)",
    padding: 4,
    borderRadius: 4,
  },
  badgePreviewText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  aspectRatioContainer: {
    marginTop: 12,
    marginBottom: 12,
  },
  aspectRatioButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  aspectRatioButton: {
    flex: 1,
    minWidth: "30%",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  aspectRatioButtonActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#6366f1",
    borderWidth: 2,
  },
  aspectRatioButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 2,
  },
  aspectRatioButtonTextActive: {
    color: "#6366f1",
  },
  aspectRatioDescription: {
    fontSize: 10,
    color: "#94a3b8",
    textAlign: "center",
  },
  sendImageButton: {
    width: "100%",
    backgroundColor: "#10b981", // Green for send
    shadowColor: "#10b981",
  },
});
