# Reliant Program Generation Prompt

## Overview

You are **Reliant**, an AI code generator for the Gym fitness app. Generate the complete `getSeedPrograms()` function containing **21 workout programs** (4 days/week = 84 total workout days) as TypeScript code.

Below you will find:
1. TypeScript interfaces your code must conform to
2. Code template with helper functions
3. Critical rules
4. Complete exercise ID reference table (198 exercises)
5. All 21 programs with full exercise data

---

## TypeScript Interfaces

```typescript
export interface WorkoutProgramLocal {
  id: string;
  userId: string;
  name: string;
  description: string;
  daysPerWeek: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  days: WorkoutDayLocal[];
  isActive: boolean;
  createdBy: 'user' | 'ai';
  createdAt: string;
  updatedAt: string;
  customized?: boolean;
}

export interface WorkoutDayLocal {
  id: string;
  programId: string;
  dayNumber: number;
  name: string;
  dayType: DayType;
  focusArea: MuscleGroup;
  exercises: ProgramExercise[];
  recoveryNotes?: string;
}

export interface ProgramExercise {
  id: string;
  exerciseId: string;     // MUST match an ID from the Exercise Reference Table
  exerciseName: string;   // MUST match the library_name from the Exercise Reference Table
  targetSets: number;
  targetReps: string;     // e.g. '8-12', '5', '20, 18, 15, 12, 10'
  restSeconds: number;
  supersetGroupId?: string;
  order: number;
  notes?: string;
}
```

---

## Code Generation Template

```typescript
export function getSeedPrograms(userId: string): WorkoutProgramLocal[] {
  let peId = 1;
  const pe = (ex: Omit<ProgramExercise, 'id'>): ProgramExercise => ({
    id: `pe_${peId++}`,
    ...ex,
  });
  const now = new Date().toISOString();

  // Build each program, then return [...all 21 programs]
  // Example:
  const prog1: WorkoutProgramLocal = {
    id: 'prog_foundations_upper_lower_split',
    userId,
    name: 'Foundations: Upper-Lower Split',
    description: 'Beginner-friendly 4-day split...',
    daysPerWeek: 4,
    difficulty: 'beginner',
    days: [/* day objects */],
    isActive: false,
    createdBy: 'ai',
    createdAt: now,
    updatedAt: now,
  };
}
```

---

## Critical Rules

1. **Exercise IDs are sacred.** Every `exerciseId` MUST come from the Exercise Reference Table below. Do NOT invent IDs.
2. **Exercise names must match.** Every `exerciseName` MUST use the exact `library_name` from the reference table.
3. **Supersets use shared `supersetGroupId`.** When exercises are supersetted, they share `'ss_1'`, `'ss_2'`, etc. Reset counter per day.
4. **Rep schemes:** Use strings: `'8'`, `'8-12'`, `'20, 18, 15, 12, 10'`
5. **Set counting:** '4 sets of 8, 5th set 20' = targetSets: 5, targetReps: '8, 8, 8, 8, 20'
6. **Rest periods:** Parse from data. Default to 60 seconds if unspecified.
7. **Focus area mapping:** Map day titles to MuscleGroup: chest, back, shoulders, legs, arms, core, full_body.
8. **Notes:** Include warm-up instructions, 'go heavy' cues, tempo notes, finisher details.
9. **DayType:** Always `'lifting'` for all 84 days.
10. **ID patterns:** Program: `prog_snake_case`, Day: `prog_xxx_day1`, Exercise: auto via `pe()`.

---

## Exercise ID Reference Table

**IMPORTANT:** Only use exerciseId values from this table. These are the 198 exercises used across all programs.

