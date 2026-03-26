// ── AI Exercise Search Edge Function ─────────────────────────────────
// Natural language exercise search with text matching + AI fallback.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { createAIProvider } from '../_shared/ai-provider.ts';
import type { AIMessage, CacheableSystemBlock } from '../_shared/types.ts';

// ── Types ───────────────────────────────────────────────────────────

interface ExerciseIndex {
  id: string;
  name: string;
  nameLower: string;
  category: string;
  muscles: string[];
  equipment: string;
  keywords: string[];
}

interface SearchResult {
  exerciseId: string;
  name: string;
  score: number;
  reason: string;
}

interface SearchRequest {
  query: string;
  limit?: number;
}

interface AIFilters {
  muscles?: string[];
  equipment?: string[];
  category?: string;
  keywords?: string[];
}

// ── Rate Limiting (in-memory) ───────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ── Muscle Synonyms ─────────────────────────────────────────────────

const MUSCLE_SYNONYMS: Record<string, string[]> = {
  chest: ['pectoralis major', 'pectoralis', 'pecs', 'upper pectoralis major', 'lower pectoralis major', 'upper chest'],
  back: ['latissimus dorsi', 'lats', 'rhomboids', 'erector spinae', 'trapezius', 'traps', 'upper back', 'lower back'],
  shoulders: ['deltoid', 'anterior deltoid', 'medial deltoid', 'rear deltoid', 'delts', 'front delt', 'side delt', 'rear delt'],
  biceps: ['biceps', 'bicep'],
  triceps: ['triceps', 'tricep', 'triceps (long head)'],
  legs: ['quadriceps', 'quads', 'hamstrings', 'glutes', 'calves', 'hip flexors', 'adductors', 'abductors'],
  quads: ['quadriceps', 'quads'],
  hamstrings: ['hamstrings', 'hams'],
  glutes: ['glutes', 'gluteus', 'butt', 'hip thrust'],
  calves: ['calves', 'calf', 'gastrocnemius', 'soleus'],
  core: ['core', 'abs', 'abdominals', 'obliques', 'rectus abdominis', 'transverse abdominis', 'diaphragm'],
  forearms: ['forearms', 'wrist', 'grip'],
  traps: ['trapezius', 'traps'],
};

function expandMuscleTerms(term: string): string[] {
  const lower = term.toLowerCase();
  const expanded: string[] = [lower];
  for (const [key, synonyms] of Object.entries(MUSCLE_SYNONYMS)) {
    if (lower === key || synonyms.includes(lower)) {
      expanded.push(key, ...synonyms);
    }
  }
  return [...new Set(expanded)];
}

// ── Exercise Index ──────────────────────────────────────────────────

