import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, spacing, borderRadius, typography, shadows, getTransferColor } from "../constants/design";

interface TransferPillProps {
  stage: string;
  progress: number;
  transferId?: string | null;
  showProgress?: boolean;
}

export function TransferPill({
  stage,
  progress,
  transferId,
  showProgress = true,
}: TransferPillProps) {
  const getStageLabel = () => {
    switch (stage) {
      case "preparing":
        return "Preparing...";
      case "sending_start":
        return "Starting...";
      case "sending_chunks":
        return `Sending ${progress}%`;
      case "waiting_ack":
        return "Waiting for badge...";
      case "done":
        return "Sent ✓";
      case "error":
        return "Failed ✕";
      default:
        return "Ready";
    }
  };

  const getStageIcon = () => {
    switch (stage) {
      case "preparing":
      case "sending_start":
      case "sending_chunks":
      case "waiting_ack":
        return "↑";
      case "done":
        return "✓";
      case "error":
        return "✕";
      default:
        return "◦";
    }
  };

  const color = getTransferColor(stage);
  const isActive = stage !== "idle" && stage !== "done" && stage !== "error";

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, shadows.md]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.icon, { color }]}>{getStageIcon()}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.label}>{getStageLabel()}</Text>
          {transferId && (
            <Text style={styles.id}>{transferId.slice(0, 8)}</Text>
          )}
        </View>
      </View>
      {showProgress && isActive && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minWidth: 180,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 14,
    fontWeight: "600",
  },
  textContainer: {
    flex: 1,
  },
  label: {
    ...typography.chip,
    fontSize: 13,
  },
  id: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: "monospace",
    marginTop: 2,
  },
  progressContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  progressBackground: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 1.5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1.5,
  },
});