| PDF Exercise Name | Library Exercise Name | exerciseId |
|---|---|---|
| Ab Crunch Machine | Ab Crunch Machine | `ex_ab_crunch_machine` |
| Ab Leg Pull Ins | Leg Pull-In | `ex_leg_pull-in` |
| Ab Tuck Complex | Tuck Crunch | `ex_tuck_crunch` |
| Ab Wheel Rollout | Ab Wheel Rollout | `ex_ab_wheel` |
| Abdominal Twists (with Plate) | Plate Twist | `ex_plate_twist` |
| Abductor Machine | Abductor Machine | `ex_abductor_machine` |
| Adductor Machine | Adductor Machine | `ex_adductor_machine` |
| Alternating Dumbbell Bicep Curls | Alternate Hammer Curl | `ex_alternate_hammer_curl` |
| Banded Cannon Ball Squats | Band Squat | `ex_band_squat` |
| Banded Squat Hold Taps | Band Squat | `ex_band_squat` |
| Barbell Back Squat | Barbell Back Squat | `ex_squat` |
| Barbell Bench Press | Barbell Bench Press | `ex_bench_press` |
| Barbell Bent Over Row | Barbell Row | `ex_barbell_row` |
| Barbell Bicep Curls | Barbell Curl | `ex_barbell_curl` |
| Barbell Deadlift | Car Deadlift | `ex_car_deadlift` |
| Barbell Front Squat | Barbell Full Squat | `ex_barbell_full_squat` |
| Barbell Reverse Lunge | Barbell Lunge | `ex_barbell_lunge` |
| Barbell Shoulder Press (Standing) | Barbell Shoulder Press | `ex_barbell_shoulder_press` |
| Barbell Shoulder Press Behind Neck | Standing Barbell Press Behind Neck | `ex_standing_barbell_press_behind_neck` |
| Bear Crawls | Bear Crawl | `ex_bear_crawl` |
| Beast Crunch | Cable Crunch | `ex_cable_crunch` |
| Bent Over Concentration Curls | Concentration Curl | `ex_concentration_curl` |
| Bicycle Crunches | Bicycle Crunch | `ex_bicycle_crunch` |
| Bodyweight Balance RDL | Kettlebell One-Legged Deadlift | `ex_kettlebell_one-legged_deadlift` |
| Bodyweight Cannon Ball Squats | Bodyweight Squat | `ex_bodyweight_squat` |
| Bodyweight Squats | Bodyweight Squat | `ex_bodyweight_squat` |
| Burpees | Burpee | `ex_burpee` |
| Cable Bicep Curls with Tricep Rope | Cable Hammer Curls - Rope Attachment | `ex_cable_hammer_curls_-_rope_attachment` |
| Cable Chest Fly (from high) | Cable Crossover | `ex_cable_crossover` |
| Cable Chest Fly (from low) | Low Cable Fly | `ex_cable_fly_low` |
| Cable Chest Fly (from neutral/middle) | Mid Cable Fly | `ex_cable_fly_mid` |
| Cable High Up Pull Down Extensions | Triceps Pushdown - V-Bar Attachment | `ex_triceps_pushdown_-_v-bar_attachment` |
| Cable Kick Backs | One-Legged Cable Kickback | `ex_one-legged_cable_kickback` |
| Cable Lateral Leg Kicks | Cable Lateral Raise | `ex_cable_lateral_raise` |
| Cable Lateral Shoulder Raise | Cable Lateral Raise | `ex_cable_lateral_raise` |
| Cable Straight Bar Mid Back Row | Straight Bar Bench Mid Rows | `ex_straight_bar_bench_mid_rows` |
| Chest Press Machine | Machine Chest Press | `ex_machine_chest_press` |
| Chin Ups | Chin-Up | `ex_chin_up` |
| Clap Push Ups | Plyo Push-up | `ex_plyo_push-up` |
| Core Twists | Russian Twist | `ex_russian_twist` |
| Cross Crunch | Cross-Body Crunch | `ex_cross-body_crunch` |
| Cross Leg Crunch | Cross-Body Crunch | `ex_cross-body_crunch` |
| Crunch Holds Side to Side | Oblique Crunches | `ex_oblique_crunches` |
| Crunches | Crunches | `ex_crunches` |
| Decline Chest Press | Decline Dumbbell Bench Press | `ex_decline_db_bench` |
| Diver Push Ups | Decline Push-Up | `ex_decline_push-up` |
| Dumbbell 90 Degree Shoulder Raise | Dumbbell Incline Shoulder Raise | `ex_dumbbell_incline_shoulder_raise` |
| Dumbbell Alternating Leg Step Ups | Dumbbell Step-Up | `ex_step_up` |
| Dumbbell Alternating Leg Step Ups (Flat Bench) | Dumbbell Step-Up | `ex_step_up` |
| Dumbbell Back Row (Single Arm) | Dumbbell Row | `ex_db_row` |
| Dumbbell Bench Step Ups | Dumbbell Bench Press | `ex_db_bench_press` |
| Dumbbell Box Step Ups with High Knee | Step-up with Knee Raise | `ex_step-up_with_knee_raise` |
| Dumbbell Deadlift | Dumbbell Romanian Deadlift | `ex_db_rdl` |
| Dumbbell Flat Bench Flys | Dumbbell Flyes | `ex_db_flyes` |
| Dumbbell Flat Bench Press | Dumbbell Bench Press | `ex_db_bench_press` |
| Dumbbell Front Shoulder Raise | Front Two-Dumbbell Raise | `ex_front_two-dumbbell_raise` |
| Dumbbell Front Shoulder Upright Row | Dumbbell One-Arm Upright Row | `ex_dumbbell_one-arm_upright_row` |
| Dumbbell Front Squat to Shoulder Press Thrusters | Dumbbell Thruster | `ex_thruster` |
| Dumbbell Hammer Curls | Incline Hammer Curls | `ex_incline_hammer_curls` |
| Dumbbell Hammer Curls with Twist | Hammer Curl | `ex_hammer_curl` |
| Dumbbell Hammer Front Shoulder Raise | Dumbbell Incline Shoulder Raise | `ex_dumbbell_incline_shoulder_raise` |
| Dumbbell Hamstring RDL | Dumbbell Romanian Deadlift | `ex_db_rdl` |
| Dumbbell Incline Bench Press | Dumbbell Bench Press | `ex_db_bench_press` |
| Dumbbell Incline Press | Incline Dumbbell Bench Press | `ex_incline_db_bench` |
| Dumbbell Lateral Shoulder Raise | Lateral Raise | `ex_lateral_raise` |
| Dumbbell Lawn Mower Row | Dumbbell Incline Row | `ex_dumbbell_incline_row` |
| Dumbbell Pull Over Pops | Straight-Arm Dumbbell Pullover | `ex_straight-arm_dumbbell_pullover` |
| Dumbbell Push Ups with Lateral Row | Dumbbell Row | `ex_db_row` |
| Dumbbell Reverse Lunge | Dumbbell Rear Lunge | `ex_dumbbell_rear_lunge` |
| Dumbbell Shoulder Press (Seated) | Dumbbell Shoulder Press | `ex_db_shoulder_press` |
| Dumbbell Step Back Lunge | Dumbbell Rear Lunge | `ex_dumbbell_rear_lunge` |
| Dumbbell Two Arm Tricep Flat Bench Extensions | Skull Crusher | `ex_skull_crusher` |
| Dumbbell Walking Lunges | Barbell Walking Lunge | `ex_barbell_walking_lunge` |
| Easy Bar Lateral Shoulder Raise | Lateral Raise | `ex_lateral_raise` |
| Fire Hydrants | Hip Circles | `ex_hip_circles` |
| Flat Bench Dumbbell Alternating Leg Step Ups | Dumbbell Step-Up | `ex_step_up` |
| Flat Bench Dumbbell Single Arm Tricep Extensions | Dumbbell One-Arm Triceps Extension | `ex_dumbbell_one-arm_triceps_extension` |
| Foam Rolling (Full Body) | Foam Rolling (Full Body) | `ex_foam_rolling` |
| Forward Lunge with Courtesy Lunge | Reverse Lunge | `ex_reverse_lunge` |
| Front Squat Step Back Lunges | Front Squat | `ex_front_squat` |
| Goblet/Dumbbell Front Squat | Goblet Squat | `ex_goblet_squat` |
| Good Mornings | Good Morning | `ex_good_morning` |
| Half Burpee Forward Lunge | Burpee | `ex_burpee` |
| Hanging Ab Raises (Feet to Bar) | Hanging Leg Raise | `ex_hanging_leg_raise` |
| Hanging Knee to Chest Raises | Hanging Leg Raise | `ex_hanging_leg_raise` |
| High Cable Straight Bar Tricep Pull Downs | Triceps Pushdown - V-Bar Attachment | `ex_triceps_pushdown_-_v-bar_attachment` |
| High Cable X Back Row | Elevated Cable Rows | `ex_elevated_cable_rows` |
| High Knees | High Knees | `ex_high_knees` |
| Incline Bench Alternating Bicep Curls | Alternate Incline Dumbbell Curl | `ex_alternate_incline_dumbbell_curl` |
| Incline Bench Dumbbell Back Row | Incline Dumbbell Bench Press | `ex_incline_db_bench` |
| Incline Bench Press Smith Machine | Smith Machine Incline Bench Press | `ex_smith_machine_incline_bench_press` |
| Incline Chest Press Machine | Incline Cable Chest Press | `ex_incline_cable_chest_press` |
| Incline Single Arm Dumbbell Curl | Incline Dumbbell Curl | `ex_incline_db_curl` |
| Jump Lunge with Bounce | Scissors Jump | `ex_scissors_jump` |
| Jump Squat | Freehand Jump Squat | `ex_freehand_jump_squat` |
| Jumping Jacks | Jumping Jacks | `ex_jumping_jacks` |
| Kettlebell Single Arm Farmer Carry | Kettlebell Figure 8 | `ex_kettlebell_figure_8` |
| Kettlebell Single Leg RDL | Kettlebell One-Legged Deadlift | `ex_kettlebell_one-legged_deadlift` |
| Kettlebell Walking Lunges | Barbell Walking Lunge | `ex_barbell_walking_lunge` |
| Kick Sit Burpees | Burpee | `ex_burpee` |
| Knee to Chest Abs (off Bench Edge) | Flat Bench Lying Leg Raise | `ex_flat_bench_lying_leg_raise` |
| Landmine Back Row | One-Arm Long Bar Row | `ex_one-arm_long_bar_row` |
| Landmine Cross Body Shoulder Raise | Landmine Press | `ex_landmine_press` |
| Lat Pull Down | Lat Pulldown | `ex_lat_pulldown` |
| Lateral Lunge (Kettlebell) | Bodyweight Walking Lunge | `ex_bodyweight_walking_lunge` |
| Leg Curl (Hamstring Lying) | Leg Curl | `ex_leg_curl` |
| Leg Drops/Lowering | Flat Bench Lying Leg Raise | `ex_flat_bench_lying_leg_raise` |
| Leg Extensions (Quad) | Leg Extension | `ex_leg_extension` |
| Leg Press Machine | Leg Press | `ex_leg_press` |
| Low Cable Chest Flys | Low Cable Fly | `ex_cable_fly_low` |
| Low Cable Tricep Rope Bicep Curls | Cable Hammer Curls - Rope Attachment | `ex_cable_hammer_curls_-_rope_attachment` |
| Lying Flat Bench Dumbbell Tricep Extensions | Lying Dumbbell Tricep Extension | `ex_lying_dumbbell_tricep_extension` |
| Med Ball Alternating Push Ups | Push-Ups With Feet On An Exercise Ball | `ex_push-ups_with_feet_on_an_exercise_ball` |
| Med Ball Russian Twists | Cable Russian Twists | `ex_cable_russian_twists` |
| Med Ball Toe Touches | Toe Touchers | `ex_toe_touchers` |
| Mountain Climbers | Mountain Climber | `ex_mountain_climber` |
| Oblique Crunch | Oblique Crunches | `ex_oblique_crunches` |
| Oblique Side Crunches | Oblique Crunches | `ex_oblique_crunches` |
| Opposite Arm Opposite Knee Taps | Bird Dog | `ex_bird_dog` |
| Peck Deck Machine Flys | Pec Deck | `ex_pec_deck` |
| Peck Deck Machine Single Arm Pull Backs (Reverse Fly) | Reverse Fly | `ex_reverse_fly` |
| Peck Deck Reverse Flys | Reverse Fly | `ex_reverse_fly` |
| Plank | Plank | `ex_plank` |
| Plank Dips | Plank | `ex_plank` |
| Plank Taps | Plank | `ex_plank` |
| Plate Around the Worlds | Around The Worlds | `ex_around_the_worlds` |
| Plate Bicep Curls Cross Body | Cross-Body Hammer Curl | `ex_cross_body_curl` |
| Plate Push Ups | Push-Up | `ex_push_up` |
| Plate Shoulder Raises Combo (Front/Cross Body) | Front Plate Raise | `ex_front_plate_raise` |
| Preacher Curl Machine | Preacher Curl | `ex_preacher_curl` |
| Preacher Curls (Easy Bar) | Preacher Curl | `ex_preacher_curl` |
| Pull Ups | Pull-Up | `ex_pull_up` |
| Push Up Combo | Push-Up | `ex_push_up` |
| Push Up Plank Taps | Push Up to Side Plank | `ex_push_up_to_side_plank` |
| Rack Pulls | Rack Pull | `ex_rack_pull` |
| Reverse Grip Lat Pull Down | Close-Grip Lat Pulldown | `ex_close_grip_pulldown` |
| Romanian Deadlift (Barbell RDL) | Romanian Deadlift | `ex_romanian_deadlift` |
| Russian Twists | Russian Twist | `ex_russian_twist` |
| Seated Cable Back Row | Seated Cable Row | `ex_seated_cable_row` |
| Seated Dumbbell Bicep Curls Combo | Seated Dumbbell Inner Biceps Curl | `ex_seated_dumbbell_inner_biceps_curl` |
| Seated Dumbbell Shoulder Side Raises | Seated Side Lateral Raise | `ex_seated_side_lateral_raise` |
| Seated Incline Bench Bicep Curls | Alternate Incline Dumbbell Curl | `ex_alternate_incline_dumbbell_curl` |
| Seated Leaning Forward Dumbbell Lateral Raise | Seated Side Lateral Raise | `ex_seated_side_lateral_raise` |
| Seated Off Bench Dumbbell Bicep Curls | Seated Dumbbell Curl | `ex_seated_dumbbell_curl` |
| Seated Overhead Dumbbell Tricep Extension | Seated Bent-Over One-Arm Dumbbell Triceps Extension | `ex_seated_bent-over_one-arm_dumbbell_triceps_extension` |
| Seated Plate Lateral Shoulder Raises | Seated Side Lateral Raise | `ex_seated_side_lateral_raise` |
| Seated Tricep Extensions (One Dumbbell) | Overhead Tricep Extension | `ex_overhead_tricep_ext` |
| See-Saw Lunges | Bodyweight Walking Lunge | `ex_bodyweight_walking_lunge` |
| Shoulder Clap Burpees | Burpee | `ex_burpee` |
| Side Crunch | Rope Crunch | `ex_rope_crunch` |
| Single Arm Cross Body Chest Press Machine | Machine Chest Press | `ex_machine_chest_press` |
| Single Arm Flat Dumbbell Bench Press | One Arm Dumbbell Bench Press | `ex_one_arm_dumbbell_bench_press` |
| Single Cable Back Row (Single Arm) | Seated One-arm Cable Pulley Rows | `ex_seated_one-arm_cable_pulley_rows` |
| Single Cable One Arm Tricep Extensions | Cable One Arm Tricep Extension | `ex_cable_one_arm_tricep_extension` |
| Single Cable Tricep Reverse Pull Down | Reverse Grip Triceps Pushdown | `ex_reverse_grip_triceps_pushdown` |
| Single Dumbbell Squat | Plie Dumbbell Squat | `ex_plie_dumbbell_squat` |
| Single Leg Alternating Push Up | Push-Up | `ex_push_up` |
| Single Leg Lowering | Single Leg Glute Bridge | `ex_single_leg_glute_bridge` |
| Single Leg Mini Crunch | Tuck Crunch | `ex_tuck_crunch` |
| Smith Machine Shoulder Press (Seated) | Smith Machine Overhead Shoulder Press | `ex_smith_machine_overhead_shoulder_press` |
| Spider Man Push Ups | Plyo Push-up | `ex_plyo_push-up` |
| Split Squat Jumps | Split Squats | `ex_split_squats` |
| Squat to High Knee | Bodyweight Squat | `ex_bodyweight_squat` |
| Squat to Kick Outs | Bodyweight Squat | `ex_bodyweight_squat` |
| Squat with 3 Pulses | Bodyweight Squat | `ex_bodyweight_squat` |
| Standing Alternating Leg Kicks | Standing Alternating Dumbbell Press | `ex_standing_alternating_dumbbell_press` |
| Standing Calf Raises | Standing Calf Raise | `ex_calf_raise` |
| Standing Dumbbell Lateral Shoulder Raises | Standing Dumbbell Calf Raise | `ex_standing_dumbbell_calf_raise` |
| Standing Dumbbell Overhead Tricep Extension | Standing Overhead Barbell Triceps Extension | `ex_standing_overhead_barbell_triceps_extension` |
| Standing Dumbbell Shoulder Press | Dumbbell Shoulder Press | `ex_db_shoulder_press` |
| Standing Glute Kickbacks | Glute Kickback | `ex_glute_kickback` |
| Standing High Cable Lat Push Downs | Straight-Arm Pulldown | `ex_straight_arm_pulldown` |
| Standing Lateral Leg Swing | Standing Lateral Stretch | `ex_standing_lateral_stretch` |
| Standing One Arm Dumbbell Overhead Tricep Extension | Standing One-Arm Dumbbell Triceps Extension | `ex_standing_one-arm_dumbbell_triceps_extension` |
| Standing Tricep Straight Bar Cable Lat Pull Downs | Straight-Arm Pulldown | `ex_straight_arm_pulldown` |
| Steam Engines | Bicycle Crunch | `ex_bicycle_crunch` |
| Straight Bar Curls | Barbell Curl | `ex_barbell_curl` |
| Straight Barbell Shoulder Raise/Upright Row | Upright Row | `ex_upright_row` |
| Straight V Touches | Toe Touchers | `ex_toe_touchers` |
| Stretch Crunches | Crunches | `ex_crunches` |
| T-Bar/Landmine Back Row | T-Bar Row | `ex_tbar_row` |
| Tall Kneeling Cable Reverse Grip Back Pull Downs | Underhand Cable Pulldowns | `ex_underhand_cable_pulldowns` |
| Tall Kneeling Cable X Cross Back Rows | Kneeling High Pulley Row | `ex_kneeling_high_pulley_row` |
| Tall Kneeling Dumbbell Shoulder Press | Dumbbell Shoulder Press | `ex_db_shoulder_press` |
| Tall Kneeling to Squat | Kneeling Squat | `ex_kneeling_squat` |
| Toe Touches | Toe Touchers | `ex_toe_touchers` |
| Triangle/Diamond Push Ups | Diamond Push-Up | `ex_diamond_pushup` |
| Tricep Dips (Bodyweight) | Tricep Dip | `ex_tricep_dip` |
| Tricep Rope Extensions | Tricep Rope Pushdown | `ex_tricep_rope_pushdown` |
| Tricep Rope Pull Downs | Tricep Rope Pushdown | `ex_tricep_rope_pushdown` |
| Tricep Skull Crushers (Easy Bar) | EZ-Bar Skullcrusher | `ex_ez-bar_skullcrusher` |
| V Hugs | Tuck Crunch | `ex_tuck_crunch` |
| V Opposite Touches | Toe Touchers | `ex_toe_touchers` |
| V Sit Claps | Tuck Crunch | `ex_tuck_crunch` |
| V Ups | V-Up | `ex_v_up` |
| Walking Gorillas | Walking, Treadmill | `ex_walking_treadmill` |
| Wall Squat | Wall Sit | `ex_wall_sit` |
| Wide Hand Push Ups | Push-Up | `ex_push_up` |

---

## Programs Data

Below is the raw workout data for all 21 programs. For each exercise mentioned, look up the correct `exerciseId` and `exerciseName` from the reference table above.

### Program 1: Foundations: Upper-Lower Split
- **ID:** `prog_foundations_upper_lower_split`
- **Difficulty:** beginner
- **Days Per Week:** 4

#### Day 1: Chest + Biceps
- **Focus:** `chest`
- **Day ID:** `prog_foundations_upper_lower_split_day1`

> 1. Dumbbell Incline Bench Press
> Warm up
> 4 sets of 8, 5th set 20 reps
> Superset: Incline Single Arm Dumbbell Curl
> 5 sets of 12 reps
> 20 sec rest after full superset
> 2. Barbell Bicep Curls
> 5 sets of 5 reps (Go heavy)
> Superset: Push Up Combo
> 5 rounds
> 3. Core and Legs
> 50 Bodyweight Squats
> 50 Crunches
> 4. Cable Chest Fly (from high)
> 3 sets of 15 reps (Use resistance bands)
> Superset: Bent Over Single Arm Concentration Curls
> 3 sets of 8 reps per arm
> 20 sec rest after full set
> 5. Cable Chest Fly (from low)
> 3 sets of 15 reps
> Superset: Dumbbell Hammer Curls
> 3 sets of 8 reps
> 20 sec rest after full set
> 6. FINISHER
> 50 Crunches
> 50 Bodyweight Squats (Slow and deep)

#### Day 2: Legs
- **Focus:** `legs`
- **Day ID:** `prog_foundations_upper_lower_split_day2`

