import React from "react";
import { Stack } from "expo-router";
import { colors } from "../../constants/design";

export default function CreateLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="dilemma" />
      <Stack.Screen name="value1" />
      <Stack.Screen name="value2" />
      <Stack.Screen name="value3" />
      <Stack.Screen name="value4" />
      <Stack.Screen name="prophecy" />
    </Stack>
  );
}