const EXERCISE_INDEX: ExerciseIndex[] = [
  { id: "ex_bench_press", name: "Barbell Bench Press", nameLower: "barbell bench press", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps"], equipment: "barbell", keywords: ["barbell","bench","press"] },
  { id: "ex_incline_bench", name: "Incline Barbell Bench Press", nameLower: "incline barbell bench press", category: "chest", muscles: ["upper pectoralis major","anterior deltoid","triceps"], equipment: "barbell", keywords: ["incline","barbell","bench","press"] },
  { id: "ex_decline_bench", name: "Decline Barbell Bench Press", nameLower: "decline barbell bench press", category: "chest", muscles: ["lower pectoralis major","anterior deltoid","triceps"], equipment: "barbell", keywords: ["decline","barbell","bench","press"] },
  { id: "ex_db_bench_press", name: "Dumbbell Bench Press", nameLower: "dumbbell bench press", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps"], equipment: "dumbbell", keywords: ["dumbbell","bench","press"] },
  { id: "ex_incline_db_bench", name: "Incline Dumbbell Bench Press", nameLower: "incline dumbbell bench press", category: "chest", muscles: ["upper pectoralis major","anterior deltoid","triceps"], equipment: "dumbbell", keywords: ["incline","dumbbell","bench","press"] },
  { id: "ex_decline_db_bench", name: "Decline Dumbbell Bench Press", nameLower: "decline dumbbell bench press", category: "chest", muscles: ["lower pectoralis major","anterior deltoid","triceps"], equipment: "dumbbell", keywords: ["decline","dumbbell","bench","press"] },
  { id: "ex_db_flyes", name: "Dumbbell Flyes", nameLower: "dumbbell flyes", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "dumbbell", keywords: ["dumbbell","flyes"] },
  { id: "ex_cable_crossover", name: "Cable Crossover", nameLower: "cable crossover", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "cable", keywords: ["cable","crossover"] },
  { id: "ex_cable_fly_low", name: "Low Cable Fly", nameLower: "low cable fly", category: "chest", muscles: ["upper pectoralis major","anterior deltoid"], equipment: "cable", keywords: ["low","cable","fly"] },
  { id: "ex_cable_fly_mid", name: "Mid Cable Fly", nameLower: "mid cable fly", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "cable", keywords: ["mid","cable","fly"] },
  { id: "ex_pec_deck", name: "Pec Deck", nameLower: "pec deck", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "machine", keywords: ["pec","deck"] },
  { id: "ex_machine_chest_press", name: "Machine Chest Press", nameLower: "machine chest press", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps"], equipment: "machine", keywords: ["machine","chest","press"] },
  { id: "ex_push_up", name: "Push-Up", nameLower: "push-up", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps","core"], equipment: "bodyweight", keywords: ["push"] },
  { id: "ex_chest_dip", name: "Chest Dip", nameLower: "chest dip", category: "chest", muscles: ["pectoralis major","triceps","anterior deltoid"], equipment: "bodyweight", keywords: ["chest","dip"] },
  { id: "ex_landmine_press", name: "Landmine Press", nameLower: "landmine press", category: "chest", muscles: ["upper pectoralis major","anterior deltoid","triceps","core"], equipment: "barbell", keywords: ["landmine","press"] },
  { id: "ex_svend_press", name: "Svend Press", nameLower: "svend press", category: "chest", muscles: ["pectoralis major","anterior deltoid"], equipment: "dumbbell", keywords: ["svend","press"] },
  { id: "ex_incline_db_flyes", name: "Incline Dumbbell Flyes", nameLower: "incline dumbbell flyes", category: "chest", muscles: ["upper pectoralis major","anterior deltoid"], equipment: "dumbbell", keywords: ["incline","dumbbell","flyes"] },
  { id: "ex_smith_bench_press", name: "Smith Machine Bench Press", nameLower: "smith machine bench press", category: "chest", muscles: ["pectoralis major","anterior deltoid","triceps"], equipment: "machine", keywords: ["smith","machine","bench","press"] },
  { id: "ex_barbell_row", name: "Barbell Row", nameLower: "barbell row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "barbell", keywords: ["barbell","row"] },
  { id: "ex_pendlay_row", name: "Pendlay Row", nameLower: "pendlay row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid","erector spinae"], equipment: "barbell", keywords: ["pendlay","row"] },
  { id: "ex_tbar_row", name: "T-Bar Row", nameLower: "t-bar row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid","erector spinae"], equipment: "barbell", keywords: ["bar","row"] },
  { id: "ex_deadlift", name: "Deadlift", nameLower: "deadlift", category: "back", muscles: ["erector spinae","glutes","hamstrings","trapezius","forearms","core"], equipment: "barbell", keywords: ["deadlift"] },
  { id: "ex_pull_up", name: "Pull-Up", nameLower: "pull-up", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids","forearms"], equipment: "bodyweight", keywords: ["pull"] },
  { id: "ex_chin_up", name: "Chin-Up", nameLower: "chin-up", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids","forearms"], equipment: "bodyweight", keywords: ["chin"] },
  { id: "ex_lat_pulldown", name: "Lat Pulldown", nameLower: "lat pulldown", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids"], equipment: "cable", keywords: ["lat","pulldown"] },
  { id: "ex_close_grip_pulldown", name: "Close-Grip Lat Pulldown", nameLower: "close-grip lat pulldown", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids"], equipment: "cable", keywords: ["close","grip","lat","pulldown"] },
  { id: "ex_neutral_grip_pulldown", name: "Neutral-Grip Lat Pulldown", nameLower: "neutral-grip lat pulldown", category: "back", muscles: ["latissimus dorsi","biceps","rhomboids"], equipment: "cable", keywords: ["neutral","grip","lat","pulldown"] },
  { id: "ex_seated_cable_row", name: "Seated Cable Row", nameLower: "seated cable row", category: "back", muscles: ["rhomboids","latissimus dorsi","biceps","rear deltoid"], equipment: "cable", keywords: ["seated","cable","row"] },
  { id: "ex_db_row", name: "Dumbbell Row", nameLower: "dumbbell row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "dumbbell", keywords: ["dumbbell","row"] },
  { id: "ex_meadows_row", name: "Meadows Row", nameLower: "meadows row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "barbell", keywords: ["meadows","row"] },
  { id: "ex_face_pull", name: "Face Pull", nameLower: "face pull", category: "back", muscles: ["rear deltoid","rhomboids","trapezius","rotator cuff"], equipment: "cable", keywords: ["face","pull"] },
  { id: "ex_straight_arm_pulldown", name: "Straight-Arm Pulldown", nameLower: "straight-arm pulldown", category: "back", muscles: ["latissimus dorsi","triceps (long head)","rear deltoid"], equipment: "cable", keywords: ["straight","arm","pulldown"] },
  { id: "ex_chest_supported_row", name: "Chest-Supported Dumbbell Row", nameLower: "chest-supported dumbbell row", category: "back", muscles: ["rhomboids","latissimus dorsi","biceps","rear deltoid"], equipment: "dumbbell", keywords: ["chest","supported","dumbbell","row"] },
  { id: "ex_barbell_shrug", name: "Barbell Shrug", nameLower: "barbell shrug", category: "back", muscles: ["trapezius","rhomboids"], equipment: "barbell", keywords: ["barbell","shrug"] },
  { id: "ex_rack_pull", name: "Rack Pull", nameLower: "rack pull", category: "back", muscles: ["erector spinae","trapezius","glutes","hamstrings","forearms"], equipment: "barbell", keywords: ["rack","pull"] },
  { id: "ex_inverted_row", name: "Inverted Row", nameLower: "inverted row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid","core"], equipment: "bodyweight", keywords: ["inverted","row"] },
  { id: "ex_seal_row", name: "Seal Row", nameLower: "seal row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "barbell", keywords: ["seal","row"] },
  { id: "ex_lat_prayer", name: "Cable Lat Prayer", nameLower: "cable lat prayer", category: "back", muscles: ["latissimus dorsi","triceps (long head)"], equipment: "cable", keywords: ["cable","lat","prayer"] },
  { id: "ex_ohp", name: "Overhead Press", nameLower: "overhead press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps","upper chest","trapezius"], equipment: "barbell", keywords: ["overhead","press"] },
  { id: "ex_db_shoulder_press", name: "Dumbbell Shoulder Press", nameLower: "dumbbell shoulder press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps"], equipment: "dumbbell", keywords: ["dumbbell","shoulder","press"] },
  { id: "ex_seated_db_press", name: "Seated Dumbbell Press", nameLower: "seated dumbbell press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps"], equipment: "dumbbell", keywords: ["seated","dumbbell","press"] },
  { id: "ex_arnold_press", name: "Arnold Press", nameLower: "arnold press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps"], equipment: "dumbbell", keywords: ["arnold","press"] },
  { id: "ex_lateral_raise", name: "Lateral Raise", nameLower: "lateral raise", category: "shoulders", muscles: ["medial deltoid","trapezius"], equipment: "dumbbell", keywords: ["lateral","raise"] },
  { id: "ex_cable_lateral_raise", name: "Cable Lateral Raise", nameLower: "cable lateral raise", category: "shoulders", muscles: ["medial deltoid","trapezius"], equipment: "cable", keywords: ["cable","lateral","raise"] },
  { id: "ex_front_raise", name: "Front Raise", nameLower: "front raise", category: "shoulders", muscles: ["anterior deltoid","medial deltoid"], equipment: "dumbbell", keywords: ["front","raise"] },
  { id: "ex_reverse_fly", name: "Reverse Fly", nameLower: "reverse fly", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius"], equipment: "dumbbell", keywords: ["reverse","fly"] },
  { id: "ex_rear_delt_fly_cable", name: "Cable Rear Delt Fly", nameLower: "cable rear delt fly", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius"], equipment: "cable", keywords: ["cable","rear","delt","fly"] },
  { id: "ex_upright_row", name: "Upright Row", nameLower: "upright row", category: "shoulders", muscles: ["medial deltoid","trapezius","biceps","forearms"], equipment: "barbell", keywords: ["upright","row"] },
  { id: "ex_machine_shoulder_press", name: "Machine Shoulder Press", nameLower: "machine shoulder press", category: "shoulders", muscles: ["anterior deltoid","medial deltoid","triceps"], equipment: "machine", keywords: ["machine","shoulder","press"] },
  { id: "ex_rear_delt_machine", name: "Reverse Pec Deck", nameLower: "reverse pec deck", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius"], equipment: "machine", keywords: ["reverse","pec","deck"] },
  { id: "ex_db_shrug", name: "Dumbbell Shrug", nameLower: "dumbbell shrug", category: "shoulders", muscles: ["trapezius","rhomboids"], equipment: "dumbbell", keywords: ["dumbbell","shrug"] },
  { id: "ex_band_pull_apart", name: "Band Pull-Apart", nameLower: "band pull-apart", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius"], equipment: "band", keywords: ["band","pull","apart"] },
  { id: "ex_squat", name: "Barbell Back Squat", nameLower: "barbell back squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core","erector spinae"], equipment: "barbell", keywords: ["barbell","back","squat"] },
  { id: "ex_front_squat", name: "Front Squat", nameLower: "front squat", category: "legs", muscles: ["quadriceps","glutes","core"], equipment: "barbell", keywords: ["front","squat"] },
  { id: "ex_goblet_squat", name: "Goblet Squat", nameLower: "goblet squat", category: "legs", muscles: ["quadriceps","glutes","core","hamstrings"], equipment: "dumbbell", keywords: ["goblet","squat"] },
  { id: "ex_leg_press", name: "Leg Press", nameLower: "leg press", category: "legs", muscles: ["quadriceps","glutes","hamstrings"], equipment: "machine", keywords: ["leg","press"] },
  { id: "ex_hack_squat", name: "Hack Squat", nameLower: "hack squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings"], equipment: "machine", keywords: ["hack","squat"] },
  { id: "ex_romanian_deadlift", name: "Romanian Deadlift", nameLower: "romanian deadlift", category: "legs", muscles: ["hamstrings","glutes","erector spinae"], equipment: "barbell", keywords: ["romanian","deadlift"] },
  { id: "ex_db_rdl", name: "Dumbbell Romanian Deadlift", nameLower: "dumbbell romanian deadlift", category: "legs", muscles: ["hamstrings","glutes","erector spinae"], equipment: "dumbbell", keywords: ["dumbbell","romanian","deadlift"] },
  { id: "ex_hip_thrust", name: "Barbell Hip Thrust", nameLower: "barbell hip thrust", category: "legs", muscles: ["glutes","hamstrings","core"], equipment: "barbell", keywords: ["barbell","hip","thrust"] },
  { id: "ex_leg_curl", name: "Leg Curl", nameLower: "leg curl", category: "legs", muscles: ["hamstrings"], equipment: "machine", keywords: ["leg","curl"] },
  { id: "ex_seated_leg_curl", name: "Seated Leg Curl", nameLower: "seated leg curl", category: "legs", muscles: ["hamstrings"], equipment: "machine", keywords: ["seated","leg","curl"] },
  { id: "ex_leg_extension", name: "Leg Extension", nameLower: "leg extension", category: "legs", muscles: ["quadriceps"], equipment: "machine", keywords: ["leg","extension"] },
  { id: "ex_lunge", name: "Walking Lunge", nameLower: "walking lunge", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "dumbbell", keywords: ["walking","lunge"] },
  { id: "ex_reverse_lunge", name: "Reverse Lunge", nameLower: "reverse lunge", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "dumbbell", keywords: ["reverse","lunge"] },
  { id: "ex_calf_raise", name: "Standing Calf Raise", nameLower: "standing calf raise", category: "legs", muscles: ["gastrocnemius","soleus"], equipment: "machine", keywords: ["standing","calf","raise"] },
  { id: "ex_seated_calf_raise", name: "Seated Calf Raise", nameLower: "seated calf raise", category: "legs", muscles: ["soleus","gastrocnemius"], equipment: "machine", keywords: ["seated","calf","raise"] },
  { id: "ex_bulgarian_split_squat", name: "Bulgarian Split Squat", nameLower: "bulgarian split squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "dumbbell", keywords: ["bulgarian","split","squat"] },
  { id: "ex_sumo_deadlift", name: "Sumo Deadlift", nameLower: "sumo deadlift", category: "legs", muscles: ["glutes","hamstrings","quadriceps","erector spinae","adductors","core"], equipment: "barbell", keywords: ["sumo","deadlift"] },
  { id: "ex_step_up", name: "Dumbbell Step-Up", nameLower: "dumbbell step-up", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "dumbbell", keywords: ["dumbbell","step"] },
  { id: "ex_glute_bridge", name: "Glute Bridge", nameLower: "glute bridge", category: "legs", muscles: ["glutes","hamstrings","core"], equipment: "bodyweight", keywords: ["glute","bridge"] },
  { id: "ex_good_morning", name: "Good Morning", nameLower: "good morning", category: "legs", muscles: ["hamstrings","erector spinae","glutes","core"], equipment: "barbell", keywords: ["good","morning"] },
  { id: "ex_kb_goblet_squat", name: "Kettlebell Goblet Squat", nameLower: "kettlebell goblet squat", category: "legs", muscles: ["quadriceps","glutes","core","hamstrings"], equipment: "kettlebell", keywords: ["kettlebell","goblet","squat"] },
  { id: "ex_adductor_machine", name: "Adductor Machine", nameLower: "adductor machine", category: "legs", muscles: ["adductors"], equipment: "machine", keywords: ["adductor","machine"] },
  { id: "ex_abductor_machine", name: "Abductor Machine", nameLower: "abductor machine", category: "legs", muscles: ["gluteus medius","gluteus minimus"], equipment: "machine", keywords: ["abductor","machine"] },
  { id: "ex_sissy_squat", name: "Sissy Squat", nameLower: "sissy squat", category: "legs", muscles: ["quadriceps","core"], equipment: "bodyweight", keywords: ["sissy","squat"] },
  { id: "ex_nordic_curl", name: "Nordic Hamstring Curl", nameLower: "nordic hamstring curl", category: "legs", muscles: ["hamstrings","glutes"], equipment: "bodyweight", keywords: ["nordic","hamstring","curl"] },
  { id: "ex_cable_pull_through", name: "Cable Pull-Through", nameLower: "cable pull-through", category: "legs", muscles: ["glutes","hamstrings","erector spinae"], equipment: "cable", keywords: ["cable","pull","through"] },
  { id: "ex_smith_squat", name: "Smith Machine Squat", nameLower: "smith machine squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "machine", keywords: ["smith","machine","squat"] },
  { id: "ex_single_leg_press", name: "Single-Leg Press", nameLower: "single-leg press", category: "legs", muscles: ["quadriceps","glutes","hamstrings"], equipment: "machine", keywords: ["single","leg","press"] },
  { id: "ex_barbell_curl", name: "Barbell Curl", nameLower: "barbell curl", category: "arms", muscles: ["biceps","brachialis","forearms"], equipment: "barbell", keywords: ["barbell","curl"] },
  { id: "ex_db_curl", name: "Dumbbell Curl", nameLower: "dumbbell curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "dumbbell", keywords: ["dumbbell","curl"] },
  { id: "ex_hammer_curl", name: "Hammer Curl", nameLower: "hammer curl", category: "arms", muscles: ["brachialis","biceps","forearms"], equipment: "dumbbell", keywords: ["hammer","curl"] },
  { id: "ex_preacher_curl", name: "Preacher Curl", nameLower: "preacher curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "barbell", keywords: ["preacher","curl"] },
  { id: "ex_concentration_curl", name: "Concentration Curl", nameLower: "concentration curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "dumbbell", keywords: ["concentration","curl"] },
  { id: "ex_cable_curl", name: "Cable Curl", nameLower: "cable curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "cable", keywords: ["cable","curl"] },
  { id: "ex_reverse_curl", name: "Reverse Curl", nameLower: "reverse curl", category: "arms", muscles: ["brachioradialis","forearms","biceps"], equipment: "barbell", keywords: ["reverse","curl"] },
  { id: "ex_incline_db_curl", name: "Incline Dumbbell Curl", nameLower: "incline dumbbell curl", category: "arms", muscles: ["biceps (long head)","brachialis"], equipment: "dumbbell", keywords: ["incline","dumbbell","curl"] },
  { id: "ex_spider_curl", name: "Spider Curl", nameLower: "spider curl", category: "arms", muscles: ["biceps (short head)","brachialis"], equipment: "dumbbell", keywords: ["spider","curl"] },
  { id: "ex_tricep_pushdown", name: "Tricep Pushdown", nameLower: "tricep pushdown", category: "arms", muscles: ["triceps"], equipment: "cable", keywords: ["tricep","pushdown"] },
  { id: "ex_tricep_rope_pushdown", name: "Tricep Rope Pushdown", nameLower: "tricep rope pushdown", category: "arms", muscles: ["triceps"], equipment: "cable", keywords: ["tricep","rope","pushdown"] },
  { id: "ex_skull_crusher", name: "Skull Crusher", nameLower: "skull crusher", category: "arms", muscles: ["triceps"], equipment: "barbell", keywords: ["skull","crusher"] },
  { id: "ex_overhead_tricep_ext", name: "Overhead Tricep Extension", nameLower: "overhead tricep extension", category: "arms", muscles: ["triceps (long head)"], equipment: "dumbbell", keywords: ["overhead","tricep","extension"] },
  { id: "ex_cable_overhead_ext", name: "Cable Overhead Tricep Extension", nameLower: "cable overhead tricep extension", category: "arms", muscles: ["triceps (long head)"], equipment: "cable", keywords: ["cable","overhead","tricep","extension"] },
  { id: "ex_close_grip_bench", name: "Close-Grip Bench Press", nameLower: "close-grip bench press", category: "arms", muscles: ["triceps","pectoralis major","anterior deltoid"], equipment: "barbell", keywords: ["close","grip","bench","press"] },
  { id: "ex_tricep_dip", name: "Tricep Dip", nameLower: "tricep dip", category: "arms", muscles: ["triceps","anterior deltoid","pectoralis major"], equipment: "bodyweight", keywords: ["tricep","dip"] },
  { id: "ex_diamond_pushup", name: "Diamond Push-Up", nameLower: "diamond push-up", category: "arms", muscles: ["triceps","pectoralis major","anterior deltoid"], equipment: "bodyweight", keywords: ["diamond","push"] },
  { id: "ex_wrist_curl", name: "Wrist Curl", nameLower: "wrist curl", category: "arms", muscles: ["forearms"], equipment: "dumbbell", keywords: ["wrist","curl"] },
  { id: "ex_bayesian_curl", name: "Bayesian Cable Curl", nameLower: "bayesian cable curl", category: "arms", muscles: ["biceps (long head)","brachialis"], equipment: "cable", keywords: ["bayesian","cable","curl"] },
  { id: "ex_kickback", name: "Tricep Kickback", nameLower: "tricep kickback", category: "arms", muscles: ["triceps"], equipment: "dumbbell", keywords: ["tricep","kickback"] },
  { id: "ex_ez_bar_curl", name: "EZ Bar Curl", nameLower: "ez bar curl", category: "arms", muscles: ["biceps","brachialis","forearms"], equipment: "barbell", keywords: ["bar","curl"] },
  { id: "ex_cross_body_curl", name: "Cross-Body Hammer Curl", nameLower: "cross-body hammer curl", category: "arms", muscles: ["brachialis","biceps","forearms"], equipment: "dumbbell", keywords: ["cross","body","hammer","curl"] },
  { id: "ex_plank", name: "Plank", nameLower: "plank", category: "core", muscles: ["rectus abdominis","transverse abdominis","obliques","erector spinae"], equipment: "bodyweight", keywords: ["plank"] },
  { id: "ex_side_plank", name: "Side Plank", nameLower: "side plank", category: "core", muscles: ["obliques","transverse abdominis","gluteus medius"], equipment: "bodyweight", keywords: ["side","plank"] },
  { id: "ex_dead_bug", name: "Dead Bug", nameLower: "dead bug", category: "core", muscles: ["transverse abdominis","rectus abdominis","hip flexors"], equipment: "bodyweight", keywords: ["dead","bug"] },
  { id: "ex_bird_dog", name: "Bird Dog", nameLower: "bird dog", category: "core", muscles: ["erector spinae","transverse abdominis","glutes","shoulders"], equipment: "bodyweight", keywords: ["bird","dog"] },
  { id: "ex_wall_sit", name: "Wall Sit", nameLower: "wall sit", category: "legs", muscles: ["quadriceps","glutes","calves"], equipment: "bodyweight", keywords: ["wall","sit"] },
  { id: "ex_dead_hang", name: "Dead Hang", nameLower: "dead hang", category: "back", muscles: ["forearms","latissimus dorsi","shoulders","core"], equipment: "bodyweight", keywords: ["dead","hang"] },
  { id: "ex_hanging_leg_raise", name: "Hanging Leg Raise", nameLower: "hanging leg raise", category: "core", muscles: ["rectus abdominis","hip flexors","obliques"], equipment: "bodyweight", keywords: ["hanging","leg","raise"] },
  { id: "ex_cable_crunch", name: "Cable Crunch", nameLower: "cable crunch", category: "core", muscles: ["rectus abdominis","obliques"], equipment: "cable", keywords: ["cable","crunch"] },
  { id: "ex_russian_twist", name: "Russian Twist", nameLower: "russian twist", category: "core", muscles: ["obliques","rectus abdominis"], equipment: "bodyweight", keywords: ["russian","twist"] },
  { id: "ex_woodchop", name: "Cable Woodchop", nameLower: "cable woodchop", category: "core", muscles: ["obliques","rectus abdominis","shoulders"], equipment: "cable", keywords: ["cable","woodchop"] },
  { id: "ex_ab_wheel", name: "Ab Wheel Rollout", nameLower: "ab wheel rollout", category: "core", muscles: ["rectus abdominis","transverse abdominis","erector spinae","latissimus dorsi"], equipment: "bodyweight", keywords: ["wheel","rollout"] },
  { id: "ex_bicycle_crunch", name: "Bicycle Crunch", nameLower: "bicycle crunch", category: "core", muscles: ["obliques","rectus abdominis","hip flexors"], equipment: "bodyweight", keywords: ["bicycle","crunch"] },
  { id: "ex_v_up", name: "V-Up", nameLower: "v-up", category: "core", muscles: ["rectus abdominis","hip flexors","obliques"], equipment: "bodyweight", keywords: [] },
  { id: "ex_pallof_press", name: "Pallof Press", nameLower: "pallof press", category: "core", muscles: ["transverse abdominis","obliques","shoulders"], equipment: "cable", keywords: ["pallof","press"] },
  { id: "ex_decline_crunch", name: "Decline Crunch", nameLower: "decline crunch", category: "core", muscles: ["rectus abdominis","obliques"], equipment: "bodyweight", keywords: ["decline","crunch"] },
  { id: "ex_mountain_climber", name: "Mountain Climber", nameLower: "mountain climber", category: "core", muscles: ["rectus abdominis","hip flexors","shoulders","quadriceps"], equipment: "bodyweight", keywords: ["mountain","climber"] },
  { id: "ex_dragon_flag", name: "Dragon Flag", nameLower: "dragon flag", category: "core", muscles: ["rectus abdominis","transverse abdominis","obliques","hip flexors"], equipment: "bodyweight", keywords: ["dragon","flag"] },
  { id: "ex_treadmill_run", name: "Treadmill Run", nameLower: "treadmill run", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes","core"], equipment: "machine", keywords: ["treadmill","run"] },
  { id: "ex_treadmill_walk", name: "Treadmill Incline Walk", nameLower: "treadmill incline walk", category: "cardio", muscles: ["glutes","hamstrings","calves","quadriceps","core"], equipment: "machine", keywords: ["treadmill","incline","walk"] },
  { id: "ex_rowing_machine", name: "Rowing Machine", nameLower: "rowing machine", category: "cardio", muscles: ["back","legs","arms","core"], equipment: "machine", keywords: ["rowing","machine"] },
  { id: "ex_stationary_bike", name: "Stationary Bike", nameLower: "stationary bike", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes"], equipment: "machine", keywords: ["stationary","bike"] },
  { id: "ex_stairmaster", name: "Stairmaster", nameLower: "stairmaster", category: "cardio", muscles: ["quadriceps","glutes","hamstrings","calves","core"], equipment: "machine", keywords: ["stairmaster"] },
  { id: "ex_elliptical", name: "Elliptical", nameLower: "elliptical", category: "cardio", muscles: ["quadriceps","hamstrings","glutes","core","arms"], equipment: "machine", keywords: ["elliptical"] },
  { id: "ex_jump_rope", name: "Jump Rope", nameLower: "jump rope", category: "cardio", muscles: ["calves","shoulders","forearms","core"], equipment: "bodyweight", keywords: ["jump","rope"] },
  { id: "ex_battle_ropes", name: "Battle Ropes", nameLower: "battle ropes", category: "cardio", muscles: ["shoulders","arms","core","legs"], equipment: "bodyweight", keywords: ["battle","ropes"] },
  { id: "ex_box_jump", name: "Box Jump", nameLower: "box jump", category: "cardio", muscles: ["quadriceps","glutes","hamstrings","calves","core"], equipment: "bodyweight", keywords: ["box","jump"] },
  { id: "ex_sled_push", name: "Sled Push", nameLower: "sled push", category: "cardio", muscles: ["quadriceps","glutes","hamstrings","calves","core","shoulders"], equipment: "machine", keywords: ["sled","push"] },
  { id: "ex_clean_and_press", name: "Clean and Press", nameLower: "clean and press", category: "full_body", muscles: ["shoulders","trapezius","legs","glutes","core","triceps"], equipment: "barbell", keywords: ["clean","and","press"] },
  { id: "ex_power_clean", name: "Power Clean", nameLower: "power clean", category: "full_body", muscles: ["quadriceps","hamstrings","trapezius","glutes","core","shoulders"], equipment: "barbell", keywords: ["power","clean"] },
  { id: "ex_kettlebell_swing", name: "Kettlebell Swing", nameLower: "kettlebell swing", category: "full_body", muscles: ["glutes","hamstrings","core","shoulders","back"], equipment: "kettlebell", keywords: ["kettlebell","swing"] },
  { id: "ex_turkish_getup", name: "Turkish Get-Up", nameLower: "turkish get-up", category: "full_body", muscles: ["shoulders","core","glutes","legs","triceps"], equipment: "kettlebell", keywords: ["turkish","get"] },
  { id: "ex_kb_clean_press", name: "Kettlebell Clean & Press", nameLower: "kettlebell clean & press", category: "full_body", muscles: ["shoulders","glutes","core","triceps","back"], equipment: "kettlebell", keywords: ["kettlebell","clean","press"] },
  { id: "ex_burpee", name: "Burpee", nameLower: "burpee", category: "full_body", muscles: ["full body","core","chest","legs"], equipment: "bodyweight", keywords: ["burpee"] },
  { id: "ex_thruster", name: "Dumbbell Thruster", nameLower: "dumbbell thruster", category: "full_body", muscles: ["quadriceps","shoulders","glutes","triceps","core"], equipment: "dumbbell", keywords: ["dumbbell","thruster"] },
  { id: "ex_barbell_thruster", name: "Barbell Thruster", nameLower: "barbell thruster", category: "full_body", muscles: ["quadriceps","shoulders","glutes","triceps","core"], equipment: "barbell", keywords: ["barbell","thruster"] },
  { id: "ex_man_maker", name: "Man Maker", nameLower: "man maker", category: "full_body", muscles: ["full body","core","shoulders","back","chest"], equipment: "dumbbell", keywords: ["man","maker"] },
  { id: "ex_kb_snatch", name: "Kettlebell Snatch", nameLower: "kettlebell snatch", category: "full_body", muscles: ["shoulders","glutes","hamstrings","core","back","triceps"], equipment: "kettlebell", keywords: ["kettlebell","snatch"] },
  { id: "ex_hang_clean", name: "Hang Clean", nameLower: "hang clean", category: "full_body", muscles: ["quadriceps","trapezius","hamstrings","glutes","core","shoulders"], equipment: "barbell", keywords: ["hang","clean"] },
  { id: "ex_db_snatch", name: "Dumbbell Snatch", nameLower: "dumbbell snatch", category: "full_body", muscles: ["shoulders","glutes","hamstrings","core","triceps","trapezius"], equipment: "dumbbell", keywords: ["dumbbell","snatch"] },
  { id: "ex_bear_crawl", name: "Bear Crawl", nameLower: "bear crawl", category: "full_body", muscles: ["core","shoulders","quadriceps","triceps","hip flexors"], equipment: "bodyweight", keywords: ["bear","crawl"] },
  { id: "ex_renegade_row", name: "Renegade Row", nameLower: "renegade row", category: "full_body", muscles: ["latissimus dorsi","core","biceps","shoulders","chest"], equipment: "dumbbell", keywords: ["renegade","row"] },
  { id: "ex_band_face_pull", name: "Band Face Pull", nameLower: "band face pull", category: "shoulders", muscles: ["rear deltoid","rhomboids","trapezius","rotator cuff"], equipment: "band", keywords: ["band","face","pull"] },
  { id: "ex_band_squat", name: "Band Squat", nameLower: "band squat", category: "legs", muscles: ["quadriceps","glutes","hamstrings","core"], equipment: "band", keywords: ["band","squat"] },
  { id: "ex_band_row", name: "Band Row", nameLower: "band row", category: "back", muscles: ["latissimus dorsi","rhomboids","biceps","rear deltoid"], equipment: "band", keywords: ["band","row"] },
  { id: "ex_band_curl", name: "Band Curl", nameLower: "band curl", category: "arms", muscles: ["biceps","brachialis"], equipment: "band", keywords: ["band","curl"] },
  { id: "ex_band_pushdown", name: "Band Tricep Pushdown", nameLower: "band tricep pushdown", category: "arms", muscles: ["triceps"], equipment: "band", keywords: ["band","tricep","pushdown"] },
  { id: "ex_band_lateral_walk", name: "Band Lateral Walk", nameLower: "band lateral walk", category: "legs", muscles: ["gluteus medius","glutes","quadriceps"], equipment: "band", keywords: ["band","lateral","walk"] },
  { id: "ex_kb_windmill", name: "Kettlebell Windmill", nameLower: "kettlebell windmill", category: "core", muscles: ["obliques","core","shoulders","hamstrings","glutes"], equipment: "kettlebell", keywords: ["kettlebell","windmill"] },
  { id: "ex_arm_circles", name: "Arm Circles", nameLower: "arm circles", category: "warmup", muscles: ["shoulders","rotator cuff"], equipment: "bodyweight", keywords: ["arm","circles"] },
  { id: "ex_leg_swings", name: "Leg Swings", nameLower: "leg swings", category: "warmup", muscles: ["hip flexors","hamstrings","glutes","quadriceps"], equipment: "bodyweight", keywords: ["leg","swings"] },
  { id: "ex_hip_circles", name: "Hip Circles", nameLower: "hip circles", category: "warmup", muscles: ["hip flexors","glutes","core","lower back"], equipment: "bodyweight", keywords: ["hip","circles"] },
  { id: "ex_jumping_jacks", name: "Jumping Jacks", nameLower: "jumping jacks", category: "warmup", muscles: ["full body","calves","shoulders"], equipment: "bodyweight", keywords: ["jumping","jacks"] },
  { id: "ex_high_knees", name: "High Knees", nameLower: "high knees", category: "warmup", muscles: ["hip flexors","quadriceps","calves","core"], equipment: "bodyweight", keywords: ["high","knees"] },
  { id: "ex_butt_kicks", name: "Butt Kicks", nameLower: "butt kicks", category: "warmup", muscles: ["hamstrings","calves","quadriceps"], equipment: "bodyweight", keywords: ["butt","kicks"] },
  { id: "ex_cat_cow", name: "Cat-Cow Stretch", nameLower: "cat-cow stretch", category: "warmup", muscles: ["spine","core","shoulders","hip flexors"], equipment: "bodyweight", keywords: ["cat","cow","stretch"] },
  { id: "ex_standing_quad_stretch", name: "Standing Quad Stretch", nameLower: "standing quad stretch", category: "cooldown", muscles: ["quadriceps","hip flexors"], equipment: "bodyweight", keywords: ["standing","quad","stretch"] },
  { id: "ex_hamstring_stretch", name: "Hamstring Stretch", nameLower: "hamstring stretch", category: "cooldown", muscles: ["hamstrings","calves","lower back"], equipment: "bodyweight", keywords: ["hamstring","stretch"] },
  { id: "ex_pigeon_pose", name: "Pigeon Pose", nameLower: "pigeon pose", category: "cooldown", muscles: ["hip flexors","glutes","piriformis","lower back"], equipment: "bodyweight", keywords: ["pigeon","pose"] },
  { id: "ex_shoulder_stretch", name: "Shoulder Stretch", nameLower: "shoulder stretch", category: "cooldown", muscles: ["shoulders","rear deltoid","upper back"], equipment: "bodyweight", keywords: ["shoulder","stretch"] },
  { id: "ex_foam_rolling", name: "Foam Rolling (Full Body)", nameLower: "foam rolling (full body)", category: "cooldown", muscles: ["full body"], equipment: "bodyweight", keywords: ["foam","rolling","full","body"] },
  { id: "ex_walking_lunge_cooldown", name: "Walking Lunges (Cool-Down Pace)", nameLower: "walking lunges (cool-down pace)", category: "cooldown", muscles: ["quadriceps","glutes","hamstrings","hip flexors"], equipment: "bodyweight", keywords: ["walking","lunges","cool","down","pace"] },
  { id: "ex_deep_breathing", name: "Deep Breathing / Box Breathing", nameLower: "deep breathing / box breathing", category: "cooldown", muscles: ["diaphragm","core"], equipment: "bodyweight", keywords: ["deep","breathing","box","breathing"] },
  { id: "ex_30min_walk", name: "30-Minute Walk", nameLower: "30-minute walk", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes","core"], equipment: "bodyweight", keywords: ["minute","walk"] },
  { id: "ex_20min_light_jog", name: "20-Minute Light Jog", nameLower: "20-minute light jog", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes","core"], equipment: "bodyweight", keywords: ["minute","light","jog"] },
  { id: "ex_bike_ride", name: "Bike Ride (20-30 min)", nameLower: "bike ride (20-30 min)", category: "cardio", muscles: ["quadriceps","hamstrings","calves","glutes","core"], equipment: "bodyweight", keywords: ["bike","ride","min"] },
  { id: "ex_full_body_stretch", name: "Full Body Stretch Routine", nameLower: "full body stretch routine", category: "cooldown", muscles: ["full body"], equipment: "bodyweight", keywords: ["full","body","stretch","routine"] },
  { id: "ex_foam_rolling_session", name: "Foam Rolling Session", nameLower: "foam rolling session", category: "cooldown", muscles: ["full body"], equipment: "bodyweight", keywords: ["foam","rolling","session"] },
  { id: "ex_swimming", name: "Swimming (20-30 min)", nameLower: "swimming (20-30 min)", category: "cardio", muscles: ["full body","shoulders","core","back"], equipment: "bodyweight", keywords: ["swimming","min"] },
  { id: "ex_light_walk", name: "Light Walk (15-20 min)", nameLower: "light walk (15-20 min)", category: "cardio", muscles: ["quadriceps","calves","hamstrings","glutes"], equipment: "bodyweight", keywords: ["light","walk","min"] },
  { id: "ex_childs_pose", name: "Child's Pose", nameLower: "child's pose", category: "cooldown", muscles: ["lower back","lats","shoulders","hips"], equipment: "bodyweight", keywords: ["child","pose"] },
  { id: "ex_farmers_carry", name: "Farmer's Carry", nameLower: "farmer's carry", category: "full_body", muscles: ["forearms","trapezius","core","legs","shoulders"], equipment: "dumbbell", keywords: ["farmer","carry"] },
  { id: "ex_worlds_greatest_stretch", name: "World's Greatest Stretch", nameLower: "world's greatest stretch", category: "warmup", muscles: ["hip flexors","thoracic spine","hamstrings","glutes","shoulders"], equipment: "bodyweight", keywords: ["world","greatest","stretch"] },
];

// ── NLP Query Detection ─────────────────────────────────────────────

const NLP_CONNECTORS = ['for', 'with', 'that', 'using', 'without', 'like', 'to', 'can', 'do', 'good', 'best', 'what', 'which', 'how', 'exercises', 'exercise', 'movements', 'workout'];

function isNLPQuery(query: string): boolean {
  if (query.includes('?')) return true;
  const words = query.toLowerCase().split(/\s+/);
  if (words.length > 2) {
    const connectorCount = words.filter(w => NLP_CONNECTORS.includes(w)).length;
    if (connectorCount > 0) return true;
  }
  return false;
}

// ── Text Search ─────────────────────────────────────────────────────

function textSearch(query: string, limit: number): SearchResult[] {
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
  const results: SearchResult[] = [];

  // Expand query words through muscle synonyms
  const expandedTerms = queryWords.flatMap(w => expandMuscleTerms(w));

  for (const exercise of EXERCISE_INDEX) {
    let score = 0;
    const reasons: string[] = [];

    // Exact name match
    if (exercise.nameLower === queryLower) {
      score = 1.0;
      reasons.push('exact name match');
    }
    // Name contains full query
    else if (exercise.nameLower.includes(queryLower)) {
      score = Math.max(score, 0.85);
      reasons.push('name contains query');
    }
    // Partial name match (query words appear in name)
    else {
      const nameMatchCount = queryWords.filter(w => exercise.nameLower.includes(w)).length;
      if (nameMatchCount > 0) {
        const nameScore = 0.8 * (nameMatchCount / queryWords.length);
        if (nameScore > score) {
          score = nameScore;
          reasons.push('partial name match');
        }
      }
    }

    // Keyword match
    const keywordMatchCount = queryWords.filter(w =>
      exercise.keywords.some(k => k.includes(w) || w.includes(k))
    ).length;
    if (keywordMatchCount > 0) {
      const kwScore = 0.7 * (keywordMatchCount / queryWords.length);
      if (kwScore > score) {
        score = kwScore;
        reasons.push('keyword match');
      } else if (kwScore > 0) {
        score = Math.min(1.0, score + 0.05);
      }
    }

    // Muscle match (using expanded synonyms)
    const muscleMatchCount = expandedTerms.filter(t =>
      exercise.muscles.some(m => m.includes(t) || t.includes(m))
    ).length;
    if (muscleMatchCount > 0) {
      const muscleScore = 0.6 * Math.min(1, muscleMatchCount / queryWords.length);
      if (muscleScore > score) {
        score = muscleScore;
        reasons.push('muscle match');
      } else if (muscleScore > 0 && score < 0.8) {
        score = Math.min(1.0, score + 0.1);
        reasons.push('muscle match');
      }
    }

    // Equipment match
    const equipmentMatch = queryWords.some(w =>
      exercise.equipment.includes(w) || w.includes(exercise.equipment)
    );
    if (equipmentMatch) {
      const eqScore = 0.5;
      if (eqScore > score) {
        score = eqScore;
        reasons.push('equipment match');
      } else if (score > 0) {
        score = Math.min(1.0, score + 0.1);
        reasons.push('equipment match');
      }
    }

    // Category match
    const categoryMatch = expandedTerms.some(t =>
      exercise.category.includes(t) || t.includes(exercise.category)
    );
    if (categoryMatch) {
      const catScore = 0.4;
      if (catScore > score) {
        score = catScore;
        reasons.push('category match');
      } else if (score > 0) {
        score = Math.min(1.0, score + 0.05);
        reasons.push('category match');
      }
    }

    // Fuzzy match: check if any query word is within edit distance 1 of any keyword/name word
    if (score === 0) {
      const nameWords = exercise.nameLower.split(/[\s\-]+/);
      const allTargetWords = [...nameWords, ...exercise.keywords, exercise.equipment, exercise.category];
      for (const qw of queryWords) {
        for (const tw of allTargetWords) {
          if (qw.length > 2 && tw.length > 2 && fuzzyMatch(qw, tw)) {
            score = Math.max(score, 0.3);
            reasons.push('fuzzy match');
            break;
          }
        }
        if (score > 0) break;
      }
    }

    if (score > 0) {
      results.push({
        exerciseId: exercise.id,
        name: exercise.name,
        score: Math.round(score * 100) / 100,
        reason: reasons.join(', '),
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Simple fuzzy match: checks if two strings differ by at most 1 character (Levenshtein distance <= 1)
function fuzzyMatch(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;

  let diffs = 0;
  let ai = 0;
  let bi = 0;
  while (ai < a.length && bi < b.length) {
    if (a[ai] !== b[bi]) {
      diffs++;
      if (diffs > 1) return false;
      if (a.length > b.length) ai++;
      else if (b.length > a.length) bi++;
      else { ai++; bi++; }
    } else {
      ai++;
      bi++;
    }
  }
  return true;
}

// ── AI Search ───────────────────────────────────────────────────────

// Static AI instructions — identical for every search (cacheable)
const EXERCISE_SEARCH_STATIC_PROMPT = `You are an exercise search assistant. Given a natural language query about exercises, return a JSON object with filters to find matching exercises.

Return ONLY valid JSON with these optional fields:
{ "muscles": string[], "equipment": string[], "category": string, "keywords": string[] }

Valid categories: chest, back, shoulders, legs, arms, core, cardio, full_body, warmup, cooldown
Valid equipment: barbell, dumbbell, machine, cable, bodyweight, kettlebell, band
Muscle examples: pectoralis, biceps, triceps, quadriceps, hamstrings, glutes, latissimus dorsi, deltoid, trapezius, core, calves, forearms

Examples:
"chest exercises with dumbbells" → {"muscles":["pectoralis"],"equipment":["dumbbell"],"category":"chest"}
"something for my arms" → {"muscles":["biceps","triceps"],"category":"arms","keywords":["arms"]}
"leg day without machines" → {"muscles":["quadriceps","hamstrings","glutes","calves"],"category":"legs","keywords":["leg"]}
"back and biceps" → {"muscles":["latissimus dorsi","biceps","rhomboids"],"keywords":["back","biceps"]}
"bodyweight exercises" → {"equipment":["bodyweight"],"keywords":["bodyweight"]}
"good warmup movements" → {"category":"warmup","keywords":["warmup","dynamic"]}`;

async function aiSearch(query: string, limit: number): Promise<SearchResult[] | null> {
  try {
    const aiProvider = createAIProvider();

    const cachedSystemBlocks: CacheableSystemBlock[] = [
      { text: EXERCISE_SEARCH_STATIC_PROMPT, cacheControl: true },
    ];

    const messages: AIMessage[] = [
      { role: 'system', content: EXERCISE_SEARCH_STATIC_PROMPT },
      { role: 'user', content: query },
    ];

    const response = await aiProvider.chat(messages, {
      temperature: 0.1,
      max_tokens: 256,
      json_mode: true,
      cacheOptions: { cachedSystemBlocks },
    });

    if (!response.content) return null;

    const filters: AIFilters = JSON.parse(response.content);
    return applyFilters(filters, limit);
  } catch (error) {
    console.error('AI search failed:', error);
    return null;
  }
}

function applyFilters(filters: AIFilters, limit: number): SearchResult[] {
  const results: SearchResult[] = [];

  for (const exercise of EXERCISE_INDEX) {
    let score = 0;
    const reasons: string[] = [];

    // Muscle filter
    if (filters.muscles && filters.muscles.length > 0) {
      const expandedFilterMuscles = filters.muscles.flatMap(m => expandMuscleTerms(m));
      const muscleMatches = expandedFilterMuscles.filter(fm =>
        exercise.muscles.some(em => em.includes(fm) || fm.includes(em))
      ).length;
      if (muscleMatches > 0) {
        score += 0.4 * Math.min(1, muscleMatches / filters.muscles.length);
        reasons.push('muscle filter');
      }
    }

    // Equipment filter
    if (filters.equipment && filters.equipment.length > 0) {
      if (filters.equipment.some(e => exercise.equipment === e.toLowerCase())) {
        score += 0.25;
        reasons.push('equipment filter');
      } else {
        // Equipment specified but doesn't match — penalize
        score *= 0.5;
      }
    }

    // Category filter
    if (filters.category) {
      const catTerms = expandMuscleTerms(filters.category);
      if (catTerms.some(t => exercise.category === t || exercise.category.includes(t))) {
        score += 0.2;
        reasons.push('category filter');
      }
    }

    // Keyword filter
    if (filters.keywords && filters.keywords.length > 0) {
      const kwLower = filters.keywords.map(k => k.toLowerCase());
      const kwMatches = kwLower.filter(k =>
        exercise.nameLower.includes(k) ||
        exercise.keywords.some(ek => ek.includes(k) || k.includes(ek)) ||
        exercise.muscles.some(m => m.includes(k))
      ).length;
      if (kwMatches > 0) {
        score += 0.15 * Math.min(1, kwMatches / filters.keywords.length);
        reasons.push('keyword filter');
      }
    }

    if (score > 0) {
      results.push({
        exerciseId: exercise.id,
        name: exercise.name,
        score: Math.round(score * 100) / 100,
        reason: reasons.join(', '),
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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
      return errorResponse('Rate limit exceeded: 20 requests per minute', 429);
    }

    // Parse and validate input
    let body: SearchRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { query, limit = 10 } = body;

    if (!query || typeof query !== 'string') {
      return errorResponse('Missing or invalid query parameter', 400);
    }

    if (query.length > 200) {
      return errorResponse('Query must be less than 200 characters', 400);
    }

    if (query.trim().length === 0) {
      return errorResponse('Query cannot be empty', 400);
    }

    const effectiveLimit = Math.min(Math.max(1, limit), 50);

    // 1. Run text search first
    const textResults = textSearch(query, effectiveLimit);

    // 2. Determine if we should also use AI
    const shouldUseAI = textResults.length < 3 || isNLPQuery(query);

    if (!shouldUseAI || (textResults.length > 0 && textResults[0].score >= 0.8)) {
      // Text search is sufficient
      return jsonResponse({
        results: textResults,
        method: 'text' as const,
      });
    }

    // 3. Try AI search
    const aiResults = await aiSearch(query, effectiveLimit);

    if (aiResults && aiResults.length > 0) {
      // Merge: prefer AI results but include high-scoring text results
      const mergedMap = new Map<string, SearchResult>();

      // Add AI results
      for (const r of aiResults) {
        mergedMap.set(r.exerciseId, r);
      }

      // Add text results that scored high but aren't in AI results
      for (const r of textResults) {
        if (!mergedMap.has(r.exerciseId) && r.score >= 0.5) {
          mergedMap.set(r.exerciseId, r);
        }
      }

      const merged = [...mergedMap.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, effectiveLimit);

      return jsonResponse({
        results: merged,
        method: 'ai' as const,
      });
    }

    // 4. Fallback to text results
    return jsonResponse({
      results: textResults,
      method: 'text' as const,
    });
  } catch (error) {
    console.error('Exercise search error:', error);
    return errorResponse('Internal server error', 500);
  }
});
