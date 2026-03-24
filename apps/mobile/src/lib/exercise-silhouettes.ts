import type { MuscleGroup } from '../types/workout';
import { EXERCISE_ILLUSTRATIONS, type MovementType } from './exercise-illustrations';

// Extended type that includes 'cardio' for silhouette rendering
export type SilhouetteType = MovementType | 'cardio';

/**
 * Determine the silhouette type for an exercise.
 *
 * 1. Checks EXERCISE_ILLUSTRATIONS for an explicit movementType
 * 2. Falls back to inferring from category (and exercise name where useful)
 */
export function getExerciseSilhouetteType(
  exerciseId: string,
  category?: MuscleGroup,
  exerciseName?: string,
): SilhouetteType {
  // Check explicit illustration map first
  const illustration = EXERCISE_ILLUSTRATIONS[exerciseId];
  if (illustration) return illustration.movementType;

  // Infer from category + exercise name
  return inferSilhouetteType(category, exerciseName);
}

function inferSilhouetteType(
  category?: MuscleGroup,
  name?: string,
): SilhouetteType {
  const lowerName = (name ?? '').toLowerCase();

  switch (category) {
    case 'chest':
      return 'push';

    case 'back':
      return 'pull';

    case 'shoulders':
      return 'push';

    case 'legs':
      if (lowerName.includes('deadlift') || lowerName.includes('rdl')) return 'hinge';
      if (lowerName.includes('calf')) return 'isometric';
      // lunge, squat, leg press, etc. all map to squat
      return 'squat';

    case 'arms':
      // Bicep exercises are pulling motions
      if (
        lowerName.includes('curl') ||
        lowerName.includes('bicep') ||
        lowerName.includes('hammer')
      ) {
        return 'pull';
      }
      return 'push';

    case 'core':
      if (lowerName.includes('twist') || lowerName.includes('woodchop') || lowerName.includes('rotation')) {
        return 'rotation';
      }
      return 'isometric';

    case 'cardio':
      return 'cardio';

    case 'full_body':
      return 'hinge';

    case 'warmup':
    case 'cooldown':
      return 'isometric';

    default:
      return 'push';
  }
}