> 1 Single Dumbbell squats (Held between your legs) Reps: 12 10 8 6 4 2 40 sec rest between
> 2 Body Weight Squats Reps 20 18 15 12 10 10 sec rest between sets
> 3 Kettle bell walking lunges 4x10 steps
> 4 Dumbbell Hamstring RDLS 3x10 10 second rest between sets
> 5 Barbell Squats 1 set 50 reps go light
> 6 Dumbbell Dead lifts 4x5 45 sec - 1 minute rest between sets
> 7 FINISHER  20 slow and deep Body weight squats 1 sets of 50 crunches Ab roller 15
> reps

#### Day 3: Back and Shoulders
- **Focus:** `back`
- **Day ID:** `prog_foundations_upper_lower_split_day3`

> 1 Barbell Shoulder press behind the neck standing 4x10 30 sec rest between sets
> and keeping everything tight while standing up
> 2 Dumbbell shoulder press seated 4x20 20 sec rest between sets
> 3 Lat pull down 4x6 Go heavy 1 min rest between sets
> 4 Seated leaning forward dumbbell lateral shoulder raises 3x10
> raises 3x10 No rest one after the other
> 5 Later shoulder raise dumbbell
> 20 18 15 12 10 10 sec rest after you complete 1 full superset
> 6 Easy Bar Lateral Shoulder Raises 3x30 20 seconds rest between sets
> 7 FINISHER  20 crunches 3 sets Superset 3 sets of Pull ups till failure

#### Day 4: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_foundations_upper_lower_split_day4`

> Without resting do each exercise after each other.
> 1 7 reps dumbbell front squat to shoulder press thrusters
> 2 7 dips Knees Tucked
> 3 7 pull ups
> 4 7 clap push ups
> 5 7 hanging Ab raises feet to the bar
> 6 7 Dumbbell hammer bicep curls w twist
> Repeat this same routine after 1 minute of rest
> ** Do this for a total of 7 rounds!!!! Get after it!
> 7 Finisher  Tricep rope pull downs 4x25 Go light and really squeeze the triceps

---

### Program 2: Volume Builder: Push-Pull
- **ID:** `prog_volume_builder_push_pull`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Back + Chest
- **Focus:** `chest`
- **Day ID:** `prog_volume_builder_push_pull_day1`

> 1 Heavy dumbbell incline 4x6 reps 45 sec rest between sets Last set go light and do 25 reps
> Superset Standing body weight single leg kick backs 5 sets 10 reps each leg
> 2 50 bodyweight squats
> 3 Pull over pops 4 sets by 8 reps (1 pullover and 5 pops = 1 rep) Go heavier after each set
> 4 20 triangle push ups 20 mountain climbers
> 5 Reverse Grip Lat pull down 4 sets by 6 reps Go heavy min rest between sets 5th set go
> light and do 25 reps
> 6 Tricep dips feet in front 4 sets 10 reps each Go fast tempo for these
> you cant do 10 pull ups do as many as you can after each set)
> 7 Plate push ups 3 rounds Stack two 45 lb plates on top of each other and go back and forth
> There and back is 1 round
> 8 FINISHER  20 abdominal twists holding a 10 or 25 lb plate

#### Day 2: Legs + Biceps
- **Focus:** `legs`
- **Day ID:** `prog_volume_builder_push_pull_day2`

> 1 Leg Press Machine 5x10 45 sec rest between sets, go heavier after each set
> Superset Standing Calf Raises 5x15 reps
> 2 Preacher Curls Easy Bar 4x6-8 Go heavy Min rest between sets
> 3 Flat bench dumbbell alternating leg steps ups 35-45lbs dumbbells 10 steps each leg 4 sets
> Superset Dumbbell Seated Bicep Curl Combo 4x8 go heavy No rest between sets all
> the way through
> 4 Kettle bell squats Holding one kettle bell between your legs and squat down 4x20 Go light
> and deep squeeze glutes at the top  Superset Pull ups 4x6-8 35 sec rest after each
> set *alternate pull up grip after each set 1. reverse 2.regular 3.wide 4.narrow grip
> 5 Low Cable Tricep Rope Bicep Curls 4x12 each arm
> No rest between sets
> 6 Quad extensions 4x25 Go light and really squeeze your quads at the top of each rep 1 min
> rest between sets
> 7 FINISHER  50 crunches 50 body weight squats

#### Day 3: Shoulders + Triceps
- **Focus:** `shoulders`
- **Day ID:** `prog_volume_builder_push_pull_day3`

> Warm up 50 push ups
> 1 Smith Machine Shoulder Press 10 sets by 10 reps Go lighter Nice and slow 20 sec rest
> between sets fast tempo should be a warm up
> 2 Tricep rope extensions 5x20 20 sec rest between sets  Superset Standing Lateral leg
> swing 5x10 each leg
> 3 Single Cable shoulder later raise 3x15 Each Arm No rest just switch arms 3x
> 4 Single cable tricep reverse pull down 3x15 Each arm No rest all the way through
> 5 25lbs plate shoulder raises combo 4x8 Forward, cross body = 1 rep 45 sec rest between
> sets
> 6 20 bodyweight Squats 20 mountain climbers
> 7Flat bench dumbbell single arm dumbbell tricep extensions 4x10 Each arm
> Superset Dumbbell Shoulder Combo Tosses Front, side, cross body = 1 rep 4 sets 10 reps
> 8 FINISHER  50 crunches 25 diamond push ups 10 low and slow body weight squats

#### Day 4: Bodyweight Workout
- **Focus:** `full_body`
- **Day ID:** `prog_volume_builder_push_pull_day4`

> Set up: Grab two dumbbells One Flat Bench Preferably 40 lbs each *no less than 30lb
> dumbbells
> 1 10 flat bench bodyweight dips 2 10 clap push ups 3 10 abdominal V ups Use the
> dumbbells for these  exercises 4 10 dumbbell standing shoulder press 5 10 dumbbell
> bicep curls 6 10 dumbbell deadlifts 7 10 dumbbell bench step ups
> 1 min rest
> Repeat for 5 rounds
> ** Go up 1 rep after every round
> *By round 5 you should be doing 14 reps of everything

---

### Program 3: Hypertrophy Kickstart
- **ID:** `prog_hypertrophy_kickstart`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: All Chest day
- **Focus:** `chest`
- **Day ID:** `prog_hypertrophy_kickstart_day1`

> 1 Dumbbell flat bench press 5 sets 15 reps 30 sec rest between set
> 2 Single arm flat dumbbell bench press *one arm at a time (Really focus on core and
> stability, see which arm is stronger and easier to get all the reps.. do extra 2-3 reps on the
> weaker side ) 4 sets 12 reps each arm
> 3 Cable chest flys from the cables low 3 sets 15 reps Low rest between sets
> 4 Cable chest flys from neutral 3 sets 15 reps Low rest between sets
> 5 Chest press machine 3 sets 30 reps Go slow and really go for full extension
> machine 4x10 reps each arm
> 6Plate push up combo 2 rounds *Both TILL FAILURE One minute rest between sets
> 7 FINISHER  Crunches x100 Oblique side crunches x25 each side

#### Day 2: Leg day
- **Focus:** `legs`
- **Day ID:** `prog_hypertrophy_kickstart_day2`

> 1 Dumbbell Front squats (Holding one dumbbell perform a front squat) 4 sets 15 reps Go
> lighter
> 2 Plate walking lunges 3x10 steps each leg 30 sec rest after walking 10 steps each leg
> 3 Barbell Deadlifts 4x15 Go light 1 minute rest between sets (Really squeeze the glutes at
> the top Go up in weight after each set Focus on your grip being even and tight, as your go
> heavier have one hand griping reverse the other regular)
> 420 bodyweight squats 10 pull ups 10 hanging knee to chest ab raises
> 5 Bodyweight Balance RDLs with other without dowel 3x5 reps each leg 10 sec rest
> between sets
> 6 Abductor Machine 3x20
> between sets
> 7 Hamstring lying curl machine 3x20  Superset Quad extensions 3x20 30 second rest
> after each set
> 8 FINISHER  50 crunches Kettle bell single arm farmer carry (good posture, squeeze the
> kettle bell and grip hard) 4 rounds 10 steps each arm

#### Day 3: Back Day
- **Focus:** `back`
- **Day ID:** `prog_hypertrophy_kickstart_day3`

> 1 Seated single arm cable back row 5x12 each arm 40 sec rest btwn sets
> 2 Tall kneeling easy bar high cable reverse grip back pull downs 4x25 40 sec rest btwn sets
> 3 10 hanging knee to chest an raises 10 pulls ups 3 sets
> 4 Lat pull down 25 reps 5 rounds 35 sec rest between sets
> 5 Tall kneeling cable x cross back rows 4x15 35 seconds rest between sets
> 6 25 bodyweight squats
> 7 Peck deck machine single arm pull backs 3x20 each arm 30 sec rest between sets
> 8 Standing tricep straight bar cable lat pull downs 20 reps 4 rounds 25 sec rest between
> sets

#### Day 4: Arms Day
- **Focus:** `arms`
- **Day ID:** `prog_hypertrophy_kickstart_day4`

> 1 Barbell Bicep curls 5 rounds 12 reps 45 sec rest between sets
> 2 Tricep skull crushers 5 rounds 15 reps 50 second rest between sets
> 3 10 burpees 10 split squat Jumps alternating legs
> 4 High cable single grip Tricep pull downs 4 rounds 25 reps each arm
> (go HEAVY)
> 5 50 crunches
> 6 High Cable Straight bar Tricep pull downs 4x25
> 8 Finisher  Single cable tricep pull downs
> 4x12 each arm

---

### Program 4: Antagonist Superset Builder
- **ID:** `prog_antagonist_superset_builder`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Back + Biceps
- **Focus:** `back`
- **Day ID:** `prog_antagonist_superset_builder_day1`

> 1 Lat pull down 5x15
> 2 Barbell bicep curls 5x15 45 sec rest after each round
> 3 Back cable row 5x15
> curls combo 5x15
> 4 Dumbbell back row 4x10  Superset Incline bench alternating bicep curls 4x10
> 5 Pull ups 3 sets by 6 reps Chin ups 1 set by 6-10
> 6 Hanging from a pull up bar knee raises 3 sets by 15 reps
> 7 FINISHER  Lying with your chest flat on incline bench back row go light with 20s 3
> sets 20 reps!!  Superset Bent over bicep concentration curls 3x12 each arm

#### Day 2: Chest & Tri workout
- **Focus:** `chest`
- **Day ID:** `prog_antagonist_superset_builder_day2`

> 40 sec rest between sets
> 1 Dumbbell flat bench press 5x15
> 2 Tricep dips 5x5 (Slow very slow) Weighted if you can
> 3 Cable chest flys From high 2 sets x15 reps
> From middle 2 sets x15 reps
> From low 2 sets 15 reps
> 4 Tricep rope extensions 5x15
> 5 30 triangle push ups
> 6 Incline Chest press smith machine 5x15
> 7 15 clap push ups
> 8 Tricep skull crushers 4x15
> 9 Finisher  Push ups till failure x2 Min rest in between 50 crunches

#### Day 3: Legs + Shoulders
- **Focus:** `shoulders`
- **Day ID:** `prog_antagonist_superset_builder_day3`

> 1 Back squat 6 rounds 10 reps Go heavier after each set 1 minute rest between sets Stretch
> between sets, hip flexor, calf stretch etc
> 2 Seated dumbbell shoulder press 4 rounds 12 reps  Superset Standing leg kick backs
> 4x 12 each leg
> 3 Dumbbell walking lunges 4 rounds 10 steps each leg
> Superset Barbell shoulder raises 4 rounds 15 reps 1 min rest after each set
> 4 Dumbbell Dead lifts 3 rounds 10 reps each leg  Superset Dumbbell shoulder raises
> upright row 4 rounds 15 reps
> 5 Leg press machine 4 rounds 10 reps 30 sec rest between set  Superset Landmine
> cross body shoulder raises 4x10 reps each arm
> 6 FINISHER  Shoulder clap burpees ( do a push up.. then jump up onto your feet standing
> up.. bring both of your arms overhead and touch your fingers together) Repeat adding a rep
> everytime of push ups and finger touches.. Look for Steve cook YouTube video for these..
> they are a killer
> Reps for this Go all the way to where ur last set u do 10 push ups followed by 10 overhead
> finger touches

#### Day 4: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_antagonist_superset_builder_day4`

