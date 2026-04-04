import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { selectionFeedback } from '../../lib/haptics';

export interface AddedWeightToggleProps {
  weight: number;
  onWeightChange: (weight: number) => void;
  unit: 'kg' | 'lbs';
  expanded: boolean;
  onToggle: () => void;
}

export const AddedWeightToggle = React.memo(function AddedWeightToggle({
  weight,
  onWeightChange,
  unit,
  expanded,
  onToggle,
}: AddedWeightToggleProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const handleToggle = () => {
    selectionFeedback();
    onToggle();
  };

  const handleWeightText = (text: string) => {
    const w = parseFloat(text);
    onWeightChange(isNaN(w) ? 0 : w);
  };

  if (!expanded) {
    return (
      <TouchableOpacity
        onPress={handleToggle}
        style={[styles.collapsedRow, { paddingVertical: spacing.xs }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
        <Text style={[typography.caption, { color: colors.primary, marginLeft: 4 }]}>
          Add Weight
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.expandedRow, { paddingVertical: spacing.xs }]}>
      <TouchableOpacity
        onPress={handleToggle}
        style={styles.collapseHit}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="remove-circle-outline" size={14} color={colors.textTertiary} />
      </TouchableOpacity>
      <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4, marginRight: 6 }]}>
        Added ({unit})
      </Text>
      <TextInput
        style={[
          styles.weightInput,
          {
            color: colors.text,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.sm,
            ...typography.body,
            fontWeight: '700',
          },
        ]}
        value={weight > 0 ? weight.toString() : ''}
        onChangeText={handleWeightText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textTertiary}
        selectTextOnFocus
      />
    </View>
  );
});

const styles = StyleSheet.create({
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseHit: {
    padding: 2,
  },
  weightInput: {
    textAlign: 'center',
    width: 56,
    height: 32,
    paddingHorizontal: 4,
  },
});
