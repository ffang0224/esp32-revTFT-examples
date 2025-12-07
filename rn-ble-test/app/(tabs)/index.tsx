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
    })();

    return () => {
      manager.destroy();
    };
  }, []);

  const handleDeviceConnection = useCallback(async (device: Device) => {
    try {
      console.log("Low-level connected:", device.id);

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

      console.log("Autoconnected successfully to", device.name || device.id);
    } catch (e: any) {
      console.log("Connection setup error:", e);
      try {
        await manager.cancelDeviceConnection(device.id);
      } catch {}
      setIsConnecting(false);
    }
  }, []);

  const autoConnect = useCallback(async () => {
    if (isConnecting || connectedDevice) return;

    try {
      console.log("Attempting autoconnect to", AUTO_CONNECT_DEVICE_ID);
      setAutoconnectFailed(false);
      setIsConnecting(true);

      // Try to connect directly first (works if device was previously connected)
      try {
        const device = await manager.connectToDevice(AUTO_CONNECT_DEVICE_ID, {
          timeout: 5000,
        });
        console.log("Direct connection successful:", device.id);
        await handleDeviceConnection(device);
        return;
      } catch (directError) {
        console.log("Direct connection failed, will scan:", directError);
      }

      // If direct connection fails, scan for the device
      let foundDevice: Device | null = null;
      const scanTimeout = setTimeout(() => {
        manager.stopDeviceScan();
        setIsScanning(false);
        if (!foundDevice) {
          console.log("Autoconnect: Device not found during scan");
          setIsConnecting(false);
          setAutoconnectFailed(true);
        }
      }, 10000); // 10 second scan timeout

      setIsScanning(true);
      manager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.log("Scan error during autoconnect:", error);
            clearTimeout(scanTimeout);
            setIsScanning(false);
            setIsConnecting(false);
            setAutoconnectFailed(true);
            return;
          }

          if (device && device.id === AUTO_CONNECT_DEVICE_ID) {
            foundDevice = device;
            clearTimeout(scanTimeout);
            manager.stopDeviceScan();
            setIsScanning(false);
            handleDeviceConnection(device);
          }
        }
      );
    } catch (e: any) {
      console.log("Autoconnect error:", e);
      setIsConnecting(false);
      setIsScanning(false);
      setAutoconnectFailed(true);
    }
  }, [isConnecting, connectedDevice, handleDeviceConnection]);

  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      console.log("BLE State updated:", state);
      if (state === "PoweredOn") {
        // Auto-connect to the target device
        setTimeout(() => {
          autoConnect();
        }, 1000); // Small delay to ensure BLE is fully ready
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

    try {
      // Scan for all devices (null)
      manager.startDeviceScan(
        null,
        { allowDuplicates: true },
        (error, device) => {
          if (error) {
            // Handle specific iOS error for "scanning too frequently" or "powered off"
            console.log("Scan callback error:", error);
            if (error.errorCode === 601) { // Location services disabled on Android
                // Handle location error
            }
            
            Alert.alert("Scan Error", error.message);
            setIsScanning(false);
            manager.stopDeviceScan();
            return;
          }
          
          if (device) {
            // Log only unique devices to avoid console spam
            // console.log("Scanned:", device.id, device.name);
            
            setDevices((prev) => {
              // Only update if new or name changed
              if (prev[device.id] && prev[device.id].name === device.name) return prev;
               
              // Log when we find a new device or one with a name
              if (!prev[device.id] || (!prev[device.id].name && device.name)) {
                 console.log("New/Updated Device:", device.id, device.name, device.localName);
              }
              
              return { ...prev, [device.id]: device };
            });
          }
        }
      );
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
        timeout: 8000,
      });

      await handleDeviceConnection(connected);
      setAutoconnectFailed(false);

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
        const imageUrl = await generateImage(apiKey, aiPrompt);
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
        char = chars.find(
          (c) =>
            c.uuid.toLowerCase() === UART_RX_UUID.toLowerCase() &&
            (c.isWritableWithoutResponse || c.isWritableWithResponse)
        );
        if (!char) {
          throw new Error("UART RX characteristic not found");
        }
        setUartRxChar(char);
      }

      // Small delay to ensure previous image processing is complete
      await new Promise(resolve => setTimeout(resolve, 300));
      // 1. First, get the original image dimensions to calculate aspect ratio
      const originalResponse = await fetch(generatedImageUrl);
      const originalArrayBuffer = await originalResponse.arrayBuffer();
      const originalPng = UPNG.decode(originalArrayBuffer);
      const originalAspectRatio = originalPng.width / originalPng.height;
      
      // 2. Calculate dimensions that fit within 250x122 while preserving aspect ratio
      const maxWidth = 250;
      const maxHeight = 122;
      let targetWidth = maxWidth;
      let targetHeight = maxHeight;
      
      if (originalAspectRatio > maxWidth / maxHeight) {
        // Image is wider - constrain by width
        targetWidth = maxWidth;
        targetHeight = Math.round(maxWidth / originalAspectRatio);
      } else {
        // Image is taller - constrain by height
        targetHeight = maxHeight;
        targetWidth = Math.round(maxHeight * originalAspectRatio);
      }
      
      console.log(`Original: ${originalPng.width}x${originalPng.height}, Aspect: ${originalAspectRatio.toFixed(2)}`);
      console.log(`Resizing to: ${targetWidth}x${targetHeight} (preserving aspect ratio)`);
      
      // 3. Resize preserving aspect ratio
      const manipResult = await manipulateAsync(
        generatedImageUrl,
        [{ resize: { width: targetWidth, height: targetHeight } }],
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

      // 5. Send Start Command
      const startCmd = JSON.stringify({ 
        cmd: "image_start", 
        w: width, 
        h: height,
        len: binaryData.length 
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
            char = chars.find(
              (c) =>
                c.uuid.toLowerCase() === UART_RX_UUID.toLowerCase() &&
                (c.isWritableWithoutResponse || c.isWritableWithResponse)
            );
            if (char) {
              setUartRxChar(char);
              await char.writeWithoutResponse(base64Chunk);
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

      console.log(`Image sent completely: ${width}x${height} (aspect ratio preserved)`);
      Alert.alert("Success", `Image sent to badge!\n${width}x${height} (centered on display)`);
      
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
                ? "Connected"
                : isConnecting
                ? "Connecting..."
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
                        <Text style={styles.deviceName}>
                          {item.name || (item as any).localName || "Unnamed Device"}
                          {isLikelyBadge && " ⭐"}
                        </Text>
                        <Text style={styles.deviceId}>{item.id.slice(0, 8)}...</Text>
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
                  <Text style={styles.label}>Preview:</Text>
                  <Image 
                    source={{ uri: generatedImageUrl }} 
                    style={styles.generatedImage} 
                    resizeMode="contain"
                  />
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
  deviceName: {
    fontWeight: "600",
    fontSize: 16,
    color: "#1d1d1f",
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: "#999",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
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
  generatedImage: {
    width: 250,
    height: 122,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 12,
  },
  sendImageButton: {
    width: "100%",
    backgroundColor: "#10b981", // Green for send
    shadowColor: "#10b981",
  },
});
