import { Platform } from "react-native";

// Glimpse Brand Colors
export const colors = {
  // Core palette
  bg: "#FAFAFA",
  card: "#FFFFFF",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  accent: "#18181B",
  accentLight: "#F4F4F5",
  success: "#10B981",
  border: "#E5E5E5",
  warning: "#F59E0B",
  error: "#EF4444",

  // Glimpse brand accent (subtle electric blue glow)
  glimpse: "#3B82F6",
  glimpseLight: "#60A5FA",
  glimpseGlow: "rgba(59, 130, 246, 0.3)",

  // Semantic tokens
  info: "#3B82F6",
  infoBg: "#EFF6FF",
  successBg: "#ECFDF5",
  warningBg: "#FFFBEB",
  errorBg: "#FEF2F2",

  // Transfer state colors
  charging: "#F59E0B",
  sending: "#3B82F6",
  confirmed: "#10B981",

  // Battery indicator
  batteryHigh: "#10B981",
  batteryMedium: "#F59E0B",
  batteryLow: "#EF4444",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fonts = {
  regular: "InstrumentSans-Regular",
  medium: "InstrumentSans-Medium",
  semibold: "InstrumentSans-SemiBold",
  bold: "InstrumentSans-Bold",
};

export const typography = {
  title: {
    fontSize: 32,
    fontFamily: fonts.semibold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 24,
    fontFamily: fonts.semibold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  small: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  chip: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  badge: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.card,
  },
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.glimpse,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 0,
  },
};

// Animation timing
export const timing = {
  quick: 150,
  normal: 300,
  slow: 500,
  verySlow: 800,
};

// Easing curves
export const easing = {
  standard: "ease-out",
  bounce: "spring",
  linear: "linear",
};

// Sticky note colors for variety
export const stickyNoteColors = [
  "#FEF3C7", // Amber
  "#DBEAFE", // Blue
  "#FCE7F3", // Pink
  "#D1FAE5", // Green
  "#E0E7FF", // Indigo
  "#FEE2E2", // Red
];

// Status colors helper
export function getBatteryColor(pct: number): string {
  if (pct > 50) return colors.batteryHigh;
  if (pct > 20) return colors.batteryMedium;
  return colors.batteryLow;
}

export function getTransferColor(stage: string): string {
  switch (stage) {
    case "preparing":
      return colors.textMuted;
    case "sending_start":
    case "sending_chunks":
      return colors.sending;
    case "waiting_ack":
      return colors.glimpse;
    case "done":
      return colors.confirmed;
    case "error":
      return colors.error;
    default:
      return colors.textMuted;
  }
}