> Without resting do each exercise after each other.
> 1 7 reps dumbbell front squat to shoulder press thrusters
> 2 7 dips Knees Tucked
> 3 7 pull ups
> 4 7 clap push ups
> 5 7 hanging Ab raises feet to the bar
> 6 7 Dumbbell hammer bicep curls w twist
> Repeat this same routine after 1 minute of rest
> ** Do this for a total of 7 rounds!!!! Get after it!
> 7 Finisher  Tricep rope pull downs 4x25 Go light and really squeeze the triceps

---

### Program 5: Strength & Conditioning Blend
- **ID:** `prog_strength_conditioning_blend`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Shoulders + Biceps
- **Focus:** `shoulders`
- **Day ID:** `prog_strength_conditioning_blend_day1`

> 1 Dumbbell front Shoulder raises 4 rounds 15 reps
> sets
> 2 Low Cable upright row 4 rounds 12 reps
> Superset Dumbbell Hammer curls w twist 4 rounds 12 reps
> 3 Easy bar Lateral shoulder raises 4 sets 20 reps
> Superset Plate bicep curls with twist 4 sets 20 reps
> 4 Straight barbell shoulder raises 20 15 12 10 8 6 4 20 sec rest between
> 5 Bent over concentration curls 3x12 each arm No rest all the way through
> 6 Dumbbell 90 degree shoulder raises 20 18 15 12 10 reps 30 second rest between sets
> 7 Cable bicep curls with Tricep rope 2 sets of 50 reps Go light really squeeze the bicep
> muscles
> 8 FINISHER  Ab raises from pull up bar 3 rounds 12 reps
> 50 crunches 50 toe touches 20 leg drops (1 leg at a time) 20 on each leg

#### Day 2: Back + Tri
- **Focus:** `back`
- **Day ID:** `prog_strength_conditioning_blend_day2`

> 1 Lat Pull down 3x 25 reps 1 min rest between sets
> 2 Tricep Rope Pulls downs 3x 25 reps
> rest between sets back and forth just switching the height of the cable
> 3 Barbell bent over back row 4x18 1 min rest between sets
> 4 50 air squats
> 5 Tricep flat bench skull crushers 4x15
> sets
> 10 burpees
> 6 Straight bar cable machine mid back rows 4x15
> each arm No rest between sets
> 7 Cable single arm back row 4x20
> rest
> 8 FINISHER  100 crunches

#### Day 3: Full Body Workout
- **Focus:** `full_body`
- **Day ID:** `prog_strength_conditioning_blend_day3`

> Set Up One Bench 2 sets of dumbells (1 heavy, 1 light)
> 1 Light Dumbbells Standing Shoulder Raises 4 sets by 15 reps
> reps No rest Between sets
> 2 20 bellow parallel bodyweight squats
> 3 Single Arm Dumbbell Bench Press 4 sets by 15 reps (once both arms have completed 15
> reps that is 1 set)  Superset Dumbbell lawn More Row 4 sets by 15 reps (once both
> arms have completed 15 reps that is 1 set) No rest between sets
> 4 20 bellow parallel bodyweight squats
> 5 Dumbbell alternating leg step ups 4 sets by 10 reps  Superset Flat Bench Tricep
> Dumbbell Extensions 4 sets by 15 reps
> 6 20 bellow parallel bodyweight squats
> 3 Exercise Superset! You need one incline bench and dumbbells
> 7 Dumbbell Lateral Shoulder Raises Superset Dumbbell Incline bench Flys Superset Incline
> Dumbbell Back rows 3 rounds 10 reps No rest between triple set
> 8 FINISHER  10 Pull Ups 20 Clap Push Ups Shoulder Burpess (youve done these before,
> these are the Steve cook shoulder finger touches) 50 Crunches

#### Day 4: Chest Day
- **Focus:** `chest`
- **Day ID:** `prog_strength_conditioning_blend_day4`

> 1 25 Triangle Push Ups
> 2 Barbell bench press 5 sets 12 reps 1 min rest between sets
> 3 30 Bodyweight Forward Lunges Each Leg
> 4 Dumbbell incline bench press 4 sets 15 reps 1 min rest between sets
> 5 1 min wall squat
> 6 Dumbbell flat bench flys 4 rounds 12 reps  Superset Med Ball Alternating Push Ups
> 4 rounds 12 reps no rest between sets
> 7 Clap push ups  Superset Tricep dips 7 reps no rest for 4 rounds
> 8 Cable chest flys from high 15 reps 4 rounds  Superset Lying Flat Ab raises knee to
> chest 15 reps 4 rounds No rest straight through
> 9 FINISHER  Crunches x50 V ups x35 Wide hand push ups x20

---

### Program 6: Progressive Overload Primer
- **ID:** `prog_progressive_overload_primer`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Chest + Biceps
- **Focus:** `chest`
- **Day ID:** `prog_progressive_overload_primer_day1`

> 1 Dumbbell Incline Bench Press 4 sets of 15 5th set 20 reps  SUPERSET Seated
> Dumbbell Curls 5 sets of 15 reps 20 sec rest after you complete 1 full set of both incline
> press and curls
> 2 Barbell Bicep curls 4 sets 15 reps go heavy
> is 1 rep for 4 rounds
> 3 50 bodyweight Squats 50 crunches
> 4 Cable chest fly from high 3x15
> 4x12 each arm 20 second rest after you complete 1 full set
> 5 Cable chest flys from low 3x15
> rest after you complete 1 full set
> 6 FINISHER  50 crunches 50 bodyweight Squats

#### Day 2: Legs
- **Focus:** `legs`
- **Day ID:** `prog_progressive_overload_primer_day2`

> 1 Back squat 20 18 15 12 10 reps 40 sec rest between One weight the whole time
> 2 Leg extensions 20 18 15 12 10 10 sec rest between sets Pick 1 weight for all the sets and
> reps
> 3 Kettle bell walking lunges 3x15 steps each leg
> Superset Hamstring curls 3x20
> 4 Leg press 1 set 50 reps go light 45 on each side very slow and feel the blood filling up in
> your legs
> 5 Dumbbell Dead lifts 4x15 30 sec rest between sets Not to heavy work on your form and
> really squeeze on the follow through
> 6 Leg extensions round 2 20 18 15 12 10  Super set Body weight squats 20 18 15 12
> 10
> 7 FINISHER  2 sets of 50 crunches

#### Day 3: Back + Shoulders
- **Focus:** `back`
- **Day ID:** `prog_progressive_overload_primer_day3`

> 1 Crunches 5 sets 20 reps  Superset Pull ups 5 sets 8 reps Switch pull up grip after
> every set
> 2 Single arm Pec dec reverse fly 3x30
> each arm)
> 3 Dumbbell Later shoulder raise dumbbell  Superset Cable high up easy bar reverse
> grip back pull downs on your knees Reps for both 20 18 15 12 10 10 sec rest after you
> complete 1 full superset
> 4 High Cable Straight Bar Reverse grip back row 3x10
> Combo 3x10 No rest one after the other
> 5 Lat pull down 4x20 Go heavy 1 min rest between sets
> 6 Dumbbell Front shoulder press seated 4x20 20 sec rest between sets
> 7 FINISHER  Barbell Shoulder press behind the neck standing 4x10 30 sec rest between
> sets

#### Day 4: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_progressive_overload_primer_day4`

> Set up Get two 40 lbs dumbbells (or lighter set of dumbbells) Get two 60lbs dumbells
> (second set of dumbbells needs to be at least 20 lbs heavier) 1 adjustable bench
> 1 Set 1 40lbs alternating leg step ups X10 each leg
> 45 sec rest
> 2 Set 2 60 lbs incline dumbbell bench press X12
> 35 sec rest
> 3 Set 3 40 lbs incline Dumbbell back row (stomach on the incline bench)
> 1 min rest
> 4 Set 4 40 lbs seated incline bench curls x8 reps each arm 1 min plank
> 5 Set 5 1 60 lb dumbbell seated overhead tricep extension x20 reps
> 30 sec rest
> 6 Set 6 40lbs narrow stance standing rdl (deadlifts) X10 reps
> 1 min rest
> 7 Set 7 Feet elevated on bench push ups x30
> Repeat for 5 rounds!

---

### Program 7: Compound Strength Focus
- **ID:** `prog_compound_strength_focus`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Back + Chest
- **Focus:** `chest`
- **Day ID:** `prog_compound_strength_focus_day1`

> 1 Back cable row 3 sets of 20 reps
> sets 20 reps
> 2 Low cable chest flys 3x15 20 sec rest between sets
> 3 Plate push ups 3 rounds Stack to 45 lb plates on top of each other and to back and forth
> all the way across and back is 1 round
> 4 Pull ups 4x10 Fast tempo
> 5 Tricep dips knees in front 4x15 Go fast tempo for these
> 6 Lat pull down 4x20 Light weight min rest between sets
> 7 20 triangle push ups 20 mountain climbers
> 8 FINISHER  Pull over pops 4x10 Go heavy for your last 3 sets

#### Day 2: Legs + Biceps
- **Focus:** `legs`
- **Day ID:** `prog_compound_strength_focus_day2`

> 150 crunches 35 second rest 50 body weight squats
> 2 Leg extensions 4x20 15 seconds rest between sets
> 3 Cable Biceps Curls w Tricep rope 4x12 each arm
> No rest between sets
> 4Leg press 4x20 Go light and deep  Superset Pull ups 4x10 35 sec rest after each set
> 5 Flat bench dumbbell alternating leg steps ups 35-45lbs dumbbells 10 steps each leg 4 sets
> Superset Standing Dumbbell Hammer Curls 4x8 go heavy No rest between sets all the
> way through
> 6 Barbell Bicep Curls 4x15 Min rest
> 7 FINISHER  20 bodyweight squats 50 bicep curls are 15lbs or lighter Split squat jumps
> for 1 minute

#### Day 3: Shoulders + Triceps
- **Focus:** `shoulders`
- **Day ID:** `prog_compound_strength_focus_day3`

> 1 50 crunches 25 diamond push ups 10 low and slow body weight squats
> 2 Flat bench dumbbell single arm tricep extensions 4x10 Each arm
> (Bring the dumbbell Across your nose) 4x10 Each arm No rest straight through get a good
> sweat and pump going!!
> 3 20 bodyweight Squat jumps
> 4 25lbs plate shoulder raises 4x10 30 sec rest
> 5 Single cable tricep reverse pull down 5x15 Each arm No rest all the way through Really
> tighten your tricep and squeeze and flex the muscle at the bottom of the rep
> 6 Single Cable shoulder later raise 3x15 Each Arm No rest just switch arms 3x Pause at the
> top of each rep for a two count
> 7 Tricep rope extensions 5x20 20 sec rest between sets Theres are supposed to be fast
> After the set pyramid down w reps of 10 lowering the weight each time (these are an
> awesome way to Sculpt the triceps and build definition)
> 8 FINISHER  Smith machine Shoulder Press Seated 4x20 Go lighter Nice and slow 30 sec
> rest between sets Feel the shoulder fill up w blood focus on form and technique we building
> that Arnold physique w these!!!

#### Day 4: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_compound_strength_focus_day4`

> Set Up Grab two dumbbells Preferably 40 lbs each *no less than 30lb dumbbells
> 1 10 pull ups 2 20 dips 3 15 clap push ups 4 18 abdominal V ups Use the 40 lbs
> dumbbells 515 dumbbell standing shoulder press 6 20 dumbbell alternating bicep curls 7
> 18 dumbbell deadlifts 8 12 dumbbell bench step ups 1 min rest
> Repeat for 4 rounds

---

### Program 8: Functional Power Circuit
- **ID:** `prog_functional_power_circuit`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: All Chest day
- **Focus:** `chest`
- **Day ID:** `prog_functional_power_circuit_day1`

> 1 Clap push ups 3 sets 15 push ups
> 2 Decline Chest press 3 sets 30 reps Go slow and really go for full extension
> 3Cable chest flys from neutral 3 sets 15 reps Low rest between sets
> 4 Cable chest flys from the cables low 3 sets 15 reps Low rest between sets
> 5 Single arm flat dumbbell bench press 4 sets 16 reps each arm. (Notice which arm is
> having a harder time getting 16 reps and do a couple extra reps on the struggling side)
> 6 50 bodyweight squats
> 7 FINISHER  Dumbbell incline press 5 sets 15 reps 30 sec rest between sets

#### Day 2: Back Day
- **Focus:** `back`
- **Day ID:** `prog_functional_power_circuit_day2`

> 1 Standing tricep straight bar cable lat pull downs 20 reps 4 rounds 25 sec rest between
> sets
> 2 20 V Ups 30 seconds of split squat jumps
> 3 Reverse grip lat pull down 20 reps 3 rounds 30 sec rest between sets
> 4 25 bodyweight squats
> 5 Lat pull down 25 reps 5 rounds 35 sec rest between sets
> 6 10 hanging knee to chest an raises
> 7 Tall kneeling high cable easy bad reverse back pull downs 12 reps 4 rounds 40 sec rest
> btwn sets
> 8 FINISHER  Dumbbell Deadlifts 3x15 Slow and deep good technique

