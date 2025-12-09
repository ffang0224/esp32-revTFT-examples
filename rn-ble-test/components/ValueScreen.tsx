import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useDilemma } from "../contexts";
import { colors, spacing, borderRadius, typography, shadows } from "../constants/design";

const VALUE_PROMPTS = [
  "What matters most to you in this situation?",
  "What else do you care deeply about?",
  "What's another important consideration?",
  "What's the last thing you value here?",
];

const VALUE_PLACEHOLDERS = [
  "e.g., Financial security",
  "e.g., Personal growth",
  "e.g., Family time",
  "e.g., Adventure",
];

interface ValueScreenProps {
  stepNumber: 1 | 2 | 3 | 4;
}

export function ValueScreen({ stepNumber }: ValueScreenProps) {
  const router = useRouter();
  const valueIndex = stepNumber - 1;

  const { draft, setDraftValue } = useDilemma();
  const [localValue, setLocalValue] = useState(
    draft.values?.[valueIndex] || ""
  );

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;
  const inputScale = useRef(new Animated.Value(0.95)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;
  const pillsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setLocalValue(draft.values?.[valueIndex] || "");
    
    // Reset and play animations
    headerOpacity.setValue(0);
    titleOpacity.setValue(0);
    titleTranslateY.setValue(30);
    inputOpacity.setValue(0);
    inputScale.setValue(0.95);
    buttonOpacity.setValue(0);
    buttonTranslateY.setValue(20);
    pillsOpacity.setValue(0);

    // Staggered entrance
    Animated.stagger(100, [
      // Header
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      // Title
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
      // Input
      Animated.parallel([
        Animated.timing(inputOpacity, {
          toValue: 1,
          duration: 400,
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
      // Previous values pills
      Animated.timing(pillsOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      // Button
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
  }, [stepNumber, draft.values, valueIndex]);

  const isLastStep = stepNumber === 4;
  const totalSteps = 5;
  const currentStep = stepNumber + 1;

  const handleNext = () => {
    if (localValue.trim()) {
      setDraftValue(valueIndex, localValue.trim());
      
      if (isLastStep) {
        router.push("/create/prophecy");
      } else {
        router.push(`/create/value${stepNumber + 1}` as any);
      }
    }
  };

  const handleBack = () => {
    if (stepNumber === 1) {
      router.push("/create/dilemma");
    } else {
      router.push(`/create/value${stepNumber - 1}` as any);
    }
  };

  const renderProgressDots = () => {
    const dots = [];
    for (let i = 0; i < totalSteps; i++) {
      const isActive = i < currentStep;
      const isCurrent = i === currentStep - 1;
      dots.push(
        <Animated.View
          key={i}
          style={[
            styles.progressDot,
            isActive && styles.progressDotActive,
            isCurrent && styles.progressDotCurrent,
          ]}
        />
      );
    }
    return dots;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.progressContainer}>{renderProgressDots()}</View>
          <View style={styles.placeholder} />
        </Animated.View>

        <View style={styles.content}>
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <Text style={styles.stepLabel}>Step {currentStep} of {totalSteps}</Text>
            <Text style={styles.title}>{VALUE_PROMPTS[valueIndex]}</Text>
            <Text style={styles.subtitle}>
              Value {stepNumber} of 4 — Think about what you truly care about
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
              value={localValue}
              onChangeText={setLocalValue}
              placeholder={VALUE_PLACEHOLDERS[valueIndex]}
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType={isLastStep ? "done" : "next"}
              onSubmitEditing={handleNext}
            />
          </Animated.View>

          {valueIndex > 0 && (
            <Animated.View style={[styles.previousValues, { opacity: pillsOpacity }]}>
              <Text style={styles.previousTitle}>Your values so far:</Text>
              {draft.values?.slice(0, valueIndex).map((value, idx) => (
                <AnimatedPill key={idx} value={value} delay={idx * 80} />
              ))}
            </Animated.View>
          )}
        </View>

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
            style={[styles.nextButton, !localValue.trim() && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!localValue.trim()}
          >
            <Text style={styles.nextButtonText}>
              {isLastStep ? "Generate Prophecy" : "Continue"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AnimatedPill({ value, delay }: { value: string; delay: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 150,
        friction: 10,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.previousValuePill,
        { opacity, transform: [{ scale }] },
      ]}
    >
      <Text style={styles.previousValueText}>{value}</Text>
    </Animated.View>
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
  },
  progressDotCurrent: {
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
    ...typography.heading,
    marginBottom: spacing.sm,
    lineHeight: 32,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  input: {
    fontSize: 20,
    color: colors.text,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    fontWeight: "500",
  },
  previousValues: {
    marginTop: spacing.xl,
  },
  previousTitle: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  previousValuePill: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xs,
    alignSelf: "flex-start",
  },
  previousValueText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
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
