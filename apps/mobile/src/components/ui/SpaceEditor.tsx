import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import {
  useSpaceStore,
  SPACE_TEMPLATES,
  type TrainingSpace,
  type SpaceNutritionTargets,
} from '../../stores/space-store';
import { useWorkoutStore } from '../../stores/workout-store';
import { lightImpact, selectionFeedback } from '../../lib/haptics';
import type { CoachTone } from '@health-coach/shared';

// ── Types ──────────────────────────────────────────────────────────

export interface SpaceEditorProps {
  visible: boolean;
  onClose: () => void;
  /** Pass an existing space to edit; omit for create mode */
  editingSpace?: TrainingSpace;
}

// ── Icon Options ───────────────────────────────────────────────────

const ICON_OPTIONS: (keyof typeof Ionicons.glyphMap)[] = [
  'flame-outline',
  'barbell-outline',
  'fitness-outline',
  'trophy-outline',
  'heart-outline',
  'flash-outline',
  'speedometer-outline',
  'body-outline',
  'bicycle-outline',
  'timer-outline',
  'rocket-outline',
  'shield-outline',
];

// ── Accent Colors ──────────────────────────────────────────────────

const ACCENT_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#10B981', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
];

// ── Coach Tone Options ─────────────────────────────────────────────

const TONE_OPTIONS: { value: CoachTone; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'encouraging', label: 'Gentle', icon: 'heart-outline' },
  { value: 'balanced', label: 'Balanced', icon: 'scale-outline' },
  { value: 'direct', label: 'Intense', icon: 'flash-outline' },
];

// ── Component ──────────────────────────────────────────────────────

