import type { ExerciseLibraryEntry, MuscleId, MuscleDiagramData, MuscleDiagramEntry } from '../types/workout';

// ── Supabase Storage URL ────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function exerciseMediaUrl(exerciseId: string, file: string): string | undefined {
  if (!SUPABASE_URL) return undefined;
  return `${SUPABASE_URL}/storage/v1/object/public/exercise-media/${exerciseId}/${file}`;
}

// ── Video URL Map ───────────────────────────────────────────────────
// Search-based YouTube URLs for popular exercises.

const VIDEO_URLS: Record<string, string> = {
  // Chest
  ex_bench_press: 'https://www.youtube.com/results?search_query=how+to+bench+press+proper+form',
  ex_incline_bench: 'https://www.youtube.com/results?search_query=how+to+incline+bench+press+proper+form',
  ex_decline_bench: 'https://www.youtube.com/results?search_query=how+to+decline+bench+press+form',
  ex_db_bench_press: 'https://www.youtube.com/results?search_query=how+to+dumbbell+bench+press+form',
  ex_incline_db_bench: 'https://www.youtube.com/results?search_query=how+to+incline+dumbbell+bench+press+form',
  ex_db_flyes: 'https://www.youtube.com/results?search_query=how+to+dumbbell+fly+chest+form',
  ex_cable_crossover: 'https://www.youtube.com/results?search_query=how+to+cable+crossover+chest+form',
  ex_push_up: 'https://www.youtube.com/results?search_query=how+to+push+up+proper+form',
  ex_chest_dip: 'https://www.youtube.com/results?search_query=how+to+chest+dip+proper+form',

  // Back
  ex_deadlift: 'https://www.youtube.com/results?search_query=how+to+deadlift+proper+form',
  ex_barbell_row: 'https://www.youtube.com/results?search_query=how+to+barbell+row+proper+form',
  ex_pendlay_row: 'https://www.youtube.com/results?search_query=how+to+pendlay+row+proper+form',
  ex_pull_up: 'https://www.youtube.com/results?search_query=how+to+pull+up+proper+form',
  ex_chin_up: 'https://www.youtube.com/results?search_query=how+to+chin+up+proper+form',
  ex_lat_pulldown: 'https://www.youtube.com/results?search_query=how+to+lat+pulldown+proper+form',
  ex_seated_cable_row: 'https://www.youtube.com/results?search_query=how+to+seated+cable+row+form',
  ex_db_row: 'https://www.youtube.com/results?search_query=how+to+dumbbell+row+proper+form',
  ex_tbar_row: 'https://www.youtube.com/results?search_query=how+to+t+bar+row+proper+form',
  ex_face_pull: 'https://www.youtube.com/results?search_query=how+to+face+pull+proper+form',
  ex_rack_pull: 'https://www.youtube.com/results?search_query=how+to+rack+pull+proper+form',
  ex_barbell_shrug: 'https://www.youtube.com/results?search_query=how+to+barbell+shrug+proper+form',

  // Shoulders
  ex_ohp: 'https://www.youtube.com/results?search_query=how+to+overhead+press+proper+form',
  ex_db_shoulder_press: 'https://www.youtube.com/results?search_query=how+to+dumbbell+shoulder+press+form',
  ex_arnold_press: 'https://www.youtube.com/results?search_query=how+to+arnold+press+proper+form',
  ex_lateral_raise: 'https://www.youtube.com/results?search_query=how+to+lateral+raise+proper+form',
  ex_front_raise: 'https://www.youtube.com/results?search_query=how+to+front+raise+proper+form',
  ex_reverse_fly: 'https://www.youtube.com/results?search_query=how+to+reverse+fly+rear+delt+form',
  ex_upright_row: 'https://www.youtube.com/results?search_query=how+to+upright+row+proper+form',

  // Legs
  ex_squat: 'https://www.youtube.com/results?search_query=how+to+barbell+squat+proper+form',
  ex_front_squat: 'https://www.youtube.com/results?search_query=how+to+front+squat+proper+form',
  ex_leg_press: 'https://www.youtube.com/results?search_query=how+to+leg+press+proper+form',
  ex_romanian_deadlift: 'https://www.youtube.com/results?search_query=how+to+romanian+deadlift+proper+form',
  ex_bulgarian_split_squat: 'https://www.youtube.com/results?search_query=how+to+bulgarian+split+squat+form',
  ex_hip_thrust: 'https://www.youtube.com/results?search_query=how+to+barbell+hip+thrust+form',
  ex_hack_squat: 'https://www.youtube.com/results?search_query=how+to+hack+squat+proper+form',
  ex_leg_extension: 'https://www.youtube.com/results?search_query=how+to+leg+extension+proper+form',
  ex_leg_curl: 'https://www.youtube.com/results?search_query=how+to+leg+curl+proper+form',
  ex_calf_raise: 'https://www.youtube.com/results?search_query=how+to+standing+calf+raise+form',
  ex_lunge: 'https://www.youtube.com/results?search_query=how+to+lunge+proper+form',
  ex_goblet_squat: 'https://www.youtube.com/results?search_query=how+to+goblet+squat+proper+form',
  ex_good_morning: 'https://www.youtube.com/results?search_query=how+to+good+morning+exercise+form',
  ex_sumo_deadlift: 'https://www.youtube.com/results?search_query=how+to+sumo+deadlift+proper+form',

  // Arms
  ex_barbell_curl: 'https://www.youtube.com/results?search_query=how+to+barbell+curl+proper+form',
  ex_hammer_curl: 'https://www.youtube.com/results?search_query=how+to+hammer+curl+proper+form',
  ex_skull_crusher: 'https://www.youtube.com/results?search_query=how+to+skull+crusher+proper+form',
  ex_tricep_pushdown: 'https://www.youtube.com/results?search_query=how+to+tricep+pushdown+proper+form',
  ex_tricep_dip: 'https://www.youtube.com/results?search_query=how+to+tricep+dip+proper+form',
  ex_preacher_curl: 'https://www.youtube.com/results?search_query=how+to+preacher+curl+proper+form',
  ex_close_grip_bench: 'https://www.youtube.com/results?search_query=how+to+close+grip+bench+press+form',
  ex_concentration_curl: 'https://www.youtube.com/results?search_query=how+to+concentration+curl+form',

  // Core
  ex_plank: 'https://www.youtube.com/results?search_query=how+to+plank+proper+form',
  ex_hanging_leg_raise: 'https://www.youtube.com/results?search_query=how+to+hanging+leg+raise+form',
  ex_ab_wheel: 'https://www.youtube.com/results?search_query=how+to+ab+wheel+rollout+form',
  ex_russian_twist: 'https://www.youtube.com/results?search_query=how+to+russian+twist+proper+form',
  ex_cable_crunch: 'https://www.youtube.com/results?search_query=how+to+cable+crunch+proper+form',

  // Full Body / Compound
  ex_kettlebell_swing: 'https://www.youtube.com/results?search_query=how+to+kettlebell+swing+proper+form',
  ex_power_clean: 'https://www.youtube.com/results?search_query=how+to+power+clean+proper+form',
  ex_farmers_carry: 'https://www.youtube.com/results?search_query=how+to+farmers+carry+proper+form',
  ex_turkish_getup: 'https://www.youtube.com/results?search_query=how+to+turkish+getup+proper+form',
  ex_thruster: 'https://www.youtube.com/results?search_query=how+to+thruster+exercise+proper+form',
  ex_burpee: 'https://www.youtube.com/results?search_query=how+to+burpee+proper+form',
};

