# Step 6: Exercise Library, Detail, Create Exercise, and Programs Flow Audit

**Files:**
- `apps/mobile/app/workout/exercises.tsx` (261 lines) -- Exercise Library browser
- `apps/mobile/app/workout/[exerciseId].tsx` (341 lines) -- Exercise Detail
- `apps/mobile/app/workout/create-exercise.tsx` (262 lines) -- Custom exercise creator
- `apps/mobile/app/workout/programs/index.tsx` (182 lines) -- Programs list
- `apps/mobile/app/workout/programs/[id].tsx` (429 lines) -- Program detail
- `apps/mobile/app/workout/programs/create.tsx` (406 lines) -- Program creator

---

## A. Exercise Library (`exercises.tsx`)

### What Works
- **FlatList** for performance with large exercise databases
- **Search bar** with 44px min-height, clear button, and placeholder
- **Two filter rows** -- muscle group chips (horizontal scroll) and equipment chips (horizontal scroll)
- **Exercise cards** show illustration, name, primary muscles, "Custom" badge, and chevron
- **Empty state** with contextual message and "Clear Filters" action
- Toggle filter behavior (tap to select, tap again to deselect)

### What Needs to Change

| Issue | Severity | Detail |
|-------|----------|--------|
| No result count | MEDIUM | User doesn't know how many exercises match their filters. Add "24 exercises" count above the list. |
| Filter chips have small touch targets | MEDIUM | `paddingVertical: 6` (line 230) = ~26px effective height. Below 44pt minimum. Should increase to `paddingVertical: 10` minimum. |
| No "Recently Used" or "Favorites" section | HIGH | The library shows all exercises alphabetically. Users typically use 15-20 exercises regularly. Should have a "Recent" section at the top when no search/filter is active. Hevy/Strong both show recently used exercises first. |
| No exercise count per category | LOW | Category chips show the label but not how many exercises are in each category. Adding "(24)" after "Chest" helps the user decide which filter to use. |
| Equipment icons from `EQUIPMENT_ICONS` are imported but unused | LOW | Line 17 imports `EQUIPMENT_ICONS` but the filter chips use only text labels. |
| "Add to Workout" not available from list | MEDIUM | Users must drill into detail to add an exercise. For returning users who know the exercise, a long-press or swipe-to-add from the list would be faster. |
| No muscle group illustrations | LOW | Category filter is text-only. Small muscle group icons would help users find the right category faster. |

---

## B. Exercise Detail (`[exerciseId].tsx`)

### What Works
- **Rich detail layout**: illustration, metadata badges, muscle chips (primary + secondary), numbered instructions, PR records (3 types), recent session history, YouTube tutorial link
- **"Add to Workout" FAB** -- only appears when a workout is active, with proper dismiss navigation (`router.dismiss(2)`)
- **PR records** show heaviest weight, best volume, and most reps -- excellent data
- **Recent sessions** display with set chips (weight x reps) and PR highlighting
- **YouTube tutorial** with branded red icon

### What Needs to Change

| Issue | Severity | Detail |
|-------|----------|--------|
| Unit is hardcoded to "lbs" | HIGH | Line 29: `const unit = 'lbs'; // TODO: from user prefs`. This is a known TODO. Must use `profile.unitPreference`. |
| No edit option for custom exercises | MEDIUM | Custom exercises display a "Custom" badge but there's no way to edit name, muscles, or instructions after creation. |
| Muscle chips use raw muscle names | LOW | Primary muscles display raw values (e.g., "chest" not "Chest"). Should capitalize or use `MUSCLE_GROUP_LABELS`. |
| No progress chart | MEDIUM | The detail shows recent sessions as set chips but no visual progression chart (weight over time, volume over time). This is a major differentiator opportunity -- Hevy and Strong show per-exercise progression charts. |
| No "Start Workout with This Exercise" | LOW | If no workout is active, the only CTA is the YouTube link. Could offer "Quick Start with [Exercise Name]" to start an empty workout pre-loaded with this exercise. |
| Recent history shows only 5 sessions | LOW | Hardcoded `getExerciseHistory(exerciseId, history, 5)`. Should have a "See All" option for users who want to review more history. |
| PR records section not tappable | LOW | PRs show the record but don't link to the specific session where the PR was set. |

---

## C. Create Exercise (`create-exercise.tsx`)

### What Works
- Clean form with: name (required), category selector, equipment selector, primary muscles (comma-separated), secondary muscles (comma-separated), instructions (one per line)
- `keyboardShouldPersistTaps="handled"` -- keyboard stays up when tapping chips
- Modal presentation (header has close X icon)
- Input min-height 48px -- good touch target

### What Needs to Change

| Issue | Severity | Detail |
|-------|----------|--------|
| Primary/secondary muscles use free-text comma input | HIGH | Users must type muscle names as comma-separated text. This is error-prone and doesn't enforce consistency with the predefined muscle groups. Should use selectable chips (same as category/equipment) drawn from the muscle group list. |
| No duplicate name check | MEDIUM | User can create an exercise with the same name as an existing one. Should warn or prevent. |
| No success feedback | MEDIUM | After saving, `router.back()` is called immediately. No toast, haptic, or animation confirms the exercise was created. |
| Instructions textarea is small | LOW | 120px min-height for instructions. For exercises with detailed steps, this feels cramped. Consider auto-expanding textarea. |
| No preview before save | LOW | User can't see what the exercise card will look like before saving. |
| No "Bodyweight" or "Timed" toggle | MEDIUM | The form doesn't let the user specify if the exercise is bodyweight-only or timed. These flags affect set logging behavior. |
| No default sets/reps/rest configuration | LOW | The create form doesn't allow setting default sets, reps, or rest time. These values affect how the exercise appears when added to a workout or program. |
| Category and equipment default to chest/barbell | LOW | New exercises default to `chest` and `barbell`. If the user is creating a bodyweight core exercise, they must change both. |

