import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { Card, Button, Divider, ScreenContainer } from '../../src/components/ui';
import {
  useMeasurementsStore,
  type BodyMeasurement,
  type ProgressPhoto,
} from '../../src/stores/measurements-store';
import { useProfileStore } from '../../src/stores/profile-store';

// ── Unit Conversion Helpers ────────────────────────────────────────

const CM_TO_IN = 0.393701;
const IN_TO_CM = 2.54;
const KG_TO_LB = 2.20462;
const LB_TO_KG = 0.453592;

function displayWeight(kg: number | undefined, imperial: boolean): string {
  if (kg == null) return '';
  return imperial ? (kg * KG_TO_LB).toFixed(1) : kg.toFixed(1);
}

function displayLength(cm: number | undefined, imperial: boolean): string {
  if (cm == null) return '';
  return imperial ? (cm * CM_TO_IN).toFixed(1) : cm.toFixed(1);
}

function parseWeight(value: string, imperial: boolean): number | undefined {
  const n = parseFloat(value);
  if (isNaN(n) || n <= 0) return undefined;
  return imperial ? n * LB_TO_KG : n;
}

function parseLength(value: string, imperial: boolean): number | undefined {
  const n = parseFloat(value);
  if (isNaN(n) || n <= 0) return undefined;
  return imperial ? n * IN_TO_CM : n;
}

// ── Main Component ─────────────────────────────────────────────────

type Tab = 'log' | 'history' | 'photos';

const MEASUREMENT_FIELDS = [
  { key: 'chestCm', label: 'Chest', isWeight: false },
  { key: 'waistCm', label: 'Waist', isWeight: false },
  { key: 'hipsCm', label: 'Hips', isWeight: false },
  { key: 'leftArmCm', label: 'Left Arm', isWeight: false },
  { key: 'rightArmCm', label: 'Right Arm', isWeight: false },
  { key: 'leftThighCm', label: 'Left Thigh', isWeight: false },
  { key: 'rightThighCm', label: 'Right Thigh', isWeight: false },
] as const;

