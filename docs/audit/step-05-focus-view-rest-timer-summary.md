# Step 5: Active Workout Screen Audit -- Focus View, Rest Timer, and Summary

**Files:**
- `apps/mobile/src/components/FocusedWorkoutView.tsx` (628 lines)
- `apps/mobile/app/workout/active.tsx` lines 1408-1637 (RestTimerOverlay, WorkoutSummaryModal)

**Scope:** The Focus workout mode, rest timer overlay, and post-workout summary modal.

---

## A. Focused Workout View

### Executive Summary

The Focus View is **FormIQ's most impressive UI feature** and a genuine differentiator vs. competitors. By showing one exercise at a time with oversized inputs (48px font, 64px +/- buttons), it creates a "scoreboard" interface optimized for logging mid-set when hands are chalked up or sweaty. This is exactly the pattern that Alpha Progression and Strong use for their premium "focus mode."

The single massive "LOG SET" button (22px text + 32px icon, rounded XL, with green shadow glow and scale animation) is the best interaction in the entire app.

However, the view lacks some features available in list view, creating a feature-parity gap.

---

### What Works

**Scoreboard Input Design:**
- Weight and Reps inputs use `fontSize: 48` with `fontWeight: '700'` -- easily readable during a set
- +/- buttons are 64x64px -- excellent touch targets for gloved/chalked hands
- "LOG SET" button is huge with satisfying scale bounce + green flash animation
- Heavy haptic feedback on log -- feels impactful

**Set Progress Dots:**
- Horizontal dot row showing completed (green check), current (blue ring), and remaining (gray) sets
- Gives immediate visual feedback on progress through the exercise

**Suggestion Integration:**
- "Use Suggestion" button pre-fills weight/reps from suggestion engine
- Confidence-based coloring (green for high confidence, cyan for normal)
- Clearly shows "Based on your last workout, try: 135 lbs x 10 reps"

**Superset Awareness:**
- Badge shows "Superset" or "Tri-Set" with position ("Exercise 2 of 3")
- Auto-cycles to next exercise in superset group after logging a set
- Rest timer only starts after completing a full superset round

**Exercise Illustration:**
- Medium-size illustration at the top gives visual form reference

**Auto-Fill Next Set:**
- After logging a set, the next incomplete set is automatically pre-filled with the same weight/reps
- This means subsequent sets are 1-tap (just hit LOG SET)

**Completed Sets Summary:**
- Chip row shows all completed sets with weight x reps
- PRs marked with trophy emoji
- "All Sets Complete!" state with large green checkmark

---

### What Needs to Change

| Issue | Severity | Detail |
|-------|----------|--------|
| No rest timer integration in view | HIGH | When rest timer starts (after logging a set), the overlay covers the Focus View entirely. In list view this is acceptable, but in focus view the rest timer should be integrated inline -- showing the countdown on the same screen without a modal overlay. Alpha Progression does this: rest timer appears in the header, and the user can see/edit the next set's weight while resting. |
| No per-set previous performance | HIGH | Focus View shows the suggestion but not what the user did on each specific set last time. Should show "Previous: 135 x 10" above or below the weight input for the current set. |
| No exercise swap/replace | MEDIUM | List view has overflow menu with swap, YouTube, superset, delete. Focus view has none of these. User must switch to list view for any exercise modification. |
| No "Add Set" option | MEDIUM | In list view, the user can add working/warmup sets. Focus view doesn't expose this. |
| Missing bodyweight and timed exercise support | HIGH | Focus View only renders weight + reps inputs. `isBodyweight` and `isTimeBased` exercise types use the same weight input, which is wrong. Bodyweight exercises should hide the weight input; timed exercises need a timer, not weight/reps. |
| No rest time display/edit | MEDIUM | List view shows per-exercise rest time with editable presets. Focus view doesn't show or allow editing rest time. |
| "All Sets Complete" state has no auto-advance | MEDIUM | When all sets are done, the view shows a static completion message. Should auto-advance to the next exercise after a brief celebration (2-3 seconds), or at least show a prominent "Next Exercise" button. |
| Weight input doesn't validate against equipment | LOW | Users can enter any weight. Should show a hint if weight doesn't match standard plate increments (e.g., 137 lbs is unusual for a barbell). |
| No RPE input | LOW | Like list view, RPE callback exists but no UI to set it. |
| No notes/form reminders | LOW | No way to add per-exercise notes ("focus on slow eccentric") in focus view. |
| Emoji in completed set chips | LOW | Trophy emoji `🏆` in completed set chips. Should use Ionicons trophy icon for consistency. |

