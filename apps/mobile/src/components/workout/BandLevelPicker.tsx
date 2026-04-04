import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme';
import { selectionFeedback } from '../../lib/haptics';

export interface BandLevelPickerProps {
  level: number; // 1-4
  onLevelChange: (level: number) => void;
}

interface BandOption {
  level: number;
  emoji: string;
  label: string;
  color: string;
}

const BAND_OPTIONS: BandOption[] = [
  { level: 1, emoji: '🔴', label: 'Light', color: '#EF4444' },
  { level: 2, emoji: '🔵', label: 'Medium', color: '#3B82F6' },
  { level: 3, emoji: '⚫', label: 'Heavy', color: '#374151' },
  { level: 4, emoji: '🟣', label: 'X-Heavy', color: '#8B5CF6' },
];

export const BandLevelPicker = React.memo(function BandLevelPicker({
  level,
  onLevelChange,
}: BandLevelPickerProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const handleSelect = (bandLevel: number) => {
    selectionFeedback();
    onLevelChange(bandLevel);
  };

  return (
    <View style={[styles.container, { gap: spacing.xs }]}>
      {BAND_OPTIONS.map((band) => {
        const isSelected = level === band.level;
        return (
          <TouchableOpacity
            key={band.level}
            onPress={() => handleSelect(band.level)}
            activeOpacity={0.7}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? band.color : colors.surfaceSecondary,
                borderRadius: radius.sm,
                borderWidth: 2,
                borderColor: isSelected ? band.color : 'transparent',
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <Text style={styles.emoji}>{band.emoji}</Text>
            <Text
              style={[
                typography.caption,
                {
                  color: isSelected ? '#FFFFFF' : colors.text,
                  fontWeight: isSelected ? '700' : '500',
                  marginLeft: 2,
                },
              ]}
            >
              {band.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  emoji: {
    fontSize: 12,
  },
});
