import { Animated } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';

type FadeUpOpts = { delay?: number };

export function fadeUpEntrance(
  animValue: Animated.Value,
  opts?: FadeUpOpts,
): Animated.CompositeAnimation {
  const anim = Animated.spring(animValue, {
    toValue: 1,
    damping: 18,
    stiffness: 180,
    mass: 0.8,
    useNativeDriver: true,
  });
  if (opts?.delay) {
    return Animated.sequence([Animated.delay(opts.delay), anim]);
  }
  return anim;
}

export function completionFlash(
  animValue: Animated.Value,
): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(animValue, {
      toValue: 1.15,
      duration: 150,
      useNativeDriver: true,
    }),
    Animated.spring(animValue, {
      toValue: 1,
      stiffness: 300,
      useNativeDriver: true,
    }),
  ]);
}

export function checkPop(
  animValue: Animated.Value,
): Animated.CompositeAnimation {
  return Animated.spring(animValue, {
    toValue: 1,
    tension: 200,
    friction: 6,
    useNativeDriver: true,
  });
}

export function goldPulse(
  animValue: Animated.Value,
): Animated.CompositeAnimation {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 0.3,
        duration: 600,
        useNativeDriver: true,
      }),
    ]),
  );
}

export function useStaggeredList(count: number, baseDelay: number = 50, maxDelay: number = 500) {
  const anims = useMemo(
    () => Array.from({ length: count }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(12),
    })),
    [count],
  );

  useEffect(() => {
    const animations = anims.map((anim, i) => {
      const delay = Math.min(i * baseDelay, maxDelay);
      return Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.spring(anim.opacity, {
            toValue: 1,
            useNativeDriver: true,
            damping: 18,
            stiffness: 180,
            mass: 0.8,
          }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.spring(anim.translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 180,
            mass: 0.8,
          }),
        ]),
      ]);
    });
    Animated.parallel(animations).start();
  }, [count]);

  return anims.map((a) => ({
    opacity: a.opacity,
    transform: [{ translateY: a.translateY }],
  }));
}

export function useEntrance(delay?: number) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeUpEntrance(animValue, { delay }).start();
  }, []);

  const opacity = animValue;
  const transform = [
    {
      translateY: animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
      }),
    },
  ];
  const animatedStyle = { opacity, transform };

  return { opacity, transform, animatedStyle };
}
