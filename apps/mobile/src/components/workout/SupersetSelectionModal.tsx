import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Button } from '../ui';
import type { ActiveExercise } from '../../types/workout';

export interface SupersetSelectionModalProps {
  visible: boolean;
  sourceExerciseId: string;
  exercises: ActiveExercise[];
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

export function SupersetSelectionModal({
  visible,
  sourceExerciseId,
  exercises,
  onClose,
  onConfirm,
}: SupersetSelectionModalProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const availableExercises = exercises.filter(
    (e) => e.id !== sourceExerciseId && !e.supersetGroupId && !e.isSkipped,
  );

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // max 2 additional = 3 total
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (selectedIds.length > 0) {
      onConfirm([sourceExerciseId, ...selectedIds]);
      setSelectedIds([]);
      onClose();
    }
  };

  const groupLabel = selectedIds.length === 1 ? 'Superset' : selectedIds.length === 2 ? 'Tri-Set' : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.modalHeader, { paddingHorizontal: spacing.base, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={() => { setSelectedIds([]); onClose(); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.label, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
            Create {groupLabel || 'Superset'}
          </Text>
        </View>

        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.md }}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Select 1-2 exercises to group (2 = Superset, 3 = Tri-Set)
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}>
          {availableExercises.map((ex) => {
            const isSelected = selectedIds.includes(ex.id);
            return (
              <TouchableOpacity
                key={ex.id}
                onPress={() => toggleId(ex.id)}
                style={[
                  styles.replacementItem,
                  {
                    backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.xs,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primary : colors.borderLight,
                  },
                ]}
              >
                <Text style={[typography.label, { color: colors.text, flex: 1 }]}>{ex.exerciseName}</Text>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={isSelected ? colors.primary : colors.textTertiary}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.modalFooter, { paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderTopColor: colors.borderLight }]}>
          <Button
            title={`Create ${groupLabel || 'Group'}`}
            onPress={handleConfirm}
            disabled={selectedIds.length === 0}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalFooter: {
    borderTopWidth: 1,
  },
  replacementItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