---

## D. Programs List (`programs/index.tsx`)

### What Works
- Active program highlighted with 2px primary border and "Active" badge
- AI-generated programs marked with "AI" badge
- Day type breakdown shows colored icons for schedule visualization
- Stats row: days/week, difficulty level, schedule dots
- Empty state with CTA to create first program
- Program count in header

### What Needs to Change

| Issue | Severity | Detail |
|-------|----------|--------|
| No program duplication | MEDIUM | Users can't clone an existing program to modify it. "Duplicate" is a common action (clone PPL and modify for different equipment). |
| No sorting or filtering | LOW | Programs render in creation order. Should offer sorting by name, difficulty, or frequency. |
| No search for users with many programs | LOW | If a user has 10+ programs, finding the right one requires scrolling. |
| "Create" button (add-circle icon) has no text label | LOW | Only an icon in the header. Users may not recognize it as "create new program." |

---

## E. Program Detail (`programs/[id].tsx`)

### What Works
- **Day-type-aware rendering** -- lifting, cardio, rest, mobility, and active_recovery days each render with distinct icons, colors, and content (exercises for lifting, cardio suggestions for cardio, recovery notes for rest)
- **Left border color accent** per day type -- clean visual differentiation
- **"Start" button per lifting day** with active workout check
- **"Switch to This Program"** with confirmation dialog (on both web and native)
- **Delete with confirmation** via trash icon in header
- **AI Generated badge** for programs created by AI coach
- **Active program banner** with checkmark when viewing the current program

### What Needs to Change

| Issue | Severity | Detail |
|-------|----------|--------|
| No "Edit Program" option | HIGH | Programs can be viewed and deleted but not edited. Users who want to change exercises, reps, or day names must delete and recreate. This is a significant friction point. |
| Only lifting days have a "Start" button | MEDIUM | Cardio, mobility, and active recovery days have no launch action. Cardio days could start a cardio tracking session; mobility days could open a timer-based flow. |
| No "Today" indicator | MEDIUM | When viewing the full program schedule, there's no indication of which day is "today" in the weekly rotation. Should highlight or mark the current day. |
| Exercise list is not interactive | LOW | Exercise rows in a day show name and sets x reps but aren't tappable. Tapping should navigate to exercise detail. |
| No reorder/drag for days | LOW | Day order is fixed. Users might want to swap Day 3 and Day 4. |
| No program completion/progress tracking | LOW | The detail doesn't show how far the user has progressed through the program. The workout tab shows this, but the program detail screen doesn't. |
| Delete icon in header with no label | LOW | Trash icon alone in the header. Could be confused with "clear" or "archive." Should add an overflow menu (edit, duplicate, delete). |

---

## Cross-Cutting Issues

### Accessibility

| Screen | Issue |
|--------|-------|
| All screens | No `accessibilityLabel` on any filter chip, exercise card, program card, or action button |
| Exercise Library | FlatList items have no `accessibilityRole="button"` |
| Exercise Detail | PR records convey information through icon color alone |
| Create Exercise | Form fields have labels above inputs but no `accessibilityLabel` linking them |
| Program Detail | Day type is communicated through color (left border) with no text alternative |

### Navigation Consistency

| Issue | Detail |
|-------|--------|
| Back button styles vary | Exercise library uses `arrow-back`, create exercise uses `close`, program detail uses `arrow-back`. Consistent for the modal/stack pattern, but worth documenting. |
| "Add to Workout" flow | From exercise detail, `router.dismiss(2)` pops back 2 screens. This works when coming from active workout -> exercises -> detail, but may break if accessed via a different route. |

### Missing Feature: Exercise Templates

Currently there's no concept of exercise templates or saved workout templates separate from programs. Users must either:
1. Start an empty workout and add exercises one by one
2. Create a multi-day program just to have a single template

**Recommendation:** Add "Workout Templates" as a concept between individual exercises and full programs. A template is a named list of exercises with sets/reps that can be started as a one-off workout.

---

## Prioritized Recommendations

### P0 -- Must Fix

1. **Fix hardcoded "lbs" unit** in exercise detail (`TODO` on line 29)
2. **Add edit capability for programs** -- currently create-only with delete
3. **Add bodyweight/timed toggles** to create exercise form

### P1 -- High Impact

4. **Add "Recently Used" section** to exercise library (show top 10 recent exercises before full list)
5. **Replace free-text muscle input** with selectable chips in create exercise
6. **Add per-exercise progression chart** to exercise detail
7. **Add edit capability for custom exercises**
8. **Increase filter chip touch targets** to 44pt minimum
9. **Add result count** to exercise library

### P2 -- Polish

10. **Add "Duplicate Program"** to program detail
11. **Add "Today" indicator** in program detail's day list
12. **Make exercise rows tappable** in program detail (navigate to exercise detail)
13. **Add exercise count** per category in filter chips
14. **Add "Quick Start with Exercise"** CTA when no workout is active
15. **Add success toast/haptic** on exercise creation
16. **Add "See All History"** to exercise detail

### P3 -- Nice to Have

17. **Add program sorting/filtering** in programs list
18. **Add workout templates** as a new concept
19. **Add long-press to add exercise** from library list
20. **Add "Start" buttons** to cardio and mobility days in program detail
21. **Show program progress** in program detail screen

---

*Step 6 complete. Proceeding to Step 7: Nutrition Tab Audit.*
