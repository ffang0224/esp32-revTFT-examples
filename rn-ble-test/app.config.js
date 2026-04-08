export default {
  expo: {
    name: "Glimpse",
    slug: "rn-ble-test",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "glimpse",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      infoPlist: {
        NSBluetoothAlwaysUsageDescription:
          "This app uses Bluetooth to connect to your FaustoBadge.",
        NSBluetoothPeripheralUsageDescription:
          "This app uses Bluetooth to connect to your FaustoBadge.",
        UIBackgroundModes: ["bluetooth-central"],
      },
      bundleIdentifier: "com.faustofang.glimpse",
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
      package: "com.faustofang.glimpse",
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
          backgroundColor: "#FAFAFA",
          dark: {
            backgroundColor: "#18181B",
          },
        },
      ],
      [
        "react-native-ble-plx",
        {
          isBackgroundEnabled: true,
          modes: ["central"],
          bluetoothAlwaysPermission: "Allow Glimpse to use Bluetooth to connect to your badge",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      openRouterApiKey: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
    },
  },
};

