export default {
  expo: {
    name: "rn-ble-test",
    slug: "rn-ble-test",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "rnbletest",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      infoPlist: {
        NSBluetoothAlwaysUsageDescription:
          "This app uses Bluetooth to connect to your FaustoBadge.",
      },
      bundleIdentifier: "com.anonymous.rnbletest",
    },
    android: {
      permissions: [
        "BLUETOOTH",
        "BLUETOOTH_ADMIN",
        "BLUETOOTH_SCAN",
        "BLUETOOTH_CONNECT",
        "ACCESS_FINE_LOCATION",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.BLUETOOTH_CONNECT",
      ],
      package: "com.anonymous.rnbletest",
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      "react-native-ble-plx",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      openRouterApiKey: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
    },
  },
};

