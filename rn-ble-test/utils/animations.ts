import { Animated, Easing } from "react-native";

export const createFadeIn = (duration: number = 400, delay: number = 0) => {
  const opacity = new Animated.Value(0);
  const translateY = new Animated.Value(20);

  const animate = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  };

  return { opacity, translateY, animate };
};

export const createScale = (duration: number = 300) => {
  const scale = new Animated.Value(0.9);

  const animate = () => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  return { scale, animate };
};

export const createStagger = (
  items: number,
  baseDelay: number = 100,
  duration: number = 400
) => {
  const animations = Array.from({ length: items }, (_, i) => {
    const opacity = new Animated.Value(0);
    const translateY = new Animated.Value(30);
    const delay = i * baseDelay;

    return { opacity, translateY, delay };
  });

  const animate = () => {
    animations.forEach(({ opacity, translateY, delay }) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          delay,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    });
  };

  return { animations, animate };
};

export const createPulse = () => {
  const scale = new Animated.Value(1);

  const animate = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  };

  return { scale, animate };
};
