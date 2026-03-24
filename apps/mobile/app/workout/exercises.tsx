import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useExerciseLibrary } from '../../src/hooks/useExerciseLibrary';
import { Badge, EmptyState } from '../../src/components/ui';
import { MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS, EQUIPMENT_ICONS } from '../../src/lib/exercise-data';
import type { ExerciseLibraryEntry } from '../../src/types/workout';
import type { ForceFilter, MechanicFilter, LevelFilter } from '../../src/hooks/useExerciseLibrary';
import { getExerciseImages } from '../../src/lib/exercise-image-map';
import { getExerciseIllustration, CATEGORY_COLORS, CATEGORY_COLORS_DARK } from '../../src/lib/exercise-illustrations';

import type { MuscleGroup, Equipment } from '../../src/types/workout';

const CATEGORIES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full_body'];
const EQUIPMENT_LIST: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band'];

const FORCE_OPTIONS: { value: ForceFilter | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'static', label: 'Static' },
];

const MECHANIC_OPTIONS: { value: MechanicFilter | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'compound', label: 'Compound' },
  { value: 'isolation', label: 'Isolation' },
];

const LEVEL_OPTIONS: { value: LevelFilter | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' },
];

const THUMBNAIL_SIZE = 60;

export default function ExercisesScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography, dark } = useTheme();
  const {
    exercises,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedEquipment,
    setSelectedEquipment,
    selectedForce,
    setSelectedForce,
    selectedMechanic,
    setSelectedMechanic,
    selectedLevel,
    setSelectedLevel,
    clearFilters,
  } = useExerciseLibrary();

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const hasAdvancedFilters = selectedForce !== null || selectedMechanic !== null || selectedLevel !== null;

  const categoryColors = dark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS;

  const renderExercise = useCallback(
    ({ item }: { item: ExerciseLibraryEntry }): React.ReactElement | null => {
      const images = getExerciseImages(item.id);

      return (
        <TouchableOpacity
          style={[
            styles.exerciseCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.base,
              marginBottom: spacing.sm,
              borderWidth: 1,
              borderColor: colors.borderLight,
            },
          ]}
          activeOpacity={0.7}
          onPress={() => router.push(`/workout/${item.id}`)}
        >
          <View style={styles.exerciseRow}>
            {images ? (
              <Image
                source={images.startPosition}
                style={[styles.thumbnail, { borderRadius: radius.md }]}
                contentFit="cover"
                cachePolicy="disk"
                recyclingKey={item.id}
              />
            ) : (
              <View
                style={[
                  styles.thumbnail,
                  {
                    borderRadius: radius.md,
                    backgroundColor: (categoryColors[item.category] ?? categoryColors.full_body).bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={styles.fallbackEmoji}>
                  {getExerciseIllustration(item.id, item.category, item.equipment, item.primaryMuscles).emoji}
                </Text>
              </View>
            )}
            <View style={styles.exerciseInfo}>
              <View style={styles.nameRow}>
                <Text
                  style={[typography.label, { color: colors.text, flex: 1 }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.isCustom && <Badge label="Custom" variant="pro" />}
              </View>
              <Text
                style={[typography.bodySmall, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.primaryMuscles.join(', ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>
      );
    },
    [colors, spacing, radius, typography, router, categoryColors, dark],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
          Exercise Library
        </Text>
        <TouchableOpacity onPress={() => router.push('/workout/create-exercise')}>
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { paddingHorizontal: spacing.base, marginBottom: spacing.sm }]}>
        <View
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.sm, paddingVertical: 10 }]}
            placeholder="Search exercises..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: spacing.sm }}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedCategory === cat ? colors.primary : colors.surfaceSecondary,
                borderColor: selectedCategory === cat ? colors.primary : colors.border,
                borderRadius: radius.full,
                marginRight: spacing.sm,
              },
            ]}
          >
            <Text
              style={[
                typography.labelSmall,
                { color: selectedCategory === cat ? colors.textInverse : colors.text },
              ]}
            >
              {MUSCLE_GROUP_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Equipment Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: spacing.xs }}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: spacing.sm }}
      >
        {EQUIPMENT_LIST.map((eq) => (
          <TouchableOpacity
            key={eq}
            onPress={() => setSelectedEquipment(selectedEquipment === eq ? null : eq)}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedEquipment === eq ? colors.primaryDark : colors.surfaceSecondary,
                borderColor: selectedEquipment === eq ? colors.primaryDark : colors.border,
                borderRadius: radius.full,
                marginRight: spacing.sm,
              },
            ]}
          >
            <Text
              style={[
                typography.labelSmall,
                { color: selectedEquipment === eq ? colors.textInverse : colors.text },
              ]}
            >
              {EQUIPMENT_LABELS[eq]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Advanced Filters Toggle */}
      <TouchableOpacity
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setShowAdvancedFilters(!showAdvancedFilters);
        }}
        style={[styles.advancedToggle, { paddingHorizontal: spacing.base, paddingVertical: spacing.xs }]}
      >
        <Ionicons
          name={showAdvancedFilters ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={hasAdvancedFilters ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[
            typography.labelSmall,
            { color: hasAdvancedFilters ? colors.primary : colors.textSecondary, marginLeft: 4 },
          ]}
        >
          {showAdvancedFilters ? 'Hide' : 'More'} Filters{hasAdvancedFilters ? ' (active)' : ''}
        </Text>
      </TouchableOpacity>

      {showAdvancedFilters && (
        <View>
          {/* Force Filter */}
          <View style={[styles.filterRow, { paddingLeft: spacing.base }]}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary, width: 44 }]}>Force:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: spacing.base, paddingBottom: spacing.xs }}
            >
              {FORCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => setSelectedForce(opt.value)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedForce === opt.value ? colors.primary : colors.surfaceSecondary,
                      borderColor: selectedForce === opt.value ? colors.primary : colors.textTertiary,
                      borderRadius: radius.full,
                      marginRight: spacing.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: selectedForce === opt.value ? colors.textInverse : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Mechanic Filter */}
          <View style={[styles.filterRow, { paddingLeft: spacing.base }]}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary, width: 44 }]}>Type:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: spacing.base, paddingBottom: spacing.xs }}
            >
              {MECHANIC_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => setSelectedMechanic(opt.value)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedMechanic === opt.value ? colors.primary : colors.surfaceSecondary,
                      borderColor: selectedMechanic === opt.value ? colors.primary : colors.textTertiary,
                      borderRadius: radius.full,
                      marginRight: spacing.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: selectedMechanic === opt.value ? colors.textInverse : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Level Filter */}
          <View style={[styles.filterRow, { paddingLeft: spacing.base }]}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary, width: 44 }]}>Level:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: spacing.base, paddingBottom: spacing.xs }}
            >
              {LEVEL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => setSelectedLevel(opt.value)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedLevel === opt.value ? colors.primary : colors.surfaceSecondary,
                      borderColor: selectedLevel === opt.value ? colors.primary : colors.textTertiary,
                      borderRadius: radius.full,
                      marginRight: spacing.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: selectedLevel === opt.value ? colors.textInverse : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Exercise List */}
      <FlatList
        data={exercises}
        renderItem={renderExercise}
        keyExtractor={(item: ExerciseLibraryEntry) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No exercises found"
            description={searchQuery ? `No results for "${searchQuery}". Try a different search term.` : 'No exercises match your filters.'}
            actionLabel={searchQuery || selectedCategory || selectedEquipment || hasAdvancedFilters ? 'Clear Filters' : undefined}
            onAction={searchQuery || selectedCategory || selectedEquipment || hasAdvancedFilters ? () => clearFilters() : undefined}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  searchContainer: {},
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 44,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    minHeight: 36,
  },
  exerciseCard: {},
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  fallbackEmoji: {
    fontSize: 28,
  },
  exerciseInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});