---

### Feature Parity Gap: Focus View vs. List View

| Feature | List View | Focus View |
|---------|-----------|------------|
| Weight/reps input | Yes (inline) | Yes (scoreboard) |
| +/- steppers | +5/-5, +1/-1 | +/-, large buttons |
| Set completion | Per-set checkmark | "LOG SET" button |
| Previous performance | Exercise-level text | None |
| Suggestion banner | Tappable, collapsible | "Use Suggestion" button |
| Rest time display/edit | Yes | No |
| Add set (working/warmup) | Yes | No |
| Exercise swap | Yes (overflow menu) | No |
| YouTube form video | Yes (overflow menu) | No |
| Superset creation | Yes (overflow menu) | No |
| Exercise delete | Yes (overflow menu) | No |
| Exercise reorder | Yes (reorder mode) | No |
| Bodyweight support | Dedicated BodyweightSetRow | Uses weight input (broken) |
| Timed exercise support | Dedicated TimedSetRow with timer | Uses weight/reps input (broken) |
| Per-set RPE | Callback exists, no UI | No |
| Notes | No | No |

**Recommendation:** Focus View doesn't need every list view feature, but it MUST support bodyweight and timed exercises correctly, and should provide a minimal overflow menu for swap/delete.

---

## B. Rest Timer Overlay

### What Works

**Core Functionality:**
- Clear countdown display using `displayLarge` (32px) -- readable from a distance
- +15s / -15s adjustment buttons -- essential for when 90s isn't enough or too much
- Preset buttons for common durations (from `REST_TIMER_PRESETS`)
- Custom time input with "Set" button
- "Skip Rest" ghost button -- important for supersets or when ready early
- Haptic notification when timer reaches 0

---

### What Needs to Change

| Issue | Severity | Detail |
|-------|----------|--------|
| Overlay blocks the entire screen | HIGH | The rest timer is an absolutely-positioned overlay covering everything. User can't see or edit the next set while resting. Hevy/Strong show the rest timer as a compact bar at the top or bottom, leaving the set inputs visible. This is the single biggest UX improvement opportunity in the app. |
| No visual progress indicator | MEDIUM | Only a text countdown. Should have a circular progress ring filling/depleting around the time display. This is the standard pattern (Hevy, Strong, Fitbod, Alpha Progression all use it). |
| No sound/vibration options | MEDIUM | Timer completion uses haptic only. Should also support a sound alert. Some users have haptics off. |
| Timer doesn't persist across navigation | MEDIUM | If user minimizes workout and returns, the rest timer state is in the workout store, but the `RestTimerOverlay` component relies on `useActiveWorkout` hook which may re-initialize. |
| Overlay background is `colors.overlay` (50% black) | LOW | On dark mode, this creates a dark-on-dark effect that can feel heavy. Consider a semi-transparent blur instead. |
| Custom time input is small | LOW | `restCustomInput` is 70px wide with 36px min-height. Adequate but tight on smaller screens. |
| Preset buttons don't show which one was originally selected | LOW | After the rest timer starts from a set completion (e.g., 90s), the presets don't highlight the original duration. |

**Recommended Architecture Change:**

Replace the full-screen overlay with a compact, non-blocking rest timer:

```
Current:    [Full-screen overlay blocks everything]
Proposed:   [Sticky banner at top/bottom of exercise list]
            - Shows countdown + progress ring
            - +15s / -15s quick adjust
            - Skip button
            - Tapping banner expands to full settings
            - Exercise inputs remain visible and editable underneath
```

This single change would be the **highest-impact UX improvement** in the entire audit.

---

## C. Workout Summary Modal

### What Works

**Celebration Design:**
- Trophy icon (56px) at the top -- clear completion signal
- Context-aware congratulation message (varies by PR count, total sets, duration)
- Session name prominently displayed

**Stats Grid:**
- 4 stat cards: Duration, Volume, Sets, Exercises
- 5th card for PRs (gold background) when applicable
- Clean 2x2 + 1 grid layout with consistent card sizing

**PR Details Section:**
- Lists each exercise with PRs
- Shows the specific set (weight x reps) that was a PR
- Gold/warning color scheme distinguishes PRs from regular stats

**Done Button:**
- Full-width, clear action to finish

---

### What Needs to Change

