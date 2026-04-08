import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  PanResponder,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { useDilemma, useBle } from "../../contexts";
import { ProphecyPreview } from "../../components/ProphecyPreview";
import { generateProphecy, generateProphecyImage } from "../../services/openrouter";
import { colors, spacing, borderRadius, typography, shadows } from "../../constants/design";

const API_KEY_STORAGE_KEY = "openrouter_api_key";
const { height: screenHeight } = Dimensions.get("window");

// Drag interaction constants
const DRAG_THRESHOLD_RATIO = 0.3; // fraction of screen height required to trigger send
const MAX_DRAG_RATIO = 0.6; // max fraction of screen height card can travel

export default function ProphecyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { draft, getDilemma, saveDraft, updateDilemma, setDraftProphecy, getRandomValueIndices } = useDilemma();
  const {
    connectedDevice,
    sendImageToBadge,
    isSendingImage,
    transferState,
    prepareImageBuffer,
    cancelTransfer,
    batteryData,
    fetchBatteryData,
  } = useBle();

  const existingDilemma = params.id ? getDilemma(params.id) : null;
  const dilemmaData = existingDilemma || draft;

  const [selectedValues, setSelectedValues] = useState<[number, number]>(
    existingDilemma?.prophecy?.usedValues || getRandomValueIndices()
  );
  const [prophecyText, setProphecyText] = useState(
    existingDilemma?.prophecy?.text || ""
  );
  const [imageUrl, setImageUrl] = useState(
    existingDilemma?.prophecy?.imageUrl || ""
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState("");

  // Send interaction state (drag-based)
  const [sendStage, setSendStage] = useState<"idle" | "dragging" | "sending" | "confirmed" | "error">("idle");

  // Precomputed image buffer
  const [preparedImage, setPreparedImage] = useState<{
    binaryData: Uint8Array;
    width: number;
    height: number;
  } | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const dilemmaCardOpacity = useRef(new Animated.Value(0)).current;
  const dilemmaCardTranslateY = useRef(new Animated.Value(30)).current;
  const valuesOpacity = useRef(new Animated.Value(0)).current;
  const valuesTranslateY = useRef(new Animated.Value(30)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewScale = useRef(new Animated.Value(0.9)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsTranslateY = useRef(new Animated.Value(30)).current;

  // Drag animation values
  const dragY = useRef(new Animated.Value(0)).current;
  const maxDrag = -screenHeight * MAX_DRAG_RATIO;
  const dragScale = dragY.interpolate({
    inputRange: [maxDrag, 0],
    outputRange: [0.9, 1],
    extrapolate: "clamp",
  });
  const dragOpacity = dragY.interpolate({
    inputRange: [maxDrag, 0],
    outputRange: [0.2, 1],
    extrapolate: "clamp",
  });
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sendButtonScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Drag gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!connectedDevice || !imageUrl || isSendingImage) return false;
        const { dy, dx } = gestureState;
        // Start when user drags upward more than a small threshold
        return dy < -10 && Math.abs(dy) > Math.abs(dx);
      },
      onPanResponderGrant: () => {
        if (!connectedDevice || !imageUrl || isSendingImage) return;
        setSendStage("dragging");
      },
      onPanResponderMove: (_, gestureState) => {
        if (!connectedDevice || !imageUrl || isSendingImage) return;
        const { dy } = gestureState;
        // Clamp to [maxDrag, 0]
        const clamped = Math.max(maxDrag, Math.min(0, dy));
        dragY.setValue(clamped);
      },
      onPanResponderRelease: async (_, gestureState) => {
        const { dy } = gestureState;
        const threshold = -screenHeight * DRAG_THRESHOLD_RATIO;

        if (dy <= threshold && connectedDevice && imageUrl && !isSendingImage) {
          // Commit send: finish drag upward, then trigger send
          Animated.timing(dragY, {
            toValue: maxDrag,
            duration: 180,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }).start();
          await executeSend();
        } else {
          // Not enough drag: snap back
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 10,
          }).start();
          setSendStage("idle");
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 10,
        }).start();
        setSendStage("idle");
      },
    })
  ).current;

  useEffect(() => {
    loadApiKey();

    // Entrance animations
    Animated.stagger(120, [
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.parallel([
        Animated.timing(dilemmaCardOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(dilemmaCardTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
      Animated.parallel([
        Animated.timing(valuesOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(valuesTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
      Animated.parallel([
        Animated.timing(previewOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.spring(previewScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(actionsOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(actionsTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
    ]).start();

    // Pulse animation for send button glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  }, []);

  // Sync with BLE transfer state
  useEffect(() => {
    if (transferState.stage === "done") {
      setSendStage("confirmed");
      // Success animation
      Animated.sequence([
        Animated.timing(sendButtonScale, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.spring(sendButtonScale, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (transferState.stage === "error") {
      setSendStage("error");
    } else if (transferState.stage === "sending_chunks" || transferState.stage === "waiting_ack") {
      setSendStage("sending");
    }
  }, [transferState.stage, sendButtonScale]);

  // Precompute image when generated
  useEffect(() => {
    if (imageUrl && !preparedImage && !isPreparing) {
      setIsPreparing(true);
      prepareImageBuffer(imageUrl).then((result) => {
        if (result) {
          setPreparedImage(result);
        }
        setIsPreparing(false);
      });
    }
  }, [imageUrl, preparedImage, isPreparing, prepareImageBuffer]);

  const loadApiKey = async () => {
    try {
      const envApiKey =
        Constants.expoConfig?.extra?.openRouterApiKey ||
        Constants.manifest?.extra?.openRouterApiKey ||
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

      if (envApiKey) {
        setApiKey(envApiKey);
      } else {
        const savedKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
        if (savedKey) {
          setApiKey(savedKey);
        }
      }
    } catch (e) {
      console.log("Error loading API key:", e);
    }
  };

  const handleRegenerate = () => {
    const newIndices = getRandomValueIndices();
    setSelectedValues(newIndices);
    setProphecyText("");
    setImageUrl("");
    setPreparedImage(null);
    setSendStage("idle");
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      Alert.alert(
        "API Key Required",
        "Please configure your OpenRouter API key in Settings",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Go to Settings", onPress: () => router.push("/settings") },
        ]
      );
      return;
    }

    if (!dilemmaData.text || !dilemmaData.values) {
      Alert.alert("Error", "Missing dilemma or values");
      return;
    }

    setIsGenerating(true);
    setPreparedImage(null);

    try {
      const value1 = dilemmaData.values[selectedValues[0]];
      const value2 = dilemmaData.values[selectedValues[1]];

      const { prophecyText: generatedText, imagePrompt } = await generateProphecy(
        apiKey,
        dilemmaData.text,
        value1,
        value2
      );

      setProphecyText(generatedText);

      const generatedImageUrl = await generateProphecyImage(apiKey, imagePrompt);
      setImageUrl(generatedImageUrl);

      const prophecy = {
        text: generatedText,
        imageUrl: generatedImageUrl,
        usedValues: selectedValues,
      };

      if (existingDilemma) {
        updateDilemma(existingDilemma.id, { prophecy });
      } else {
        setDraftProphecy(prophecy);
      }
    } catch (e: any) {
      console.error("Generation error:", e);
      Alert.alert("Error", e.message || "Failed to generate prophecy");
    } finally {
      setIsGenerating(false);
    }
  };

  const executeSend = async () => {
    // Fallback for tap-to-send as well as drag-commit
    if (!connectedDevice || !imageUrl || isSendingImage) return;
    setSendStage("sending");
    const success = await sendImageToBadge(imageUrl, prophecyText);
    if (!success) {
      setSendStage("error");
      setTimeout(() => setSendStage("idle"), 2000);
    }
  };

  const handleDone = () => {
    if (!existingDilemma && dilemmaData.text && dilemmaData.values?.every(v => v)) {
      if (prophecyText && imageUrl) {
        setDraftProphecy({
          text: prophecyText,
          imageUrl: imageUrl,
          usedValues: selectedValues,
        });
      }
      saveDraft();
    }
    router.push("/");
  };

  const handleBack = () => {
    if (existingDilemma) {
      router.back();
    } else {
      router.push("/create/value4");
    }
  };

  // Get send button state
  const getSendButtonState = () => {
    if (!connectedDevice) {
      return { text: "Connect Badge First", disabled: true, color: colors.textMuted };
    }
    if (!imageUrl || !prophecyText) {
      return { text: "Generate First", disabled: true, color: colors.textMuted };
    }
    if (sendStage === "dragging") {
      return { text: "Drag up to send", disabled: false, color: colors.accent };
    }
    if (sendStage === "sending") {
      const progress = transferState.progress || 0;
      return { text: `Sending ${progress}%`, disabled: true, color: colors.accent };
    }
    if (sendStage === "confirmed") {
      return { text: "Sent ✓", disabled: false, color: colors.success };
    }
    if (sendStage === "error") {
      return { text: "Failed - Retry", disabled: false, color: colors.error };
    }
    // Default idle state
    return { text: "Drag up to send", disabled: false, color: colors.success };
  };

  const sendButtonState = getSendButtonState();

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Glimpse</Text>
          {batteryData && (
            <TouchableOpacity onPress={fetchBatteryData} style={styles.batteryChip}>
              <Text style={styles.batteryText}>{batteryData.pct}%</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={handleDone} style={styles.doneButton}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Dilemma Card */}
        <Animated.View
          style={[
            styles.dilemmaCard,
            {
              opacity: dilemmaCardOpacity,
              transform: [{ translateY: dilemmaCardTranslateY }],
            },
          ]}
        >
          <Text style={styles.dilemmaLabel}>Your Dilemma</Text>
          <Text style={styles.dilemmaText}>{dilemmaData.text}</Text>
        </Animated.View>

        {/* Values */}
        <Animated.View
          style={[
            styles.valuesSection,
            {
              opacity: valuesOpacity,
              transform: [{ translateY: valuesTranslateY }],
            },
          ]}
        >
          <Text style={styles.valuesLabel}>Your Values</Text>
          <Text style={styles.valuesHint}>
            Prophecy uses the highlighted values
          </Text>
          <View style={styles.valuesGrid}>
            {dilemmaData.values?.map((value, index) => {
              const isSelected = selectedValues.includes(index);
              return (
                <AnimatedValuePill
                  key={index}
                  value={value}
                  isSelected={isSelected}
                  index={index}
                />
              );
            })}
          </View>
        </Animated.View>

        {/* Preview + Actions (draggable card) */}
        <Animated.View
          style={{
            transform: [{ translateY: dragY }, { scale: dragScale }],
            opacity: dragOpacity,
          }}
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.previewSection,
              {
                opacity: previewOpacity,
                transform: [{ scale: previewScale }],
              },
            ]}
          >
            <ProphecyPreview
              imageUrl={imageUrl || null}
              prophecyText={prophecyText}
              isLoading={isGenerating}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.actions,
              {
                opacity: actionsOpacity,
                transform: [{ translateY: actionsTranslateY }],
              },
            ]}
          >
          <TouchableOpacity
            style={[styles.regenerateButton, isGenerating && styles.buttonDisabled]}
            onPress={handleRegenerate}
            disabled={isGenerating}
          >
            <Text style={styles.regenerateButtonText}>Shuffle Values</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator size="small" color={colors.card} />
                <Text style={styles.generateButtonText}>Generating...</Text>
              </>
            ) : (
              <Text style={styles.generateButtonText}>
                {prophecyText ? "Regenerate Prophecy" : "Generate Prophecy"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Drag-up send interaction */}
          {prophecyText && imageUrl && (
            <View style={styles.sendButtonContainer}>
              {/* Progress indicator */}
              {sendStage === "sending" && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${transferState.progress}%` },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Send button */}
              <Animated.View
                style={{
                  transform: [{ scale: sendButtonState.disabled ? 1 : sendButtonScale }],
                }}
              >
                <Pressable
                  onPress={() => executeSend()}
                  disabled={sendButtonState.disabled}
                  style={({ pressed }) => [
                    styles.sendButton,
                    {
                      backgroundColor: sendButtonState.color,
                      opacity: pressed && !sendButtonState.disabled ? 0.9 : 1,
                    },
                  ]}
                >
                {sendStage === "sending" ? (
                  <>
                    <ActivityIndicator size="small" color={colors.card} />
                    <Text style={styles.sendButtonText}>{sendButtonState.text}</Text>
                  </>
                ) : sendStage === "confirmed" ? (
                  <>
                    <Text style={styles.sendButtonEmoji}>✓</Text>
                    <Text style={styles.sendButtonText}>{sendButtonState.text}</Text>
                  </>
                ) : sendStage === "error" ? (
                  <>
                    <Text style={styles.sendButtonEmoji}>✕</Text>
                    <Text style={styles.sendButtonText}>{sendButtonState.text}</Text>
                  </>
                ) : ( // idle / dragging
                  <>
                    <Text style={styles.sendButtonText}>{sendButtonState.text}</Text>
                    {(sendStage === "idle" || sendStage === "dragging") && connectedDevice && (
                      <Text style={styles.sendButtonHint}>drag card up to send</Text>
                    )}
                  </>
                )}
                </Pressable>
              </Animated.View>

              {/* Status messages */}
              {transferState.error && (
                <Text style={styles.errorText}>{transferState.error}</Text>
              )}
            </View>
          )}
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AnimatedValuePill({
  value,
  isSelected,
  index,
}: {
  value: string;
  isSelected: boolean;
  index: number;
}) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 150,
      friction: 10,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, [index]);

  return (
    <Animated.View
      style={[
        styles.valuePill,
        {
          transform: [{ scale }],
          backgroundColor: isSelected ? colors.accent : colors.card,
          borderColor: isSelected ? colors.accent : colors.border,
        },
      ]}
    >
      <Text style={[styles.valuePillText, { color: isSelected ? colors.card : colors.text }]}>
        {value}
      </Text>
      {isSelected && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  backText: {
    fontSize: 20,
    color: colors.text,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    ...typography.subheading,
  },
  batteryChip: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentLight,
    borderRadius: borderRadius.full,
  },
  batteryText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  doneButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  doneText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.accent,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  dilemmaCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  dilemmaLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  dilemmaText: {
    ...typography.body,
    fontWeight: "500",
  },
  valuesSection: {
    marginBottom: spacing.lg,
  },
  valuesLabel: {
    ...typography.subheading,
    marginBottom: spacing.xs,
  },
  valuesHint: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  valuesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  valuePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    ...shadows.sm,
  },
  valuePillText: {
    fontSize: 14,
    fontWeight: "500",
  },
  checkmark: {
    marginLeft: spacing.xs,
  },
  checkmarkText: {
    fontSize: 12,
    color: colors.card,
    fontWeight: "bold",
  },
  previewSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  actions: {
    gap: spacing.md,
  },
  regenerateButton: {
    backgroundColor: colors.accentLight,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  regenerateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  generateButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.md,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.card,
  },
  sendButtonContainer: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  glowRing: {
    position: "absolute",
    width: 200,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.success,
    opacity: 0,
  },
  chargeRing: {
    position: "absolute",
    width: 200,
    height: 60,
    borderRadius: borderRadius.md,
    borderWidth: 3,
    borderColor: colors.success,
  },
  sendButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.md,
    minWidth: 200,
    minHeight: 56,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.card,
  },
  sendButtonEmoji: {
    fontSize: 20,
  },
  sendButtonHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginLeft: spacing.xs,
  },
  progressContainer: {
    position: "absolute",
    top: -20,
    width: "100%",
    paddingHorizontal: spacing.xl,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  chargeIndicatorContainer: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  chargeBarBackground: {
    width: 150,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  chargeBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  chargeText: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },
  errorText: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.error,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
