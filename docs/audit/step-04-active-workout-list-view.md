# Step 4: Active Workout Screen Audit -- List View

**File:** `apps/mobile/app/workout/active.tsx` (2824 lines)
**Scope:** List (full) view mode, including SetRow, BodyweightSetRow, TimedSetRow, ExerciseCard, ExerciseReplacementModal, SupersetSelectionModal, top bar, stats bar, bottom nav, and add exercise flow.

---

## Executive Summary

This is the **most critical screen in the entire app** -- the screen where users spend 90% of their workout time. At 2824 lines, it is also the largest single file in the codebase.

The good news: the screen is **functionally very rich**. It has pre-fill from suggestion engine, auto-start rest timer on set completion, superset/tri-set grouping, exercise reorder mode, warmup/cooldown suggestions, per-exercise rest time editing, exercise replacement with smart suggestions, overflow menu with YouTube form videos, a focus view toggle, and in-workout AI coaching. This feature set is competitive with or exceeds Hevy/Strong.

The bad news: **the implementation is a 2824-line monolith** that combines 8 components, 3 modals, and the main screen in a single file. The UX also has specific friction points that hurt set logging speed -- the primary metric for a workout app.

---

## Component-by-Component Assessment

### 1. SetRow (Lines 253-511)

**What works:**
- Pre-fill inputs with suggested weight/reps -- this addresses the #1 competitive gap identified in Step 1
- +5/-5 weight and +1/-1 rep steppers are 44x44px -- meets touch target minimum
- Numeric inputs use `selectTextOnFocus` -- tap-to-replace is efficient
- Green flash animation on set completion -- satisfying feedback
- PR trophy bounce animation with haptic -- delightful
- Set type labels (W/D/F) with color-coding for warmup/drop/failure sets
- Completed sets show green background with gold for PRs -- clear visual state

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Input fields start empty if no suggestion | HIGH | When `suggestion` is null (new exercise, no history), weight/reps inputs show placeholder text ("lbs" / "reps"). The user has to type from scratch. Should pre-fill with the target reps from the program at minimum. |
| No "PREVIOUS" column | HIGH | Hevy/Strong show previous session's exact weight x reps inline on each set row. FormIQ shows `lastPerf` as a single text line above all sets ("Last: 80 lbs x 8"). Each individual set row should show what the user did last time for that specific set number. |
| Remove set button is 28x28px | MEDIUM | `removeBtn: { width: 28, height: 28 }` (line 2603) -- below 44pt minimum. Combined with `hitSlop: 8` = effective 44px, but the visual target is small and easy to miss. |
| Weight stepper increment is fixed at 5 | MEDIUM | `-5` / `+5` is correct for barbell lifts but wrong for dumbbell work (should be 2.5) or cable machines (variable). Should be configurable per exercise or per equipment type. |
| No RPE visual in set row | LOW | `onRPE` callback exists but the set row has no UI to view or set RPE. The callback is wired but never triggered from the set row UI. |
| Checkmark button disabled after completion | LOW | Once completed, the checkmark can't be un-done. Users who accidentally tap the check need to be able to undo. Hevy allows tapping a completed set to uncomplete it. |

---

### 2. BodyweightSetRow (Lines 513-699)

**What works:**
- Identical animation treatment (flash, scale, PR bounce) as SetRow -- consistent
- Weight is locked to 0 for bodyweight exercises, only reps are editable
- Same +1/-1 stepper pattern

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No "added weight" option | MEDIUM | For weighted bodyweight exercises (dips with belt, weighted pull-ups), there's no way to log additional weight. Need an optional weight input that appears when the user wants to add load. |
| Significant code duplication | LOW | BodyweightSetRow duplicates ~80% of SetRow's logic (animations, state, completion handler). Should be a single SetRow with a `isBodyweight` prop. |

---

### 3. TimedSetRow (Lines 54-251)

