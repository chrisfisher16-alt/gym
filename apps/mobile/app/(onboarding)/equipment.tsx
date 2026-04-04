/**
 * Equipment Confirmation — onboarding step where the user reviews
 * and adjusts the pre-filled equipment list for their gym type.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { selectionFeedback } from '../../src/lib/haptics';
import {
  EQUIPMENT_CATALOG,
  EQUIPMENT_CATEGORY_LABELS,
  getEquipmentPreset,
  type EquipmentCategory,
  type DetailedEquipmentItem,
} from '../../src/types/onboarding';

// Category display order
const CATEGORY_ORDER: EquipmentCategory[] = [
  'small_weights',
  'bars_and_plates',
  'benches_and_racks',
  'cable_machines',
  'machines',
  'cardio',
  'other',
];

/** Group catalog items by category, preserving catalog order within each group. */
function groupByCategory(): Record<EquipmentCategory, DetailedEquipmentItem[]> {
  const groups = {} as Record<EquipmentCategory, DetailedEquipmentItem[]>;
  for (const cat of CATEGORY_ORDER) {
    groups[cat] = [];
  }
  for (const item of EQUIPMENT_CATALOG) {
    groups[item.category].push(item);
  }
  return groups;
}

/** Format selected weights as a compact summary string. */
function formatWeightSummary(weights: number[], unit: string, maxDisplay = 5): string {
  if (weights.length === 0) return 'None selected';
  const sorted = [...weights].sort((a, b) => a - b);
  if (sorted.length <= maxDisplay) {
    return sorted.map((w) => `${w}`).join(', ') + ` ${unit}`;
  }
  const shown = sorted.slice(0, maxDisplay).map((w) => `${w}`).join(', ');
  return `${shown}... ${unit}`;
}

