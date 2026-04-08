import React from "react";
import { Stack } from "expo-router";
import { Buffer } from "buffer";
import { StatusBar } from "expo-status-bar";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Text,
  Animated,
  TouchableOpacity,
} from "react-native";
import { useFonts } from "expo-font";
import { BleProvider, DilemmaProvider, useBle } from "../contexts";
import { colors, spacing, shadows, typography, borderRadius } from "../constants/design";

// Polyfill Buffer for react-native-ble-plx
(global as any).Buffer = (global as any).Buffer || Buffer;

// Global Status Bar Component
function GlobalStatusBar() {
  const { connectedDevice, rssi, batteryData, transferState, isFetchingBattery, fetchBatteryData } = useBle();

  const [visible, setVisible] = React.useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Show status bar when connected or during transfer
    const shouldShow = connectedDevice !== null || transferState.stage !== "idle";

    if (shouldShow && !visible) {
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (!shouldShow && visible) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [connectedDevice, transferState.stage, visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.statusBar, { opacity: fadeAnim }]}>
      <SafeAreaView style={styles.statusSafeArea}>
        <View style={styles.statusContent}>
          {/* Connection Status */}
          <View style={styles.statusSection}>
            <View style={[
              styles.statusDot,
              { backgroundColor: connectedDevice ? colors.success : colors.textMuted }
            ]} />
            <Text style={styles.statusText}>
              {connectedDevice ? "Connected" : "Disconnected"}
            </Text>
            {rssi !== null && connectedDevice && (
              <Text style={styles.rssiText}>{rssi}dBm</Text>
            )}
          </View>

          {/* Transfer Status */}
          {transferState.stage !== "idle" && (
            <View style={styles.transferSection}>
              <View style={styles.transferBadge}>
                <Text style={styles.transferEmoji}>
                  {transferState.stage === "done" ? "✓" :
                   transferState.stage === "error" ? "✕" : "↑"}
                </Text>
                <Text style={styles.transferText}>
                  {transferState.stage === "done" ? "Sent" :
                   transferState.stage === "error" ? "Failed" :
                   transferState.progress > 0 ? `${transferState.progress}%` : "Sending..."}
                </Text>
              </View>
            </View>
          )}

          {/* Battery Status */}
          {batteryData && connectedDevice && (
            <TouchableOpacity
              onPress={fetchBatteryData}
              disabled={isFetchingBattery}
              style={styles.batterySection}
            >
              <Text style={[
                styles.batteryText,
                batteryData.pct > 50 ? { color: colors.batteryHigh } :
                batteryData.pct > 20 ? { color: colors.batteryMedium } :
                { color: colors.batteryLow }
              ]}>
                {isFetchingBattery ? "..." : `${Math.round(batteryData.pct)}%`}
              </Text>
              <Text style={styles.batteryIcon}>
                {batteryData.pct > 75 ? "▮▮▮▮" :
                 batteryData.pct > 50 ? "▮▮▮▯" :
                 batteryData.pct > 25 ? "▮▮▯▯" :
                 batteryData.pct > 10 ? "▮▯▯▯" : "▯▯▯▯"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function RootLayoutContent() {
  const [fontsLoaded] = useFonts({
    "InstrumentSans-Regular": require("../assets/fonts/InstrumentSans-Regular.ttf"),
    "InstrumentSans-Medium": require("../assets/fonts/InstrumentSans-Medium.ttf"),
    "InstrumentSans-SemiBold": require("../assets/fonts/InstrumentSans-SemiBold.ttf"),
    "InstrumentSans-Bold": require("../assets/fonts/InstrumentSans-Bold.ttf"),
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#18181B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <GlobalStatusBar />
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
    </View>
  );
}

export default function RootLayout() {
  return (
    <BleProvider>
      <DilemmaProvider>
        <RootLayoutContent />
      </DilemmaProvider>
    </BleProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  statusBar: {
    backgroundColor: colors.card,
    ...shadows.md,
  },
  statusSafeArea: {
    backgroundColor: colors.card,
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  statusSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.small,
    fontWeight: "500",
  },
  rssiText: {
    ...typography.small,
    color: colors.textMuted,
  },
  transferSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  transferBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  transferEmoji: {
    fontSize: 12,
  },
  transferText: {
    ...typography.small,
    fontWeight: "600",
  },
  batterySection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  batteryText: {
    ...typography.small,
    fontWeight: "600",
  },
  batteryIcon: {
    fontSize: 10,
    letterSpacing: -1,
    color: colors.textMuted,
  },
});