#### Day 3: Legs
- **Focus:** `legs`
- **Day ID:** `prog_functional_power_circuit_day3`

> 1 50 crunches 35 second rests Kettle bell single arm farmer carry good posture 4 rounds 10
> steps each arm
> 2 Hamstring lying curls 3x20 10 seconds rest between sets
> 4 Quad extensions 3x20
> 4 Abductor 3x20 Machines superset Adductor 3x20 Go all the way through no rest
> 5Leg Press 5x20 Minimal rest between sets
> 620 bodyweight squats 10 pull ups 10 hanging knee raises
> 7 split squat jumps 4x 30 seconds Go light speed
> 8 FINISHER  Reverse dumbbell lunge 3x10 each leg 30 sec rest after both legs

#### Day 4: Arms
- **Focus:** `arms`
- **Day ID:** `prog_functional_power_circuit_day4`

> 1 Barbell Bicep curls 5 rounds 12 reps
> 2 Tricep skull crushers 5 rounds 15 reps
> 3 10 burpees 20 clap push ups
> 4 Tricep rope pull downs 4 rounds 25 reps
> reps (go HEAVY)
> 5 50 crunches
> 6 Seated bicep curls combo 4 rounds 10 reps
> reps each arm
> 7 For this exercise do 10 tricep dips then go straight into clap push ups x15 reps for 3
> rounds no rest
> 8 FINISHER  Grab 15 lbs dumbbells do curls for two Mins straight
> Then go to the tricep cable pull down and do single arm tricep extensions alternate every
> 20 reps till you cant get 20 anymore!!

---

### Program 9: Muscular Endurance Phase
- **ID:** `prog_muscular_endurance_phase`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Back + Biceps
- **Focus:** `back`
- **Day ID:** `prog_muscular_endurance_phase_day1`

> 1 lat pull downs 4 sets 20 reps  Superset Bent over bicep concentration curls 4x12
> each arm Do one after the other then rest for 35 seconds after completing the both
> 2 Hanging from a pull up bar knee raises 3 sets by 15 reps  Superset 3 sets 20 reps
> body weight squats
> 3 Pull ups 3 sets by 10 reps Chin ups 1 set by 8
> 4 Single arm Dumbbell back row  Superset Seated dumbbell bicep curls combo 5x10
> 5 single cable back row 4x15
> 6 20 squats
> 7 FINISHER  Lat pull down  Superset 10 lbs bicep plate curls a twist 5x15 each arm

#### Day 2: Chest & Tri workout
- **Focus:** `chest`
- **Day ID:** `prog_muscular_endurance_phase_day2`

> 1 Push ups combo 4x5 One round is goin in each direction and back to base 45 sec rest
> between sets
> 2 50 crunches
> 3 Tricep easy bar skull crushers on flat bench 4x25  Superset Dumbbell Push Ups w
> Lateral Reach 4x10 Roll left and right is 1 rep
> 4 15 clap push ups 16 lying flat single leg lowering abs (8 each leg)
> 5 Incline Chest press machine 5x15 Go slowwww and really extend out
> 6 30 triangle push ups
> 7 Tricep rope extensions 5x15 Go fast tempo and do a pyramid back down after the 5 sets
> going down in weight every time after you hit 10 reps
> 8 FINISHER  Dumbbell flat bench press 5x15 30 second rest between sets
> Abs 25 med ball toe touches 25 med ball Russian twists 12 on each side oblique lying on
> your side crunches

#### Day 3: Legs + Shoulders
- **Focus:** `shoulders`
- **Day ID:** `prog_muscular_endurance_phase_day3`

> 1 Plate Push UPS There and back is 1 rep 4 sets by 3 reps
> 2 Leg press machine 4 rounds 25 reps Light rest between sets
> 3 Dumbbell Lateral Shoulder Raises 4x15  Superset Dumbbell front Shoulder Raises
> 4x6 (heavy)
> 4 Dumbbell box step ups with high knee 3 rounds 10 reps each leg Superset 25lb
> plates Shoulder Combo 3x12 No rest all the way through!
> 5 Dumbbell walking lunges 4 rounds 10 steps each leg  Superset Cable Lateral
> shoulder raises 4 rounds 15 reps
> 6 25 bodyweight squats 10 v ups 10 burpees
> 7 Seated dumbbell shoulder press 4 rounds 12 reps Go heavy
> 8 FINISHER  10 burpees 50 push ups 20 crunches

#### Day 4: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_muscular_endurance_phase_day4`

> Without resting do each exercise after each other.
> 1 7 reps dumbbell front squat to shoulder press thrusters
> 2 7 dips Knees Tucked
> 3 7 pull ups
> 4 7 clap push ups
> 5 7 hanging Ab raises feet to the bar
> 6 7 Dumbbell hammer bicep curls w twist
> Repeat this same routine after 1 minute of rest
> ** Do this for a total of 7 rounds!!!! Get after it!
> 7 Finisher  Tricep rope pull downs 4x25 Go light and really squeeze the triceps

---

### Program 10: Intensity Escalation Week
- **ID:** `prog_intensity_escalation_week`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Shoulders + Biceps
- **Focus:** `shoulders`
- **Day ID:** `prog_intensity_escalation_week_day1`

> Warm Up 50 crunches 50 toe touches 20 leg drops (1 leg at a time) 20 on each leg
> 1 Ab raises from pull up bar 3 rounds 12 reps
> 2 Cable bicep curls w Tricep rope 2 sets of 50 reps Go light really squeeze the bicep muscles
> 3 Cable lateral shoulder raises 20 18 15 12 10 each arm No rest between sets
> 4 Bent over concentration curls 3x12 each arm No rest all the way through
> 5 Straight barbell shoulder raises 20 15 12 10 8 6 4 20 sec rest between
> 6 Seated Dumbbell Lateral shoulder raises 4 sets 20 reps
> rest till all 4 rounds are done (Go like 10 lb dumbbells for this)
> 7 Plate around the worlds 4 rounds 12 reps
> till completed Same weight
> 8 FINISHER  Dumbbell front Shoulder raises 4 rounds 15 reps  Superset Preacher
> curls 4x20 30 sec rest between sets

#### Day 2: Back + Triceps
- **Focus:** `back`
- **Day ID:** `prog_intensity_escalation_week_day2`

> Warm Up 100 crunches
> 1 Mid cable back row 4x20
> rest
> 2 High Cable X Back row 4x8
> each arm No rest between sets
> 3 10 burpees
> 4 Tricep flat bench skull crushers 4x15  Superset Triangle push ups 4x20 1 min rest
> between sets
> 5 50 air squats
> 6 Barbell bent over back row 4x15 1 min rest between sets
> 7 Tricep Rope Pulls downs 3x 25 reps  Superset 30 sec plank No rest between sets
> 8 FINISHER  Lat Pull down 3x 25 reps 1 min rest between sets

#### Day 3: Full Body Workout
- **Focus:** `full_body`
- **Day ID:** `prog_intensity_escalation_week_day3`

> Set Up One Bench 2 sets of dumbells (1 heavy, 1 light)
> 110 Pull Ups 220 Clap Push Ups 350 Crunches
> 3 Exercise Superset!  Lateral Shoulder Raises  Superset Dumbbell Incline
> Flys  Superset Incline Dumbbell Back rows 3 rounds 10 reps No rest between triple
> set
> 4 20 bellow parallel bodyweight squats
> 5 Dumbbell alternating leg step ups 4 sets by 10 reps  Superset Flat Bench Tricep
> Dumbbell Extensions 4 sets by 15 reps
> 6 20 bellow parallel bodyweight squats
> 7 Single Arm Dumbbell Bench Press 4 sets by 15 reps (once both arms have completed 15
> reps that is 1 set)  Superset Dumbbell lawn More Row 4 sets by 15 reps (once both
> arms have completed 15 reps that is 1 set) No rest between sets
> 8 20 bellow parallel bodyweight squats
> 9 FINISHER  Light Dumbbells Standing Shoulder Raises 4 sets by 15 reps  Superset
> Seated Dumbbell Bicep Curls 4 Sets by 15 reps No rest Between sets

#### Day 4: Chest Day
- **Focus:** `chest`
- **Day ID:** `prog_intensity_escalation_week_day4`

> Warm Up Crunches x50 V ups x35 Wide hand push ups x20
> 1 Cable chest flys Hugh 15 reps 4 rounds  Superset Pull up bar Ab raises knee to chest
> 15 reps 4 rounds No rest straight through
> 2 push up combo 4x5 all 4 variations is 1 rep
> 3 Dumbbell flat bench flys 4 rounds 12 reps  Superset Med Ball Alternating Push Ups
> 4 rounds 12 reps no rest between sets
> 4 1 min wall squat bellow parallel
> 5 Dumbbell incline bench press 4 sets 15 reps 1 min rest between sets
> 6 30 Bodyweight Forward Lunges Each Leg
> 7 FINISHER  Pull over pops 4 sets 8 pull overs 8 pops = 1 set Min rest between sets

---

### Program 11: Athletic Performance Builder
- **ID:** `prog_athletic_performance_builder`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Chest + Biceps
- **Focus:** `chest`
- **Day ID:** `prog_athletic_performance_builder_day1`

> 1 50 crunches 50 bodyweight Squats
> 2 30 reps of alternating dumbbell bicep curls standing each arm
> 3 100 reps of barbellbench press just the bar
> 4 Cable chest flys from low 3x15  Superset Dumbbell Hammer curls 4x15 20 second
> rest after you complete 1 full set
> 5Cable chest fly from high 3x15 Superset Bent over single arm concentration curls
> 4x12 each arm 20 second rest after you complete 1 full set
> 6 50 bodyweight Squats 50 crunches
> 7 Barbell Bicep curls 4 sets 15 reps go heavy  Superset 30 push ups 4 rounds
> 8 FINISHER  Dumbbell Incline Bench Press 4 sets of 15 5th set 20 reps  Superset
> Incline Dumbbell Curls 5 sets of 15 reps

#### Day 2: Legs + Triceps
- **Focus:** `legs`
- **Day ID:** `prog_athletic_performance_builder_day2`

> 1 Back squat 20 18 15 12 10 reps 40 sec rest between One weight the whole time Or
> Holding a single Dumbbell Squats Same reps as above
> 2 Flat Bench easy bar Tricep Skull Crushers 5 sets 20 reps after the 20 reps holding the bar
> do 10 narrow grip bench presses w the easy bar Short rest between
> 3 Leg extensions 20 18 15 12 10 10 sec rest between sets Pick 1 weight for all the sets and
> reps
> 4 Tricep Rope Pull Downs 5 sets 20 reps Go fast one set after the other !
> 5 Kettle bell walking lunges 3x15 steps each leg  Super set Hamstring curls 3x20
> 6 Tricep dips 3x15
> 7 leg press 1 set 50 reps go light 45 on each side very slow and feel the blood filling up in
> your legs
> 8 FINISHER  Dumbbell Dead lifts 4x15 30 sec rest between sets Not to heavy work on
> your form and really squeeze on the follow through
> Abs to end it  2 sets of 50 crunches

#### Day 3: Back + Shoulders
- **Focus:** `back`
- **Day ID:** `prog_athletic_performance_builder_day3`

> 1 5 sets of hanging from pull up bar knee to chest raises 10 reps  Superset 5 sets of
> Pull ups 8 reps
> 2 Pec dec single arm reverse fly 3x30
> 3 10 burpees 10 clap push ups
> 4 Later shoulder raise dumbbell 5x15 each arm  Superset Cables high up pull down
> extensions 20 18 15 12 10 10 sec rest after you complete 1 full superset
> 515 standing good mornings
> 6 Rack Pulls 3x10 Go Heavy
> 3x10 No rest one after the other
> 4 Lat pull down 4x20
> 5 30 bodyweight squats
> 6 Dumbbell shoulder press seated 4x20 20 sec rest between sets
> 7 Landmine back row 3x15 reps

#### Day 4: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_athletic_performance_builder_day4`

> Without resting do each exercise after each other.
> 1 7 reps dumbbell front squat to shoulder press thrusters
> 2 7 dips Knees Tucked
> 3 7 pull ups
> 4 7 clap push ups
> 5 7 hanging Ab raises feet to the bar
> 6 7 Dumbbell hammer bicep curls w twist
> Repeat this same routine after 1 minute of rest
> ** Do this for a total of 7 rounds!!!! Get after it!
> 7 Finisher  Tricep rope pull downs 4x25 Go light and really squeeze the triceps

---

