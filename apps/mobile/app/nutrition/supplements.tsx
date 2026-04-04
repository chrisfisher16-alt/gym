import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useSupplements } from '../../src/hooks/useSupplements';
import { Card, Button, ScreenContainer, Badge, EmptyState } from '../../src/components/ui';
import type { SupplementEntry, UserSupplementEntry } from '../../src/types/nutrition';

type Frequency = UserSupplementEntry['frequency'];
type TimeOfDay = UserSupplementEntry['timeOfDay'];

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_daily', label: 'Twice Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as_needed', label: 'As Needed' },
];

const TIME_OPTIONS: { value: TimeOfDay; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'with_meals', label: 'With Meals' },
  { value: 'any', label: 'Any Time' },
];

export default function SupplementsScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const {
    activeSupplements,
    availableCatalogItems,
    supplementCatalog,
    supplementsTaken,
    addUserSupplement,
    removeUserSupplement,
    logSupplement,
    unlogSupplement,
    isSupplementTaken,
  } = useSupplements();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<SupplementEntry | null>(null);
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');

  const handleSelectCatalogItem = (item: SupplementEntry) => {
    setSelectedCatalogItem(item);
    setDose(item.defaultDose);
    setShowAddForm(true);
  };

  const handleAddSupplement = () => {
    if (!selectedCatalogItem) return;

    addUserSupplement(
      selectedCatalogItem.id,
      dose || selectedCatalogItem.defaultDose,
      selectedCatalogItem.defaultUnit,
      frequency,
      timeOfDay,
    );

    setShowAddForm(false);
    setSelectedCatalogItem(null);
    setDose('');
  };

  const handleRemove = (id: string, name: string) => {
    crossPlatformAlert('Remove Supplement', `Stop tracking "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeUserSupplement(id) },
    ]);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Supplements
        </Text>
      </View>

      {/* My Supplements */}
      {activeSupplements.length > 0 && (
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            My Supplements
          </Text>

          {activeSupplements.map((supp) => {
            const taken = isSupplementTaken(supp.id);
            return (
              <Card key={supp.id} style={{ marginBottom: spacing.sm }}>
                <View style={styles.suppRow}>
                  <TouchableOpacity
                    onPress={() => taken ? unlogSupplement(supp.id) : logSupplement(supp.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={taken ? 'checkbox' : 'square-outline'}
                      size={26}
                      color={taken ? colors.success : colors.textTertiary}
                    />
                  </TouchableOpacity>

                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[
                      typography.labelLarge,
                      {
                        color: taken ? colors.textSecondary : colors.text,
                        textDecorationLine: taken ? 'line-through' : 'none',
                      },
                    ]}>
                      {supp.supplementName}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {supp.dose} {supp.unit} · {supp.frequency.replace('_', ' ')} · {supp.timeOfDay.replace('_', ' ')}
                    </Text>
                    {supp.streak > 0 && (
                      <View style={[styles.streakRow, { marginTop: 4 }]}>
                        <Ionicons name="flame" size={14} color={colors.warning} />
                        <Text style={[typography.caption, { color: colors.warning, marginLeft: 4 }]}>
                          {supp.streak} day streak
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => handleRemove(supp.id, supp.supplementName)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Add Supplement Form */}
      {showAddForm && selectedCatalogItem && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
            Add {selectedCatalogItem.name}
          </Text>

          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            {selectedCatalogItem.description}
          </Text>

          {/* Dose */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Dose ({selectedCatalogItem.defaultUnit})
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                  color: colors.text,
                  paddingHorizontal: spacing.md,
                  ...typography.body,
                },
              ]}
              value={dose}
              onChangeText={setDose}
              keyboardType="numeric"
              placeholder={selectedCatalogItem.defaultDose}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          {/* Frequency */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Frequency
            </Text>
            <View style={styles.chipRow}>
              {FREQUENCY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: frequency === opt.value ? colors.primary : colors.surfaceSecondary,
                      borderRadius: radius.full,
                    },
                  ]}
                  onPress={() => setFrequency(opt.value)}
                >
                  <Text style={[typography.bodySmall, { color: frequency === opt.value ? colors.textInverse : colors.text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Time of Day */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Time of Day
            </Text>
            <View style={styles.chipRow}>
              {TIME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: timeOfDay === opt.value ? colors.primary : colors.surfaceSecondary,
                      borderRadius: radius.full,
                    },
                  ]}
                  onPress={() => setTimeOfDay(opt.value)}
                >
                  <Text style={[typography.bodySmall, { color: timeOfDay === opt.value ? colors.textInverse : colors.text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="ghost" onPress={() => setShowAddForm(false)} fullWidth={false} style={{ flex: 1 }} />
            <Button title="Add" onPress={handleAddSupplement} fullWidth={false} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {/* Catalog */}
      <View style={{ marginBottom: spacing['2xl'] }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Supplement Catalog
        </Text>

        {availableCatalogItems.length === 0 && activeSupplements.length > 0 ? (
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg }]}>
            You&apos;ve added all available supplements!
          </Text>
        ) : (
          availableCatalogItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => handleSelectCatalogItem(item)}
            >
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.catalogRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.labelLarge, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      {item.description}
                    </Text>
                    <View style={[styles.benefitRow, { marginTop: spacing.xs }]}>
                      {item.benefits.slice(0, 3).map((benefit) => (
                        <Badge key={benefit} label={benefit} variant="default" />
                      ))}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[typography.label, { color: colors.textSecondary }]}>
                      {item.defaultDose} {item.defaultUnit}
                    </Text>
                    <Ionicons name="add-circle" size={24} color={colors.primary} style={{ marginTop: spacing.sm }} />
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suppRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    minHeight: 44,
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catalogRow: {
    flexDirection: 'row',
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
});
