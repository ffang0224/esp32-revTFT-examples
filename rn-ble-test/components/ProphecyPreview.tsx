import React, { useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, Animated, Easing } from "react-native";
import { colors, spacing, borderRadius, shadows } from "../constants/design";

interface ProphecyPreviewProps {
  imageUrl?: string | null;
  prophecyText?: string;
  isLoading?: boolean;
}

export function ProphecyPreview({
  imageUrl,
  prophecyText,
  isLoading,
}: ProphecyPreviewProps) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLoading]);

  useEffect(() => {
    if (imageUrl) {
      fadeIn.setValue(0);
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start();
    }
  }, [imageUrl]);

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        {/* Left side: Image */}
        <View style={styles.imageContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Animated.Text style={[styles.loadingEmoji, { opacity: pulseAnim }]}>🔮</Animated.Text>
              <Text style={styles.loadingText}>Conjuring...</Text>
            </View>
          ) : imageUrl ? (
            <Animated.Image
              source={{ uri: imageUrl }}
              style={[styles.image, { opacity: fadeIn }]}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderEmoji}>🔮</Text>
            </View>
          )}
        </View>

        {/* Right side: Text */}
        <View style={styles.textContainer}>
          {prophecyText ? (
            <Animated.Text
              style={[styles.prophecyText, { opacity: fadeIn }]}
              numberOfLines={8}
            >
              {prophecyText}
            </Animated.Text>
          ) : (
            <View style={styles.placeholderTextContainer}>
              <Text style={styles.placeholderLabel}>
                Your prophecy{"\n"}will appear here
              </Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Badge label */}
      <Text style={styles.badgeLabel}>E-Ink Badge Preview</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  badge: {
    width: 250,
    height: 122,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  imageContainer: {
    width: 122,
    height: 122,
    backgroundColor: "#F8F8F8",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    backgroundColor: "#F0F0F0",
  },
  loadingEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "500",
  },
  image: {
    width: 122,
    height: 122,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderEmoji: {
    fontSize: 36,
    opacity: 0.2,
  },
  textContainer: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#EEEEEE",
  },
  prophecyText: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 14,
    fontWeight: "500",
    fontStyle: "italic",
  },
  placeholderTextContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 14,
  },
  badgeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontWeight: "500",
  },
});