### Program 12: Peak Strength Challenge
- **ID:** `prog_peak_strength_challenge`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: Back + Chest
- **Focus:** `chest`
- **Day ID:** `prog_peak_strength_challenge_day1`

> 1 Back cable row 3 sets of 20 reps
> 2 Low cable chest flys 3x15 20 sec rest
> bar 3 x 15
> 3 Plate push ups 3 rounds Stack to 45 lb plates on top of each other and to back and forth
> 30 second rest between sets
> 4 Pull ups 4x10 Fast tempo
> 5 Tricep dips knees tucked 4x15 Go fast tempo for these
> 6 Lat pull down 4x15 min rest between sets  Superset Standing single leg kick backs
> 4x15 each leg
> 7 20 triangle push ups 20 mountain climbers
> 8 FINSIHER  50 bodyweight squats dumbbell incline 4x20 35 sec rest between sets Go
> light and slow work the form and technique

#### Day 2: Legs + Triceps
- **Focus:** `legs`
- **Day ID:** `prog_peak_strength_challenge_day2`

> Warm Up 20 bodyweight squats 20 triangle push ups 20 low bear crawl steps (10
> forward 10 backward)
> 1 Barbell Front Squat 15 12 10 8 6 10 (set of 6 reps should be heavy and tough to get 6)
> (last set of 10 go very light and just go slow and deep) About 1 min rest between sets
> 2 Flat bench Tricep skull crushers 20 15 12 10 20 Go up in weight each time, when you get
> to the last set of 20 go light back to the weight you started with
> 3 Kettle bell center hold lateral lunge 10 to the left and back to center 10 to the right and
> back to center That is 1 full set Then do 2 more after a one minute rest
> 4 Tricep rope extensions 20 18 15 12 10 rest 30 seconds 12 15 18 20 Very short rest
> between sets pyramid down then pyramid back up
> 5 Kettle bell Single Leg RDL 10 reps each leg 4 sets total Really focus on your balance go
> nice and slow
> 6 Seated Tricep extensions with 1 Dumbbell Go heavy! 3x12
> 7 Lying hamstring curl machine 20 18 15 12 10 10 sec rest between sets
> 8 Quad extension machine 20 18 15 12 10 10 sec rest between sets
> 9 FINISHER  Calf raises 20 reps rest 20 seconds 15 reps rest 20 seconds 12 reps rest 20
> seconds

#### Day 3: Shoulders
- **Focus:** `shoulders`
- **Day ID:** `prog_peak_strength_challenge_day3`

> 1 Peck deck reverse flys 3x30 Go light and get the blood pumping lead with your shoulder
> going back first
> 2Dumbbell front Shoulder raises 4 rounds 15 reps 30 sec rest between sets
> 3 Straight bar upright row 4 rounds 12 reps
> reps No rest till completed
> 4 Standing Dumbbell Lateral shoulder raises 4 sets 20 reps  Superset Dumbbell
> hammer shoulder raises 4 sets 20 reps No rest till all 4 rounds are done (Go like 10 lb
> dumbbells for this)
> 5 Dummbell shoulder upright rows 20 15 12 10 8 6 4 20 sec rest between
> 6 Cable lateral shoulder raises 20 18 15 12 10 each arm No rest between sets
> 7 FINISHER  Ab raises from pull up bar 3 rounds 12 reps 50 crunches 50 toe touches 20
> leg drops (1 leg at a time) 20 on each leg

#### Day 4: Full Body (Primary Biceps)
- **Focus:** `full_body`
- **Day ID:** `prog_peak_strength_challenge_day4`

> 1 Barbell Bicep Curls 20 15 12 10 8 5 Go up in weight after each set 45 second rest between
> sets
> 2 Front Squat Step Back Lunges 5 sets 10 reps each leg Solid minute plus rest
> 3 Tricep Dips 4x15  Superset Pull ups 4 sets 8 reps each No rest just go back and forth
> between exercises
> 4Tricep Rope Low Cable Bicep Curls https://youtu.be/2Uj33uMNvfI 20 18 15 12 10 20
> second rest between each set
> 5 Landmine T bar back Row 4 sets 10 reps increase weight every time 45 second rest
> between sets After your 4th set pyramid down dropping the weight after each set doing 10
> reps till you have just the bar left, no rest all the way through
> 6 Standing barbell Shoulder Press 4 sets 12 reps Go light and really go through full
> extension and good form solid base
> 8 Tricep Rope Extensions 5 sets 10 reps Go up in weight every set 20 second rest between
> sets *after your 5th set pyramid down Do 10 reps then lower the weight for 5 sets lowering
> the weight each time with no rest between sets
> FINISHER Abs 20 crunches 20 v ups 20 bicycles 20 leg lowerings 10 each leg
> Abs w Med ball 20 Russian twists 20 toe touches 20 sit ups to med ball press

---

### Program 13: Deload & Technique Refinement
- **ID:** `prog_deload_technique_refinement`
- **Difficulty:** intermediate
- **Days Per Week:** 4

#### Day 1: All Back Day
- **Focus:** `back`
- **Day ID:** `prog_deload_technique_refinement_day1`

> 1 Bent Over Barbell Back Row 15 reps 4 rounds 40 sec rest btwn sets
> 2 Lawn Mower One Arm Bent Over Row 12 reps each arm 4 rounds 40 sec rest btwn sets
> *Go heavier after each set
> 10 hanging knee to chest an raises 10 split squat jumps
> 3 Lat pull down 25 reps 5 rounds 35 sec rest between sets
> 25 bodyweight squats
> 4 Reverse grip lat pull down 20 reps 3 rounds 30 sec rest between sets
> 20 V Ups
> 5Standing high cable lat push downs 20 reps 4 rounds 25 sec rest between sets
> 6 Dumbbells push ups with lateral row 1 push up left arm row out back to center 1 push up
> right arm row out back to center = 1 full rep
> Do 4 total reps 4 sets
> 7 FINISHER  Ab Finisher 30 crunches 30 toe touches 15 oblique crunches each side 30
> Russian twists

#### Day 2: All Chest Day
- **Focus:** `chest`
- **Day ID:** `prog_deload_technique_refinement_day2`

> 1 Dumbbell incline press 5 sets 15 reps 30 sec rest between sets
> 50 bodyweight squats
> 2 Single arm flat dumbbell bench press 4 sets 12 reps each arm. (Notice which arm is
> having a harder time getting 12 reps and do a couple extra reps on the struggling side)
> 3 Cable chest flys from the cables low 3 sets 15 reps Low rest between sets
> Or if you dont have cables Side to side push ups https://youtu.be/CaTQLPxRSbs
> 4 Cable chest flys from neutral 3 sets 15 reps Low rest between sets
> If you dont have cables Leaning forward push ups https://youtu.be/BkTz2Vajx7o
> 5 Chest press machine https://youtu.be/n8TOta_pfr4 3 sets 30 reps Go slow and really go
> for full extension
> 6 2 rounds of push ups till failure min rest in between sets
> 7 FINSIHER  Abs hanging from a bar Crunches x100 Sit ups x50 Oblique side crunches
> x25 each side

#### Day 3: All Leg day
- **Focus:** `legs`
- **Day ID:** `prog_deload_technique_refinement_day3`

> 1 Barbell Front squat or Dumbbell Front Squat 4 sets 15 reps Go lighter
> 2 Reverse barbell lunge with front grip hold 3x10 each leg Min rest after both legs
> 3 Deadlift 4x12 Go decent wait nothing to heavy Min rest between sets
> 4 20 bodyweight squats 10 pull ups 10 hanging knee raises
> 5 Bodyweight Cannon Ball Squats 3x20 10 sec rest between sets
> 10 pulls ups
> 6 Fire hydrants 3x20 each side
> 7 Hamstring Good Mornings 3x20 https://youtu.be/a7Q_HO0Slmo
> 8 FINISHER  50 crunches Kettle bell single arm farmer carry good posture 4 rounds 10
> steps each arm

#### Day 4: All Arms Day
- **Focus:** `arms`
- **Day ID:** `prog_deload_technique_refinement_day4`

> 1 Barbell Bicep curls 5 rounds 12 reps Dropset after 5th set 6-8 reps lowering the weight
> after each set
> 2 Tricep skull crushers https://youtu.be/d_KZxkY_0cM 5 rounds 15 reps 45 second rest
> between sets
> 3 25 diamond push ups 10 burpees
> Superset these next exercises
> 4 Tricep rope pull downs 4 rounds 25 reps With Dumbbell hammer curls 4 rounds 8 reps
> (go HEAVY)
> 50 crunches
> 5 Seated incline bicep curls 4 rounds 25 reps With Standing Dummbell tricep extensions
> 6 For this exercise do 10 tricep dips then go straight into spider man push ups x6 reps each
> side https://youtu.be/EXI4iBZNop8
> for 3 rounds no rest
> 7 Finisher 1 Grab 15 lbs dumbbells do curls until u cant raise your arms just play two
> slaps on your phone and dont stop till both songs end.
> Then go to the tricep cable pull down and do single arm tricep extensions alternate
> every 20 reps till you cant get 20 anymore!! https://youtu.be/Zl46Cxc4DDs

---

### Program 14: Advanced Split Training
- **ID:** `prog_advanced_split_training`
- **Difficulty:** advanced
- **Days Per Week:** 4

#### Day 1: Chest & Tri workout
- **Focus:** `chest`
- **Day ID:** `prog_advanced_split_training_day1`

> 1 Cable chest flys Or Dumbbell Flat Bench Flys
> From high 2 sets From middle 2 sets From low 2 sets Total 6 sets by 15 reps
> 2 Tricep skull crushers 4x15
> back to back
> 3 Dumbbell flat bench press 5x12
> seconds rest after each set
> 4 Tricep dips 4x15 (Slow very slow) Weighted if you can
> 5 Tricep rope extensions 5x15 Go slow and really flex the triceps at the end of each rep
> 30 triangle push ups
> 6 Incline Chest press machine 4x15 Go quick tempo really focus on form and technique
> doing full reps
> 7 Push Up Combo 15 clap push ups 15 triangle push ups 15 wide hand push ups
> 8 FINISHER  Push ups till failure x2 Min rest in between 50 crunches

#### Day 2: Back + Biceps
- **Focus:** `back`
- **Day ID:** `prog_advanced_split_training_day2`

> 1 Lat pull down 5x15
> around 1 minute after completing both
> 2 Single Cable Back cable row 4x10
> 3 Single Arm Dumbbell back row 4x10 each arm  Superset Incline bench alternating
> bicep curls 5x10
> 4 Pull ups 3 sets by 6-10 reps Chin ups 1 set by 6-10 Min rest max
> 5 Hanging from a pull up bar knee raises 3 sets by 15 reps
> 6 FINISHER  Lying with your chest flat on incline bench back row go light with 20s 3
> sets 20 reps!!  Superset Bent over bicep concentration curls 3x12 each arm

#### Day 3: Leg day
- **Focus:** `legs`
- **Day ID:** `prog_advanced_split_training_day3`

> 1 Front squat 4 sets 15 reps 1 min rest between sets
> 2 Reverse dumbbell lunge 3x10 each leg 30 sec rest after both legs
> 3 Deadlift 4x10 1 min rest between sets Go heavier after each set
> 4 Cardio Combo  20 bodyweight squats 10 pull ups 10 hanging knee raises
> 5 Leg Press 3x20 10 sec rest between sets Go light max two plates
> 6 Leg Blaster  Abductor 3x20 Machines superset Adductor 3x20 Go all the way through
> no rest
> 7 Hamstring lying curls 3x20 Superset Quad extensions 3x20
> 8 FINISHER  50 crunches Kettle bell single arm farmer carry good posture 4 rounds 10
> steps each arm

#### Day 4: Shoulders
- **Focus:** `shoulders`
- **Day ID:** `prog_advanced_split_training_day4`

> 1 Lateral Shoulder Raises 4x15 each arm No rest go back and fourth switching arms
> 20 bodyweight squats
> 2 Forward Shoulder Raises 4x15 each arm No rest go back and fourth switching arms
> 3 Seated dumbbell shoulder side raises
> 20 18 15 12 10 Back to back all the way through no rest !
> 4 Standing Barbell Shoulder Press
> 10 Do exercises back to back then rest for 1 min
> 5 Dumbbell Front Shoulders Upright Row 4x15
> Raises 4x15 35 seconds rest between sets
> 6 Finisher  20 crunches 20 v ups 20 mountain climbers 20 bicycle crunches 20 Russian
> abdominal twists

---

### Program 15: Heavy Compound Emphasis
- **ID:** `prog_heavy_compound_emphasis`
- **Difficulty:** advanced
- **Days Per Week:** 4

#### Day 1: Heavy Chest Day
- **Focus:** `chest`
- **Day ID:** `prog_heavy_compound_emphasis_day1`

