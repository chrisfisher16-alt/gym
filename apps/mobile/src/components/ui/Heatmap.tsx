import React, { useMemo } from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { useTheme } from '../../theme';

export interface HeatmapDataPoint {
  date: string; // ISO date string "YYYY-MM-DD"
  value: number; // 0 = no activity, higher = more intensity
}

export interface HeatmapProps {
  data: HeatmapDataPoint[];
  weeks?: number;
  cellSize?: number;
  cellGap?: number;
  showDayLabels?: boolean;
  showMonthLabels?: boolean;
  style?: ViewStyle;
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function getColorForValue(
  value: number,
  maxValue: number,
  colors: Record<string, string>,
): string {
  if (value <= 0 || maxValue <= 0) return colors.heatmapEmpty;
  const ratio = value / maxValue;
  if (ratio <= 0.25) return colors.heatmapLow;
  if (ratio <= 0.75) return colors.heatmapMid;
  return colors.heatmapHigh;
}

/** Strips time component from a Date, returning midnight-local "YYYY-MM-DD". */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function Heatmap({
  data,
  weeks = 12,
  cellSize = 14,
  cellGap = 3,
  showDayLabels = true,
  showMonthLabels = true,
  style,
}: HeatmapProps) {
  const { colors } = useTheme();

  const grid = useMemo(() => {
    if (weeks < 1) return null;

    // Build a lookup map from date string -> value
    const valueMap = new Map<string, number>();
    let maxValue = 0;
    for (const point of data) {
      const existing = valueMap.get(point.date) ?? 0;
      const newVal = existing + point.value;
      valueMap.set(point.date, newVal);
      if (newVal > maxValue) maxValue = newVal;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // End date is today. We need weeks * 7 days total.
    // The grid ends on today's day-of-week column, and goes back `weeks` columns.
    // Each column is a week (Sun=0 through Sat=6 as rows).
    const todayDow = today.getDay(); // 0=Sun, 6=Sat
    const totalDays = weeks * 7;

    // The last cell in the grid is today. The last column ends on Saturday
    // of today's week. But to match GitHub style, the last column is the
    // partial week containing today.
    // Start date: go back enough days so that we fill `weeks` columns.
    // Last column's Saturday offset from today = 6 - todayDow
    // But we don't render future dates, so the last column may be partial.
    // Start = today - (weeks - 1) * 7 - todayDow  (the Sunday of the first week)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (weeks - 1) * 7 - todayDow);

    // Build cells: columns = weeks, rows = 7 (Sun-Sat)
    const cells: Array<{
      col: number;
      row: number;
      dateKey: string;
      value: number;
      month: number;
      isVisible: boolean;
    }> = [];

    const monthStarts: Array<{ col: number; month: number }> = [];
    let prevMonth = -1;

    for (let col = 0; col < weeks; col++) {
      for (let row = 0; row < 7; row++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + col * 7 + row);
        const dateKey = toDateKey(cellDate);
        const isVisible = cellDate <= today;
        const value = valueMap.get(dateKey) ?? 0;

        cells.push({
          col,
          row,
          dateKey,
          value,
          month: cellDate.getMonth(),
          isVisible,
        });

        // Track month boundaries (check first row of each column)
        if (row === 0) {
          const cellMonth = cellDate.getMonth();
          if (cellMonth !== prevMonth) {
            monthStarts.push({ col, month: cellMonth });
            prevMonth = cellMonth;
          }
        }
      }
    }

    return { cells, monthStarts, maxValue };
  }, [data, weeks]);

  if (!grid || weeks < 1) return null;

  const labelOffset = showDayLabels ? 28 : 0;
  const monthLabelOffset = showMonthLabels ? 16 : 0;
  const step = cellSize + cellGap;
  const svgWidth = labelOffset + step * weeks;
  const svgHeight = monthLabelOffset + step * 7;

  return (
    <View style={style}>
      <Svg width={svgWidth} height={svgHeight}>
        {/* Month labels */}
        {showMonthLabels && (
          <G>
            {grid.monthStarts.map(({ col, month }) => (
              <SvgText
                key={`month-${col}`}
                x={labelOffset + col * step}
                y={10}
                fontSize={9}
                fill={colors.textTertiary}
              >
                {MONTH_NAMES[month]}
              </SvgText>
            ))}
          </G>
        )}

        {/* Day labels */}
        {showDayLabels && (
          <G>
            {DAY_LABELS.map((label, row) =>
              label ? (
                <SvgText
                  key={`day-${row}`}
                  x={0}
                  y={monthLabelOffset + row * step + cellSize - 2}
                  fontSize={9}
                  fill={colors.textTertiary}
                >
                  {label}
                </SvgText>
              ) : null,
            )}
          </G>
        )}

        {/* Cells */}
        <G>
          {grid.cells.map((cell) => {
            if (!cell.isVisible) return null;
            return (
              <Rect
                key={cell.dateKey}
                x={labelOffset + cell.col * step}
                y={monthLabelOffset + cell.row * step}
                width={cellSize}
                height={cellSize}
                rx={3}
                ry={3}
                fill={getColorForValue(cell.value, grid.maxValue, colors)}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
