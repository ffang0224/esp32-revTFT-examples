import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, spacing, borderRadius, typography, shadows } from "../constants/design";

interface StatusChipProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "glimpse";
  icon?: string;
  animated?: boolean;
}

export function StatusChip({
  label,
  variant = "default",
  icon,
  animated = false,
}: StatusChipProps) {
  const getColors = () => {
    switch (variant) {
      case "success":
        return { bg: colors.successBg, text: colors.success, border: colors.success };
      case "warning":
        return { bg: colors.warningBg, text: colors.warning, border: colors.warning };
      case "error":
        return { bg: colors.errorBg, text: colors.error, border: colors.error };
      case "info":
        return { bg: colors.infoBg, text: colors.info, border: colors.info };
      case "glimpse":
        return { bg: colors.accentLight, text: colors.glimpse, border: colors.glimpse };
      default:
        return { bg: colors.card, text: colors.textMuted, border: colors.border };
    }
  };

  const { bg, text, border } = getColors();

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderColor: variant === "glimpse" ? colors.glimpse : border,
          borderWidth: variant === "glimpse" ? 1 : 0,
        },
      ]}
    >
      {icon && <Text style={[styles.icon, { color: text }]}>{icon}</Text>}
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );

  if (animated) {
    return (
      <Animated.View style={[styles.animatedContainer, shadows.sm]}>
        {content}
      </Animated.View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    ...shadows.sm,
  },
  animatedContainer: {
    borderRadius: borderRadius.full,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    ...typography.chip,
    fontSize: 12,
  },
});
