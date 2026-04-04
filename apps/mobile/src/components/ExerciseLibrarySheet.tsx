import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme';
import { useWorkoutStore } from '../stores/workout-store';
import { lightImpact, selectionFeedback } from '../lib/haptics';
import { EXERCISE_LIBRARY, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS, EQUIPMENT_ICONS } from '../lib/exercise-data';
import { CATEGORY_COLORS, CATEGORY_COLORS_DARK } from '../lib/exercise-illustrations';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ExerciseImage } from './workout/ExerciseImage';
import { MuscleGroupPicker } from './MuscleGroupPicker';
import type { ExerciseLibraryEntry, MuscleGroup, Equipment } from '../types/workout';

// ── Types ────────────────────────────────────────────────────────────

export interface ExerciseLibrarySheetProps {
  visible: boolean;
  onClose: () => void;
  mode?: 'browse' | 'select';
  onExercisesSelected?: (exerciseIds: string[]) => void;
  onExercisePress?: (exercise: ExerciseLibraryEntry) => void;
  excludeExerciseIds?: string[];
  initialFilter?: { muscleGroup?: string; equipment?: string };
}

type FilterTab = 'all' | 'muscle' | 'equipment' | 'categories';

interface Section {
  title: string;
  data: ExerciseLibraryEntry[];
}

// ── Constants ────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'muscle', label: 'By Muscle' },
  { key: 'equipment', label: 'By Equipment' },
  { key: 'categories', label: 'Categories' },
];

const ALL_EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band',
];

const CATEGORY_ORDER: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full_body',
];

const NLP_CONNECTORS = new Set([
  'for', 'with', 'that', 'using', 'without', 'like', 'to', 'can', 'do',
  'good', 'best', 'what', 'which', 'how', 'exercises', 'exercise', 'movements', 'workout',
]);

const LOCAL_DEBOUNCE_MS = 300;
const AI_DEBOUNCE_MS = 500;

// ── Helpers ──────────────────────────────────────────────────────────

function isNLPQuery(query: string): boolean {
  if (query.includes('?')) return true;
  const words = query.toLowerCase().split(/\s+/);
  if (words.length > 2) {
    return words.some((w) => NLP_CONNECTORS.has(w));
  }
  return false;
}

