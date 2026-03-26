import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDots?: boolean;
  showFill?: boolean;
  fillColor?: string;
  animated?: boolean;
  style?: ViewStyle;
  /** 'default' = full sparkline; 'inline' = compact 40×16 trend line */
  variant?: 'default' | 'inline';
  /** Override automatic trend coloring (inline variant only) */
  trendColor?: string;
}

/**
 * Build a monotone cubic interpolation path string for the given points.
 * Uses Fritsch–Carlson tangents to guarantee monotonicity per segment.
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${points[0].x},${points[0].y}`;
  if (n === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;

  // Compute secants
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = []; // tangents
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    dy.push(points[i + 1].y - points[i].y);
    m.push(dy[i] / dx[i]);
  }

  // Fritsch–Carlson tangents
  const tangents: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents.push(0);
    } else {
      tangents.push(2 / (1 / m[i - 1] + 1 / m[i]));
    }
  }
  tangents.push(m[n - 2]);

  // Build cubic bezier segments
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const seg = dx[i] / 3;
    const cp1x = points[i].x + seg;
    const cp1y = points[i].y + tangents[i] * seg;
    const cp2x = points[i + 1].x - seg;
    const cp2y = points[i + 1].y - tangents[i + 1] * seg;
    d += `C${cp1x},${cp1y},${cp2x},${cp2y},${points[i + 1].x},${points[i + 1].y}`;
  }
  return d;
}

/** Determine trend color based on first/last data values */
function getTrendColor(data: number[]): string {
  const first = data[0];
  const last = data[data.length - 1];
  if (last > first) return '#4CAF50'; // green — upward
  if (last < first) return '#F44336'; // red — downward
  return '#9E9E9E'; // neutral gray
}

export function Sparkline({
  data,
  width: widthProp,
  height: heightProp,
  color: colorProp,
  strokeWidth: strokeWidthProp,
  showDots: showDotsProp,
  showFill: showFillProp,
  fillColor: fillColorProp,
  animated: animatedProp,
  style,
  variant = 'default',
  trendColor,
}: SparklineProps) {
  const { colors } = useTheme();
  const isInline = variant === 'inline';

  // Resolve defaults based on variant
  const width = widthProp ?? (isInline ? 40 : 120);
  const height = heightProp ?? (isInline ? 16 : 40);
  const strokeWidth = strokeWidthProp ?? (isInline ? 1.5 : 2);
  const showDots = showDotsProp ?? false;
  const showFill = isInline ? false : (showFillProp ?? false);
  const animated = isInline ? false : (animatedProp ?? true);

  // Determine line color
  const lineColor = isInline
    ? (trendColor ?? getTrendColor(data))
    : (colorProp ?? colors.chartLine);
  const gradientColor = fillColorProp ?? lineColor;

  const dashOffset = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animated && data.length >= 2) {
      dashOffset.setValue(1);
      Animated.timing(dashOffset, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } else {
      dashOffset.setValue(0);
    }
  }, [data, animated]);

  if (data.length < 2) {
    return <View style={style} />;
  }

  const padding = isInline ? 1 : 4;
  const drawW = width - padding * 2;
  const drawH = height - padding * 2;

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1; // flat line guard

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * drawW,
    y: padding + drawH - ((v - minVal) / range) * drawH,
  }));

  const linePath = buildSmoothPath(points);

  // Closed fill path: line path + close to bottom-right, bottom-left
  const fillPath = `${linePath}L${points[points.length - 1].x},${height}L${points[0].x},${height}Z`;

  // Estimate total path length for dash animation (sum of segment distances)
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dxSeg = points[i].x - points[i - 1].x;
    const dySeg = points[i].y - points[i - 1].y;
    pathLength += Math.sqrt(dxSeg * dxSeg + dySeg * dySeg);
  }
  // Overestimate slightly to account for curves
  pathLength *= 1.5;

  const gradientId = useMemo(() => `sparkline-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <View style={style}>
      <Svg width={width} height={height}>
        {showFill && (
          <>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={gradientColor} stopOpacity={0.3} />
                <Stop offset="1" stopColor={gradientColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={fillPath} fill={`url(#${gradientId})`} />
          </>
        )}

        {animated ? (
          <AnimatedPath
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset.interpolate({
              inputRange: [0, 1],
              outputRange: [0, pathLength],
            })}
          />
        ) : (
          <Path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {showDots &&
          points.map((pt, i) => (
            <Circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={3}
              fill={lineColor}
            />
          ))}
      </Svg>
    </View>
  );
}