**What works:**
- Countdown timer with start/pause/reset controls
- Duration preset chips (30, 45, 60, 90, 120s) for quick selection
- Auto-complete with haptic when timer reaches 0
- Manual "Done" option for when user doesn't want to use timer

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Timer doesn't survive screen navigation | HIGH | `setInterval` is in component state. If user navigates away and returns, the timer resets. Should persist timer state in the workout store. |
| No visual countdown indicator | MEDIUM | Only a text display. Should have a circular progress ring or animated progress bar showing time remaining. |
| Timer controls too small | MEDIUM | `timerBtn` has `paddingHorizontal: 14, paddingVertical: 8` (line 2701-2706). Effective height is ~30px, below 44pt minimum. |
| No background timer notification | LOW | Timer only works while the screen is visible. Should trigger local notification when timer completes if app is backgrounded. |

---

### 4. ExerciseCard (Lines 887-1406)

**What works:**
- Exercise illustration (small size) gives visual context
- Last performance text shows previous session data
- Suggestion banner is tappable to auto-fill all incomplete sets -- excellent UX
- Suggestion confidence-based coloring (green for high, cyan for normal)
- Per-exercise rest time editor with preset chips + custom input
- Overflow menu cleanly organizes secondary actions (swap, YouTube, superset, delete)
- Superset bar (left edge color indicator, blue for superset, purple for tri-set)
- Reorder mode with up/down arrows
- Different set table layouts for weighted, bodyweight, and timed exercises
- "Add Set" and "Add Warmup" buttons below the set table

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Card is extremely tall | HIGH | A single exercise card includes: illustration + name + rest time + last perf + suggestion banner + set header + N set rows + add set buttons. For a 4-set exercise, the card is ~400px tall. With 5-6 exercises, the list view becomes a very long scroll. |
| Overflow button is 36x36px | MEDIUM | `overflowBtn: { width: 36, height: 36 }` (line 2588-2593) -- below 44pt. |
| No collapsed/expanded state | MEDIUM | All exercise cards are fully expanded always. Completed exercises should auto-collapse to show just the name + summary, saving scroll real estate for the current exercise. |
| Set header columns misaligned with input fields | LOW | The SET/WEIGHT/REPS column headers use fixed widths (28px for SET, flex for WEIGHT/REPS) but the input groups below include +/- steppers that shift alignment. |
| Pre-fill `useEffect` runs on suggestion change, not mount | LOW | Line 967-975: `useEffect` depends on `suggestion?.suggestedWeight, suggestion?.suggestedReps` -- if the suggestion changes mid-workout (shouldn't happen but could), all sets re-fill. |
| Suggestion banner takes vertical space even when already applied | LOW | After tapping the suggestion, the banner remains visible. Should collapse or show "Applied" state. |
| Overflow menu is inline, not a popover | LOW | Menu renders inside the card, pushing content down. A proper popover/dropdown positioned absolutely would be less disruptive. |

---

### 5. ExerciseReplacementModal (Lines 701-785)

**What works:**
- Smart replacement groups from `getSuggestedReplacements` -- shows exercises targeting same muscles with same equipment first
- Clean list with equipment + muscle labels
- Swap icon on each item

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No search/filter | MEDIUM | If the user wants a specific replacement, they must scroll through groups. Should have a search bar. |
| No indication of why replacements are suggested | LOW | Each group has a label but no explanation of the matching criteria. |

---

### 6. SupersetSelectionModal (Lines 787-885)

**What works:**
- Clear selection UI with checkmark icons
- Max 2 additional (3 total) enforced
- Label updates dynamically (Superset vs. Tri-Set)

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No visual grouping preview | LOW | After selection, user can't preview how the superset will look/flow before confirming. |

---

### 7. Top Bar (Lines 1998-2026)

**What works:**
- Workout name centered with timer below
- Minimize (chevron down) and Finish (green button) on left/right
- `Pressable` with long-press for Discard -- clever hidden feature
- `accessibilityRole` and `accessibilityLabel` on minimize button -- the ONE accessibility label in the entire app

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Long-press discard is undiscoverable | HIGH | The only way to discard is a long-press on the minimize button. No user will discover this. The Workout Tab's active session card has a visible "Discard" link -- but the active workout screen itself doesn't. Should add discard to an overflow menu or show it as a text button. |
| Timer doesn't show total elapsed prominently | MEDIUM | Timer text is `labelSmall` (12px). During an hour-long workout, users want to see the elapsed time clearly. Should be at least `label` (14px) or `h3` (18px). |
| Finish button is small | LOW | `paddingHorizontal: 16, paddingVertical: 8` (line 2503-2506). About 32px tall. Could be taller for such an important action. |

---

### 8. Stats Bar (Lines 2028-2136)

**What works:**
- Shows Sets, Volume, Exercises count in a row
- Inline rest time editor (tap to edit, type custom value)
- Reorder toggle button
- View mode toggle (Full/Focus)

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Stats bar is overloaded | HIGH | 6+ items in a single horizontal row: Sets, Volume, Exercises, Rest time, Reorder toggle, View toggle. On smaller phones (iPhone SE, ~320pt width) this will overflow or become unreadable. |
| "Reorder" and view toggle have tiny touch targets | MEDIUM | Both use `paddingHorizontal: 8, paddingVertical: 4` (lines 2512-2517, 2721-2726). Effective height ~22px. Well below 44pt. |
| Volume shows "lbs" hardcoded | LOW | Line 2034: `Volume: {totalVolume.toLocaleString()} lbs`. Should use the user's unit preference (kg/lbs). |

---

### 9. Bottom Navigation Bar (Lines 2296-2364)

**What works:**
- Previous/Next exercise navigation with disabled state
- Exercise position indicator (e.g., "3 / 6")
- Navigation buttons have proper padding and clear disabled styling

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Nav buttons don't indicate exercise names | MEDIUM | "Previous" / "Next" don't show which exercise is previous/next. Should show truncated exercise name: "< Bench Press" / "Rows >" |
| No swipe gesture | MEDIUM | Users should be able to swipe left/right to navigate between exercises, especially in list view. |
| Fixed bottom bar reduces content area | LOW | The bottom bar + stats bar together take ~100px of vertical space. On smaller phones this significantly reduces the scrollable area for exercise cards. |

---

### 10. Warmup/Cooldown Suggestion Cards (Lines 2146-2268)

**What works:**
- Warmup suggested at workout start, cooldown at finish -- intelligent timing
- Context-aware descriptions based on workout focus (upper body, lower body, etc.)
- Clear Accept/Skip options
- Cooldown appears as a modal when finishing, giving users a second chance

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Warmup card disappears permanently after dismiss | LOW | If user skips warmup at start but changes mind later, there's no way to get it back. |
| Cooldown card at bottom of scroll is easy to miss | LOW | Placed after all exercise cards, may not be visible. |

---

## Cross-Cutting Issues

### A. File Size and Architecture

| Issue | Severity | Detail |
|-------|----------|--------|
| 2824-line single file | CRITICAL | Contains 8 components, 3 modals, and the main screen. This is unmaintainable. |

**Recommended decomposition:**

```
app/workout/active.tsx                    -- ~200 lines (orchestrator)
  components/workout/SetRow.tsx            -- unified for weight/bodyweight/timed
  components/workout/ExerciseCard.tsx       -- card with set table
  components/workout/TopBar.tsx            -- timer, minimize, finish
  components/workout/StatsBar.tsx          -- stats, reorder, view toggle
  components/workout/BottomNav.tsx         -- prev/next exercise
  components/workout/RestTimerOverlay.tsx   -- rest timer modal
  components/workout/WorkoutSummary.tsx    -- completion modal
  components/workout/ExerciseReplacement.tsx -- swap modal
  components/workout/SupersetSelection.tsx -- superset creation modal
  components/workout/WarmupCard.tsx        -- warmup suggestion
  components/workout/CooldownCard.tsx      -- cooldown suggestion
```

### B. Accessibility

| Issue | Severity |
|-------|----------|
| Only 1 accessibility label in the entire 2824-line file (minimize button) | CRITICAL |
| Weight/reps inputs have no `accessibilityLabel` ("Weight input for set 2") | CRITICAL |
| +5/-5 and +1/-1 steppers have no labels | CRITICAL |
| Checkmark completion button has no `accessibilityHint` | HIGH |
| Set type labels (W/D/F) are abbreviations with no full-text accessibility | HIGH |
| Suggestion banner has no role or label | MEDIUM |
| Overflow menu items have no roles | MEDIUM |

### C. Performance

| Issue | Severity |
|-------|----------|
| `ExerciseCard` re-renders on any workout store change because it subscribes to 8 separate selectors | HIGH |
| SetRow/BodyweightSetRow/TimedSetRow are `React.memo` but ExerciseCard iterates sets inline | MEDIUM |
| `ExerciseReplacementModal` calls `getSuggestedReplacements` every render when visible | LOW |
| Superset group map rebuilt every render (lines 1974-1981) | LOW |

### D. Set Logging Speed Analysis

From the Step 1 competitive analysis, set logging speed is the #1 gap. Here's the current tap count:

**Logging a set (returning user, same weight as last time):**
1. Inputs are pre-filled from suggestion engine -- 0 taps
2. Tap checkmark to complete -- 1 tap

**Total: 1 tap** -- this is now competitive with Hevy/Strong after the pre-fill change.

**Logging a set (different weight):**
1. Tap weight input -- 1 tap
2. Type new weight -- 2-4 taps
3. Tap reps input -- 1 tap  
4. Type new reps -- 1-2 taps
5. Tap checkmark -- 1 tap

**Total: 6-8 taps** -- acceptable, and the +5/-5 steppers provide an alternative (2-3 taps).

**Verdict:** The pre-fill from suggestion engine (`useEffect` at lines 967-975) closes the #1 competitive gap. The implementation is already good. The remaining gap is per-set previous data (showing what each individual set was last time, not just the exercise-level aggregate).

---

## Prioritized Recommendations

### P0 -- Must Fix

1. **Decompose the 2824-line file** into 10+ focused components
2. **Add accessibility labels** to ALL interactive elements (inputs, steppers, checkmarks, buttons)
3. **Add visible discard option** -- users can't discover long-press
4. **Fix timer controls touch targets** -- TimedSetRow buttons are ~30px tall

### P1 -- High Impact

5. **Add per-set previous performance** -- show "PREVIOUS" column like Hevy/Strong with each set's prior weight x reps
6. **Auto-collapse completed exercises** -- show summary row instead of full card
7. **Add undo for set completion** -- tap completed set to uncomplete
8. **Fix stats bar overflow on small screens** -- prioritize or wrap items
9. **Increase overflow button to 44x44** -- currently 36x36
10. **Show exercise names in bottom nav** -- "< Bench Press" / "Rows >"

### P2 -- Polish

11. **Make weight increment configurable** -- 2.5/5/10 based on equipment type
12. **Add swipe navigation** between exercises
13. **Add visual countdown** to TimedSetRow (progress ring)
14. **Add RPE UI** to set rows (the callback exists but no UI)
15. **Consolidate SetRow/BodyweightSetRow** into one component with `isBodyweight` prop
16. **Fix hardcoded "lbs"** in stats bar -- use unit preference
17. **Make suggestion banner collapse** after applied

### P3 -- Nice to Have

18. **Persist timed set timer** in workout store (survives navigation)
19. **Add "added weight" option** for bodyweight exercises
20. **Add search to replacement modal**
21. **Add superset grouping preview** before confirmation
22. **Animate suggestion banner** appearance
23. **Background notification** for timed set completion

---

*Step 4 complete. Proceeding to Step 5: Active Workout Screen Audit (Focus View + Rest Timer + Summary).*