function localSearch(
  exercises: ExerciseLibraryEntry[],
  query: string,
): ExerciseLibraryEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return exercises;

  const words = q.split(/\s+/).filter((w) => w.length > 0);

  type Scored = { exercise: ExerciseLibraryEntry; score: number };
  const scored: Scored[] = [];

  for (const ex of exercises) {
    const nameLower = ex.name.toLowerCase();
    const categoryLabel = MUSCLE_GROUP_LABELS[ex.category]?.toLowerCase() ?? '';
    const equipmentLabel = EQUIPMENT_LABELS[ex.equipment]?.toLowerCase() ?? '';
    const musclesLower = ex.primaryMuscles.map((m) => m.toLowerCase()).join(' ');

    let score = 0;

    // Exact prefix on name
    if (nameLower.startsWith(q)) {
      score = 100;
    }
    // Name contains full query
    else if (nameLower.includes(q)) {
      score = 80;
    } else {
      // Word-level matching
      let wordMatches = 0;
      for (const w of words) {
        if (
          nameLower.includes(w) ||
          categoryLabel.includes(w) ||
          equipmentLabel.includes(w) ||
          musclesLower.includes(w)
        ) {
          wordMatches++;
        }
      }
      if (wordMatches > 0) {
        score = 40 + (wordMatches / words.length) * 30;
      }
    }

    if (score > 0) {
      scored.push({ exercise: ex, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .map((s) => s.exercise);
}

function groupAlphabetically(exercises: ExerciseLibraryEntry[]): Section[] {
  const map = new Map<string, ExerciseLibraryEntry[]>();
  for (const ex of exercises) {
    const letter = ex.name[0].toUpperCase();
    const list = map.get(letter);
    if (list) list.push(ex);
    else map.set(letter, [ex]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

function groupByCategory(exercises: ExerciseLibraryEntry[]): Section[] {
  const map = new Map<MuscleGroup, ExerciseLibraryEntry[]>();
  for (const ex of exercises) {
    const list = map.get(ex.category);
    if (list) list.push(ex);
    else map.set(ex.category, [ex]);
  }
  return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => ({
    title: MUSCLE_GROUP_LABELS[cat] ?? cat,
    data: map.get(cat)!.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

function groupByEquipment(exercises: ExerciseLibraryEntry[]): Section[] {
  const map = new Map<Equipment, ExerciseLibraryEntry[]>();
  for (const ex of exercises) {
    const list = map.get(ex.equipment);
    if (list) list.push(ex);
    else map.set(ex.equipment, [ex]);
  }
  return ALL_EQUIPMENT.filter((eq) => map.has(eq)).map((eq) => ({
    title: EQUIPMENT_LABELS[eq] ?? eq,
    data: map.get(eq)!.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

function groupByMuscle(
  exercises: ExerciseLibraryEntry[],
  selectedMuscles: string[],
): Section[] {
  if (selectedMuscles.length === 0) return groupAlphabetically(exercises);

  // Group by matching muscle group
  const map = new Map<string, ExerciseLibraryEntry[]>();
  for (const ex of exercises) {
    const key = MUSCLE_GROUP_LABELS[ex.category] ?? ex.category;
    const list = map.get(key);
    if (list) list.push(ex);
    else map.set(key, [ex]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({
      title,
      data: data.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// ── Memoized Row Component ──────────────────────────────────────────

interface ExerciseRowProps {
  exercise: ExerciseLibraryEntry;
  isSelected: boolean;
  isSelectMode: boolean;
  isAIResult: boolean;
  onPress: (exercise: ExerciseLibraryEntry) => void;
  onToggle: (exerciseId: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
  dark: boolean;
}

const ExerciseRow = React.memo(function ExerciseRow({
  exercise,
  isSelected,
  isSelectMode,
  isAIResult,
  onPress,
  onToggle,
  colors,
  typography,
  spacing,
  radius,
  dark,
}: ExerciseRowProps) {
  const categoryPalette = dark
    ? CATEGORY_COLORS_DARK[exercise.category]
    : CATEGORY_COLORS[exercise.category];

  const handlePress = () => {
    if (isSelectMode) {
      selectionFeedback();
      onToggle(exercise.id);
    } else {
      lightImpact();
      onPress(exercise);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isSelected
            ? colors.primaryMuted
            : pressed
              ? colors.surfaceSecondary
              : 'transparent',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
      ]}
    >
      {/* Thumbnail */}
      <ExerciseImage
        exerciseId={exercise.id}
        variant="thumbnail"
        category={exercise.category}
        imageUrl={exercise.thumbnailUrl}
      />

      {/* Info */}
      <View style={[styles.rowInfo, { marginLeft: spacing.md }]}>
        <Text
          style={[typography.body, { color: colors.text }]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        <View style={styles.rowBadges}>
          {/* Muscle group badge */}
          <View
            style={[
              styles.badge,
              {
                backgroundColor: categoryPalette?.bg ?? colors.surfaceSecondary,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Text
              style={[
                typography.micro,
                { color: categoryPalette?.text ?? colors.textSecondary },
              ]}
            >
              {MUSCLE_GROUP_LABELS[exercise.category] ?? exercise.category}
            </Text>
          </View>

          {/* Equipment badge */}
          <View
            style={[
              styles.badge,
              styles.equipmentBadge,
              {
                borderColor: colors.border,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Ionicons
              name={(EQUIPMENT_ICONS[exercise.equipment] ?? 'barbell-outline') as any}
              size={10}
              color={colors.textSecondary}
            />
            <Text
              style={[
                typography.micro,
                { color: colors.textSecondary, marginLeft: 3 },
              ]}
            >
              {EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}
            </Text>
          </View>

          {/* AI result indicator */}
          {isAIResult && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.infoLight,
                  borderRadius: radius.sm,
                },
              ]}
            >
              <Text style={[typography.micro, { color: colors.info }]}>
                AI
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Select checkbox or menu */}
      {isSelectMode ? (
        <View style={styles.checkboxOuter}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: isSelected ? colors.primary : colors.textTertiary,
                backgroundColor: isSelected ? colors.primary : 'transparent',
                borderRadius: radius.sm,
              },
            ]}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={14} color={colors.textInverse} />
            )}
          </View>
        </View>
      ) : (
        <Pressable
          hitSlop={8}
          style={styles.menuButton}
          onPress={() => {
            // Quick actions — placeholder for future context menu
          }}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={colors.textTertiary}
          />
        </Pressable>
      )}
    </Pressable>
  );
});

// ── Equipment Pill Component ────────────────────────────────────────

interface EquipmentPillProps {
  equipment: Equipment;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
}

function EquipmentPill({ equipment, selected, onPress, colors, typography, spacing, radius }: EquipmentPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.equipmentPill,
        {
          backgroundColor: selected ? colors.primaryMuted : 'transparent',
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          marginRight: spacing.sm,
        },
      ]}
    >
      <Ionicons
        name={(EQUIPMENT_ICONS[equipment] ?? 'barbell-outline') as any}
        size={14}
        color={selected ? colors.primary : colors.textSecondary}
      />
      <Text
        style={[
          typography.labelSmall,
          {
            color: selected ? colors.primary : colors.text,
            marginLeft: spacing.xs,
          },
        ]}
      >
        {EQUIPMENT_LABELS[equipment]}
      </Text>
    </Pressable>
  );
}

// ── Category Tile Component ─────────────────────────────────────────

interface CategoryTileProps {
  category: MuscleGroup;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
  dark: boolean;
}

function CategoryTile({ category, selected, onPress, colors, typography, spacing, radius, dark }: CategoryTileProps) {
  const palette = dark ? CATEGORY_COLORS_DARK[category] : CATEGORY_COLORS[category];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.categoryTile,
        {
          backgroundColor: selected ? palette?.bg : colors.surfaceSecondary,
          borderColor: selected ? palette?.text : colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          marginRight: spacing.sm,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <Text
        style={[
          typography.labelSmall,
          { color: selected ? palette?.text : colors.text },
        ]}
      >
        {MUSCLE_GROUP_LABELS[category]}
      </Text>
    </Pressable>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function ExerciseLibrarySheet({
  visible,
  onClose,
  mode = 'browse',
  onExercisesSelected,
  onExercisePress,
  excludeExerciseIds,
  initialFilter,
}: ExerciseLibrarySheetProps) {
  const { colors, typography, spacing, radius, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<TextInput>(null);
  const storeExercises = useWorkoutStore((s) => s.exercises);

  // ── State ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<Equipment>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<MuscleGroup>>(new Set());
  const [musclePickerVisible, setMusclePickerVisible] = useState(false);
  const [aiResults, setAiResults] = useState<Set<string>>(new Set());
  const [aiSearching, setAiSearching] = useState(false);

  const isSelectMode = mode === 'select';

  // ── Reset on open ────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setDebouncedQuery('');
      setSelectedExerciseIds(new Set());
      setAiResults(new Set());
      setAiSearching(false);

      if (initialFilter?.muscleGroup) {
        setActiveTab('muscle');
        setSelectedMuscles([initialFilter.muscleGroup]);
      } else if (initialFilter?.equipment) {
        setActiveTab('equipment');
        setSelectedEquipment(new Set([initialFilter.equipment as Equipment]));
      } else {
        setActiveTab('all');
        setSelectedMuscles([]);
        setSelectedEquipment(new Set());
        setSelectedCategories(new Set());
      }
    }
  }, [visible, initialFilter?.muscleGroup, initialFilter?.equipment]);

  // ── Base exercise list (excluding already-added) ─────────────────
  const baseExercises = useMemo(() => {
    const allExercises = storeExercises.length > 0 ? storeExercises : EXERCISE_LIBRARY;
    if (!excludeExerciseIds || excludeExerciseIds.length === 0) return allExercises;
    const excludeSet = new Set(excludeExerciseIds);
    return allExercises.filter((ex) => !excludeSet.has(ex.id));
  }, [excludeExerciseIds, storeExercises]);

  // ── Debounced search ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, LOCAL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── AI search ────────────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery || !isNLPQuery(debouncedQuery)) {
      setAiResults(new Set());
      setAiSearching(false);
      return;
    }

    if (!isSupabaseConfigured) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAiSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-exercise-search', {
          body: { query: debouncedQuery, limit: 20 },
        });
        if (!controller.signal.aborted && data?.results && !error) {
          const ids = new Set<string>(
            (data.results as { exerciseId: string }[]).map((r) => r.exerciseId),
          );
          if (data.method === 'ai') {
            setAiResults(ids);
          } else {
            setAiResults(new Set());
          }
        }
      } catch {
        // Fail silently — local search is the fallback
      } finally {
        if (!controller.signal.aborted) setAiSearching(false);
      }
    }, AI_DEBOUNCE_MS - LOCAL_DEBOUNCE_MS); // offset by local debounce already waited

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [debouncedQuery]);

  // ── Filter exercises ─────────────────────────────────────────────
  const filteredExercises = useMemo(() => {
    let list = baseExercises;

    // Apply muscle filter
    if (activeTab === 'muscle' && selectedMuscles.length > 0) {
      const muscleSet = new Set(selectedMuscles);
      list = list.filter((ex) => {
        // Match category to muscle group IDs from the picker
        // The picker uses ids like 'chest', 'back', 'biceps', 'triceps', etc.
        if (muscleSet.has(ex.category)) return true;
        // Also check if any primary/secondary muscles match
        const lower = ex.primaryMuscles.map((m) => m.toLowerCase());
        return selectedMuscles.some((mg) => lower.some((m) => m.includes(mg)));
      });
    }

    // Apply equipment filter
    if (activeTab === 'equipment' && selectedEquipment.size > 0) {
      list = list.filter((ex) => selectedEquipment.has(ex.equipment));
    }

    // Apply category filter
    if (activeTab === 'categories' && selectedCategories.size > 0) {
      list = list.filter((ex) => selectedCategories.has(ex.category));
    }

    // Apply search
    if (debouncedQuery) {
      list = localSearch(list, debouncedQuery);

      // Merge AI results that aren't already in local results
      if (aiResults.size > 0) {
        const localIds = new Set(list.map((ex) => ex.id));
        const aiOnlyExercises = baseExercises.filter(
          (ex) => aiResults.has(ex.id) && !localIds.has(ex.id),
        );
        list = [...list, ...aiOnlyExercises];
      }
    }

    return list;
  }, [baseExercises, activeTab, selectedMuscles, selectedEquipment, selectedCategories, debouncedQuery, aiResults]);

  // ── Build sections ───────────────────────────────────────────────
  const sections = useMemo((): Section[] => {
    if (debouncedQuery) {
      // When searching, show flat alphabetical results
      return filteredExercises.length > 0
        ? [{ title: `${filteredExercises.length} Results`, data: filteredExercises }]
        : [];
    }

    switch (activeTab) {
      case 'muscle':
        return groupByMuscle(filteredExercises, selectedMuscles);
      case 'equipment':
        return groupByEquipment(filteredExercises);
      case 'categories':
        return groupByCategory(filteredExercises);
      default:
        return groupAlphabetically(filteredExercises);
    }
  }, [filteredExercises, activeTab, selectedMuscles, debouncedQuery]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleToggle = useCallback((exerciseId: string) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }, []);

  const handleExercisePress = useCallback(
    (exercise: ExerciseLibraryEntry) => {
      onExercisePress?.(exercise);
    },
    [onExercisePress],
  );

  const handleAddExercises = useCallback(() => {
    lightImpact();
    onExercisesSelected?.([...selectedExerciseIds]);
    onClose();
  }, [selectedExerciseIds, onExercisesSelected, onClose]);

  const handleTabChange = useCallback((tab: FilterTab) => {
    selectionFeedback();
    setActiveTab(tab);
    if (tab === 'muscle') {
      // Open muscle picker when switching to muscle tab
      setMusclePickerVisible(true);
    }
  }, []);

  const handleEquipmentToggle = useCallback((eq: Equipment) => {
    selectionFeedback();
    setSelectedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(eq)) next.delete(eq);
      else next.add(eq);
      return next;
    });
  }, []);

  const handleCategoryToggle = useCallback((cat: MuscleGroup) => {
    selectionFeedback();
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setAiResults(new Set());
    searchInputRef.current?.focus();
  }, []);

  // ── Render helpers ───────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: ExerciseLibraryEntry }) => (
      <ExerciseRow
        exercise={item}
        isSelected={selectedExerciseIds.has(item.id)}
        isSelectMode={isSelectMode}
        isAIResult={aiResults.has(item.id)}
        onPress={handleExercisePress}
        onToggle={handleToggle}
        colors={colors}
        typography={typography}
        spacing={spacing}
        radius={radius}
        dark={dark}
      />
    ),
    [selectedExerciseIds, isSelectMode, aiResults, handleExercisePress, handleToggle, colors, typography, spacing, radius, dark],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View
        style={[
          styles.sectionHeader,
          {
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <Text
          style={[
            typography.overline,
            { color: colors.textTertiary },
          ]}
        >
          {section.title}
        </Text>
      </View>
    ),
    [colors, typography, spacing],
  );

  const keyExtractor = useCallback((item: ExerciseLibraryEntry) => item.id, []);

  const selectedCount = selectedExerciseIds.size;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.sm,
              backgroundColor: colors.surface,
              borderBottomColor: colors.divider,
              borderBottomWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (activeTab === 'muscle') {
                setMusclePickerVisible(true);
              }
            }}
            hitSlop={8}
            style={styles.headerButton}
          >
            <Ionicons
              name="filter-outline"
              size={22}
              color={
                (activeTab === 'muscle' && selectedMuscles.length > 0) ||
                (activeTab === 'equipment' && selectedEquipment.size > 0) ||
                (activeTab === 'categories' && selectedCategories.size > 0)
                  ? colors.primary
                  : colors.text
              }
            />
          </Pressable>

          <Text style={[typography.h3, { color: colors.text, flex: 1, textAlign: 'center' }]}>
            All Exercises
          </Text>

          <Pressable onPress={onClose} hitSlop={8} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* ── Search Bar ──────────────────────────────────────────── */}
        <View
          style={[
            styles.searchContainer,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              ref={searchInputRef}
              style={[
                typography.body,
                styles.searchInput,
                { color: colors.text },
              ]}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {aiSearching && (
              <View style={styles.aiIndicator}>
                <ActivityIndicator size="small" color={colors.info} />
              </View>
            )}
            {searchQuery.length > 0 && (
              <Pressable onPress={clearSearch} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          {/* AI search label */}
          {debouncedQuery && isNLPQuery(debouncedQuery) && (
            <View style={[styles.aiLabel, { marginTop: spacing.xs }]}>
              <Ionicons name="sparkles" size={12} color={colors.info} />
              <Text style={[typography.micro, { color: colors.info, marginLeft: 3 }]}>
                AI Search
              </Text>
            </View>
          )}
        </View>

        {/* ── Filter Tabs ─────────────────────────────────────────── */}
        <View
          style={[
            styles.tabsContainer,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: colors.surface,
              borderBottomColor: colors.divider,
              borderBottomWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <View
            style={[
              styles.segmentedControl,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
              },
            ]}
          >
            {FILTER_TABS.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => handleTabChange(tab.key)}
                style={[
                  styles.segmentTab,
                  {
                    backgroundColor: activeTab === tab.key ? colors.surface : 'transparent',
                    borderRadius: radius.sm,
                    ...(activeTab === tab.key
                      ? {
                          shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
                        }
                      : {}),
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: activeTab === tab.key ? colors.text : colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Sub-Filters ─────────────────────────────────────────── */}
        {activeTab === 'equipment' && (
          <View
            style={[
              styles.subFilterRow,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                backgroundColor: colors.surface,
              },
            ]}
          >
            {ALL_EQUIPMENT.map((eq) => (
              <EquipmentPill
                key={eq}
                equipment={eq}
                selected={selectedEquipment.has(eq)}
                onPress={() => handleEquipmentToggle(eq)}
                colors={colors}
                typography={typography}
                spacing={spacing}
                radius={radius}
              />
            ))}
          </View>
        )}

        {activeTab === 'categories' && (
          <View
            style={[
              styles.subFilterWrap,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                backgroundColor: colors.surface,
              },
            ]}
          >
            {CATEGORY_ORDER.map((cat) => (
              <CategoryTile
                key={cat}
                category={cat}
                selected={selectedCategories.has(cat)}
                onPress={() => handleCategoryToggle(cat)}
                colors={colors}
                typography={typography}
                spacing={spacing}
                radius={radius}
                dark={dark}
              />
            ))}
          </View>
        )}

        {activeTab === 'muscle' && selectedMuscles.length > 0 && (
          <View
            style={[
              styles.muscleFilterBar,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Filtering by: {selectedMuscles.map((m) => {
                // Capitalize first letter
                return m.charAt(0).toUpperCase() + m.slice(1);
              }).join(', ')}
            </Text>
            <Pressable
              onPress={() => setMusclePickerVisible(true)}
              hitSlop={8}
            >
              <Text style={[typography.labelSmall, { color: colors.primary }]}>
                Edit
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Exercise List ────────────────────────────────────────── */}
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={
            isSelectMode
              ? { paddingBottom: 80 + insets.bottom }
              : { paddingBottom: insets.bottom + spacing.lg }
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="barbell-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
                ]}
              >
                {debouncedQuery
                  ? `No exercises match "${debouncedQuery}"`
                  : 'No exercises found'}
              </Text>
            </View>
          }
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
        />

        {/* ── Bottom Bar (select mode) ─────────────────────────────── */}
        {isSelectMode && (
          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: Math.max(insets.bottom, spacing.lg),
                paddingTop: spacing.md,
                paddingHorizontal: spacing.lg,
                backgroundColor: colors.surface,
                borderTopColor: colors.divider,
                borderTopWidth: StyleSheet.hairlineWidth,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Pressable
              style={[
                styles.groupButton,
                {
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                },
              ]}
              onPress={() => {
                // Superset grouping — placeholder for future implementation
              }}
              disabled={selectedCount < 2}
            >
              <Text
                style={[
                  typography.label,
                  {
                    color: selectedCount >= 2 ? colors.text : colors.disabledText,
                  },
                ]}
              >
                Group as...
              </Text>
            </Pressable>

            <Pressable
              onPress={handleAddExercises}
              disabled={selectedCount === 0}
              style={[
                styles.addButton,
                {
                  backgroundColor: selectedCount > 0 ? colors.primary : colors.disabled,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <Text
                style={[
                  typography.label,
                  {
                    color: selectedCount > 0 ? colors.textInverse : colors.disabledText,
                  },
                ]}
              >
                {selectedCount > 0
                  ? `Add ${selectedCount} Exercise${selectedCount > 1 ? 's' : ''}`
                  : 'Add Exercise'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Muscle Group Picker Modal ────────────────────────────── */}
        <MuscleGroupPicker
          visible={musclePickerVisible}
          onClose={() => setMusclePickerVisible(false)}
          selectedGroups={selectedMuscles}
          onSelectionChange={setSelectedMuscles}
          onSave={(groups) => {
            setSelectedMuscles(groups);
          }}
        />
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchContainer: {},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  aiIndicator: {
    marginRight: 6,
  },
  aiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Filter tabs
  tabsContainer: {},
  segmentedControl: {
    flexDirection: 'row',
    padding: 2,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
  },

  // Sub-filters
  subFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  subFilterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  equipmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  categoryTile: {
    borderWidth: 1,
  },
  muscleFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Section header
  sectionHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Exercise row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
  },
  rowInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  rowBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  equipmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },

  // Checkbox
  checkboxOuter: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Menu
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 16,
  },
  groupButton: {
    borderWidth: 1,
  },
  addButton: {},
});
