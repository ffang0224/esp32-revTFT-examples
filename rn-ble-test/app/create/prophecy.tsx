import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { useDilemma, useBle } from "../../contexts";
import { ProphecyPreview } from "../../components/ProphecyPreview";
import { generateProphecy, generateProphecyImage } from "../../services/openrouter";
import { colors, spacing, borderRadius, typography, shadows } from "../../constants/design";

const API_KEY_STORAGE_KEY = "openrouter_api_key";

export default function ProphecyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { draft, getDilemma, saveDraft, updateDilemma, setDraftProphecy, getRandomValueIndices } = useDilemma();
  const { connectedDevice, sendImageToBadge, isSendingImage } = useBle();

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
  
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

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
  }, []);

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

  const handleSendToBadge = async () => {
    if (!imageUrl || !prophecyText) {
      Alert.alert("Error", "Please generate a prophecy first");
      return;
    }

    if (!connectedDevice) {
      Alert.alert("Not Connected", "Please connect to your badge in Settings");
      return;
    }

    await sendImageToBadge(imageUrl, prophecyText);
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

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prophecy</Text>
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

        {/* Preview */}
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

        {/* Actions */}
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

          {prophecyText && imageUrl && (
            <Animated.View>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!connectedDevice || isSendingImage) && styles.buttonDisabled,
                ]}
                onPress={handleSendToBadge}
                disabled={!connectedDevice || isSendingImage}
              >
                {isSendingImage ? (
                  <>
                    <ActivityIndicator size="small" color={colors.card} />
                    <Text style={styles.sendButtonText}>Sending...</Text>
                  </>
                ) : (
                  <Text style={styles.sendButtonText}>
                    {connectedDevice ? "Send to Badge" : "Connect Badge First"}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
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
  headerTitle: {
    ...typography.subheading,
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
  sendButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.md,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.card,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