export default function EquipmentScreen() {
  const { colors, typography, spacing } = useTheme();
  const gymName = useOnboardingStore((s) => s.gymName);
  const gymType = useOnboardingStore((s) => s.gymType);
  const selectedEquipment = useOnboardingStore((s) => s.selectedEquipment);
  const setSelectedEquipment = useOnboardingStore((s) => s.setSelectedEquipment);
  const toggleEquipment = useOnboardingStore((s) => s.toggleEquipment);
  const equipmentWeights = useOnboardingStore((s) => s.equipmentWeights);
  const setEquipmentWeights = useOnboardingStore((s) => s.setEquipmentWeights);
  const toggleEquipmentWeight = useOnboardingStore((s) => s.toggleEquipmentWeight);

  // Re-apply equipment preset whenever gym type changes
  const [lastPresetGymType, setLastPresetGymType] = useState<string | null>(null);

  useEffect(() => {
    if (gymType && gymType !== lastPresetGymType) {
      const preset = getEquipmentPreset(gymType);
      setSelectedEquipment(preset);
      setLastPresetGymType(gymType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymType]);

  // All categories start expanded
  const [collapsed, setCollapsed] = useState<Record<EquipmentCategory, boolean>>(() => {
    const init = {} as Record<EquipmentCategory, boolean>;
    for (const cat of CATEGORY_ORDER) {
      init[cat] = false;
    }
    return init;
  });

  // Weight selection bottom sheet state
  const [weightSheetItem, setWeightSheetItem] = useState<DetailedEquipmentItem | null>(null);

  const grouped = useMemo(groupByCategory, []);

  const title = gymName ? `Equipment at ${gymName}` : 'Your equipment';

  const toggleCategory = (cat: EquipmentCategory) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleToggleItem = (id: string) => {
    selectionFeedback();
    toggleEquipment(id);
  };

  const checkedSet = useMemo(() => new Set(selectedEquipment), [selectedEquipment]);

  /** Get current selected weights for an equipment item (falling back to defaults). */
  const getSelectedWeights = useCallback(
    (item: DetailedEquipmentItem): number[] => {
      if (!item.weightOptions) return [];
      return equipmentWeights[item.id] ?? item.weightOptions.defaultSelected;
    },
    [equipmentWeights],
  );

  const handleOpenWeightSheet = (item: DetailedEquipmentItem) => {
    // Initialize weights from defaults if not yet set
    if (!equipmentWeights[item.id] && item.weightOptions) {
      setEquipmentWeights(item.id, item.weightOptions.defaultSelected);
    }
    setWeightSheetItem(item);
  };

  const handleToggleWeight = (weight: number) => {
    if (!weightSheetItem) return;
    selectionFeedback();
    toggleEquipmentWeight(weightSheetItem.id, weight);
  };

  const handleSelectAllWeights = () => {
    if (!weightSheetItem?.weightOptions) return;
    setEquipmentWeights(weightSheetItem.id, [...weightSheetItem.weightOptions.values]);
  };

  const handleDeselectAllWeights = () => {
    if (!weightSheetItem) return;
    setEquipmentWeights(weightSheetItem.id, []);
  };

  const isNavigating = useRef(false);
  const handleNavigateNext = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.push('/(onboarding)/notifications');
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  // For the currently open weight sheet
  const sheetWeights = weightSheetItem ? getSelectedWeights(weightSheetItem) : [];
  const sheetWeightSet = useMemo(() => new Set(sheetWeights), [sheetWeights]);
  const allSelected =
    weightSheetItem?.weightOptions &&
    sheetWeights.length === weightSheetItem.weightOptions.values.length;

  return (
    <OnboardingScreen
      step="equipment"
      title={title}
      subtitle="We've set up likely equipment. Adjust anything that's wrong."
      ctaLabel="Looks Good"
      ctaEnabled
      onNext={handleNavigateNext}
    >
      <View style={{ marginTop: spacing.sm }}>
        {gymType === 'no_equipment' && (
          <Card style={{ marginBottom: spacing.base, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="body-outline" size={24} color={colors.primary} />
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
              No equipment? No problem. We'll focus on bodyweight exercises.
            </Text>
          </Card>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (items.length === 0) return null;

          const checkedCount = items.filter((i) => checkedSet.has(i.id)).length;
          const isCollapsed = collapsed[cat];

          return (
            <View key={cat} style={{ marginBottom: spacing.base }}>
              {/* Category Header */}
              <Pressable
                onPress={() => toggleCategory(cat)}
                style={[
                  styles.categoryHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.categoryHeaderLeft}>
                  <Text style={[typography.h3, { color: colors.primary }]}>
                    {EQUIPMENT_CATEGORY_LABELS[cat]}
                  </Text>
                  <Text
                    style={[
                      typography.label,
                      { color: colors.textSecondary, marginLeft: 8 },
                    ]}
                  >
                    {checkedCount} items
                  </Text>
                </View>
                <Ionicons
                  name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                  size={20}
                  color={colors.primary}
                />
              </Pressable>

              {/* Items */}
              {!isCollapsed &&
                items.map((item) => {
                  const isChecked = checkedSet.has(item.id);
                  const hasWeights = !!item.weightOptions;
                  const weights = hasWeights ? getSelectedWeights(item) : [];

                  return (
                    <View key={item.id}>
                      <Pressable
                        onPress={() => handleToggleItem(item.id)}
                        style={[
                          styles.itemRow,
                          {
                            borderBottomColor: colors.border,
                            borderBottomWidth: hasWeights && isChecked ? 0 : StyleSheet.hairlineWidth,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={isChecked ? colors.primary : colors.textTertiary}
                        />
                        <Text
                          style={[
                            typography.body,
                            { color: colors.text, marginLeft: 12, flex: 1 },
                          ]}
                        >
                          {item.name}
                        </Text>
                      </Pressable>

                      {/* Weight summary + Edit link for items with weightOptions */}
                      {hasWeights && isChecked && (
                        <Pressable
                          onPress={() => handleOpenWeightSheet(item)}
                          style={[
                            styles.weightSummaryRow,
                            { borderBottomColor: colors.border },
                          ]}
                        >
                          <Text
                            style={[
                              typography.bodySmall,
                              { color: colors.textSecondary, flex: 1 },
                            ]}
                            numberOfLines={1}
                          >
                            {formatWeightSummary(weights, item.weightOptions!.unit)}
                          </Text>
                          <Text
                            style={[
                              typography.bodySmall,
                              { color: colors.primary, fontWeight: '600', marginLeft: 8 },
                            ]}
                          >
                            Edit
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
            </View>
          );
        })}
      </View>

      {/* Weight Selection Bottom Sheet */}
      <BottomSheet
        visible={!!weightSheetItem}
        onClose={() => setWeightSheetItem(null)}
        maxHeight={0.7}
      >
        {weightSheetItem?.weightOptions && (
          <View>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>
                Select {weightSheetItem.weightOptions.label}
              </Text>
              <Pressable onPress={allSelected ? handleDeselectAllWeights : handleSelectAllWeights}>
                <Text style={[typography.bodySmall, { color: colors.primary, fontWeight: '600' }]}>
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Text>
              </Pressable>
            </View>

            {/* Weight list */}
            {weightSheetItem.weightOptions.values.map((weight) => {
              const isSelected = sheetWeightSet.has(weight);
              return (
                <Pressable
                  key={weight}
                  onPress={() => handleToggleWeight(weight)}
                  style={[
                    styles.weightRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                    {weight} {weightSheetItem.weightOptions!.unit}
                  </Text>
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isSelected ? colors.primary : colors.textTertiary}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </BottomSheet>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weightSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 52, // aligned with text after checkbox (16 + 24 icon + 12 margin)
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
