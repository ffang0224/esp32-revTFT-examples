import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useDilemma } from "../../contexts";
import { generateDilemmaSuggestions } from "../../services/openrouter";
import { colors, spacing, borderRadius, typography, shadows } from "../../constants/design";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API_KEY_STORAGE_KEY = "openrouter_api_key";

export default function DilemmaScreen() {
  const router = useRouter();
  const { draft, setDraftText } = useDilemma();
  const [localText, setLocalText] = useState(draft.text || "");
  const [apiKey, setApiKey] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(40)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputScale = useRef(new Animated.Value(0.9)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(30)).current;
  const suggestionsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadApiKey();

    // Staggered entrance animations
    Animated.stagger(150, [
      // Header fades in
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      // Title slides up
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
      // Input fades and scales in
      Animated.parallel([
        Animated.timing(inputOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.spring(inputScale, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      // Suggestions fade in
      Animated.timing(suggestionsOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      // Button slides up
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(buttonTranslateY, {
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

  const loadSuggestions = useCallback(async () => {
    if (isLoadingSuggestions) return;

    setIsLoadingSuggestions(true);
    try {
      const newSuggestions = await generateDilemmaSuggestions(apiKey, 4);
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    } catch (e) {
      console.log("Failed to load suggestions:", e);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [apiKey, isLoadingSuggestions]);

  const handleSuggestionPress = (suggestion: string) => {
    setLocalText(suggestion);
    setShowSuggestions(false);
  };

  const handleNext = () => {
    if (localText.trim()) {
      setDraftText(localText.trim());
      router.push("/create/value1");
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
          </View>
          <View style={styles.placeholder} />
        </Animated.View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <Text style={styles.stepLabel}>Step 1 of 5</Text>
            <Text style={styles.title}>What's your dilemma?</Text>
            <Text style={styles.subtitle}>
              Describe the decision or situation you're facing
            </Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: inputOpacity,
              transform: [{ scale: inputScale }],
            }}
          >
            <TextInput
              style={styles.input}
              value={localText}
              onChangeText={setLocalText}
              placeholder="I'm torn between..."
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Suggestions Section */}
          <Animated.View style={[styles.suggestionsContainer, { opacity: suggestionsOpacity }]}>
            {!showSuggestions ? (
              <TouchableOpacity
                style={styles.suggestionToggle}
                onPress={loadSuggestions}
                disabled={isLoadingSuggestions}
              >
                <Text style={styles.suggestionToggleText}>
                  {isLoadingSuggestions ? "Loading..." : "Need inspiration?"}
                </Text>
                <Text style={styles.suggestionToggleIcon}>💡</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <View style={styles.suggestionsHeader}>
                  <Text style={styles.suggestionsTitle}>Quick suggestions</Text>
                  <TouchableOpacity onPress={loadSuggestions} disabled={isLoadingSuggestions}>
                    <Text style={styles.refreshText}>
                      {isLoadingSuggestions ? "..." : "↻ Refresh"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.suggestionsList}>
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionChip}
                      onPress={() => handleSuggestionPress(suggestion)}
                    >
                      <Text style={styles.suggestionChipText} numberOfLines={2}>
                        {suggestion}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.hideSuggestions}
                  onPress={() => setShowSuggestions(false)}
                >
                  <Text style={styles.hideSuggestionsText}>Hide suggestions</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        <Animated.View
          style={[
            styles.footer,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslateY }],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.nextButton, !localText.trim() && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!localText.trim()}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  closeText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  progressContainer: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  stepLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: colors.text,
    lineHeight: 28,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    minHeight: 120,
    maxHeight: 200,
  },
  suggestionsContainer: {
    marginTop: spacing.lg,
  },
  suggestionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    backgroundColor: colors.infoBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.info,
    gap: spacing.sm,
  },
  suggestionToggleText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.info,
  },
  suggestionToggleIcon: {
    fontSize: 16,
  },
  suggestionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  suggestionsTitle: {
    ...typography.caption,
    fontSize: 12,
  },
  refreshText: {
    fontSize: 12,
    color: colors.info,
    fontWeight: "500",
  },
  suggestionsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  suggestionChip: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "48%",
    ...shadows.sm,
  },
  suggestionChipText: {
    fontSize: 13,
    color: colors.text,
  },
  hideSuggestions: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  hideSuggestionsText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  nextButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "600",
  },
});