// ── Muscle Name → MuscleId Mapping ──────────────────────────────────
// Maps human-readable muscle names from exercise-data.ts to MuscleId values.

const MUSCLE_NAME_TO_ID: Record<string, MuscleId> = {
  // Chest
  'Pectoralis Major': 'pectoralis_major',
  'Upper Pectoralis Major': 'pectoralis_major',
  'Lower Pectoralis Major': 'pectoralis_major',
  'Upper Chest': 'pectoralis_major',
  'Chest': 'pectoralis_major',
  'Pectoralis Minor': 'pectoralis_minor',

  // Shoulders / Deltoids
  'Anterior Deltoid': 'deltoid_anterior',
  'Medial Deltoid': 'deltoid_lateral',
  'Rear Deltoid': 'deltoid_posterior',
  'Lateral Deltoid': 'deltoid_lateral',
  'Posterior Deltoid': 'deltoid_posterior',
  'Shoulders': 'deltoid_lateral',

  // Arms
  'Biceps': 'biceps',
  'Biceps (Long Head)': 'biceps',
  'Biceps (Short Head)': 'biceps',
  'Triceps': 'triceps',
  'Triceps (Long Head)': 'triceps',
  'Forearms': 'forearms',
  'Brachialis': 'brachialis',
  'Brachioradialis': 'brachioradialis',
  'Arms': 'biceps',

  // Core
  'Abdominals': 'rectus_abdominis',
  'Rectus Abdominis': 'rectus_abdominis',
  'Obliques': 'obliques',
  'Transverse Abdominis': 'transverse_abdominis',
  'Core': 'rectus_abdominis',
  'Diaphragm': 'transverse_abdominis',

  // Back
  'Trapezius': 'trapezius',
  'Rhomboids': 'rhomboids',
  'Latissimus Dorsi': 'latissimus_dorsi',
  'Lats': 'latissimus_dorsi',
  'Erector Spinae': 'erector_spinae',
  'Lower Back': 'lower_back',
  'Upper Back': 'upper_back',
  'Back': 'latissimus_dorsi',
  'Spine': 'erector_spinae',
  'Thoracic Spine': 'erector_spinae',
  'Rotator Cuff': 'rotator_cuff',

  // Legs - Upper
  'Quadriceps': 'quadriceps',
  'Hamstrings': 'hamstrings',
  'Glutes': 'glutes',
  'Gluteus Medius': 'gluteus_medius',
  'Gluteus Minimus': 'gluteus_minimus',
  'Hip Flexors': 'hip_flexors',
  'Hips': 'hip_flexors',
  'Adductors': 'adductors',
  'Piriformis': 'piriformis',
  'Legs': 'quadriceps',

  // Legs - Lower
  'Calves': 'calves',
  'Gastrocnemius': 'gastrocnemius',
  'Soleus': 'soleus',

  // Full Body (maps to a major compound group)
  'Full Body': 'quadriceps',
};

