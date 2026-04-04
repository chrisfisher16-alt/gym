// ── Smart Workout Generation Edge Function ──────────────────────────
// Generates personalized daily workouts based on recovery status, goals,
// equipment availability, and training history with progressive overload.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';

// ── Types ───────────────────────────────────────────────────────────

interface RecentWorkout {
  date: string;
  exercises: { exerciseId: string; sets: number; category: string }[];
  durationMinutes?: number;
}

interface ExerciseHistoryEntry {
  exerciseId: string;
  lastWeight: number;
  lastReps: number;
  lastDate: string;
  personalRecord?: { weight: number; reps: number };
}

interface SmartExercise {
  exerciseId: string;
  exerciseName: string;
  category: string;
  equipment: string;
  targetSets: number;
  targetReps: string;
  suggestedWeight?: number;
  restSeconds: number;
  notes?: string;
  supersetGroupId?: string;
  isCompound: boolean;
}

interface GenerateRequest {
  goal: 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness' | 'weight_loss';
  equipment: string[];
  availableMinutes: number;
  muscleGroupPreferences?: string[];
  recentWorkouts?: RecentWorkout[];
  exerciseHistory?: ExerciseHistoryEntry[];
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  excludeExerciseIds?: string[];
}

interface GenerateResponse {
  workout: {
    name: string;
    targetMuscles: string[];
    exercises: SmartExercise[];
    warmupExercises?: string[];
    estimatedDurationMinutes: number;
    totalSets: number;
    aiExplanation: string;
    recoveryStatus: Record<string, number>;
  };
  method: 'ai' | 'algorithmic';
}

// ── Rate Limiting (in-memory) ───────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── Exercise Index ──────────────────────────────────────────────────

interface ExerciseEntry {
  id: string;
  name: string;
  category: string;
  muscles: string[];
  equipment: string;
}

