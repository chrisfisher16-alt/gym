import React, { useCallback, useEffect } from 'react';
import { Text, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface AnimatedNumberProps {
  /** Target value to animate to */
  value: number;
  /** Duration of the animation in ms (default 400) */
  duration?: number;
  /** Number of decimal places (default 0) */
  decimals?: number;
  /** Text style to apply */
  style?: TextStyle | TextStyle[];
  /** Optional formatter function (e.g. toLocaleString) */
  formatter?: (n: number) => string;
  /** Whether to animate from 0 on first mount (default true) */
  animateOnMount?: boolean;
}

export function AnimatedNumber({
  value,
  duration = 400,
  decimals = 0,
  style,
  formatter,
  animateOnMount = true,
}: AnimatedNumberProps) {
  const animatedVal = useSharedValue(animateOnMount ? 0 : value);
  const isFirstRender = useSharedValue(true);
  const [displayValue, setDisplayValue] = React.useState(() =>
    formatNumber(animateOnMount ? 0 : value, decimals, formatter),
  );

  const updateDisplay = useCallback(
    (v: number) => {
      setDisplayValue(formatNumber(v, decimals, formatter));
    },
    [decimals, formatter],
  );

  useAnimatedReaction(
    () => animatedVal.value,
    (current) => {
      runOnJS(updateDisplay)(current);
    },
  );

  useEffect(() => {
    if (isFirstRender.value) {
      isFirstRender.value = false;
      if (animateOnMount) {
        animatedVal.value = withTiming(value, {
          duration,
          easing: Easing.out(Easing.quad),
        });
      } else {
        animatedVal.value = value;
      }
      return;
    }

    // Subsequent value changes: animate to new value
    animatedVal.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.quad),
    });
  }, [value, duration, animateOnMount]);

  return <Text style={style}>{displayValue}</Text>;
}

function formatNumber(
  n: number,
  decimals: number,
  formatter?: (n: number) => string,
): string {
  if (formatter) return formatter(n);
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();
}
