import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { Card, Button, Divider, ScreenContainer } from '../../src/components/ui';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import {
  useMeasurementsStore,
  type BodyMeasurement,
  type ProgressPhoto,
} from '../../src/stores/measurements-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { estimateBodyMeasurements } from '../../src/lib/ai-body-analyzer';

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

  const profileGender = useProfileStore((s) => s.profile.gender);
  const profileHeightCm = useProfileStore((s) => s.profile.heightCm);

  // Form state
  const [weight, setWeight] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightCmInput, setHeightCmInput] = useState('');
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [estimatedFields, setEstimatedFields] = useState<Set<string>>(new Set());
  const [isEstimating, setIsEstimating] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Pre-fill form from last measurement when switching to log tab
  const hasPrefilledRef = useRef(false);
  useEffect(() => {
    if (activeTab !== 'log' || measurements.length === 0) return;
    if (hasPrefilledRef.current) return;
    hasPrefilledRef.current = true;
    const last = measurements[0]; // sorted by date desc
    if (last.weightKg != null) setWeight(displayWeight(last.weightKg, imperial));
    if (last.heightCm != null) {
      if (imperial) {
        const totalInches = last.heightCm / IN_TO_CM;
        setHeightFeet(Math.floor(totalInches / 12).toString());
        setHeightInches(Math.round(totalInches % 12).toString());
      } else {
        setHeightCmInput(last.heightCm.toFixed(1));
      }
    } else if (profileHeightCm) {
      if (imperial) {
        const totalInches = profileHeightCm / IN_TO_CM;
        setHeightFeet(Math.floor(totalInches / 12).toString());
        setHeightInches(Math.round(totalInches % 12).toString());
      } else {
        setHeightCmInput(profileHeightCm.toFixed(1));
      }
    }
    const fields: Record<string, string> = {};
    for (const field of MEASUREMENT_FIELDS) {
      const val = (last as any)[field.key];
      if (val != null) {
        fields[field.key] = displayLength(val, imperial);
      }
    }
    setFormFields(fields);
    if (last.notes) setNotes(last.notes);
  }, [activeTab, measurements.length, imperial, measurements, profileHeightCm]);

  // ── Weight Chart Data ────────────────────────────────────────────

  const weightHistory = measurements
    .filter((m) => m.weightKg != null)
    .slice(0, 12)
    .reverse();

  const weightValues = weightHistory.map((m) => m.weightKg!);
  const maxWeight = weightValues.length > 0 ? Math.max(...weightValues) : 100;
  const minWeight = weightValues.length > 0 ? Math.min(...weightValues) : 0;
  const weightRange = maxWeight - minWeight || 1;

  // ── Form Submit ──────────────────────────────────────────────────

  // Parse height from form inputs
  const getHeightCm = useCallback((): number | undefined => {
    if (imperial) {
      const ft = parseInt(heightFeet, 10);
      const inches = parseInt(heightInches, 10);
      if (isNaN(ft) && isNaN(inches)) return undefined;
      const totalInches = (isNaN(ft) ? 0 : ft) * 12 + (isNaN(inches) ? 0 : inches);
      if (totalInches <= 0) return undefined;
      return totalInches * IN_TO_CM;
    } else {
      const cm = parseFloat(heightCmInput);
      if (isNaN(cm) || cm <= 0) return undefined;
      return cm;
    }
  }, [imperial, heightFeet, heightInches, heightCmInput]);

  const handleSave = useCallback(() => {
    const weightKg = parseWeight(weight, imperial);
    const heightCm = getHeightCm();
    const parsed: Partial<BodyMeasurement> = {};

    for (const field of MEASUREMENT_FIELDS) {
      const val = formFields[field.key];
      if (val) {
        (parsed as any)[field.key] = parseLength(val, imperial);
      }
    }

    if (!weightKg && !heightCm && Object.values(parsed).every((v) => v == null) && !notes) {
      crossPlatformAlert('Empty', 'Please enter at least one measurement.');
      return;
    }

    addMeasurement({
      date: new Date().toISOString(),
      weightKg,
      heightCm,
      ...parsed,
      notes: notes || undefined,
    });

    // Reset form
    setWeight('');
    setHeightFeet('');
    setHeightInches('');
    setHeightCmInput('');
    setFormFields({});
    setNotes('');
    setEstimatedFields(new Set());
    crossPlatformAlert('Saved', 'Measurement recorded successfully.');
  }, [weight, formFields, notes, imperial, addMeasurement, getHeightCm]);

  // AI estimation
  const handleAISuggest = useCallback(async () => {
    const waistVal = formFields['waistCm'];
    if (!waistVal) {
      crossPlatformAlert('Waist Required', 'Please enter your waist measurement first.');
      return;
    }
    const waistCm = parseLength(waistVal, imperial);
    if (!waistCm) {
      crossPlatformAlert('Invalid', 'Please enter a valid waist measurement.');
      return;
    }

    const heightCm = getHeightCm() ?? profileHeightCm;
    if (!heightCm) {
      crossPlatformAlert('Height Required', 'Please enter your height to use AI suggestions.');
      return;
    }

    const weightKg = parseWeight(weight, imperial);
    if (!weightKg) {
      crossPlatformAlert('Weight Required', 'Please enter your weight to use AI suggestions.');
      return;
    }

    setIsEstimating(true);
    try {
      const result = await estimateBodyMeasurements({
        heightCm,
        weightKg,
        gender: profileGender,
        waistCm,
      });

      const newFields = { ...formFields };
      const newEstimated = new Set(estimatedFields);

      const fieldMap: Record<string, keyof typeof result> = {
        chestCm: 'chestCm',
        hipsCm: 'hipsCm',
        leftArmCm: 'leftArmCm',
        rightArmCm: 'rightArmCm',
        leftThighCm: 'leftThighCm',
        rightThighCm: 'rightThighCm',
      };

      for (const [key, resultKey] of Object.entries(fieldMap)) {
        if (!newFields[key]) {
          const cmVal = result[resultKey];
          newFields[key] = displayLength(cmVal, imperial);
          newEstimated.add(key);
        }
      }

      setFormFields(newFields);
      setEstimatedFields(newEstimated);
    } catch (error) {
      crossPlatformAlert('Error', 'Could not estimate measurements. Please try again.');
    } finally {
      setIsEstimating(false);
    }
  }, [formFields, imperial, weight, getHeightCm, profileHeightCm, profileGender, estimatedFields]);

  // ── Photo Picker ─────────────────────────────────────────────────

  const handleAddPhoto = useCallback(async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        crossPlatformAlert('Permission Required', 'Please allow photo library access to add progress photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!result.canceled && result.assets[0]) {
        crossPlatformAlert('Label Photo', 'Select a label for this photo:', [
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
      crossPlatformAlert('Error', 'Could not open photo picker.');
    }
  }, [addPhoto]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        crossPlatformAlert('Permission Required', 'Please allow camera access to take progress photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!result.canceled && result.assets[0]) {
        crossPlatformAlert('Label Photo', 'Select a label for this photo:', [
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
      crossPlatformAlert('Error', 'Could not open camera.');
    }
  }, [addPhoto]);

  // ── Delete Handlers ──────────────────────────────────────────────

  const confirmDeleteMeasurement = useCallback(
    (id: string) => {
      crossPlatformAlert('Delete Measurement', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMeasurement(id) },
      ]);
    },
    [deleteMeasurement],
  );

  const confirmDeletePhoto = useCallback(
    (id: string) => {
      crossPlatformAlert('Delete Photo', 'Are you sure?', [
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

            {/* Height */}
            <Text style={[typography.label, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Height {imperial ? '(ft / in)' : '(cm)'}
            </Text>
            {imperial ? (
              <View style={styles.heightRow}>
                <TextInput
                  style={[
                    styles.heightInput,
                    {
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      color: colors.text,
                      backgroundColor: colors.surface,
                      paddingHorizontal: spacing.md,
                    },
                    typography.body,
                  ]}
                  value={heightFeet}
                  onChangeText={setHeightFeet}
                  placeholder="5"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                />
                <Text style={[typography.label, { color: colors.textSecondary, marginHorizontal: spacing.xs }]}>ft</Text>
                <TextInput
                  style={[
                    styles.heightInput,
                    {
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      color: colors.text,
                      backgroundColor: colors.surface,
                      paddingHorizontal: spacing.md,
                    },
                    typography.body,
                  ]}
                  value={heightInches}
                  onChangeText={setHeightInches}
                  placeholder="10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                />
                <Text style={[typography.label, { color: colors.textSecondary, marginLeft: spacing.xs }]}>in</Text>
              </View>
            ) : (
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
                value={heightCmInput}
                onChangeText={setHeightCmInput}
                placeholder="e.g. 178"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            )}

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
                  <View style={styles.fieldLabelRow}>
                    <Text
                      style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}
                    >
                      {field.label}
                    </Text>
                    {estimatedFields.has(field.key) && (
                      <View style={styles.estimatedBadge}>
                        <Ionicons name="sparkles" size={10} color={colors.primary} />
                        <Text style={[typography.caption, { color: colors.primary, fontSize: 9, marginLeft: 2 }]}>
                          est.
                        </Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={[
                      styles.smallInput,
                      {
                        borderColor: estimatedFields.has(field.key) ? colors.primary : colors.border,
                        borderRadius: radius.sm,
                        color: estimatedFields.has(field.key) ? colors.primary : colors.text,
                        backgroundColor: colors.surface,
                        paddingHorizontal: spacing.sm,
                      },
                      typography.bodySmall,
                    ]}
                    value={formFields[field.key] ?? ''}
                    onChangeText={(v) => {
                      setFormFields((prev) => ({ ...prev, [field.key]: v }));
                      setEstimatedFields((prev) => {
                        const next = new Set(prev);
                        next.delete(field.key);
                        return next;
                      });
                    }}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textTertiary}
                    placeholder="—"
                  />
                </View>
              ))}
            </View>

            {/* AI Suggest Button */}
            {formFields['waistCm'] && (
              <TouchableOpacity
                onPress={handleAISuggest}
                disabled={isEstimating}
                style={[
                  styles.aiSuggestBtn,
                  {
                    backgroundColor: colors.primaryMuted,
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    marginBottom: spacing.md,
                  },
                ]}
                activeOpacity={0.7}
              >
                {isEstimating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                )}
                <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: spacing.xs }]}>
                  {isEstimating ? 'Estimating...' : 'Suggest with AI'}
                </Text>
              </TouchableOpacity>
            )}

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
                  {m.heightCm != null && (
                    <View style={styles.historyItem}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        Height
                      </Text>
                      <Text style={[typography.label, { color: colors.text }]}>
                        {imperial
                          ? `${Math.floor(m.heightCm / 2.54 / 12)}'${Math.round((m.heightCm / 2.54) % 12)}"`
                          : `${m.heightCm.toFixed(1)} cm`}
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
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  heightInput: {
    borderWidth: 1,
    minHeight: 44,
    paddingVertical: 10,
    width: 60,
    textAlign: 'center',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  estimatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiSuggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
