import React from "react";
import { Stack } from "expo-router";
import { Buffer } from "buffer";

// Polyfill Buffer for react-native-ble-plx
(global as any).Buffer = (global as any).Buffer || Buffer;

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Fausto BLE Badge" }} />
    </Stack>
  );
}