export default function MeasurementsScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const router = useRouter();

  const measurements = useMeasurementsStore((s) => s.measurements);
  const photos = useMeasurementsStore((s) => s.photos);
  const addMeasurement = useMeasurementsStore((s) => s.addMeasurement);
  const deleteMeasurement = useMeasurementsStore((s) => s.deleteMeasurement);
  const addPhoto = useMeasurementsStore((s) => s.addPhoto);
  const deletePhoto = useMeasurementsStore((s) => s.deletePhoto);
  const initialize = useMeasurementsStore((s) => s.initialize);
  const isInitialized = useMeasurementsStore((s) => s.isInitialized);

  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const imperial = unitPref === 'imperial';
  const weightUnit = imperial ? 'lbs' : 'kg';
  const lengthUnit = imperial ? 'in' : 'cm';

  const [activeTab, setActiveTab] = useState<Tab>('log');

  // Form state
  const [weight, setWeight] = useState('');
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // ── Weight Chart Data ────────────────────────────────────────────

  const weightHistory = measurements
    .filter((m) => m.weightKg != null)
    .slice(0, 12)
    .reverse();

  const maxWeight = Math.max(...weightHistory.map((m) => m.weightKg!), 1);
  const minWeight = Math.min(...weightHistory.map((m) => m.weightKg!), 0);
  const weightRange = maxWeight - minWeight || 1;

  // ── Form Submit ──────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const weightKg = parseWeight(weight, imperial);
    const parsed: Partial<BodyMeasurement> = {};

    for (const field of MEASUREMENT_FIELDS) {
      const val = formFields[field.key];
      if (val) {
        (parsed as any)[field.key] = parseLength(val, imperial);
      }
    }

    if (!weightKg && Object.values(parsed).every((v) => v == null) && !notes) {
      Alert.alert('Empty', 'Please enter at least one measurement.');
      return;
    }

    addMeasurement({
      date: new Date().toISOString(),
      weightKg,
      ...parsed,
      notes: notes || undefined,
    });

    // Reset form
    setWeight('');
    setFormFields({});
    setNotes('');
    Alert.alert('Saved', 'Measurement recorded successfully.');
  }, [weight, formFields, notes, imperial, addMeasurement]);

  // ── Photo Picker ─────────────────────────────────────────────────

  const handleAddPhoto = useCallback(async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access to add progress photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!result.canceled && result.assets[0]) {
        Alert.alert('Label Photo', 'Select a label for this photo:', [
          {
            text: 'Front',
            onPress: () =>
              addPhoto({ date: new Date().toISOString(), uri: result.assets[0].uri, label: 'front' }),
          },
          {
            text: 'Side',
            onPress: () =>
              addPhoto({ date: new Date().toISOString(), uri: result.assets[0].uri, label: 'side' }),
          },
          {
            text: 'Back',
            onPress: () =>
              addPhoto({ date: new Date().toISOString(), uri: result.assets[0].uri, label: 'back' }),
          },
          {
            text: 'No Label',
            onPress: () =>
              addPhoto({ date: new Date().toISOString(), uri: result.assets[0].uri }),
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open photo picker.');
    }
  }, [addPhoto]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to take progress photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!result.canceled && result.assets[0]) {
        Alert.alert('Label Photo', 'Select a label for this photo:', [
          {
            text: 'Front',
            onPress: () =>
              addPhoto({ date: new Date().toISOString(), uri: result.assets[0].uri, label: 'front' }),
          },
          {
            text: 'Side',
            onPress: () =>
              addPhoto({ date: new Date().toISOString(), uri: result.assets[0].uri, label: 'side' }),
          },
          {
            text: 'Back',
            onPress: () =>
              addPhoto({ date: new Date().toISOString(), uri: result.assets[0].uri, label: 'back' }),
          },
          {
            text: 'No Label',
            onPress: () =>
              addPhoto({ date: new Date().toISOString(), uri: result.assets[0].uri }),
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open camera.');
    }
  }, [addPhoto]);

  // ── Delete Handlers ──────────────────────────────────────────────

  const confirmDeleteMeasurement = useCallback(
    (id: string) => {
      Alert.alert('Delete Measurement', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMeasurement(id) },
      ]);
    },
    [deleteMeasurement],
  );

  const confirmDeletePhoto = useCallback(
    (id: string) => {
      Alert.alert('Delete Photo', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePhoto(id) },
      ]);
    },
    [deletePhoto],
  );

  // ── Render ───────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'log', label: 'Log', icon: 'add-circle-outline' },
    { key: 'history', label: 'History', icon: 'list-outline' },
    { key: 'photos', label: 'Photos', icon: 'camera-outline' },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Body Measurements
        </Text>
      </View>

      {/* Weight Chart */}
      {weightHistory.length > 1 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Weight Trend
          </Text>
          <Card>
            <View style={styles.chartContainer}>
              {weightHistory.map((m, i) => {
                const normalized = (m.weightKg! - minWeight) / weightRange;
                const height = Math.max(normalized * 80, 4);
                return (
                  <View key={m.id} style={styles.chartBar}>
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textTertiary, fontSize: 9, marginBottom: 2 },
                      ]}
                    >
                      {displayWeight(m.weightKg, imperial)}
                    </Text>
                    <View
                      style={[
                        styles.bar,
                        {
                          height,
                          backgroundColor: colors.primary,
                          borderRadius: radius.sm,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textTertiary, marginTop: 4, fontSize: 9 },
                      ]}
                    >
                      {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      )}

      {/* Tab Selector */}
      <View style={[styles.tabRow, { marginBottom: spacing.md, gap: spacing.xs }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab.key ? colors.primary : colors.surfaceSecondary,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                flex: 1,
              },
            ]}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.key ? colors.textInverse : colors.textSecondary}
            />
            <Text
              style={[
                typography.labelSmall,
                {
                  color: activeTab === tab.key ? colors.textInverse : colors.textSecondary,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Log Tab */}
      {activeTab === 'log' && (
        <View style={{ marginBottom: spacing['2xl'] }}>
          <Card>
            {/* Weight */}
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Weight ({weightUnit})
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  color: colors.text,
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.md,
                  marginBottom: spacing.md,
                },
                typography.body,
              ]}
              value={weight}
              onChangeText={setWeight}
              placeholder={`e.g. ${imperial ? '165' : '75'}`}
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />

            <Divider />

            {/* Body Part Fields */}
            <Text
              style={[
                typography.label,
                { color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
              ]}
            >
              Body Measurements ({lengthUnit})
            </Text>
            <View style={styles.fieldGrid}>
              {MEASUREMENT_FIELDS.map((field) => (
                <View key={field.key} style={styles.fieldItem}>
                  <Text
                    style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}
                  >
                    {field.label}
                  </Text>
                  <TextInput
                    style={[
                      styles.smallInput,
                      {
                        borderColor: colors.border,
                        borderRadius: radius.sm,
                        color: colors.text,
                        backgroundColor: colors.surface,
                        paddingHorizontal: spacing.sm,
                      },
                      typography.bodySmall,
                    ]}
                    value={formFields[field.key] ?? ''}
                    onChangeText={(v) =>
                      setFormFields((prev) => ({ ...prev, [field.key]: v }))
                    }
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textTertiary}
                    placeholder="—"
                  />
                </View>
              ))}
            </View>

            <Divider />

            {/* Notes */}
            <Text
              style={[
                typography.label,
                { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
              ]}
            >
              Notes
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  color: colors.text,
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.md,
                  height: 60,
                  textAlignVertical: 'top',
                  marginBottom: spacing.md,
                },
                typography.body,
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes..."
              placeholderTextColor={colors.textTertiary}
              multiline
            />

            <Button title="Save Measurement" onPress={handleSave} />
          </Card>
        </View>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <View style={{ marginBottom: spacing['2xl'] }}>
          {measurements.length === 0 ? (
            <Card>
              <Text
                style={[
                  typography.body,
                  { color: colors.textTertiary, textAlign: 'center', padding: spacing.xl },
                ]}
              >
                No measurements yet. Log your first!
              </Text>
            </Card>
          ) : (
            measurements.map((m) => (
              <Card key={m.id} style={{ marginBottom: spacing.sm }}>
                <View style={styles.historyHeader}>
                  <Text style={[typography.label, { color: colors.text }]}>
                    {new Date(m.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <TouchableOpacity onPress={() => confirmDeleteMeasurement(m.id)} hitSlop={12}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <View style={styles.historyGrid}>
                  {m.weightKg != null && (
                    <View style={styles.historyItem}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        Weight
                      </Text>
                      <Text style={[typography.label, { color: colors.text }]}>
                        {displayWeight(m.weightKg, imperial)} {weightUnit}
                      </Text>
                    </View>
                  )}
                  {MEASUREMENT_FIELDS.map((field) => {
                    const val = (m as any)[field.key];
                    if (val == null) return null;
                    return (
                      <View key={field.key} style={styles.historyItem}>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {field.label}
                        </Text>
                        <Text style={[typography.label, { color: colors.text }]}>
                          {displayLength(val, imperial)} {lengthUnit}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {m.notes && (
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary, marginTop: spacing.sm },
                    ]}
                  >
                    {m.notes}
                  </Text>
                )}
              </Card>
            ))
          )}
        </View>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <View style={{ marginBottom: spacing['2xl'] }}>
          {/* Add Photo Buttons */}
          <View style={[styles.photoActions, { gap: spacing.sm, marginBottom: spacing.md }]}>
            <TouchableOpacity
              onPress={handleTakePhoto}
              style={[
                styles.photoActionBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  flex: 1,
                },
              ]}
            >
              <Ionicons name="camera" size={20} color={colors.textInverse} />
              <Text
                style={[typography.label, { color: colors.textInverse, marginLeft: spacing.xs }]}
              >
                Take Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAddPhoto}
              style={[
                styles.photoActionBtn,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="images" size={20} color={colors.text} />
              <Text style={[typography.label, { color: colors.text, marginLeft: spacing.xs }]}>
                Pick Photo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Photo Grid */}
          {photos.length === 0 ? (
            <Card>
              <Text
                style={[
                  typography.body,
                  { color: colors.textTertiary, textAlign: 'center', padding: spacing.xl },
                ]}
              >
                No progress photos yet. Take your first!
              </Text>
            </Card>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <View
                  key={photo.id}
                  style={[
                    styles.photoCard,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={[styles.photoImage, { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md }]}
                  />
                  <View style={{ padding: spacing.sm }}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      {new Date(photo.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    {photo.label && (
                      <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                        {photo.label.charAt(0).toUpperCase() + photo.label.slice(1)}
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={() => confirmDeletePhoto(photo.id)}
                      style={{ marginTop: spacing.xs }}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 16,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 20,
    minHeight: 4,
  },
  tabRow: {
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    minHeight: 44,
    paddingVertical: 10,
  },
  smallInput: {
    borderWidth: 1,
    height: 36,
    paddingVertical: 4,
    minWidth: 60,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  fieldItem: {
    width: '45%',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  historyItem: {
    minWidth: '40%',
  },
  photoActions: {
    flexDirection: 'row',
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCard: {
    width: '48%',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
});