| Issue | Severity | Detail |
|-------|----------|--------|
| No share functionality | HIGH | After completing a workout, users want to share their achievement. Strava, Hevy, and Alpha Progression all offer shareable workout cards. Should generate a visual card (exercise list, stats, PRs) shareable to social media or messages. |
| No comparison to previous session | MEDIUM | Summary shows absolute numbers but no delta. "Volume up 12% vs. last session" or "2 more sets than last time" would reinforce progress. |
| No animation or confetti | MEDIUM | The modal slides up (`animationType="slide"`) but the content is static. A confetti burst for PR sessions or a celebration animation would match competitor polish (Fitbod, Alpha Progression). |
| Volume shows "Volume (lbs)" hardcoded | LOW | Line 1578 -- should use unit preference. |
| No exercise-level breakdown | LOW | Only shows aggregate stats. Users may want to see per-exercise summary (3 sets, total volume per exercise). |
| No "Start Next Workout" option | LOW | Summary only has "Done" which navigates to workout tab. Could offer "Start Next Workout" for users who want to immediately begin another session (common for AM/PM splits). |
| No workout rating/mood input | LOW | Many competitors (Hevy, JEFIT) ask the user to rate their workout (1-5 stars) or log their perceived effort. This data feeds analytics. |
| Trophy icon emoji inconsistency | LOW | Summary uses Ionicons trophy throughout except in PR set text which could benefit from consistent iconography. |
| Not accessible | MEDIUM | No accessibility labels on stats cards, PR rows, or navigation. |

---

## Interaction Flow Analysis

### Happy Path: Log 4 Sets of Bench Press (Focus View)

1. Screen opens on first exercise
2. Suggestion shows "135 lbs x 10" with "Use Suggestion" button
3. User taps "Use Suggestion" -- weight and reps populate (1 tap)
4. User taps "LOG SET" -- set 1 logged, dot turns green, rest timer overlay appears (1 tap)
5. **User waits 90 seconds staring at the rest timer, unable to adjust next set's weight** (friction)
6. Timer expires, haptic fires, overlay dismisses
7. Next set auto-fills with 135 x 10
8. User taps "LOG SET" (1 tap)
9. Repeat steps 5-8 for sets 3 and 4
10. "All Sets Complete!" message appears
11. User taps "Next" in bottom nav (1 tap)

**Total taps per set: ~2 (suggestion + LOG SET for first set, 1 for subsequent)**
**Dead time: ~90s x 3 rest periods where user can't do anything productive**

If the rest timer were non-blocking, users could review upcoming exercises, adjust weights, or check their progress during rest -- turning dead time into productive time.

---

## Prioritized Recommendations

### P0 -- Must Fix

1. **Replace full-screen rest timer with non-blocking compact timer** -- highest-impact single change in the entire audit. Show countdown as a sticky banner/bar while keeping exercise inputs visible and editable.
2. **Fix Focus View bodyweight/timed exercise support** -- currently broken (shows weight input for bodyweight, no timer for timed)
3. **Add accessibility labels** to all summary stats, PR rows, and Focus View elements

### P1 -- High Impact

4. **Add share workout card** to summary -- generate shareable image with stats
5. **Add per-set previous performance** to Focus View -- "Previous: 135 x 10"
6. **Add visual countdown ring** to rest timer
7. **Add auto-advance** from Focus View "All Sets Complete" state to next exercise
8. **Add minimal overflow menu** to Focus View (swap, delete, YouTube)
9. **Add comparison to previous session** in summary ("Volume up 12%")

### P2 -- Polish

10. **Add confetti/celebration animation** for PR sessions in summary
11. **Add workout rating/mood** input to summary
12. **Integrate rest timer inline** in Focus View (countdown in the header area)
13. **Add exercise-level breakdown** to summary
14. **Add "Add Set" option** to Focus View
15. **Replace emoji** in completed set chips with Ionicons
16. **Add sound option** for rest timer completion
17. **Fix hardcoded "lbs"** in summary volume

### P3 -- Nice to Have

18. **Add notes/form reminders** to Focus View
19. **Add weight validation** against standard plate increments
20. **Add blur background** for rest timer overlay (dark mode improvement)
21. **Add "Start Next Workout"** option to summary
22. **Highlight original preset** in rest timer when starting

---

## Architecture Recommendation

The Focus View should be elevated to a first-class citizen:

1. **Default to Focus View** for users who have tried it (persist preference)
2. **Feature parity** with list view for core operations (bodyweight, timed, swap, add set)
3. **Integrated rest timer** that doesn't block the view
4. **Previous performance** visible per-set

These four changes would make FormIQ's Focus View the best-in-class workout logging experience -- superior to any competitor's.

---

*Steps 3, 4, and 5 complete.*
