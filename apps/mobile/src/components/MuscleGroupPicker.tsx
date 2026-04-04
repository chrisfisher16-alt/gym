import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { MuscleGroupTile, MUSCLE_GROUPS } from './MuscleGroupTile';
import type { MuscleGroupInfo } from './MuscleGroupTile';

// ── Types ────────────────────────────────────────────────────────────

export interface MuscleGroupPickerProps {
  visible: boolean;
  onClose: () => void;
  selectedGroups: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onSave?: (selectedIds: string[]) => void;
  recoveryData?: Record<string, number>;
}

// ── Component ────────────────────────────────────────────────────────

const NUM_COLUMNS = 3;

export function MuscleGroupPicker({
  visible,
  onClose,
  selectedGroups,
  onSelectionChange,
  onSave,
  recoveryData,
}: MuscleGroupPickerProps) {
  const { colors, typography, spacing, radius } = useTheme();

  // Local selection state when save mode is active
  const [localSelection, setLocalSelection] = useState<string[]>(selectedGroups);

  // Reset local selection when the sheet opens
  React.useEffect(() => {
    if (visible) setLocalSelection(selectedGroups);
  }, [visible, selectedGroups]);

  const activeSelection = onSave ? localSelection : selectedGroups;

  const toggleGroup = useCallback(
    (groupId: string) => {
      const next = activeSelection.includes(groupId)
        ? activeSelection.filter((id) => id !== groupId)
        : [...activeSelection, groupId];

      if (onSave) {
        setLocalSelection(next);
      } else {
        onSelectionChange(next);
      }
    },
    [activeSelection, onSave, onSelectionChange],
  );

  const handleSave = useCallback(() => {
    onSave?.(localSelection);
    onSelectionChange(localSelection);
    onClose();
  }, [localSelection, onSave, onSelectionChange, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const mainGroups = useMemo(
    () => MUSCLE_GROUPS.filter((g) => g.category === 'main'),
    [],
  );
  const accessoryGroups = useMemo(
    () => MUSCLE_GROUPS.filter((g) => g.category === 'accessory'),
    [],
  );

  const screenWidth = Dimensions.get('window').width;
  // Account for bottom sheet padding (lg = 20 on each side)
  const containerPadding = spacing.lg * 2;
  const gap = spacing.sm;
  const tileSize = Math.floor(
    (screenWidth - containerPadding - gap * (NUM_COLUMNS - 1)) / NUM_COLUMNS,
  );

  const renderGrid = (groups: MuscleGroupInfo[]) => {
    const rows: MuscleGroupInfo[][] = [];
    for (let i = 0; i < groups.length; i += NUM_COLUMNS) {
      rows.push(groups.slice(i, i + NUM_COLUMNS));
    }

    return rows.map((row, rowIndex) => (
      <View key={rowIndex} style={[styles.row, { gap }]}>
        {row.map((group) => (
          <MuscleGroupTile
            key={group.id}
            muscleGroup={group}
            selected={activeSelection.includes(group.id)}
            onPress={() => toggleGroup(group.id)}
            recoveryPercent={recoveryData?.[group.id]}
            size={tileSize}
          />
        ))}
        {/* Fill empty cells in the last row for alignment */}
        {row.length < NUM_COLUMNS &&
          Array.from({ length: NUM_COLUMNS - row.length }).map((_, i) => (
            <View key={`spacer-${i}`} style={{ width: tileSize }} />
          ))}
      </View>
    ));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.92}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[typography.body, { color: colors.textSecondary, flex: 1 }]}>
          Pick the muscle groups you want to work out:
        </Text>
      </View>

      {/* Save / Cancel bar */}
      {onSave && (
        <View style={[styles.actionBar, { marginBottom: spacing.md }]}>
          <TouchableOpacity onPress={handleCancel} hitSlop={8}>
            <Text style={[typography.label, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} hitSlop={8}>
            <Text style={[typography.label, { color: colors.primary }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Muscle Groups */}
      <Text
        style={[
          typography.overline,
          { color: colors.textTertiary, marginBottom: spacing.sm },
        ]}
      >
        MAIN MUSCLE GROUPS
      </Text>
      {renderGrid(mainGroups)}

      {/* Accessory Muscle Groups */}
      <Text
        style={[
          typography.overline,
          {
            color: colors.textTertiary,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
          },
        ]}
      >
        ACCESSORY MUSCLE GROUPS
      </Text>
      {renderGrid(accessoryGroups)}
    </BottomSheet>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
});
