import React from "react";
import { Stack } from "expo-router";
import { Buffer } from "buffer";
import { StatusBar } from "expo-status-bar";
import { BleProvider, DilemmaProvider } from "../contexts";

// Polyfill Buffer for react-native-ble-plx
(global as any).Buffer = (global as any).Buffer || Buffer;

export default function RootLayout() {
  return (
    <BleProvider>
      <DilemmaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#FAFAFA" },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="settings" />
          <Stack.Screen
            name="create"
            options={{
              animation: "slide_from_bottom",
            }}
          />
        </Stack>
      </DilemmaProvider>
    </BleProvider>
  );
}
