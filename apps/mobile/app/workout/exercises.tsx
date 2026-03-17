import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useExerciseLibrary } from '../../src/hooks/useExerciseLibrary';
import { Badge, EmptyState } from '../../src/components/ui';
import { MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS, EQUIPMENT_ICONS } from '../../src/lib/exercise-data';
import type { ExerciseLibraryEntry, MuscleGroup, Equipment } from '../../src/types/workout';
import { ExerciseIllustration } from '../../src/components/ExerciseIllustration';

const CATEGORIES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full_body'];
const EQUIPMENT_LIST: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band'];

export default function ExercisesScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const {
    exercises,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedEquipment,
    setSelectedEquipment,
  } = useExerciseLibrary();

  const renderExercise = useCallback(
    ({ item }: { item: ExerciseLibraryEntry }): React.ReactElement | null => (
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
          <ExerciseIllustration
            exerciseId={item.id}
            category={item.category}
            equipment={item.equipment}
            primaryMuscles={item.primaryMuscles}
            size="small"
          />
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
    ),
    [colors, spacing, radius, typography, router],
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
                backgroundColor: selectedCategory === cat ? colors.primary : colors.surface,
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
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: spacing.sm }}
      >
        {EQUIPMENT_LIST.map((eq) => (
          <TouchableOpacity
            key={eq}
            onPress={() => setSelectedEquipment(selectedEquipment === eq ? null : eq)}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedEquipment === eq ? colors.primaryDark : colors.surface,
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

      {/* Exercise List */}
      <FlatList
        data={exercises}
        renderItem={renderExercise}
        keyExtractor={(item: ExerciseLibraryEntry) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No exercises found"
            description={searchQuery ? `No results for "${searchQuery}". Try a different search term.` : 'No exercises match your filters.'}
            actionLabel={searchQuery || selectedCategory || selectedEquipment ? 'Clear Filters' : undefined}
            onAction={searchQuery || selectedCategory || selectedEquipment ? () => { setSearchQuery(''); setSelectedCategory(null); setSelectedEquipment(null); } : undefined}
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  exerciseCard: {},
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});
