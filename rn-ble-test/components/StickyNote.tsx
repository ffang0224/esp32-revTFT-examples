import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from "react-native";
import { colors, spacing, borderRadius, shadows, stickyNoteColors } from "../constants/design";

interface StickyNoteProps {
  dilemmaText: string;
  createdAt: number;
  hasProphecy?: boolean;
  onPress: () => void;
  index: number;
}

const { width: screenWidth } = Dimensions.get("window");
const CARD_WIDTH = (screenWidth - spacing.lg * 3) / 2;

export function StickyNote({
  dilemmaText,
  createdAt,
  hasProphecy,
  onPress,
  index,
}: StickyNoteProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Alternate rotation for visual interest
  const rotation = index % 2 === 0 ? "-1.5deg" : "1.5deg";
  const backgroundColor = stickyNoteColors[index % stickyNoteColors.length];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
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

  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { rotate: rotation },
              { scale: scaleAnim },
            ],
            backgroundColor,
          },
        ]}
      >
        <View style={styles.content}>
          <Text style={styles.text} numberOfLines={4}>
            {dilemmaText}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.date}>{formatDate(createdAt)}</Text>
          {hasProphecy && (
            <View style={styles.prophecyBadge}>
              <Text style={styles.prophecyBadgeText}>✨</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    minHeight: 140,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  content: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  date: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },
  prophecyBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  prophecyBadgeText: {
    fontSize: 12,
  },
});
