import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';
import Svg, {
  Path,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  G,
  Circle,
} from 'react-native-svg';
import { useTheme } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ── Types ────────────────────────────────────────────────────────

export interface AreaChartDataPoint {
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: AreaChartDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  showValues?: boolean;
  animated?: boolean;
  gridLines?: number;
  style?: ViewStyle;
}

// ── Monotone cubic interpolation ─────────────────────────────────
// Attempt to produce a smooth curve that doesn't overshoot data points.

function monotonicCubicPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;
  }

  const n = points.length;

  // 1. Compute slopes of secant lines
  const deltas: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    deltas.push(points[i + 1].x - points[i].x);
    slopes.push((points[i + 1].y - points[i].y) / deltas[i]);
  }

  // 2. Compute tangent at each point (Fritsch-Carlson method)
  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }

  // 3. Adjust tangents to ensure monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-6) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / slopes[i];
      const beta = tangents[i + 1] / slopes[i];
      const s = alpha * alpha + beta * beta;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        tangents[i] = tau * alpha * slopes[i];
        tangents[i + 1] = tau * beta * slopes[i];
      }
    }
  }

  // 4. Build SVG path with cubic bezier segments
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = deltas[i] / 3;
    const cp1x = points[i].x + dx;
    const cp1y = points[i].y + dx * tangents[i];
    const cp2x = points[i + 1].x - dx;
    const cp2y = points[i + 1].y - dx * tangents[i + 1];
    d += `C${cp1x},${cp1y},${cp2x},${cp2y},${points[i + 1].x},${points[i + 1].y}`;
  }

  return d;
}

// ── Component ────────────────────────────────────────────────────

export function AreaChart({
  data,
  width = 300,
  height = 180,
  color: colorProp,
  fillColor: fillColorProp,
  showGrid = true,
  showLabels = true,
  showValues = false,
  animated = true,
  gridLines = 4,
  style,
}: AreaChartProps) {
  const { colors } = useTheme();

  const lineColor = colorProp ?? colors.chartLine;
  const fillColor = fillColorProp ?? colors.chartArea;

  // ── Animation ────────────────────────────────────────────────
  const dashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated || data.length < 2) return;
    dashAnim.setValue(1);
    Animated.timing(dashAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [animated, data]);

  // ── Edge case: empty data ────────────────────────────────────
  if (data.length === 0) {
    return <View style={[{ width, height }, style]} />;
  }

  // ── Chart area geometry ──────────────────────────────────────
  const paddingLeft = 16;
  const paddingTop = showValues ? 20 : 8;
  const paddingBottom = showLabels ? 24 : 8;
  const paddingRight = 8;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values) * 1.1 || 1; // avoid 0

  // ── Map data → SVG points ────────────────────────────────────
  const points = data.map((d, i) => ({
    x: paddingLeft + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: paddingTop + chartH - (d.value / maxVal) * chartH,
  }));

  // ── Single data point ────────────────────────────────────────
  if (data.length === 1) {
    const pt = points[0];
    return (
      <View style={[{ width, height }, style]}>
        <Svg width={width} height={height}>
          {showGrid && renderGrid(gridLines, paddingLeft, paddingTop, chartW, chartH, maxVal, colors)}
          <Circle cx={pt.x} cy={pt.y} r={4} fill={lineColor} />
          {showValues && (
            <SvgText
              x={pt.x}
              y={pt.y - 8}
              fontSize={10}
              fill={colors.text}
              textAnchor="middle"
            >
              {data[0].value}
            </SvgText>
          )}
          {showLabels && (
            <SvgText
              x={pt.x}
              y={paddingTop + chartH + 16}
              fontSize={10}
              fill={colors.textTertiary}
              textAnchor="middle"
            >
              {data[0].label}
            </SvgText>
          )}
        </Svg>
      </View>
    );
  }

  // ── Paths ────────────────────────────────────────────────────
  const linePath = monotonicCubicPath(points);

  // Closed area path: line path → bottom-right → bottom-left
  const areaPath =
    linePath +
    `L${points[points.length - 1].x},${paddingTop + chartH}` +
    `L${points[0].x},${paddingTop + chartH}Z`;

  const gradientId = 'area-fill-gradient';

  // Estimated path length for dash animation (generous estimate)
  const pathLength = 1200;

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fillColor} stopOpacity={0.4} />
            <Stop offset="1" stopColor={fillColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {showGrid && renderGrid(gridLines, paddingLeft, paddingTop, chartW, chartH, maxVal, colors)}

        {/* Filled area */}
        <Path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Data line */}
        {animated ? (
          <AnimatedPath
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, pathLength],
            })}
          />
        ) : (
          <Path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Value labels */}
        {showValues &&
          points.map((pt, i) => (
            <SvgText
              key={`val-${i}`}
              x={pt.x}
              y={pt.y - 8}
              fontSize={10}
              fill={colors.text}
              textAnchor="middle"
            >
              {values[i]}
            </SvgText>
          ))}

        {/* X-axis labels */}
        {showLabels && (
          <G>
            {data.map((d, i) => (
              <SvgText
                key={`lbl-${i}`}
                x={points[i].x}
                y={paddingTop + chartH + 16}
                fontSize={10}
                fill={colors.textTertiary}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            ))}
          </G>
        )}
      </Svg>
    </View>
  );
}

// ── Grid helper ──────────────────────────────────────────────────

function renderGrid(
  count: number,
  left: number,
  top: number,
  chartW: number,
  chartH: number,
  _maxVal: number,
  colors: Record<string, string>,
) {
  const lines = [];
  for (let i = 0; i <= count; i++) {
    const y = top + (i / count) * chartH;
    lines.push(
      <Line
        key={`grid-${i}`}
        x1={left}
        y1={y}
        x2={left + chartW}
        y2={y}
        stroke={colors.chartGrid}
        strokeWidth={1}
        strokeDasharray="4,4"
      />,
    );
  }
  return <G>{lines}</G>;
}
