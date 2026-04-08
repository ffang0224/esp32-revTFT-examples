import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, borderRadius, typography, getBatteryColor } from "../constants/design";

interface BatteryIndicatorProps {
  percentage: number;
  voltage?: number;
  temperature?: number | null;
  onPress?: () => void;
  compact?: boolean;
  showDetails?: boolean;
}

export function BatteryIndicator({
  percentage,
  voltage,
  temperature,
  onPress,
  compact = false,
  showDetails = false,
}: BatteryIndicatorProps) {
  const color = getBatteryColor(percentage);

  const getBatteryIcon = () => {
    if (percentage > 75) return "▮▮▮▮";
    if (percentage > 50) return "▮▮▮▯";
    if (percentage > 25) return "▮▮▯▯";
    if (percentage > 10) return "▮▯▯▯";
    return "▯▯▯▯";
  };

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.compactContainer, { borderColor: color }]}
        disabled={!onPress}
      >
        <Text style={[styles.compactIcon, { color }]}>{getBatteryIcon()}</Text>
        <Text style={[styles.compactText, { color }]}>{Math.round(percentage)}%</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Badge Battery</Text>
        <Text style={[styles.percentage, { color }]}>{Math.round(percentage)}%</Text>
      </View>

      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      </View>

      {showDetails && (
        <View style={styles.details}>
          {voltage && (
            <Text style={styles.detailText}>{(voltage / 1000).toFixed(2)}V</Text>
          )}
          {temperature !== null && temperature !== undefined && (
            <Text style={styles.detailText}>{temperature.toFixed(1)}°C</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.caption,
  },
  percentage: {
    ...typography.subheading,
    fontSize: 16,
  },
  barContainer: {
    marginTop: spacing.xs,
  },
  barBackground: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  details: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  detailText: {
    ...typography.small,
    fontFamily: "monospace",
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  compactIcon: {
    fontSize: 10,
    letterSpacing: -1,
  },
  compactText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