// ── Primary / Secondary Opacity Constants ───────────────────────────

const PRIMARY_OPACITY = 1.0;
const SECONDARY_OPACITY = 0.4;

// ── Diagram Data Generator ──────────────────────────────────────────

/**
 * Generates muscle diagram data from an exercise's primary and secondary muscle arrays.
 * Deduplicates muscles and assigns appropriate opacity values.
 */
export function getMuscleDiagramData(exercise: ExerciseLibraryEntry): MuscleDiagramData {
  const seenPrimary = new Set<MuscleId>();
  const seenSecondary = new Set<MuscleId>();

  const primaryEntries: MuscleDiagramEntry[] = [];
  for (const name of exercise.primaryMuscles) {
    const muscleId = MUSCLE_NAME_TO_ID[name];
    if (muscleId && !seenPrimary.has(muscleId)) {
      seenPrimary.add(muscleId);
      primaryEntries.push({ muscle: muscleId, opacity: PRIMARY_OPACITY });
    }
  }

  const secondaryEntries: MuscleDiagramEntry[] = [];
  for (const name of exercise.secondaryMuscles) {
    const muscleId = MUSCLE_NAME_TO_ID[name];
    // Skip if already listed as primary
    if (muscleId && !seenPrimary.has(muscleId) && !seenSecondary.has(muscleId)) {
      seenSecondary.add(muscleId);
      secondaryEntries.push({ muscle: muscleId, opacity: SECONDARY_OPACITY });
    }
  }

  return {
    primaryMuscles: primaryEntries,
    secondaryMuscles: secondaryEntries,
  };
}

// ── Exercise Media Record ───────────────────────────────────────────

export interface ExerciseMediaEntry {
  thumbnailUrl?: string;
  heroImageUrl?: string;
  videoUrl?: string;
  muscleDiagramData?: MuscleDiagramData;
}

/**
 * Build the EXERCISE_MEDIA map lazily from the exercise library.
 * This avoids a circular import by accepting the library as a parameter.
 */
export function buildExerciseMediaMap(
  library: ExerciseLibraryEntry[],
): Record<string, ExerciseMediaEntry> {
  const map: Record<string, ExerciseMediaEntry> = {};
  for (const exercise of library) {
    map[exercise.id] = {
      thumbnailUrl: exerciseMediaUrl(exercise.id, 'thumbnail.webp'),
      heroImageUrl: exerciseMediaUrl(exercise.id, 'hero.webp'),
      videoUrl: VIDEO_URLS[exercise.id],
      muscleDiagramData: getMuscleDiagramData(exercise),
    };
  }
  return map;
}

// ── Singleton + Accessor ────────────────────────────────────────────

let _mediaMap: Record<string, ExerciseMediaEntry> | null = null;

/**
 * Initialize the media map. Call once at app startup with the exercise library.
 */
export function initExerciseMedia(library: ExerciseLibraryEntry[]): void {
  _mediaMap = buildExerciseMediaMap(library);
}

/**
 * Get media data for a specific exercise.
 * Returns undefined if the exercise is not found or media map is not initialized.
 */
export function getExerciseMedia(exerciseId: string): ExerciseMediaEntry | undefined {
  return _mediaMap?.[exerciseId];
}

/**
 * Get the full media map. Throws if not initialized.
 */
export function getExerciseMediaMap(): Record<string, ExerciseMediaEntry> {
  if (!_mediaMap) {
    throw new Error('Exercise media map not initialized. Call initExerciseMedia() first.');
  }
  return _mediaMap;
}

/**
 * Convert a human-readable muscle name to a MuscleId.
 * Returns undefined if no mapping exists.
 */
export function muscleNameToId(name: string): MuscleId | undefined {
  return MUSCLE_NAME_TO_ID[name];
}