> 1 Barbell Bench Press 5x5-8 reps Minute rest between sets
> 2 Dumbbell incline bench press 5x6-8 reps Minute rest between sets
> 3 Bodyweight dips 3x20 Minute rest between sets
> 4 Dumbbell or Barbell Decline Press 4x12 30 seconds rest between sets
> 5 Peck Deck Machine Flys 3x15 20 sec rest between sets
> 6 Finisher  50 crunches 1 set of push ups till failure

#### Day 2: Heavy Legs
- **Focus:** `legs`
- **Day ID:** `prog_heavy_compound_emphasis_day2`

> 1 Barbell Back Squat Warm up set light Warm up set medium weight Working sets 4x5-8
> Minute rest between sets at least take more time if you need it
> 2 Barbell RDL 4x8 Go heavy for the hamstrings Minute rest between sets
> 3 Barbell Front Squat single leg step back lunges 4x8 each leg Minute and a half rest
> between sets
> 4 Cable lateral leg kicks (Put the cable to the lowest setting out your foot through one of the
> handles and do lateral leg kicks) 4x10 each leg No rest just switch legs that is in the cable
> 5 kettle bell single arm farmers carry 10 steps each arm 4 rounds each arm
> 6 Leg Extensions 20 18 15 12 10 - reps 10 seconds rest between sets
> 7 Finisher  Ab machine go heavy 50 reps 20 push ups 50 more reps 20 push ups

#### Day 3: Back + Triceps
- **Focus:** `back`
- **Day ID:** `prog_heavy_compound_emphasis_day3`

> 1 Lat Pull Down Warm up set 25 reps 4x8 5th set go light 25 reps 1 minute rest between
> sets
> 2 Tricep easy bar flat bench skull crushers Warm up set 25 reps just the bar 4x12 1 minute
> rest between sets
> 3 Cable neutral back row 4x10 1 minute rest between sets
> 4 Landmine back Rows 5x6-8 Go heavy Short rest 45 seconds
> 5 Tricep rope pull downs 5x8 6th set 25 reps Go heavy 40 - 1 min rest
> 6 Flat bench dumbbell pull over pops 4x8x8 8 pops 8 pull overs Is 1 set 1 minute rest
> between sets go heavy
> 7 Single cable one Arm Tricep extensions 3x15 Each arm no rest just keep switching sides
> 8 FINISHER  25 Russian twists 20 side oblique crunches each side 25 V Ups

#### Day 4: Shoulders + Biceps
- **Focus:** `shoulders`
- **Day ID:** `prog_heavy_compound_emphasis_day4`

> 1 Dumbbell front Shoulder raises 4 rounds 15 reps  Superset Preacher curls 4x20 30
> sec rest between sets
> 2 Straight bar upright row 4 rounds 12 reps
> till completed Same weight
> 3 Dumbbell Lateral shoulder raises 4 sets 20 reps  Superset Dumbbell hammer curls
> 4 sets 20 reps No rest till all 4 rounds are done (Go like 10 lb dumbbells for this)
> 4 Straight barbell shoulder raises 20 15 12 10 8 6 4 reps 20 sec rest between
> 5 Bent over dumbbell concentration curls one arm at a time 3x12 each arm No rest all the
> way through
> 6 Cable lateral shoulder raises 20 18 15 12 10 each arm No rest between sets
> 7 Cable bicep curls Tricep rope 2 sets of 50 reps Go light really squeeze the bicep muscles
> 50 crunches 50 toe touches 20 leg drops (1 leg at a time) 20 on each leg

---

### Program 16: Full Body Power Week
- **ID:** `prog_full_body_power_week`
- **Difficulty:** advanced
- **Days Per Week:** 4

#### Day 1: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_full_body_power_week_day1`

> 1 Deadlifts 2 warm up sets go heavier after each set 10-12 reps 3x5 go heavy
> 2 Barbell Bench Press Warm up set 20 reps go light 4x8 Go heavy
> 3 Lat Pull Downs Warm up set 25 reps 4x8 go heavy
> 4 Tricep Rope Extensions Warm up set 25 reps 4x8 to heavy
> 5 Barbell Bicep Curls 5x8 go heavy
> 6 Standing Shoulder Press 3x8 medium to heavy
> 7 FINISHER  100 crunches

#### Day 2: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_full_body_power_week_day2`

> 1 RDL Warm up set 15 reps Medium to heavy for next 4 sets 4x8 reps
> 2 Dumbbell Incline Bench Press Warm up set 25 reps 4x8 reps go heavy!
> 3 TBar Landmine Back Rows Warm up set 20 reps 4x8 go heavy!
> 4 Pull Over Pops 4x8x8 4 sets 8 pull overs 8 pops each set go heavy!
> 5 Tricep Dips 4x15 Minute rest between sets
> 6 Dumbbell Hammer Curls 4x8 go heavy
> 7 Lateral cable shoulder raises 3x15 each arm
> 8 FINISHER  100 v ups

#### Day 3: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_full_body_power_week_day3`

> 1 Front Squat Lunge Step Backs 4x10 each leg Medium to lighter weight
> 2 Seated Dumbbell Shoulder Press Warm up set 12 reps 4x8 reps Go heavy
> 3 Incline bench press chest on bench dumbbell back row 4x8 reps go heavy
> 4 Cable high chest flys 4x15 reps
> 5 Cable chest flys low 3x12 reps
> 6 Plate Bicep curls cross body 4x8 go heavy 25 lbs plates or 35lbs plates
> 7 Easy Bar Tricep skull crushers Warm up 25 reps 4x 8 go heavy
> 8 Finisher  100 Russian twists

#### Day 4: Full Body
- **Focus:** `full_body`
- **Day ID:** `prog_full_body_power_week_day4`

> 1 Seated Leg extensions 5x8 go heavy
> 2 Lying hamstring curl machine 5x12 Medium weight
> 3 Abductor machine 3x15 10 sec fest between sets
> 4 Adductor machine 3x15 10 sec rest between sets
> 5 Standing barbell Shoulder Press Warm up set 25 reps 4x8 reps go medium to heavy
> 6 Barbell Rack Pulls (these are like the top half of a deadlift)
> 7 Peck Deck Machine Flys Warm up set 25 reps 4x8 reps go medium to heavy
> 8 Single Cable One Arm Tricep extensions 4x8 each arm Go heavy
> 9 Tricep rope low cable Bicep Curls 4x8 go heavy
> FINISHER  50 oblique crunches Flip sides 50 oblique crunches other side

---

### Program 17: Metabolic Stress Training
- **ID:** `prog_metabolic_stress_training`
- **Difficulty:** advanced
- **Days Per Week:** 4

#### Day 1: Back + Chest
- **Focus:** `chest`
- **Day ID:** `prog_metabolic_stress_training_day1`

> Barbell Bench Press Warm up 4x8 Superset 8 pull up after each bench press set 1 min rest
> after you compete both
> Dumbbell Pull Over Pops 4x8x8 8 pull overs 8 pops Superset 12 Tricep dips knee in front
> close to your chest 1 min rest after you do both
> Lat Pull Downs Warm up set 25 reps 4x8 Min rest between sets
> Incline dumbbell Press 4x15
> TBar Landmine Back Rows 4x8
> Finisher 10 pull ups 10 hanging knee to chest 10 clap push ups 1 minute rest Repeat two
> more times

#### Day 2: Leg Day
- **Focus:** `legs`
- **Day ID:** `prog_metabolic_stress_training_day2`

> Barbell Back Squat Warm up set 12 reps Middle weight 10 reps Working sets 4x8 Minute
> -minute and a half rest
> Quad Extensions 20 18 15 12 10 10 seconds rest
> Barbell RDLs 4x15 1 minute rest between sets
> Low Cable lateral kicks 4x10 each leg
> Cable kick backs 4x10 each leg
> Abductor machine 20 18 15 12 10 10 sec rest between sets
> Adductor machine 20 18 15 12 10 10 sec rest between sets
> 100 crunches

#### Day 3: Arms + Abs
- **Focus:** `arms`
- **Day ID:** `prog_metabolic_stress_training_day3`

> Easy Bar Tricep Skull Crushers Warm up set 25 reps 4x8 Min rest between sets
> 25 crunches
> Preacher curl machine Warm up 25 reps 4x8 45 sec rest between sets
> 25 med ball Russian twists
> Dumbbell two arm Tricep flat bench extensions Superset Standing dumbbell Hammer Curls
> 4x8 for both No rest back and forth
> 50 crunches
> Tricep Rope Extensions 5x8 Go heavy 45 sec rest between sets
> 25 lb plate abdominal crunch pushes
> Tricep rope low cable Bicep Curls 4x8 Go heavy
> Tricep Dips 3x15 Superset Pull ups 3x8-10 Go back and forth no rest till you do all 3

#### Day 4: Shoulders
- **Focus:** `shoulders`
- **Day ID:** `prog_metabolic_stress_training_day4`

> Ab raises from pull up bar 3 rounds 12 reps
> 50 crunches 50 toe touches 20 leg drops (1 leg at a time) 20 on each leg
> Cable lateral shoulder raises 20 18 15 12 10 each arm No rest between sets
> Straight barbell shoulder raises 20 15 12 10 8 6 4 20 sec rest between
> Dumbbell Lateral shoulder raises 4 sets 20 reps Superset Dumbbell hammer shoulder
> raises 4 sets 20 reps No rest till all 4 rounds are done (Go like 10 lb dumbbells for this)
> Straight bar upright row 4 rounds 12 reps Superset Seated plate lateral shoulder raises 4
> rounds 12 reps No rest till completed
> Dumbbell front Shoulder raises 4 rounds 8 reps
> Peck deck reverse flys 3x30

---

### Program 18: Unilateral Focus Phase
- **ID:** `prog_unilateral_focus_phase`
- **Difficulty:** advanced
- **Days Per Week:** 4

#### Day 1: Day 1
- **Focus:** `full_body`
- **Day ID:** `prog_unilateral_focus_phase_day1`

> Full Body
> 1 Standing barbell Shoulder Press 4x15 medium to heavy weight
> 2 V Hugs 3x10 20 seconds rest between sets
> 3 Barbell Bicep Curls 4x15 lighter weight really squeeze the biceps
> 4 half burpee you forward lunge 3 sets of 5 reps each side
> 5 Tricep Rope Extensions Warm up set 25 reps 4x8 heavy
> 6 Lat Pull Downs Warm up set 25 reps 4x8 go heavy
> 7 Dumbbell Deadlifts 3x10 medium weight
> 8 Barbell Bench Press 4x20 go light perfect form really feel the chest filling with blood you
> should just be able to get 20 reps

#### Day 2: Day 2
- **Focus:** `full_body`
- **Day ID:** `prog_unilateral_focus_phase_day2`

> Full Body
> 1 Dumbbell Hammer Curls 4x15 medium weight
> 2 V opposite touches 3x10
> 3 Tricep Dips 4x15 Minute rest between sets Go slow pause for two seconds at the bottom
> 4 squat time high knee 3x10 each side 45 seconds rest between sets
> 5 Pull Over Pops 4x5x5 4 sets 5 pull overs 5 pops each set go heavy
> 6 Lateral cable shoulder raises 3x15 each arm  Superset Beast crunch 3 sets of 8 reps
> each side
> 7 TBar Landmine Back Rows 3x10 medium weight  Superset Barbell RDL 3x10 light
> weight good form and technique nice and slow
> 8 Dumbbell Incline Bench Press 4x15 light weight 35 seconds rest Fast and get pumped

#### Day 3: Day 3
- **Focus:** `full_body`
- **Day ID:** `prog_unilateral_focus_phase_day3`

> Full Body
> 1 Core Twists 3x15
> 2 Easy Bar Tricep skull crushers Warm up 25 reps 4x20 light weight
> 3 Plate Bicep curls cross body 4x8 go heavy 25 lbs plates or 35lbs plates
> 4 Cable chest flys two settings bellow middle 3x20 reps
> 5 Cable high chest flys 4x15 reps
> 6 Spider Man Push Ups 3x10 Reps 30 seconds rest between sets
> 7 Seated Dumbbell Shoulder Press Warm up set 20 reps 4x12 reps Medium to light weight
> Superset Forward lunge with Curtis lunge 3 sets of 8 reps each leg

#### Day 4: Day 4
- **Focus:** `full_body`
- **Day ID:** `prog_unilateral_focus_phase_day4`