export function SpaceEditor({ visible, onClose, editingSpace }: SpaceEditorProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const createSpace = useSpaceStore((s) => s.createSpace);
  const updateSpace = useSpaceStore((s) => s.updateSpace);
  const switchSpace = useSpaceStore((s) => s.switchSpace);
  const programs = useWorkoutStore((s) => s.programs);

  // ── Form State ────────────────────────────────────────────────

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('flame-outline');
  const [accentColor, setAccentColor] = useState<string>(ACCENT_COLORS[0]);
  const [description, setDescription] = useState('');
  const [coachTone, setCoachTone] = useState<CoachTone>('balanced');
  const [activeProgram, setActiveProgram] = useState<string | undefined>(undefined);
  const [nutritionTargets, setNutritionTargets] = useState<SpaceNutritionTargets>({});
  const [showTemplates, setShowTemplates] = useState(false);

  // Reset form when opening/closing or switching between create/edit
  useEffect(() => {
    if (visible) {
      if (editingSpace) {
        setName(editingSpace.name);
        setIcon(editingSpace.icon);
        setAccentColor(editingSpace.accentColor ?? ACCENT_COLORS[0]);
        setDescription(editingSpace.description ?? '');
        setCoachTone(editingSpace.coachTone ?? 'balanced');
        setActiveProgram(editingSpace.activeProgram);
        setNutritionTargets(editingSpace.nutritionTargets ?? {});
        setShowTemplates(false);
      } else {
        setName('');
        setIcon('flame-outline');
        setAccentColor(ACCENT_COLORS[0]);
        setDescription('');
        setCoachTone('balanced');
        setActiveProgram(undefined);
        setNutritionTargets({});
        setShowTemplates(true);
      }
    }
  }, [visible, editingSpace]);

  // ── Template Selection ────────────────────────────────────────

  const applyTemplate = (templateIndex: number) => {
    const template = SPACE_TEMPLATES[templateIndex];
    setName(template.name);
    setIcon(template.icon);
    setAccentColor(template.accentColor ?? ACCENT_COLORS[0]);
    setDescription(template.description ?? '');
    setCoachTone(template.coachTone ?? 'balanced');
    setNutritionTargets(template.nutritionTargets ?? {});
    setShowTemplates(false);
    selectionFeedback();
  };

  // ── Save ──────────────────────────────────────────────────────

  const handleSave = () => {
    if (!name.trim()) return;

    const spaceData = {
      name: name.trim(),
      icon,
      accentColor,
      description: description.trim() || undefined,
      coachTone,
      activeProgram,
      nutritionTargets:
        Object.values(nutritionTargets).some((v) => v != null)
          ? nutritionTargets
          : undefined,
    };

    if (editingSpace) {
      updateSpace(editingSpace.id, spaceData);
    } else {
      const id = createSpace(spaceData);
      switchSpace(id);
    }

    lightImpact();
    onClose();
  };

  // ── Macro Input Helper ────────────────────────────────────────

  const updateMacro = (key: keyof SpaceNutritionTargets, text: string) => {
    const num = text === '' ? undefined : parseInt(text, 10);
    setNutritionTargets((prev) => ({
      ...prev,
      [key]: num != null && !isNaN(num) ? num : undefined,
    }));
  };

  const isEditing = !!editingSpace;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.9}>
      <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.base }]}>
        {isEditing ? 'Edit Space' : 'New Training Space'}
      </Text>

      {/* ── Templates (create mode only) ──────────────────────── */}
      {!isEditing && showTemplates && (
        <View style={{ marginBottom: spacing.base }}>
          <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }]}>
            Start from template
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {SPACE_TEMPLATES.map((template, idx) => (
              <Pressable
                key={template.name}
                onPress={() => applyTemplate(idx)}
                style={({ pressed }) => [
                  styles.templateCard,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    marginRight: spacing.sm,
                    borderColor: template.accentColor ?? colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={template.icon as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color={template.accentColor ?? colors.text}
                />
                <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }]}>
                  {template.name}
                </Text>
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={2}>
                  {template.description}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowTemplates(false)}
              style={({ pressed }) => [
                styles.templateCard,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <Ionicons name="create-outline" size={24} color={colors.textSecondary} />
              <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                Custom
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* ── Name ──────────────────────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Name
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Cut Phase"
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.textInput,
          {
            backgroundColor: colors.surfaceSecondary,
            color: colors.text,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.base,
            ...typography.body,
          },
        ]}
      />

      {/* ── Description ───────────────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Description
      </Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Optional description"
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.textInput,
          {
            backgroundColor: colors.surfaceSecondary,
            color: colors.text,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.base,
            ...typography.body,
          },
        ]}
      />

      {/* ── Icon Picker ───────────────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Icon
      </Text>
      <View style={[styles.iconGrid, { marginBottom: spacing.base }]}>
        {ICON_OPTIONS.map((iconName) => (
          <Pressable
            key={iconName}
            onPress={() => {
              setIcon(iconName);
              selectionFeedback();
            }}
            style={[
              styles.iconOption,
              {
                backgroundColor: icon === iconName ? accentColor + '20' : colors.surfaceSecondary,
                borderColor: icon === iconName ? accentColor : 'transparent',
                borderRadius: radius.md,
              },
            ]}
          >
            <Ionicons
              name={iconName}
              size={22}
              color={icon === iconName ? accentColor : colors.textSecondary}
            />
          </Pressable>
        ))}
      </View>

      {/* ── Accent Color ──────────────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Accent Color
      </Text>
      <View style={[styles.colorRow, { marginBottom: spacing.base }]}>
        {ACCENT_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => {
              setAccentColor(color);
              selectionFeedback();
            }}
            style={[
              styles.colorSwatch,
              {
                backgroundColor: color,
                borderRadius: radius.full,
                borderWidth: accentColor === color ? 3 : 0,
                borderColor: colors.text,
              },
            ]}
          />
        ))}
      </View>

      {/* ── Coach Tone ────────────────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Coach Tone
      </Text>
      <View style={[styles.toneRow, { marginBottom: spacing.base }]}>
        {TONE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              setCoachTone(option.value);
              selectionFeedback();
            }}
            style={[
              styles.toneOption,
              {
                backgroundColor: coachTone === option.value ? accentColor + '18' : colors.surfaceSecondary,
                borderColor: coachTone === option.value ? accentColor : colors.border,
                borderRadius: radius.md,
                padding: spacing.sm,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Ionicons
              name={option.icon}
              size={16}
              color={coachTone === option.value ? accentColor : colors.textSecondary}
            />
            <Text
              style={[
                typography.label,
                {
                  color: coachTone === option.value ? accentColor : colors.textSecondary,
                  marginLeft: spacing.xs,
                  fontSize: 13,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Nutrition Targets (Optional) ──────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Nutrition Targets (Optional)
      </Text>
      <View style={[styles.macroGrid, { marginBottom: spacing.base }]}>
        <MacroInput
          label="Calories"
          value={nutritionTargets.calories}
          onChangeText={(t) => updateMacro('calories', t)}
          suffix="kcal"
          colors={colors}
          typography={typography}
          spacing={spacing}
          radius={radius}
        />
        <MacroInput
          label="Protein"
          value={nutritionTargets.proteinGrams}
          onChangeText={(t) => updateMacro('proteinGrams', t)}
          suffix="g"
          colors={colors}
          typography={typography}
          spacing={spacing}
          radius={radius}
        />
        <MacroInput
          label="Carbs"
          value={nutritionTargets.carbGrams}
          onChangeText={(t) => updateMacro('carbGrams', t)}
          suffix="g"
          colors={colors}
          typography={typography}
          spacing={spacing}
          radius={radius}
        />
        <MacroInput
          label="Fat"
          value={nutritionTargets.fatGrams}
          onChangeText={(t) => updateMacro('fatGrams', t)}
          suffix="g"
          colors={colors}
          typography={typography}
          spacing={spacing}
          radius={radius}
        />
      </View>

      {/* ── Program Selector ──────────────────────────────────── */}
      {programs.length > 0 && (
        <>
          <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }]}>
            Active Program
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.base }}
          >
            <Pressable
              onPress={() => {
                setActiveProgram(undefined);
                selectionFeedback();
              }}
              style={[
                styles.programPill,
                {
                  backgroundColor: activeProgram == null ? accentColor + '18' : colors.surfaceSecondary,
                  borderColor: activeProgram == null ? accentColor : colors.border,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  marginRight: spacing.sm,
                },
              ]}
            >
              <Text
                style={[
                  typography.label,
                  {
                    color: activeProgram == null ? accentColor : colors.textSecondary,
                    fontSize: 13,
                  },
                ]}
              >
                None
              </Text>
            </Pressable>
            {programs.map((prog) => (
              <Pressable
                key={prog.id}
                onPress={() => {
                  setActiveProgram(prog.id);
                  selectionFeedback();
                }}
                style={[
                  styles.programPill,
                  {
                    backgroundColor: activeProgram === prog.id ? accentColor + '18' : colors.surfaceSecondary,
                    borderColor: activeProgram === prog.id ? accentColor : colors.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    marginRight: spacing.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.label,
                    {
                      color: activeProgram === prog.id ? accentColor : colors.textSecondary,
                      fontSize: 13,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {prog.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Save Button ───────────────────────────────────────── */}
      <Button
        title={isEditing ? 'Save Changes' : 'Create Space'}
        onPress={handleSave}
        disabled={!name.trim()}
        style={{ marginTop: spacing.sm }}
      />
    </BottomSheet>
  );
}

// ── Macro Input Sub-component ──────────────────────────────────────

function MacroInput({
  label,
  value,
  onChangeText,
  suffix,
  colors,
  typography: typo,
  spacing,
  radius,
}: {
  label: string;
  value: number | undefined;
  onChangeText: (text: string) => void;
  suffix: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
}) {
  return (
    <View style={styles.macroItem}>
      <Text style={[typo.caption, { color: colors.textTertiary, marginBottom: 2 }]}>
        {label}
      </Text>
      <View
        style={[
          styles.macroInputRow,
          {
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        <TextInput
          value={value != null ? String(value) : ''}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textTertiary}
          style={[
            {
              flex: 1,
              color: colors.text,
              paddingVertical: spacing.sm,
              ...typo.body,
              fontSize: 14,
            },
          ]}
        />
        <Text style={[typo.caption, { color: colors.textTertiary }]}>{suffix}</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  textInput: {
    fontSize: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconOption: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorSwatch: {
    width: 32,
    height: 32,
  },
  toneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  macroItem: {
    flex: 1,
  },
  macroInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  programPill: {
    borderWidth: 1,
  },
  templateCard: {
    width: 130,
    borderWidth: 1,
  },
});
