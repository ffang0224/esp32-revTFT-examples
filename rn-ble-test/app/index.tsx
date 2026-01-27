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
import { colors, spacing, borderRadius, fonts, shadows } from "../constants/design";

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
  const dilemmaCardScale = useRef(new Animated.Value(0.8)).current;
  const dilemmaCardOpacity = useRef(new Animated.Value(0)).current;
  const createCardScale = useRef(new Animated.Value(0.9)).current;
  const createCardOpacity = useRef(new Animated.Value(0)).current;
  const createFadeOpacity = useRef(new Animated.Value(1)).current;

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
      // Dilemma card bounces in (if exists)
      Animated.parallel([
        Animated.spring(dilemmaCardScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(dilemmaCardOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // Create card fades in
      Animated.parallel([
        Animated.spring(createCardScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(createCardOpacity, {
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

  const handleCycleDilemma = () => {
    if (dilemmas.length > 1) {
      const currentIndex = dilemmas.findIndex(d => d.id === currentDilemma?.id);
      const nextIndex = (currentIndex + 1) % dilemmas.length;
      setCurrentDilemma(dilemmas[nextIndex]);
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
        {/* Yellow Sticky Note - Existing Dilemma (only shown when exists) */}
        {hasDilemma && (
          <Animated.View
            style={[
              styles.dilemmaCardContainer,
              {
                opacity: dilemmaCardOpacity,
                transform: [{ scale: dilemmaCardScale }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.dilemmaCard}
              onPress={handleDilemmaPress}
              onLongPress={handleCycleDilemma}
              activeOpacity={0.9}
            >
              <View style={styles.dilemmaContent}>
                <View style={styles.dilemmaHeader}>
                  {currentDilemma.prophecy?.text && (
                    <View style={styles.prophecyBadge}>
                      <Text style={styles.prophecyBadgeText}>✨</Text>
                    </View>
                  )}
                </View>
                <View style={styles.dilemmaBody}>
                  <Text style={styles.dilemmaText} numberOfLines={4}>
                    {currentDilemma.text}
                  </Text>
                </View>
                <View style={styles.dilemmaFooter}>
                  <Text style={styles.dilemmaDate}>
                    {formatDate(currentDilemma.createdAt)}
                  </Text>
                  {dilemmas.length > 1 && (
                    <Text style={styles.dilemmaCounter}>
                      {dilemmas.findIndex(d => d.id === currentDilemma?.id) + 1}/{dilemmas.length}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* White/Cream Card - Create New */}
        <Animated.View
          style={[
            hasDilemma ? styles.createCardContainerSmall : styles.createCardContainerFull,
            {
              opacity: createCardOpacity,
              transform: [{ scale: createCardScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.createCard}
            onPress={handleCreateNew}
            activeOpacity={0.9}
          >
            <Animated.View style={[styles.createContent, { opacity: createFadeOpacity }]}>
              <View style={styles.plusIconContainer}>
                <Text style={styles.plusIcon}>+</Text>
              </View>
              <View style={styles.createTextContainer}>
                <Text style={styles.createTitle}>Solve</Text>
                <Text style={styles.createSubtitle}>a dilemma</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
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
    fontFamily: fonts.medium,
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
  // Yellow Sticky Note - Existing Dilemma
  dilemmaCardContainer: {
    marginBottom: spacing.lg,
  },
  dilemmaCard: {
    backgroundColor: "#FEF3C7", // Amber/yellow
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    minHeight: 160,
    ...shadows.md,
  },
  dilemmaContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  dilemmaHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  prophecyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  prophecyBadgeText: {
    fontSize: 14,
  },
  dilemmaBody: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  dilemmaText: {
    fontSize: 18,
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  dilemmaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dilemmaDate: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  dilemmaCounter: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  // White/Cream Card - Create New
  createCardContainerFull: {
    flex: 1,
    maxHeight: screenHeight * 0.6,
  },
  createCardContainerSmall: {
    flex: 1,
    maxHeight: screenHeight * 0.45,
  },
  createCard: {
    flex: 1,
    backgroundColor: "#F5F5F0", // Cream/off-white
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  createContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  plusIconContainer: {
    alignItems: "flex-start",
  },
  plusIcon: {
    fontSize: 48,
    fontFamily: fonts.regular,
    color: colors.text,
    lineHeight: 56,
  },
  createTextContainer: {
    marginBottom: spacing.md,
  },
  createTitle: {
    fontSize: 28,
    fontFamily: fonts.medium,
    color: colors.text,
    letterSpacing: -0.5,
  },
  createSubtitle: {
    fontSize: 28,
    fontFamily: fonts.medium,
    color: colors.text,
    letterSpacing: -0.5,
  },
});
