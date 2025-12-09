import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useBle, useDilemma } from "../contexts";
import { colors, spacing, borderRadius, typography, shadows } from "../constants/design";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function DilemmaScreen() {
  const router = useRouter();
  const { connectedDevice, isConnecting, connectionRetryCount, rssi } = useBle();
  const { dilemmas, currentDilemma, setCurrentDilemma, clearDraft } = useDilemma();
  
  // State for creation animation
  const [isCreating, setIsCreating] = useState(false);

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;
  const stickyNoteScale = useRef(new Animated.Value(0.8)).current;
  const stickyNoteOpacity = useRef(new Animated.Value(0)).current;
  const mainCardScale = useRef(new Animated.Value(0.9)).current;
  const mainCardOpacity = useRef(new Animated.Value(0)).current;
  const createFadeOpacity = useRef(new Animated.Value(1)).current;
  const contentFadeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      // Header fades in first
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
      // Sticky note bounces in
      Animated.parallel([
        Animated.spring(stickyNoteScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(stickyNoteOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // Main card fades in
      Animated.parallel([
        Animated.spring(mainCardScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(mainCardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleCreateNew = () => {
    // Start fade animation
    setIsCreating(true);
    
    Animated.sequence([
      // Fade out the "+" create content
      Animated.timing(createFadeOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start(() => {
      clearDraft();
      router.push("/create/dilemma");
      // Reset for next time
      setTimeout(() => {
        setIsCreating(false);
        createFadeOpacity.setValue(1);
      }, 500);
    });
  };

  const handleDilemmaPress = () => {
    if (currentDilemma) {
      router.push(`/create/prophecy?id=${currentDilemma.id}`);
    }
  };

  const handleStickyNotePress = () => {
    // Cycle through dilemmas or show gallery
    if (dilemmas.length > 1) {
      const currentIndex = dilemmas.findIndex(d => d.id === currentDilemma?.id);
      const nextIndex = (currentIndex + 1) % dilemmas.length;
      setCurrentDilemma(dilemmas[nextIndex]);
    } else if (dilemmas.length === 1) {
      handleDilemmaPress();
    }
  };

  const getConnectionStatus = () => {
    if (connectedDevice) {
      return {
        text: rssi ? `Connected (${rssi}dBm)` : "Connected",
        color: colors.success,
        dotColor: colors.success,
      };
    }
    if (isConnecting) {
      return {
        text: connectionRetryCount > 0 
          ? `Connecting (${connectionRetryCount + 1})...` 
          : "Connecting...",
        color: colors.warning,
        dotColor: colors.warning,
      };
    }
    return {
      text: "Disconnected",
      color: colors.textMuted,
      dotColor: colors.textMuted,
    };
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const status = getConnectionStatus();
  const hasDilemma = currentDilemma !== null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.statusContainer}>
            <Animated.View style={[styles.statusDot, { backgroundColor: status.dotColor }]} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.text}
            </Text>
            {isConnecting && (
              <ActivityIndicator
                size="small"
                color={status.color}
                style={styles.statusLoader}
              />
            )}
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push("/settings")}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Top Sticky Note Preview */}
        <Animated.View
          style={[
            styles.stickyNoteContainer,
            {
              opacity: stickyNoteOpacity,
              transform: [{ scale: stickyNoteScale }],
            },
          ]}
        >
          <TouchableOpacity 
            style={styles.stickyNote}
            onPress={handleStickyNotePress}
            activeOpacity={0.9}
          >
            {hasDilemma && currentDilemma.prophecy?.text ? (
              <Text style={styles.stickyNoteText} numberOfLines={3}>
                {currentDilemma.prophecy.text.substring(0, 60)}...
              </Text>
            ) : (
              <View style={styles.stickyNoteEmpty} />
            )}
          </TouchableOpacity>
          {dilemmas.length > 1 && (
            <View style={styles.dilemmaCounter}>
              <Text style={styles.dilemmaCounterText}>
                {dilemmas.findIndex(d => d.id === currentDilemma?.id) + 1}/{dilemmas.length}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Main Dilemma Card */}
        <Animated.View
          style={[
            styles.mainCardContainer,
            {
              opacity: mainCardOpacity,
              transform: [{ scale: mainCardScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.mainCard}
            onPress={hasDilemma ? handleDilemmaPress : handleCreateNew}
            activeOpacity={0.9}
          >
            {hasDilemma ? (
              // Show existing dilemma
              <Animated.View style={[styles.dilemmaContent, { opacity: contentFadeOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1],
              }) }]}>
                <View style={styles.dilemmaHeader}>
                  {currentDilemma.prophecy?.text && (
                    <View style={styles.prophecyBadge}>
                      <Text style={styles.prophecyBadgeText}>✨</Text>
                    </View>
                  )}
                </View>
                <View style={styles.dilemmaBody}>
                  <Text style={styles.dilemmaText} numberOfLines={6}>
                    {currentDilemma.text}
                  </Text>
                </View>
                <View style={styles.dilemmaFooter}>
                  <Text style={styles.dilemmaDate}>
                    {formatDate(currentDilemma.createdAt)}
                  </Text>
                  <Text style={styles.tapHint}>Tap to view</Text>
                </View>
              </Animated.View>
            ) : (
              // Show create new
              <Animated.View style={[styles.createContent, { opacity: createFadeOpacity }]}>
                <View style={styles.plusIconContainer}>
                  <Text style={styles.plusIcon}>+</Text>
                </View>
                <View style={styles.createTextContainer}>
                  <Text style={styles.createTitle}>Solve</Text>
                  <Text style={styles.createSubtitle}>a dilemma</Text>
                </View>
              </Animated.View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Create New Button (when there's already a dilemma) */}
        {hasDilemma && (
          <TouchableOpacity
            style={styles.newDilemmaButton}
            onPress={handleCreateNew}
            activeOpacity={0.8}
          >
            <Text style={styles.newDilemmaButtonText}>+ New Dilemma</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
  },
  statusLoader: {
    marginLeft: spacing.sm,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  settingsIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  // Sticky Note Preview
  stickyNoteContainer: {
    marginBottom: spacing.lg,
  },
  stickyNote: {
    width: 120,
    height: 80,
    backgroundColor: "#FEF3C7", // Amber/yellow
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    ...shadows.md,
  },
  stickyNoteEmpty: {
    flex: 1,
  },
  stickyNoteText: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 14,
    fontWeight: "500",
  },
  dilemmaCounter: {
    position: "absolute",
    bottom: -8,
    right: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  dilemmaCounterText: {
    fontSize: 10,
    color: colors.card,
    fontWeight: "600",
  },
  // Main Card
  mainCardContainer: {
    flex: 1,
    maxHeight: screenHeight * 0.55,
  },
  mainCard: {
    flex: 1,
    backgroundColor: "#F5F5F0", // Cream/off-white
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  // Create New Content
  createContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  plusIconContainer: {
    alignItems: "flex-start",
  },
  plusIcon: {
    fontSize: 48,
    fontWeight: "300",
    color: colors.text,
    lineHeight: 56,
  },
  createTextContainer: {
    marginBottom: spacing.md,
  },
  createTitle: {
    fontSize: 28,
    fontWeight: "500",
    color: colors.text,
    letterSpacing: -0.5,
  },
  createSubtitle: {
    fontSize: 28,
    fontWeight: "500",
    color: colors.text,
    letterSpacing: -0.5,
  },
  // Existing Dilemma Content
  dilemmaContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  dilemmaHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  prophecyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  prophecyBadgeText: {
    fontSize: 16,
  },
  dilemmaBody: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  dilemmaText: {
    fontSize: 20,
    fontWeight: "500",
    color: colors.text,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  dilemmaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dilemmaDate: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  tapHint: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  // New Dilemma Button
  newDilemmaButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    alignItems: "center",
    ...shadows.sm,
  },
  newDilemmaButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.card,
  },
});
