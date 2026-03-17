import type { ExerciseLibraryEntry } from '../types/workout';

export interface ReplacementGroup {
  label: string;
  exercises: ExerciseLibraryEntry[];
}

/**
 * Returns exercises grouped and sorted by relevance for replacing the given exercise.
 * Groups:
 *  1. "Best Alternatives" — same primary muscle group + same equipment
 *  2. "Other Options" — same primary muscle group, different equipment
 *  3. "Related" — shares secondary muscles
 */
export function getSuggestedReplacements(
  currentExercise: ExerciseLibraryEntry,
  allExercises: ExerciseLibraryEntry[],
): ReplacementGroup[] {
  const candidates = allExercises.filter((e) => e.id !== currentExercise.id);

  const currentPrimarySet = new Set(
    currentExercise.primaryMuscles.map((m) => m.toLowerCase()),
  );
  const currentSecondarySet = new Set(
    currentExercise.secondaryMuscles.map((m) => m.toLowerCase()),
  );

  const bestAlternatives: ExerciseLibraryEntry[] = [];
  const otherOptions: ExerciseLibraryEntry[] = [];
  const related: ExerciseLibraryEntry[] = [];

  for (const exercise of candidates) {
    const sharesPrimary = exercise.primaryMuscles.some((m) =>
      currentPrimarySet.has(m.toLowerCase()),
    );

    // Also check category match for broader matching (e.g. "chest" exercises)
    const sameCategory = exercise.category === currentExercise.category;

    if (sharesPrimary || sameCategory) {
      if (exercise.equipment === currentExercise.equipment) {
        bestAlternatives.push(exercise);
      } else {
        otherOptions.push(exercise);
      }
    } else {
      const sharesSecondary =
        exercise.primaryMuscles.some((m) =>
          currentSecondarySet.has(m.toLowerCase()),
        ) ||
        exercise.secondaryMuscles.some((m) =>
          currentPrimarySet.has(m.toLowerCase()),
        ) ||
        exercise.secondaryMuscles.some((m) =>
          currentSecondarySet.has(m.toLowerCase()),
        );

      if (sharesSecondary) {
        related.push(exercise);
      }
    }
  }

  const groups: ReplacementGroup[] = [];

  if (bestAlternatives.length > 0) {
    groups.push({ label: 'Best Alternatives', exercises: bestAlternatives });
  }
  if (otherOptions.length > 0) {
    groups.push({ label: 'Other Options', exercises: otherOptions });
  }
  if (related.length > 0) {
    groups.push({ label: 'Related', exercises: related });
  }

  return groups;
}

/**
 * Flat list of all suggested replacements, sorted by relevance.
 */
export function getSuggestedReplacementsFlat(
  currentExercise: ExerciseLibraryEntry,
  allExercises: ExerciseLibraryEntry[],
): ExerciseLibraryEntry[] {
  const groups = getSuggestedReplacements(currentExercise, allExercises);
  return groups.flatMap((g) => g.exercises);
}