> Full Body
> 1 Squats w 3 pulses 4 sets of 10 reps 1 min rest between sets
> 2 oblique crunches 50 reps Flip sides 50 oblique crunches other side
> 3 Single Cable One Arm Tricep extensions 4x12 each arm No rest just go back to back
> switching arms
> 4 Peck Deck Machine Chest Flys Warm up set 25 reps very light 4x20 reps  Superset
> Fire hydrants 4 sets of 10 reps each side
> 5 Barbell Rack Pulls (these are like the top half of a deadlift)
> 6 Standing barbell Shoulder Press Warm up set 25 reps 4x12 reps go light to medium
> weight, good base, good form  Superset V sit claps 4 sets of 12 reps each side
> 7 Lying hamstring curls machine Reps: 20 18 15 12 10 10 sec rest between sets

---

### Program 19: Plateau Breaker Protocol
- **ID:** `prog_plateau_breaker_protocol`
- **Difficulty:** advanced
- **Days Per Week:** 4

#### Day 1: Day 1
- **Focus:** `full_body`
- **Day ID:** `prog_plateau_breaker_protocol_day1`

> Full Body
> 1 Seated cable back row Warm up 20 reps 4x8 Finish 25 reps very light
> 2 Squat w 3 Pulses 4 sets of 10 reps
> Superset Standing Hammer Curl Twist Biceps Curls 4 sets of 10 reps Go up in weight
> after each set 45-1 min rest between sets
> 3 Dumbbell Flat Bench Press Warm up 25 reps 3 sets of 10 reps Finish 20 reps light
> Superset Straight V Touches 3 sets of 10 reps
> 4 Tricep Rope Extensions Warm up 25 reps 4 sets of 15 reps https://youtu.be/kt9qfp4uH-4
> Superset Single Leg Mini Crunch 4 sets of 5 FULL reps A full rep is 1 kick out and 3
> mini crunches on each side 1 min rest after completing 1 superset
> 5 Standing Calf Raises 4x20 full extension each leg
> 6 Standing Dumbbell Shoulder 90 degree 4 sets of 12 reps 5th set go light 25 reps
> tight throughout these

#### Day 2: Day 2
- **Focus:** `full_body`
- **Day ID:** `prog_plateau_breaker_protocol_day2`

> Full Body
> 1 Half Burpee to Forward Lunge 4 sets of 5 reps each leg 1 min rest between sets
> 2 Cable Chest Flys from High Warm up 25 reps 4x15 Final set 25 reps
> Superset Cross Leg Crunch 4 sets of 10 full reps 1 min rest after completing superset
> 3 Dumbbell Front Shoulder Raises *one at a time 4x12 each arm Go heavy 5th set 30 reps
> each arm go very light  Superset Banded Squat Hold Pulses 4 sets of 15 reps 1 min
> rest after each set
> 4 High Cable Bent Over Back Pull Downs Warm up 25 reps 4x12 30 seconds rest between
> sets
> 5 Barbell Bicep Curls Warm up 25 reps 4x10  Superset Single arm dumbbell Farmers
> carry 10 steps each arm 4 sets total
> 6 High Cable Straight bar Tricep Rope Extensions 4x20
> Superset Stretch Crunches 4x20 No rest back to back till done all the way through

#### Day 3: Day 3
- **Focus:** `full_body`
- **Day ID:** `prog_plateau_breaker_protocol_day3`

> Full Body
> 1 Good Mornings 20 18 15 12 10 10 seconds rest between sets
> 2 Dumbbell Incline Bench Press Warm up 25 reps 4x12
> 3 Hammer Bicep Curls *one arm at a time 4x12
> 12 reps 1 tap each side = 1 full reps
> 4 Dumbbell Step Back Lunge 4x10 each leg
> 5 Lying Flat Bench Dumbbell Tricep Extensions 4x15  Superset Push Up Plank Taps 4
> sets of 8 reps
> 6 Reverse Grip Lat Pull Downs Warm up 25 reps 4 sets of 8 reps Go Heavy!
> Superset Ab Leg Pull Ins 4 sets of 8 full reps
> 7 Seated Lateral Shoulder Raises 4 sets of 20 reps
> of 10 reps No rest straight through GET AFTER it!

#### Day 4: Day 4
- **Focus:** `full_body`
- **Day ID:** `prog_plateau_breaker_protocol_day4`

> Full Body
> 1 Banded Cannon Ball Squats 5 sets of 20 reps 30 seconds rest between sets Go fast!
> 2 Rack Pulls or bent over barbell back row 4 sets of 10 reps
> Superset 4 sets of 25 jumping Jacks
> 3 Single Leg Alternating Push Up 4 sets of 8 reps each side 45 seconds rest between sets
> 4 Kick Sit Burpees 4 sets of 8 reps each side
> Superset Barbell Standing Shoulder Press 4 sets of 8 reps 1 min test between sets
> 5 Low Cable Chest Flys 3 sets of 15 reps
> 6 Single Arm Tricep Extensions 4x15 each arm
> 7 Seated Dumbbell Bicep Curls Watch full video 4 sets of 8 FULL reps 45 seconds rest
> between sets

---

### Program 20: Pre-Competition Peak
- **ID:** `prog_pre_competition_peak`
- **Difficulty:** advanced
- **Days Per Week:** 4

#### Day 1: Day 1
- **Focus:** `full_body`
- **Day ID:** `prog_pre_competition_peak_day1`

> Full Body
> 1 Squat to Kick Outs 4x10 each leg Fast 30 seconds rest between sets
> 2 Seated Dumbbell Shoulder Press Warm up set 12 reps 4x8 reps Go heavy
> SUPERSET Jumping Jacks 4x15
> 3 Incline bench press chest on bench dumbbell back row 4x8 reps go heavy  Superset
> Bear Crawls 3 steps forward 3 step back = 1 Rep 4 sets of 4 reps 1 min rest after completing
> both
> 4 Cable high chest flys 4x15 reps  SUPERSET Diver Push Ups 4x8 reps
> 5 Cable chest flys low 3x12 reps
> 6 Single Leg Lowering 3 sets of 10 reps each side No rest all back to back all the way
> through just switch sides
> 6 Plate Bicep curls cross body *dont twist on these see video just come across 4x8 go heavy
> 25 lbs plates or 35lbs plates
> 7 Easy Bar Tricep skull crushers Warm up 25 reps 4x 8 go heavy
> FINISHER Crunch Holds Side to Side 3x10 each side

#### Day 2: Day 2
- **Focus:** `full_body`
- **Day ID:** `prog_pre_competition_peak_day2`

> Full Body
> 1 RDL Warm up set 15 reps Medium to heavy for next 4 sets 4x8 reps
> 2 Jump Lunge w Bounce 4 sets of 8 total reps 35 seconds rest between sets
> 3 Dumbbell Incline Bench Press Warm up set 25 reps 4x8 reps go heavy!
> 4 TBar Landmine Back Rows Warm up set 20 reps 4x8 go heavy!
> 5 Pull Over Pops 4x8x8 4 sets 8 pull overs 8 pops each set go heavy!
> 6 Tricep Dips 4x15  SUPERSET Steam Engines 4x15 No rest all back to back until all 4
> sets of each are done
> 7 Dumbbell Hammer Curls 4x8 go heavy
> 8 Lateral cable shoulder raises 3x15 each arm
> FINISHER 30 Straight V Touches

#### Day 3: Day 3
- **Focus:** `full_body`
- **Day ID:** `prog_pre_competition_peak_day3`

> Full Body
> 1 Squat to High Knee 5x10 each side 1 min rest between sets
> 2 Lying hamstring curl machine 4x12 Medium weight Or Body weight good mornings 4x12
> 3 Abductor machine 3x15 10 sec fest between sets
> 4 Adductor machine 3x15 10 sec rest between sets
> 5 Standing barbell Shoulder Press Warm up set 25 reps 4x8 reps go medium to heavy
> 6Barbell Rack Pulls 4x8 go heavy
> 7 Push Up Combo Up right and left down right and left= 1Rep 4 sets of 3 full reps 45 second
> rest between sets
> 8 Single Cable One Arm Tricep extensions 4x15 each arm
> heavy NO REST BACK TO BACK TILL DONE

#### Day 4: Day 4
- **Focus:** `full_body`
- **Day ID:** `prog_pre_competition_peak_day4`

> Full Body
> 1 Dumbbell Deadlifts 4 sets 25 reps 45 seconds rest between sets
> 2 Barbell Bench Press Warm up set 20 reps go light 4x8 Go heavy
> 3 Lat Pull Downs Warm up set 25 reps 4x8 go heavy
> 4 Tricep Rope Extensions Warm up set 25 reps 4x8 to heavy
> 5 Barbell Bicep Curls 5x8 go heavy
> 6 Plank Taps 4 sets of 12 reps 1 tap left 1 tap right = 1 full Rep
> ABS FINISHER
> 25 reps each side oblique crunch
> Side Crunch 10 reps each side
> Leg Pull In 20 reps each side

---

### Program 21: Ultimate Intensity Finisher
- **ID:** `prog_ultimate_intensity_finisher`
- **Difficulty:** advanced
- **Days Per Week:** 4

#### Day 1: Day 1
- **Focus:** `full_body`
- **Day ID:** `prog_ultimate_intensity_finisher_day1`

> Chest
> 1 Dumbbell Flat Bench Press Warm up 20 reps 12 10 8 8 20 reps for working sets After
> each set 20 knee taps in place https://youtu.be/dVYrzc22gEY 45 sec -1 min rest
> 2 Dumbbell Incline Bench Press Warm up 25 reps 20 15 12 10 20 reps for working sets
> calf raise 10 rep each leg after every set 45-1 min rest between sets
> 3 High Cable Chest Flys 10 reps left leg in front 10 reps right leg in front 4 rounds
> Steal Engines 4 sets of 15 reps
> 4 Mid Cable Chest Flys 10 reps left leg in front 10 reps right leg in front 4 rounds 20 second
> rest between sets fast tempo
> 5 Single Alternating Push Up 4 sets of 8 reps each side 30 Seconds
> FINISHER
> 20 reps straight v touches
> 20 leg lifts twists
> 20 reverse crunch
> 20 V Sit Claps

#### Day 2: Day 2
- **Focus:** `full_body`
- **Day ID:** `prog_ultimate_intensity_finisher_day2`

> All legs
> 1 Banded Cannon Ball Squats 4 sets of 25 reps 30 seconds rest between sets
> 2 Dumbbell Dead Lifts 4 sets of 25 reps 30 seconds rest between sets
> 3 See-Saw Lunges 4 sets of 8 reps each side 30 seconds rest between sets
> 4 Banded Squat Hold Taps 4 sets of 15 reps each side 45 seconds rest between sets
> 5 Walking Gorillas 4 sets of 10 reps
> ALL BACK TO BACK NO REST 4 sets straight
> 6 Standing Alternating Leg Kicks 4 sets of 12 reps each side No rest all back to back with no
> rest
> 7 FINISHER  Forward lung with Courtesy Lunge 2 sets of 8 reps each side 30 seconds
> rest between sets

#### Day 3: Day 3
- **Focus:** `full_body`
- **Day ID:** `prog_ultimate_intensity_finisher_day3`

> Back + Biceps
> 1 Lat Pull Down 30 reps real light get the blood flowing 25 20 15 12 10 8 5 going heavier
> after each set, good fast pace max 35 sec rest between sets really squeeze at bottom
> 2 Barbell Bicep Curls 7 mid 7 top 7 full reps with just the bar warm up 10 8 6 working sets
> go heavier after each set 25 full reps just the bar to finish
> 3 Mid Back Single Cable Seated Single Arm Back Row 5x10
> sets 7 FULL reps watch video below to see what 1 full rep looks like
> 4 Barbell bent over back rows 4x15  Superset Heavy Dumbbell Hammer Curls 4x6-8
> 5 Pull Ups 4 sets of 10 reps Change grips every time Wide, reverse, narrow, side to side
> 6 Hanging from pull up bar abs 1 set of 12 reps of each exercise

#### Day 4: Day 4
- **Focus:** `full_body`
- **Day ID:** `prog_ultimate_intensity_finisher_day4`

> Shoulders + Triceps
> 1 Standing Dumbbell Shoulder Press 4 sets of 25 reps 30 seconds rest between each set
> 2 Standing one arm Dumbbell Over head tricep extension 4 sets of 10 reps each side No rest
> back to back switching sides
> 3 Tall Kneeling Dumbbell Shoulder Press 4 sets of 12 reps each arm 35 seconds rest
> between sets
> slow!!
> 4 Tall Kneeling Single Arm Dumbbell Row 4 sets of 10 reps each side No rest go back to
> back switching sides
> 5 Tricep Rope Extensions 4 sets of 25 reps 15 seconds rest Between sets
> 6 FINISHER  Cross Crunch 25 reps each side
> Oblique Crunch 25 reps each side
> Ab tuck complex 12 reps
> Plank Dips 12 reps each side

---