const EXERCISE_INDEX: ExerciseEntry[] = [
  // ── Chest ──
  { id: "ex_bench_press", name: "Barbell Bench Press", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps"], equipment: "barbell" },
  { id: "ex_incline_bench", name: "Incline Barbell Bench Press", category: "chest", muscles: ["upper pectoralis major","anterior deltoid","triceps"], equipment: "barbell" },
  { id: "ex_decline_bench", name: "Decline Barbell Bench Press", category: "chest", muscles: ["lower pectoralis major","anterior deltoid","triceps"], equipment: "barbell" },
  { id: "ex_db_bench_press", name: "Dumbbell Bench Press", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps"], equipment: "dumbbell" },
  { id: "ex_incline_db_bench", name: "Incline Dumbbell Bench Press", category: "chest", muscles: ["upper pectoralis major","anterior deltoid","triceps"], equipment: "dumbbell" },
  { id: "ex_decline_db_bench", name: "Decline Dumbbell Bench Press", category: "chest", muscles: ["lower pectoralis major","anterior deltoid","triceps"], equipment: "dumbbell" },
  { id: "ex_db_flyes", name: "Dumbbell Flyes", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "dumbbell" },
  { id: "ex_cable_crossover", name: "Cable Crossover", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "cable" },
  { id: "ex_cable_fly_low", name: "Low Cable Fly", category: "chest", muscles: ["upper pectoralis major","anterior deltoid"], equipment: "cable" },
  { id: "ex_cable_fly_mid", name: "Mid Cable Fly", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "cable" },
  { id: "ex_pec_deck", name: "Pec Deck", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "machine" },
  { id: "ex_machine_chest_press", name: "Machine Chest Press", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps"], equipment: "machine" },
  { id: "ex_push_up", name: "Push-Up", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps","core"], equipment: "bodyweight" },
  { id: "ex_chest_dip", name: "Chest Dip", category: "chest", muscles: ["pectoralis major","triceps","anterior deltoid"], equipment: "bodyweight" },
  { id: "ex_landmine_press", name: "Landmine Press", category: "chest", muscles: ["upper pectoralis major","anterior deltoid","triceps","core"], equipment: "barbell" },
  { id: "ex_svend_press", name: "Svend Press", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "dumbbell" },
  { id: "ex_incline_db_flyes", name: "Incline Dumbbell Flyes", category: "chest", muscles: ["upper pectoralis major","anterior deltoid"], equipment: "dumbbell" },
  { id: "ex_smith_bench_press", name: "Smith Machine Bench Press", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps"], equipment: "machine" },
  // ── Back ──
  { id: "ex_barbell_row", name: "Barbell Row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "barbell" },
  { id: "ex_pendlay_row", name: "Pendlay Row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid","erector spinae"], equipment: "barbell" },
  { id: "ex_tbar_row", name: "T-Bar Row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid","erector spinae"], equipment: "barbell" },
  { id: "ex_deadlift", name: "Deadlift", category: "back", muscles: ["erector spinae","glutes","hamstrings","trapezius","forearms","core"], equipment: "barbell" },
  { id: "ex_pull_up", name: "Pull-Up", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids","forearms"], equipment: "bodyweight" },
  { id: "ex_chin_up", name: "Chin-Up", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids","forearms"], equipment: "bodyweight" },
  { id: "ex_lat_pulldown", name: "Lat Pulldown", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids"], equipment: "cable" },
  { id: "ex_close_grip_pulldown", name: "Close-Grip Lat Pulldown", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids"], equipment: "cable" },
  { id: "ex_neutral_grip_pulldown", name: "Neutral-Grip Lat Pulldown", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids"], equipment: "cable" },
  { id: "ex_seated_cable_row", name: "Seated Cable Row", category: "back", muscles: ["rhomboids","latissimus dorsi","biceps","rear deltoid"], equipment: "cable" },
  { id: "ex_db_row", name: "Dumbbell Row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "dumbbell" },
  { id: "ex_meadows_row", name: "Meadows Row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "barbell" },
  { id: "ex_face_pull", name: "Face Pull", category: "back", muscles: ["rear deltoid","rhomboids","trapezius","rotator cuff"], equipment: "cable" },
  { id: "ex_straight_arm_pulldown", name: "Straight-Arm Pulldown", category: "back", muscles: ["latissimus dorsi","triceps (long head)","rear deltoid"], equipment: "cable" },
  { id: "ex_chest_supported_row", name: "Chest-Supported Dumbbell Row", category: "back", muscles: ["rhomboids","latissimus dorsi","biceps","rear deltoid"], equipment: "dumbbell" },
  { id: "ex_machine_row", name: "Machine Row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "machine" },
  { id: "ex_hyperextension", name: "Back Extension / Hyperextension", category: "back", muscles: ["erector spinae","glutes","hamstrings"], equipment: "bodyweight" },
  { id: "ex_inverted_row", name: "Inverted Row", category: "back", muscles: ["rhomboids","latissimus dorsi","biceps","rear deltoid","core"], equipment: "bodyweight" },
  { id: "ex_band_row", name: "Band Row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "band" },
  { id: "ex_dead_hang", name: "Dead Hang", category: "back", muscles: ["forearms","latissimus dorsi","shoulders","core"], equipment: "bodyweight" },
  // ── Shoulders ──
  { id: "ex_ohp", name: "Overhead Press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps","core"], equipment: "barbell" },
  { id: "ex_db_shoulder_press", name: "Dumbbell Shoulder Press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps"], equipment: "dumbbell" },
  { id: "ex_arnold_press", name: "Arnold Press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps"], equipment: "dumbbell" },
  { id: "ex_lateral_raise", name: "Lateral Raise", category: "shoulders", muscles: ["medial deltoid","trapezius"], equipment: "dumbbell" },
  { id: "ex_cable_lateral_raise", name: "Cable Lateral Raise", category: "shoulders", muscles: ["medial deltoid","trapezius"], equipment: "cable" },
  { id: "ex_front_raise", name: "Front Raise", category: "shoulders", muscles: ["anterior deltoid","medial deltoid"], equipment: "dumbbell" },
  { id: "ex_reverse_fly", name: "Reverse Fly", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius"], equipment: "dumbbell" },
  { id: "ex_rear_delt_fly_cable", name: "Cable Rear Delt Fly", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius"], equipment: "cable" },
  { id: "ex_upright_row", name: "Upright Row", category: "shoulders", muscles: ["medial deltoid","trapezius","biceps","forearms"], equipment: "barbell" },
  { id: "ex_machine_shoulder_press", name: "Machine Shoulder Press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps"], equipment: "machine" },
  { id: "ex_rear_delt_machine", name: "Reverse Pec Deck", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius"], equipment: "machine" },
  { id: "ex_db_shrug", name: "Dumbbell Shrug", category: "shoulders", muscles: ["trapezius","rhomboids"], equipment: "dumbbell" },
  { id: "ex_band_pull_apart", name: "Band Pull-Apart", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius"], equipment: "band" },
  { id: "ex_band_face_pull", name: "Band Face Pull", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius","rotator cuff"], equipment: "band" },
  // ── Legs ──
  { id: "ex_squat", name: "Barbell Back Squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core","erector spinae"], equipment: "barbell" },
  { id: "ex_front_squat", name: "Front Squat", category: "legs", muscles: ["quadriceps","glutes","core"], equipment: "barbell" },
  { id: "ex_goblet_squat", name: "Goblet Squat", category: "legs", muscles: ["quadriceps","glutes","core","hamstrings"], equipment: "dumbbell" },
  { id: "ex_leg_press", name: "Leg Press", category: "legs", muscles: ["quadriceps","glutes","hamstrings"], equipment: "machine" },
  { id: "ex_hack_squat", name: "Hack Squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings"], equipment: "machine" },
  { id: "ex_romanian_deadlift", name: "Romanian Deadlift", category: "legs", muscles: ["hamstrings","glutes","erector spinae"], equipment: "barbell" },
  { id: "ex_db_rdl", name: "Dumbbell Romanian Deadlift", category: "legs", muscles: ["hamstrings","glutes","erector spinae"], equipment: "dumbbell" },
  { id: "ex_hip_thrust", name: "Barbell Hip Thrust", category: "legs", muscles: ["glutes","hamstrings","core"], equipment: "barbell" },
  { id: "ex_leg_curl", name: "Leg Curl", category: "legs", muscles: ["hamstrings"], equipment: "machine" },
  { id: "ex_seated_leg_curl", name: "Seated Leg Curl", category: "legs", muscles: ["hamstrings"], equipment: "machine" },
  { id: "ex_leg_extension", name: "Leg Extension", category: "legs", muscles: ["quadriceps"], equipment: "machine" },
  { id: "ex_lunge", name: "Walking Lunge", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "dumbbell" },
  { id: "ex_reverse_lunge", name: "Reverse Lunge", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "dumbbell" },
  { id: "ex_calf_raise", name: "Standing Calf Raise", category: "legs", muscles: ["gastrocnemius","soleus"], equipment: "machine" },
  { id: "ex_seated_calf_raise", name: "Seated Calf Raise", category: "legs", muscles: ["soleus","gastrocnemius"], equipment: "machine" },
  { id: "ex_bulgarian_split_squat", name: "Bulgarian Split Squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "dumbbell" },
  { id: "ex_sumo_deadlift", name: "Sumo Deadlift", category: "legs", muscles: ["glutes","hamstrings","quadriceps","erector spinae","adductors","core"], equipment: "barbell" },
  { id: "ex_step_up", name: "Dumbbell Step-Up", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "dumbbell" },
  { id: "ex_glute_bridge", name: "Glute Bridge", category: "legs", muscles: ["glutes","hamstrings","core"], equipment: "bodyweight" },
  { id: "ex_good_morning", name: "Good Morning", category: "legs", muscles: ["hamstrings","erector spinae","glutes","core"], equipment: "barbell" },
  { id: "ex_kb_goblet_squat", name: "Kettlebell Goblet Squat", category: "legs", muscles: ["quadriceps","glutes","core","hamstrings"], equipment: "kettlebell" },
  { id: "ex_adductor_machine", name: "Adductor Machine", category: "legs", muscles: ["adductors"], equipment: "machine" },
  { id: "ex_abductor_machine", name: "Abductor Machine", category: "legs", muscles: ["gluteus medius","gluteus minimus"], equipment: "machine" },
  { id: "ex_sissy_squat", name: "Sissy Squat", category: "legs", muscles: ["quadriceps","core"], equipment: "bodyweight" },
  { id: "ex_nordic_curl", name: "Nordic Hamstring Curl", category: "legs", muscles: ["hamstrings","glutes"], equipment: "bodyweight" },
  { id: "ex_cable_pull_through", name: "Cable Pull-Through", category: "legs", muscles: ["glutes","hamstrings","erector spinae"], equipment: "cable" },
  { id: "ex_smith_squat", name: "Smith Machine Squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "machine" },
  { id: "ex_single_leg_press", name: "Single-Leg Press", category: "legs", muscles: ["quadriceps","glutes","hamstrings"], equipment: "machine" },
  { id: "ex_wall_sit", name: "Wall Sit", category: "legs", muscles: ["quadriceps","glutes","calves"], equipment: "bodyweight" },
  { id: "ex_band_squat", name: "Band Squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "band" },
  { id: "ex_band_lateral_walk", name: "Band Lateral Walk", category: "legs", muscles: ["gluteus medius","glutes","quadriceps"], equipment: "band" },
  // ── Arms ──
  { id: "ex_barbell_curl", name: "Barbell Curl", category: "arms", muscles: ["biceps","brachialis","forearms"], equipment: "barbell" },
  { id: "ex_db_curl", name: "Dumbbell Curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "dumbbell" },
  { id: "ex_hammer_curl", name: "Hammer Curl", category: "arms", muscles: ["brachialis","biceps","forearms"], equipment: "dumbbell" },
  { id: "ex_preacher_curl", name: "Preacher Curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "barbell" },
  { id: "ex_concentration_curl", name: "Concentration Curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "dumbbell" },
  { id: "ex_cable_curl", name: "Cable Curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "cable" },
  { id: "ex_reverse_curl", name: "Reverse Curl", category: "arms", muscles: ["brachioradialis","forearms","biceps"], equipment: "barbell" },
  { id: "ex_incline_db_curl", name: "Incline Dumbbell Curl", category: "arms", muscles: ["biceps (long head)","brachialis"], equipment: "dumbbell" },
  { id: "ex_spider_curl", name: "Spider Curl", category: "arms", muscles: ["biceps (short head)","brachialis"], equipment: "dumbbell" },
  { id: "ex_tricep_pushdown", name: "Tricep Pushdown", category: "arms", muscles: ["triceps"], equipment: "cable" },
  { id: "ex_tricep_rope_pushdown", name: "Tricep Rope Pushdown", category: "arms", muscles: ["triceps"], equipment: "cable" },
  { id: "ex_skull_crusher", name: "Skull Crusher", category: "arms", muscles: ["triceps"], equipment: "barbell" },
  { id: "ex_overhead_tricep_ext", name: "Overhead Tricep Extension", category: "arms", muscles: ["triceps (long head)"], equipment: "dumbbell" },
  { id: "ex_cable_overhead_ext", name: "Cable Overhead Tricep Extension", category: "arms", muscles: ["triceps (long head)"], equipment: "cable" },
  { id: "ex_close_grip_bench", name: "Close-Grip Bench Press", category: "arms", muscles: ["triceps","pectoralis major","anterior deltoid"], equipment: "barbell" },
  { id: "ex_tricep_dip", name: "Tricep Dip", category: "arms", muscles: ["triceps","anterior deltoid","pectoralis major"], equipment: "bodyweight" },
  { id: "ex_diamond_pushup", name: "Diamond Push-Up", category: "arms", muscles: ["triceps","pectoralis major","anterior deltoid"], equipment: "bodyweight" },
  { id: "ex_wrist_curl", name: "Wrist Curl", category: "arms", muscles: ["forearms"], equipment: "dumbbell" },
  { id: "ex_bayesian_curl", name: "Bayesian Cable Curl", category: "arms", muscles: ["biceps (long head)","brachialis"], equipment: "cable" },
  { id: "ex_kickback", name: "Tricep Kickback", category: "arms", muscles: ["triceps"], equipment: "dumbbell" },
  { id: "ex_ez_bar_curl", name: "EZ Bar Curl", category: "arms", muscles: ["biceps","brachialis","forearms"], equipment: "barbell" },
  { id: "ex_cross_body_curl", name: "Cross-Body Hammer Curl", category: "arms", muscles: ["brachialis","biceps","forearms"], equipment: "dumbbell" },
  { id: "ex_band_curl", name: "Band Curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "band" },
  { id: "ex_band_pushdown", name: "Band Tricep Pushdown", category: "arms", muscles: ["triceps"], equipment: "band" },
  // ── Core ──
  { id: "ex_plank", name: "Plank", category: "core", muscles: ["rectus abdominis","transverse abdominis","obliques","erector spinae"], equipment: "bodyweight" },
  { id: "ex_side_plank", name: "Side Plank", category: "core", muscles: ["obliques","transverse abdominis","gluteus medius"], equipment: "bodyweight" },
  { id: "ex_dead_bug", name: "Dead Bug", category: "core", muscles: ["transverse abdominis","rectus abdominis","hip flexors"], equipment: "bodyweight" },
  { id: "ex_bird_dog", name: "Bird Dog", category: "core", muscles: ["erector spinae","transverse abdominis","glutes","shoulders"], equipment: "bodyweight" },
  { id: "ex_hanging_leg_raise", name: "Hanging Leg Raise", category: "core", muscles: ["rectus abdominis","hip flexors","obliques"], equipment: "bodyweight" },
  { id: "ex_cable_crunch", name: "Cable Crunch", category: "core", muscles: ["rectus abdominis","obliques"], equipment: "cable" },
  { id: "ex_russian_twist", name: "Russian Twist", category: "core", muscles: ["obliques","rectus abdominis"], equipment: "bodyweight" },
  { id: "ex_woodchop", name: "Cable Woodchop", category: "core", muscles: ["obliques","rectus abdominis","shoulders"], equipment: "cable" },
  { id: "ex_ab_wheel", name: "Ab Wheel Rollout", category: "core", muscles: ["rectus abdominis","transverse abdominis","erector spinae","latissimus dorsi"], equipment: "bodyweight" },
  { id: "ex_bicycle_crunch", name: "Bicycle Crunch", category: "core", muscles: ["obliques","rectus abdominis","hip flexors"], equipment: "bodyweight" },
  { id: "ex_v_up", name: "V-Up", category: "core", muscles: ["rectus abdominis","hip flexors","obliques"], equipment: "bodyweight" },
  { id: "ex_pallof_press", name: "Pallof Press", category: "core", muscles: ["transverse abdominis","obliques","core"], equipment: "cable" },
  { id: "ex_kb_windmill", name: "Kettlebell Windmill", category: "core", muscles: ["obliques","core","shoulders","hamstrings","glutes"], equipment: "kettlebell" },
  // ── Cardio ──
  { id: "ex_treadmill", name: "Treadmill Run", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes","core"], equipment: "machine" },
  { id: "ex_stationary_bike", name: "Stationary Bike", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes"], equipment: "machine" },
  { id: "ex_rowing_machine", name: "Rowing Machine", category: "cardio", muscles: ["back","legs","arms","core"], equipment: "machine" },
  { id: "ex_stairmaster", name: "Stairmaster", category: "cardio", muscles: ["quadriceps","glutes","hamstrings","calves","core"], equipment: "machine" },
  { id: "ex_elliptical", name: "Elliptical", category: "cardio", muscles: ["quadriceps","hamstrings","glutes","core","arms"], equipment: "machine" },
  { id: "ex_jump_rope", name: "Jump Rope", category: "cardio", muscles: ["calves","shoulders","forearms","core"], equipment: "bodyweight" },
  { id: "ex_battle_ropes", name: "Battle Ropes", category: "cardio", muscles: ["shoulders","arms","core","legs"], equipment: "bodyweight" },
  { id: "ex_box_jump", name: "Box Jump", category: "cardio", muscles: ["quadriceps","glutes","hamstrings","calves","core"], equipment: "bodyweight" },
  { id: "ex_sled_push", name: "Sled Push", category: "cardio", muscles: ["quadriceps","glutes","hamstrings","calves","core","shoulders"], equipment: "machine" },
  { id: "ex_30min_walk", name: "30-Minute Walk", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes","core"], equipment: "bodyweight" },
  { id: "ex_20min_light_jog", name: "20-Minute Light Jog", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes","core"], equipment: "bodyweight" },
  { id: "ex_bike_ride", name: "Bike Ride (20-30 min)", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes","core"], equipment: "bodyweight" },
  { id: "ex_swimming", name: "Swimming (20-30 min)", category: "cardio", muscles: ["full body","shoulders","core","back"], equipment: "bodyweight" },
  { id: "ex_light_walk", name: "Light Walk (15-20 min)", category: "cardio", muscles: ["quadriceps","calves","hamstrings","glutes"], equipment: "bodyweight" },
  // ── Full Body ──
  { id: "ex_clean_and_press", name: "Clean and Press", category: "full_body", muscles: ["shoulders","trapezius","legs","glutes","core","triceps"], equipment: "barbell" },
  { id: "ex_power_clean", name: "Power Clean", category: "full_body", muscles: ["quadriceps","hamstrings","trapezius","glutes","core","shoulders"], equipment: "barbell" },
  { id: "ex_kettlebell_swing", name: "Kettlebell Swing", category: "full_body", muscles: ["glutes","hamstrings","core","shoulders","back"], equipment: "kettlebell" },
  { id: "ex_turkish_getup", name: "Turkish Get-Up", category: "full_body", muscles: ["shoulders","core","glutes","legs","triceps"], equipment: "kettlebell" },
  { id: "ex_kb_clean_press", name: "Kettlebell Clean & Press", category: "full_body", muscles: ["shoulders","glutes","core","triceps","back"], equipment: "kettlebell" },
  { id: "ex_burpee", name: "Burpee", category: "full_body", muscles: ["full body","core","chest","legs"], equipment: "bodyweight" },
  { id: "ex_thruster", name: "Dumbbell Thruster", category: "full_body", muscles: ["quadriceps","shoulders","glutes","triceps","core"], equipment: "dumbbell" },
  { id: "ex_barbell_thruster", name: "Barbell Thruster", category: "full_body", muscles: ["quadriceps","shoulders","glutes","triceps","core"], equipment: "barbell" },
  { id: "ex_man_maker", name: "Man Maker", category: "full_body", muscles: ["full body","core","shoulders","back","chest"], equipment: "dumbbell" },
  { id: "ex_kb_snatch", name: "Kettlebell Snatch", category: "full_body", muscles: ["shoulders","glutes","hamstrings","core","back","triceps"], equipment: "kettlebell" },
  { id: "ex_hang_clean", name: "Hang Clean", category: "full_body", muscles: ["quadriceps","trapezius","hamstrings","glutes","core","shoulders"], equipment: "barbell" },
  { id: "ex_db_snatch", name: "Dumbbell Snatch", category: "full_body", muscles: ["shoulders","glutes","hamstrings","core","triceps","trapezius"], equipment: "dumbbell" },
  { id: "ex_bear_crawl", name: "Bear Crawl", category: "full_body", muscles: ["core","shoulders","quadriceps","triceps","hip flexors"], equipment: "bodyweight" },
  { id: "ex_renegade_row", name: "Renegade Row", category: "full_body", muscles: ["latissimus dorsi","core","biceps","shoulders","chest"], equipment: "dumbbell" },
  { id: "ex_farmers_carry", name: "Farmer's Carry", category: "full_body", muscles: ["forearms","trapezius","core","legs","shoulders"], equipment: "dumbbell" },
  // ── Warmup ──
  { id: "ex_arm_circles", name: "Arm Circles", category: "warmup", muscles: ["shoulders","rotator cuff"], equipment: "bodyweight" },
  { id: "ex_leg_swings", name: "Leg Swings", category: "warmup", muscles: ["hip flexors","hamstrings","glutes","quadriceps"], equipment: "bodyweight" },
  { id: "ex_hip_circles", name: "Hip Circles", category: "warmup", muscles: ["hip flexors","glutes","core","lower back"], equipment: "bodyweight" },
  { id: "ex_jumping_jacks", name: "Jumping Jacks", category: "warmup", muscles: ["full body","calves","shoulders"], equipment: "bodyweight" },
  { id: "ex_high_knees", name: "High Knees", category: "warmup", muscles: ["hip flexors","quadriceps","calves","core"], equipment: "bodyweight" },
  { id: "ex_butt_kicks", name: "Butt Kicks", category: "warmup", muscles: ["hamstrings","calves","quadriceps"], equipment: "bodyweight" },
  { id: "ex_cat_cow", name: "Cat-Cow Stretch", category: "warmup", muscles: ["spine","core","shoulders","hip flexors"], equipment: "bodyweight" },
  { id: "ex_worlds_greatest_stretch", name: "World's Greatest Stretch", category: "warmup", muscles: ["hip flexors","thoracic spine","hamstrings","glutes","shoulders"], equipment: "bodyweight" },
  // ── Cooldown ──
  { id: "ex_standing_quad_stretch", name: "Standing Quad Stretch", category: "cooldown", muscles: ["quadriceps","hip flexors"], equipment: "bodyweight" },
  { id: "ex_hamstring_stretch", name: "Hamstring Stretch", category: "cooldown", muscles: ["hamstrings","calves","lower back"], equipment: "bodyweight" },
  { id: "ex_pigeon_pose", name: "Pigeon Pose", category: "cooldown", muscles: ["hip flexors","glutes","piriformis","lower back"], equipment: "bodyweight" },
  { id: "ex_shoulder_stretch", name: "Shoulder Stretch", category: "cooldown", muscles: ["shoulders","rear deltoid","upper back"], equipment: "bodyweight" },
  { id: "ex_foam_rolling", name: "Foam Rolling (Full Body)", category: "cooldown", muscles: ["full body"], equipment: "bodyweight" },
  { id: "ex_full_body_stretch", name: "Full Body Stretch Routine", category: "cooldown", muscles: ["full body"], equipment: "bodyweight" },
  { id: "ex_foam_rolling_session", name: "Foam Rolling Session", category: "cooldown", muscles: ["full body"], equipment: "bodyweight" },
  { id: "ex_childs_pose", name: "Child's Pose", category: "cooldown", muscles: ["lower back","lats","shoulders","hips"], equipment: "bodyweight" },
  { id: "ex_deep_breathing", name: "Deep Breathing / Box Breathing", category: "cooldown", muscles: ["diaphragm","core"], equipment: "bodyweight" },
];

// ── Compound Exercise Set ───────────────────────────────────────────

const COMPOUND_EXERCISES = new Set([
  "ex_bench_press", "ex_incline_bench", "ex_decline_bench",
  "ex_db_bench_press", "ex_incline_db_bench", "ex_decline_db_bench",
  "ex_smith_bench_press", "ex_machine_chest_press", "ex_push_up",
  "ex_chest_dip", "ex_landmine_press",
  "ex_barbell_row", "ex_pendlay_row", "ex_tbar_row", "ex_deadlift",
  "ex_pull_up", "ex_chin_up", "ex_lat_pulldown", "ex_seated_cable_row",
  "ex_db_row", "ex_meadows_row", "ex_chest_supported_row", "ex_machine_row",
  "ex_inverted_row",
  "ex_ohp", "ex_db_shoulder_press", "ex_arnold_press",
  "ex_machine_shoulder_press", "ex_upright_row",
  "ex_squat", "ex_front_squat", "ex_goblet_squat", "ex_leg_press",
  "ex_hack_squat", "ex_romanian_deadlift", "ex_db_rdl", "ex_hip_thrust",
  "ex_sumo_deadlift", "ex_lunge", "ex_reverse_lunge",
  "ex_bulgarian_split_squat", "ex_step_up", "ex_good_morning",
  "ex_kb_goblet_squat", "ex_smith_squat", "ex_single_leg_press",
  "ex_close_grip_bench", "ex_tricep_dip", "ex_diamond_pushup",
  "ex_clean_and_press", "ex_power_clean", "ex_kettlebell_swing",
  "ex_turkish_getup", "ex_kb_clean_press", "ex_burpee",
  "ex_thruster", "ex_barbell_thruster", "ex_man_maker",
  "ex_kb_snatch", "ex_hang_clean", "ex_db_snatch",
  "ex_renegade_row", "ex_farmers_carry",
]);

// Build a lookup map for quick access
const EXERCISE_MAP = new Map(EXERCISE_INDEX.map(e => [e.id, e]));

// ── Category → Muscle Group Mapping ─────────────────────────────────

// Maps training categories to the logical muscle group names used for
// recovery tracking and split logic.
const CATEGORY_MUSCLE_MAP: Record<string, string[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  legs: ['legs'],
  arms: ['arms'],
  core: ['core'],
  cardio: ['cardio'],
  full_body: ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'],
};

// Push/pull/legs grouping for split logic
const PUSH_CATEGORIES = ['chest', 'shoulders'];
const PULL_CATEGORIES = ['back'];
const LEG_CATEGORIES = ['legs'];

// Logical split pairings
const SPLIT_PAIRINGS: Record<string, string[][]> = {
  push: [['chest', 'shoulders'], ['chest', 'shoulders', 'arms']],
  pull: [['back'], ['back', 'arms']],
  legs: [['legs'], ['legs', 'core']],
  upper: [['chest', 'back', 'shoulders'], ['chest', 'back', 'shoulders', 'arms']],
  full_body: [['chest', 'back', 'shoulders', 'legs', 'arms', 'core']],
};

// ── Recovery Calculation ────────────────────────────────────────────
// Mirrors the algorithm from apps/mobile/src/lib/recovery.ts

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function baseRecovery(hoursSince: number): number {
  if (hoursSince <= 0) return 0;
  if (hoursSince <= 24) return lerp(0, 30, hoursSince / 24);
  if (hoursSince <= 48) return lerp(30, 60, (hoursSince - 24) / 24);
  if (hoursSince <= 72) return lerp(60, 90, (hoursSince - 48) / 24);
  const extra = hoursSince - 72;
  return Math.min(100, 90 + 10 * (1 - Math.exp(-extra / 24)));
}

function volumeMultiplier(setsForGroup: number): number {
  if (setsForGroup <= 10) return 1;
  return Math.max(0.7, 1 - (setsForGroup - 10) * 0.025);
}

function calculateRecoveryStatus(
  recentWorkouts: RecentWorkout[],
  now: number = Date.now(),
): Record<string, number> {
  const ALL_GROUPS = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];
  const result: Record<string, number> = {};

  for (const group of ALL_GROUPS) {
    let mostRecentTs: number | null = null;
    let totalSets = 0;

    for (const workout of recentWorkouts) {
      const workoutTs = new Date(workout.date).getTime();
      let hitsGroup = false;
      let sessionSets = 0;

      for (const ex of workout.exercises) {
        const categories = CATEGORY_MUSCLE_MAP[ex.category] ?? [];
        if (categories.includes(group)) {
          hitsGroup = true;
          sessionSets += ex.sets;
        }
      }

      if (hitsGroup) {
        if (mostRecentTs === null || workoutTs > mostRecentTs) {
          mostRecentTs = workoutTs;
        }
        const daysSince = (now - workoutTs) / (1000 * 60 * 60 * 24);
        if (daysSince <= 7) {
          totalSets += sessionSets;
        }
      }
    }

    if (mostRecentTs === null) {
      result[group] = 100;
    } else {
      const hoursSince = (now - mostRecentTs) / (1000 * 60 * 60);
      const base = baseRecovery(hoursSince);
      const adjusted = base * volumeMultiplier(totalSets);
      result[group] = Math.round(Math.min(100, Math.max(0, adjusted)));
    }
  }

  return result;
}

// ── Muscle Group Selection ──────────────────────────────────────────

function selectMuscleGroups(
  recovery: Record<string, number>,
  recentWorkouts: RecentWorkout[],
): string[] {
  const now = Date.now();

  // Check what was trained recently
  const lastTrainedCategory: Record<string, number> = {};
  for (const workout of recentWorkouts) {
    const workoutTs = new Date(workout.date).getTime();
    for (const ex of workout.exercises) {
      const groups = CATEGORY_MUSCLE_MAP[ex.category] ?? [];
      for (const g of groups) {
        if (!lastTrainedCategory[g] || workoutTs > lastTrainedCategory[g]) {
          lastTrainedCategory[g] = workoutTs;
        }
      }
    }
  }

  const hoursSinceAny = Object.values(lastTrainedCategory).length > 0
    ? (now - Math.max(...Object.values(lastTrainedCategory))) / (1000 * 60 * 60)
    : Infinity;

  // Rule: If 3+ days since any workout → full-body ease-back day
  if (hoursSinceAny >= 72) {
    return ['chest', 'back', 'legs'];
  }

  // Determine what was trained yesterday and the day before
  const yesterday = now - 24 * 60 * 60 * 1000;
  const dayBefore = now - 48 * 60 * 60 * 1000;

  const trainedYesterday = new Set<string>();
  const trainedDayBefore = new Set<string>();
  for (const workout of recentWorkouts) {
    const ts = new Date(workout.date).getTime();
    const hoursAgo = (now - ts) / (1000 * 60 * 60);
    for (const ex of workout.exercises) {
      const groups = CATEGORY_MUSCLE_MAP[ex.category] ?? [];
      if (hoursAgo <= 24) groups.forEach(g => trainedYesterday.add(g));
      else if (hoursAgo <= 48) groups.forEach(g => trainedDayBefore.add(g));
    }
  }

  const trainedPushYesterday = PUSH_CATEGORIES.some(c => trainedYesterday.has(c));
  const trainedPullYesterday = PULL_CATEGORIES.some(c => trainedYesterday.has(c));
  const trainedLegsYesterday = LEG_CATEGORIES.some(c => trainedYesterday.has(c));
  const trainedUpperTwoDays = PUSH_CATEGORIES.some(c => trainedYesterday.has(c) && trainedDayBefore.has(c))
    || PULL_CATEGORIES.some(c => trainedYesterday.has(c) && trainedDayBefore.has(c));

  // Get groups that are sufficiently recovered (>= 80%)
  const readyGroups = Object.entries(recovery)
    .filter(([_, pct]) => pct >= 80)
    .map(([g]) => g);

  // Rule: If trained push yesterday → suggest pull
  if (trainedPushYesterday && !trainedPullYesterday) {
    const pullGroups = ['back'];
    if (recovery['arms'] >= 70) pullGroups.push('arms');
    if (pullGroups.length > 0) return pullGroups;
  }

  // Rule: If trained pull yesterday → suggest push
  if (trainedPullYesterday && !trainedPushYesterday) {
    const pushGroups = ['chest', 'shoulders'].filter(g => recovery[g] >= 70);
    if (pushGroups.length > 0) return pushGroups;
  }

  // Rule: If trained upper 2 days in a row → suggest legs
  if (trainedUpperTwoDays) {
    const legGroups = ['legs'];
    if (recovery['core'] >= 70) legGroups.push('core');
    if (legGroups.length > 0) return legGroups;
  }

  // Rule: If trained legs yesterday → suggest upper body
  if (trainedLegsYesterday) {
    const upperGroups = ['chest', 'back', 'shoulders'].filter(g => recovery[g] >= 70);
    if (upperGroups.length > 0) return upperGroups;
  }

  // Default: pick 2-3 most recovered groups that form a logical pairing
  if (readyGroups.length === 0) {
    // Nothing fully recovered, pick highest recovery groups
    const sorted = Object.entries(recovery)
      .filter(([g]) => g !== 'cardio')
      .sort(([, a], [, b]) => b - a);
    return sorted.slice(0, 2).map(([g]) => g);
  }

  // Try to pick a logical pairing from ready groups
  for (const [_, pairings] of Object.entries(SPLIT_PAIRINGS)) {
    for (const pairing of pairings) {
      if (pairing.length >= 2 && pairing.length <= 3 && pairing.every(g => readyGroups.includes(g))) {
        return pairing;
      }
    }
  }

  // Fallback: pick top 2-3 ready groups
  return readyGroups.slice(0, 3);
}

// ── Exercise Selection ──────────────────────────────────────────────

function getExerciseCountForDuration(minutes: number): number {
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 5;
  if (minutes <= 60) return 6;
  if (minutes <= 75) return 7;
  return 8;
}

function selectExercises(
  targetGroups: string[],
  equipment: string[],
  availableMinutes: number,
  excludeIds: Set<string>,
): ExerciseEntry[] {
  const targetCount = getExerciseCountForDuration(availableMinutes);

  // Filter the exercise pool: must match target groups & available equipment
  // Exclude warmup, cooldown, and cardio categories from main workout selection
  const excludeCategories = new Set(['warmup', 'cooldown', 'cardio']);
  const pool = EXERCISE_INDEX.filter(e =>
    !excludeCategories.has(e.category) &&
    !excludeIds.has(e.id) &&
    equipment.includes(e.equipment) &&
    targetGroups.includes(e.category)
  );

  if (pool.length === 0) return [];

  // Separate compound and isolation exercises
  const compounds = pool.filter(e => COMPOUND_EXERCISES.has(e.id));
  const isolations = pool.filter(e => !COMPOUND_EXERCISES.has(e.id));

  const selected: ExerciseEntry[] = [];
  const usedNames = new Set<string>();

  // Helper to avoid duplicate movement patterns (e.g. don't pick 3 presses)
  const movementPatterns = new Map<string, number>();

  function getMovementPattern(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('press') || lower.includes('push')) return 'press';
    if (lower.includes('row')) return 'row';
    if (lower.includes('curl')) return 'curl';
    if (lower.includes('fly') || lower.includes('flye') || lower.includes('crossover')) return 'fly';
    if (lower.includes('raise')) return 'raise';
    if (lower.includes('squat')) return 'squat';
    if (lower.includes('deadlift') || lower.includes('rdl')) return 'hinge';
    if (lower.includes('lunge') || lower.includes('split')) return 'lunge';
    if (lower.includes('extension')) return 'extension';
    if (lower.includes('pulldown') || lower.includes('pull-up') || lower.includes('chin')) return 'vertical_pull';
    if (lower.includes('pushdown') || lower.includes('kickback')) return 'tricep_iso';
    return 'other';
  }

  function canAddExercise(e: ExerciseEntry): boolean {
    if (usedNames.has(e.name)) return false;
    const pattern = getMovementPattern(e.name);
    const count = movementPatterns.get(pattern) ?? 0;
    return count < 2; // max 2 exercises per movement pattern
  }

  function addExercise(e: ExerciseEntry): void {
    selected.push(e);
    usedNames.add(e.name);
    const pattern = getMovementPattern(e.name);
    movementPatterns.set(pattern, (movementPatterns.get(pattern) ?? 0) + 1);
  }

  // Distribute exercises across target groups proportionally
  const groupBudget = new Map<string, number>();
  const basePerGroup = Math.floor(targetCount / targetGroups.length);
  let remainder = targetCount - basePerGroup * targetGroups.length;
  for (const group of targetGroups) {
    groupBudget.set(group, basePerGroup + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }

  // Shuffle helper for variety
  function shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // For each group: pick compounds first, then isolations
  for (const group of targetGroups) {
    const budget = groupBudget.get(group) ?? 0;
    let picked = 0;

    const groupCompounds = shuffle(compounds.filter(e => e.category === group));
    const groupIsolations = shuffle(isolations.filter(e => e.category === group));

    // Pick compounds first
    for (const e of groupCompounds) {
      if (picked >= budget) break;
      if (canAddExercise(e)) {
        addExercise(e);
        picked++;
      }
    }

    // Fill remaining with isolations
    for (const e of groupIsolations) {
      if (picked >= budget) break;
      if (canAddExercise(e)) {
        addExercise(e);
        picked++;
      }
    }
  }

  // If we haven't filled all slots, add more from the general pool
  if (selected.length < targetCount) {
    const remaining = shuffle([...compounds, ...isolations].filter(e => !usedNames.has(e.name)));
    for (const e of remaining) {
      if (selected.length >= targetCount) break;
      if (canAddExercise(e)) {
        addExercise(e);
      }
    }
  }

  // Sort: compounds before isolations
  selected.sort((a, b) => {
    const aCompound = COMPOUND_EXERCISES.has(a.id) ? 0 : 1;
    const bCompound = COMPOUND_EXERCISES.has(b.id) ? 0 : 1;
    return aCompound - bCompound;
  });

  return selected;
}

// ── Set / Rep Schemes ───────────────────────────────────────────────

interface SetRepScheme {
  sets: [number, number]; // min, max
  reps: [number, number]; // min, max
  restSeconds: [number, number]; // min, max
}

const GOAL_SCHEMES: Record<string, SetRepScheme> = {
  strength:        { sets: [3, 5], reps: [3, 5],   restSeconds: [180, 300] },
  hypertrophy:     { sets: [3, 4], reps: [8, 12],  restSeconds: [60, 120] },
  endurance:       { sets: [2, 3], reps: [15, 20], restSeconds: [30, 60] },
  general_fitness: { sets: [3, 3], reps: [8, 12],  restSeconds: [60, 90] },
  weight_loss:     { sets: [3, 3], reps: [12, 15], restSeconds: [30, 60] },
};

function getSetRepScheme(
  goal: string,
  isCompound: boolean,
): { targetSets: number; targetReps: string; restSeconds: number } {
  const scheme = GOAL_SCHEMES[goal] ?? GOAL_SCHEMES.general_fitness;

  // Compounds get more sets and lower reps for strength, isolations get fewer sets
  const setsRange = isCompound
    ? [scheme.sets[1], scheme.sets[1]]  // use upper end for compounds
    : [scheme.sets[0], scheme.sets[0]]; // use lower end for isolations

  const targetSets = setsRange[0];
  const targetReps = scheme.reps[0] === scheme.reps[1]
    ? `${scheme.reps[0]}`
    : `${scheme.reps[0]}-${scheme.reps[1]}`;

  // Compounds get more rest
  const restSeconds = isCompound
    ? scheme.restSeconds[1]
    : scheme.restSeconds[0];

  return { targetSets, targetReps, restSeconds };
}

// ── Progressive Overload ────────────────────────────────────────────

function calculateSuggestedWeight(
  exerciseId: string,
  goal: string,
  exerciseHistory: ExerciseHistoryEntry[],
  experienceLevel: string,
): number | undefined {
  const history = exerciseHistory.find(h => h.exerciseId === exerciseId);

  if (!history) {
    // No history — don't suggest a weight (user decides on first session)
    return undefined;
  }

  const { lastWeight, lastReps, personalRecord } = history;
  const maxAllowed = personalRecord
    ? personalRecord.weight * 1.1  // Never suggest more than PR + 10%
    : lastWeight * 1.2;            // Or last weight + 20% if no PR

  let suggested: number;

  switch (goal) {
    case 'strength':
      // If completed target reps → add 2.5-5 lbs
      if (lastReps >= 5) {
        suggested = lastWeight + 5;
      } else {
        // Same weight, aim for +1 rep
        suggested = lastWeight;
      }
      break;

    case 'hypertrophy':
      // If completed all reps (12) → bump weight
      if (lastReps >= 12) {
        suggested = lastWeight + 5;
      } else {
        suggested = lastWeight;
      }
      break;

    case 'endurance':
      // Keep weight same, add reps
      suggested = lastWeight;
      break;

    case 'weight_loss':
      // Same or slight increase
      if (lastReps >= 15) {
        suggested = lastWeight + 2.5;
      } else {
        suggested = lastWeight;
      }
      break;

    default: // general_fitness
      if (lastReps >= 12) {
        suggested = lastWeight + 5;
      } else {
        suggested = lastWeight;
      }
      break;
  }

  // Cap at max allowed
  suggested = Math.min(suggested, maxAllowed);

  // Round to nearest 2.5
  return Math.round(suggested / 2.5) * 2.5;
}

// ── Superset Pairing ────────────────────────────────────────────────

const ANTAGONIST_PAIRS: [string, string][] = [
  ['chest', 'back'],
  ['biceps', 'triceps'],
  ['quadriceps', 'hamstrings'],
];

function isAntagonistPair(a: ExerciseEntry, b: ExerciseEntry): boolean {
  for (const [m1, m2] of ANTAGONIST_PAIRS) {
    const aHas1 = a.muscles.some(m => m.toLowerCase().includes(m1)) || a.category === m1;
    const aHas2 = a.muscles.some(m => m.toLowerCase().includes(m2)) || a.category === m2;
    const bHas1 = b.muscles.some(m => m.toLowerCase().includes(m1)) || b.category === m1;
    const bHas2 = b.muscles.some(m => m.toLowerCase().includes(m2)) || b.category === m2;

    if ((aHas1 && bHas2) || (aHas2 && bHas1)) return true;
  }

  // Also match push/pull at category level
  const pushCats = new Set(['chest', 'shoulders']);
  const pullCats = new Set(['back']);
  if ((pushCats.has(a.category) && pullCats.has(b.category)) ||
      (pullCats.has(a.category) && pushCats.has(b.category))) {
    return true;
  }

  return false;
}

function assignSupersets(exercises: SmartExercise[], exerciseIndex: ExerciseEntry[]): void {
  let groupId = 1;
  const paired = new Set<number>();

  for (let i = 0; i < exercises.length; i++) {
    if (paired.has(i)) continue;
    const exA = exerciseIndex.find(e => e.id === exercises[i].exerciseId);
    if (!exA) continue;

    for (let j = i + 1; j < exercises.length; j++) {
      if (paired.has(j)) continue;
      const exB = exerciseIndex.find(e => e.id === exercises[j].exerciseId);
      if (!exB) continue;

      if (isAntagonistPair(exA, exB)) {
        const id = `superset_${groupId++}`;
        exercises[i].supersetGroupId = id;
        exercises[j].supersetGroupId = id;
        paired.add(i);
        paired.add(j);
        break;
      }
    }
  }
}

// ── Warmup Selection ────────────────────────────────────────────────

function selectWarmupExercises(targetGroups: string[]): string[] {
  const warmupIds: string[] = [];

  // Always include general warmup
  warmupIds.push('ex_jumping_jacks');

  // Add group-specific warmups
  if (targetGroups.includes('chest') || targetGroups.includes('shoulders')) {
    warmupIds.push('ex_arm_circles');
  }
  if (targetGroups.includes('legs')) {
    warmupIds.push('ex_leg_swings', 'ex_hip_circles');
  }
  if (targetGroups.includes('back')) {
    warmupIds.push('ex_cat_cow');
  }

  // Cap at 3-4 warmup exercises
  return warmupIds.slice(0, 4);
}

// ── Rest Day Detection ──────────────────────────────────────────────

function isRestDayNeeded(recovery: Record<string, number>): boolean {
  const trainingGroups = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];
  return trainingGroups.every(g => (recovery[g] ?? 100) < 50);
}

function buildRestDayWorkout(recovery: Record<string, number>): GenerateResponse {
  return {
    workout: {
      name: 'Active Recovery Day',
      targetMuscles: ['full body'],
      exercises: [
        {
          exerciseId: 'ex_light_walk',
          exerciseName: 'Light Walk (15-20 min)',
          category: 'cardio',
          equipment: 'bodyweight',
          targetSets: 1,
          targetReps: '1',
          restSeconds: 0,
          notes: 'Easy pace to promote blood flow',
          isCompound: false,
        },
        {
          exerciseId: 'ex_foam_rolling_session',
          exerciseName: 'Foam Rolling Session',
          category: 'cooldown',
          equipment: 'bodyweight',
          targetSets: 1,
          targetReps: '1',
          restSeconds: 0,
          notes: 'Spend 1-2 minutes on each major muscle group',
          isCompound: false,
        },
        {
          exerciseId: 'ex_full_body_stretch',
          exerciseName: 'Full Body Stretch Routine',
          category: 'cooldown',
          equipment: 'bodyweight',
          targetSets: 1,
          targetReps: '1',
          restSeconds: 0,
          notes: 'Hold each stretch for 30-60 seconds',
          isCompound: false,
        },
        {
          exerciseId: 'ex_deep_breathing',
          exerciseName: 'Deep Breathing / Box Breathing',
          category: 'cooldown',
          equipment: 'bodyweight',
          targetSets: 1,
          targetReps: '5 min',
          restSeconds: 0,
          notes: '4 seconds in, 4 seconds hold, 4 seconds out, 4 seconds hold',
          isCompound: false,
        },
      ],
      estimatedDurationMinutes: 30,
      totalSets: 4,
      aiExplanation: 'Your muscles need recovery. Today\'s light session will promote blood flow and help you come back stronger.',
      recoveryStatus: recovery,
    },
    method: 'algorithmic',
  };
}

// ── Workout Name Generation ─────────────────────────────────────────

function generateWorkoutName(targetGroups: string[], goal: string): string {
  const groupNames = targetGroups.map(g => g.charAt(0).toUpperCase() + g.slice(1));

  if (targetGroups.length >= 4) return 'Full Body Session';

  // Check for push/pull/legs patterns
  const isPush = targetGroups.every(g => ['chest', 'shoulders', 'arms'].includes(g));
  const isPull = targetGroups.every(g => ['back', 'arms'].includes(g));
  const isLegs = targetGroups.every(g => ['legs', 'core'].includes(g));

  const goalLabel: Record<string, string> = {
    strength: 'Strength',
    hypertrophy: 'Hypertrophy',
    endurance: 'Endurance',
    general_fitness: 'Fitness',
    weight_loss: 'Burn',
  };

  const suffix = goalLabel[goal] ?? 'Workout';

  if (isPush) return `Push Day ${suffix}`;
  if (isPull) return `Pull Day ${suffix}`;
  if (isLegs) return `Leg Day ${suffix}`;
  if (targetGroups.length === 1) return `${groupNames[0]} Focus ${suffix}`;

  return `${groupNames.slice(0, 2).join(' & ')} ${suffix}`;
}

// ── Explanation ──────────────────────────────────────────────────────

function generateExplanation(
  recoveryStatus: Record<string, number>,
  targetGroups: string[],
  exerciseNames: string[],
  goal: string,
): string {
  // Build recovery context
  const freshGroups = targetGroups.filter(g => (recoveryStatus[g] ?? 100) >= 80);
  const recoveringGroups = targetGroups.filter(g => {
    const r = recoveryStatus[g] ?? 100;
    return r >= 50 && r < 80;
  });

  // Goal-specific framing
  const goalFraming: Record<string, string> = {
    strength: 'heavy compound movements for maximum strength gains',
    hypertrophy: 'moderate-to-high volume to maximize muscle growth',
    endurance: 'higher rep ranges to build muscular endurance',
    general_fitness: 'a balanced mix of exercises for overall fitness',
    weight_loss: 'compound movements and circuits to maximize calorie burn',
  };
  const goalText = goalFraming[goal] ?? 'a well-rounded session';

  // Build the explanation
  const parts: string[] = [];

  // Recovery-based reasoning
  if (freshGroups.length === targetGroups.length) {
    parts.push(`Your ${formatList(targetGroups)} are fully recovered and ready to train`);
  } else if (recoveringGroups.length > 0) {
    parts.push(`Targeting ${formatList(freshGroups.length > 0 ? freshGroups : targetGroups)} today based on your recovery status`);
  } else {
    parts.push(`Today's session focuses on ${formatList(targetGroups)}`);
  }

  // Goal framing
  parts.push(`with ${goalText}`);

  // Compound the sentence
  let explanation = parts.join(' ') + '.';

  // Add exercise highlight for compound movements
  const compoundNames = exerciseNames.slice(0, 2);
  if (compoundNames.length > 0) {
    explanation += ` Starting with ${formatList(compoundNames)} to build a strong foundation.`;
  }

  return explanation;
}

function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// ── Input Validation ────────────────────────────────────────────────

const VALID_GOALS = new Set(['strength', 'hypertrophy', 'endurance', 'general_fitness', 'weight_loss']);
const VALID_EQUIPMENT = new Set(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band']);
const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const VALID_CATEGORIES = new Set(['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'full_body']);

function validateRequest(body: GenerateRequest): string | null {
  if (!body.goal || !VALID_GOALS.has(body.goal)) {
    return `Invalid goal. Must be one of: ${[...VALID_GOALS].join(', ')}`;
  }

  if (!Array.isArray(body.equipment) || body.equipment.length === 0) {
    return 'equipment must be a non-empty array';
  }
  for (const eq of body.equipment) {
    if (!VALID_EQUIPMENT.has(eq)) {
      return `Invalid equipment type: "${eq}". Must be one of: ${[...VALID_EQUIPMENT].join(', ')}`;
    }
  }

  if (typeof body.availableMinutes !== 'number' || body.availableMinutes < 15 || body.availableMinutes > 180) {
    return 'availableMinutes must be a number between 15 and 180';
  }

  if (body.muscleGroupPreferences) {
    if (!Array.isArray(body.muscleGroupPreferences)) {
      return 'muscleGroupPreferences must be an array';
    }
    for (const g of body.muscleGroupPreferences) {
      if (!VALID_CATEGORIES.has(g)) {
        return `Invalid muscle group: "${g}". Must be one of: ${[...VALID_CATEGORIES].join(', ')}`;
      }
    }
  }

  if (body.experienceLevel && !VALID_LEVELS.has(body.experienceLevel)) {
    return `Invalid experienceLevel. Must be one of: ${[...VALID_LEVELS].join(', ')}`;
  }

  return null;
}

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const { user_id } = await verifyAuth(req);

    // Rate limit by authenticated user
    const rateLimitKey = user_id;

    if (!checkRateLimit(rateLimitKey)) {
      return errorResponse('Rate limit exceeded. Maximum 10 generations per hour.', 429);
    }

    const body: GenerateRequest = await req.json();

    // Validate input
    const validationError = validateRequest(body);
    if (validationError) {
      return errorResponse(validationError, 400);
    }

    const {
      goal,
      equipment,
      availableMinutes,
      muscleGroupPreferences,
      recentWorkouts = [],
      exerciseHistory = [],
      experienceLevel = 'intermediate',
      excludeExerciseIds = [],
    } = body;

    // 1. Calculate recovery status
    const recovery = calculateRecoveryStatus(recentWorkouts);

    // 2. Check if rest day is needed
    if (isRestDayNeeded(recovery)) {
      return jsonResponse(buildRestDayWorkout(recovery));
    }

    // 3. Select muscle groups
    let targetGroups = muscleGroupPreferences && muscleGroupPreferences.length > 0
      ? muscleGroupPreferences
      : selectMuscleGroups(recovery, recentWorkouts);

    // Fallback if selection returned empty (all muscles below recovery threshold)
    if (targetGroups.length === 0) {
      targetGroups = Object.entries(recovery)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([group]) => group);
    }

    // 4. Select exercises
    const excludeSet = new Set(excludeExerciseIds);
    const selectedExercises = selectExercises(targetGroups, equipment, availableMinutes, excludeSet);

    if (selectedExercises.length === 0) {
      return errorResponse(
        `No exercises found matching your equipment (${equipment.join(', ')}) for the target muscle groups (${targetGroups.join(', ')}). Try adding more equipment types.`,
        400,
      );
    }

    // 5. Build SmartExercise array with sets/reps/weight
    const smartExercises: SmartExercise[] = selectedExercises.map(e => {
      const isCompound = COMPOUND_EXERCISES.has(e.id);
      const { targetSets, targetReps, restSeconds } = getSetRepScheme(goal, isCompound);
      const suggestedWeight = calculateSuggestedWeight(e.id, goal, exerciseHistory, experienceLevel);

      return {
        exerciseId: e.id,
        exerciseName: e.name,
        category: e.category,
        equipment: e.equipment,
        targetSets,
        targetReps,
        suggestedWeight,
        restSeconds,
        isCompound,
      };
    });

    // 6. Apply supersets if time is limited
    if (availableMinutes < 45) {
      assignSupersets(smartExercises, selectedExercises);
    }

    // 7. Select warmup exercises
    const warmupExercises = selectWarmupExercises(targetGroups);

    // 8. Calculate total sets and estimated duration
    const totalSets = smartExercises.reduce((sum, e) => sum + e.targetSets, 0);

    // Rough duration estimate: ~2.5 min per set (including rest) + 5 min warmup
    const estimatedDurationMinutes = Math.round(totalSets * 2.5 + 5);

    // 9. Generate workout name
    const workoutName = generateWorkoutName(targetGroups, goal);

    // 10. Generate explanation
    const exerciseNames = smartExercises.map(e => e.exerciseName);
    const explanation = generateExplanation(recovery, targetGroups, exerciseNames, goal);
    const method = 'algorithmic' as const;

    const response: GenerateResponse = {
      workout: {
        name: workoutName,
        targetMuscles: targetGroups,
        exercises: smartExercises,
        warmupExercises,
        estimatedDurationMinutes,
        totalSets,
        aiExplanation: explanation,
        recoveryStatus: recovery,
      },
      method,
    };

    return jsonResponse(response);
  } catch (err) {
    console.error('Generate smart workout error:', err);
    if (err instanceof SyntaxError) {
      return errorResponse('Invalid JSON in request body', 400);
    }
    return errorResponse('Internal server error', 500);
  }
});
