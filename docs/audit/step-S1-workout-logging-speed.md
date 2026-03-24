# S1: Workout Logging Speed Test (Tap Count Benchmark)

## Architecture Recap

FormIQ's set logging relies on three systems working together:

1. **Suggestion Engine** (`suggested-load.ts`) -- computes progressive overload from last session, pre-fills weight/reps via `getSuggestedLoad()`
2. **Auto Pre-fill** (`active.tsx:967-975`) -- `useEffect` calls `logSet()` on every empty, incomplete set with suggestion values on mount
3. **Rest Timer Auto-Start** (`active.tsx:1013-1014`) -- `handleCompleteSet` calls `startRestTimer()` after set completion

---

## Tap Count by Scenario

### Scenario 1: Returning User, Same Weight

Starting from Workout tab, has active program and history.

| Step | Action | Tap |
|------|--------|-----|
| 1 | Tap "Start Today's Workout" | 1 |
| 2 | Dismiss warmup suggestion card | 2 |
| 3 | Weight/reps already pre-filled from suggestion engine | -- |
| 4 | Tap checkmark on Set 1 | **3** |

**Total: 3 taps** (2 taps if warmup previously dismissed)

Feedback on completion: Medium haptic + green flash + scale bounce. PR detection adds success haptic + trophy bounce.

### Scenario 2: Returning User, Different Weight

Starting from same point, need to change weight from 135 to 155 lbs.

| Method | Steps | Total Taps |
|--------|-------|------------|
| **Text input** | Start + skip warmup + tap weight field + type "155" + tap checkmark | **4-5** |
| **+5 buttons** | Start + skip warmup + tap +5 four times + tap checkmark | **7** |

The +5/-5 increment granularity is the bottleneck. No +10/+25 buttons, no scroll wheel, no plate calculator.

### Scenario 3: New User, First Workout

Starting from Workout tab, no history, no programs.

| Step | Action | Tap |
|------|--------|-----|
| 1 | Tap "Empty Workout" | 1 |
| 2 | Dismiss warmup | 2 |
| 3 | Tap "Add Exercise" | 3 |
| 4 | Tap category filter (e.g., "Chest") | 4 |
| 5 | Tap "Bench Press" row | 5 |
| 6 | Tap "Add to Workout" on detail screen | 6 |
| 7 | Tap weight input + type value | 7 |
| 8 | Tap reps input + type value | 8 |
| 9 | Tap checkmark | **9** |

**Total: 9 taps + keyboard input** (7 if body metrics enable beginner estimation pre-fill)

The 3-screen exercise addition flow (Active -> Library -> Detail -> Active) is the biggest friction point.

### Scenario 4: Focus View

Starting from active workout in list view.

| Step | Action | Tap |
|------|--------|-----|
| 1 | Tap "Full" toggle to switch to Focus | 1 |
| 2 | Pre-filled weight/reps visible on scoreboard | -- |
| 3 | Tap LOG SET | **2** |

**From within Focus View: 1 tap.** This is best-in-class -- the massive LOG SET button with pre-filled values achieves parity with any competitor.

Feedback: Heavy haptic + button scale + green flash. Heavier haptic than list view (Heavy vs. Medium).

### Scenario 5: Superset (2 Exercises)

| View | Steps | Taps |
|------|-------|------|
| **Full View** (superset exists) | Checkmark exercise A + checkmark exercise B | **2** |
| **Focus View** (superset exists) | LOG SET on A, auto-advances to B, LOG SET on B | **2** |
| **Creating superset first** | Overflow menu + Create Superset + select partner + confirm | **+4 setup** |

Superset behavior is smart: rest timer only starts after the full round completes, not after individual exercises.

### Scenario 6: Adding Exercise Mid-Workout

| Step | Action | Tap |
|------|--------|-----|
| 1 | Scroll down, tap "Add Exercise" | 1 |
| 2 | Search or tap category | 2 |
| 3 | Tap exercise row | 3 |
| 4 | Tap "Add to Workout" | **4** |

**Total: 4 taps** before any set logging.

The exercise detail screen is the unnecessary detour -- it shows illustration, muscles, and history, which is useful for browsing but overkill when adding mid-workout.

---

## Competitive Comparison

| Scenario | FormIQ (Full) | FormIQ (Focus) | Hevy | Strong | Fitbod |
|----------|--------------|----------------|------|--------|--------|
| Same weight, returning | **3** | **1** | 1 | 1 | 1 |
| Different weight (+20 lbs) | **7** | **5** | 3 | 3 | 2 |
| New user, first set | **9** | -- | ~6 | ~6 | 1 (AI) |
| Superset round | **2** | **2** | 2 | 2 | -- |
| Add exercise mid-workout | **4** | **4** | 2 | 3 | 1 |

### Key Gaps

1. **Full View: +2 taps vs. competitors** -- warmup card + navigation overhead
2. **Focus View: at parity** -- 1-tap LOG SET matches Hevy/Strong
3. **Weight adjustment: +4 taps vs. competitors** -- no scroll wheel or larger increments
4. **Exercise addition: +2 taps vs. Hevy** -- Hevy uses inline "+" button in the library list, no detail screen required

---

## Recommendations

| # | Change | Tap Reduction | Effort |
|---|--------|---------------|--------|
| 1 | **Remember warmup dismissal** (setting or persist per session) | -1 per workout | Trivial |
| 2 | **Default to Focus View** for returning users with programs | -2 per workout | Low |
| 3 | **Add inline "+" buttons** in Exercise Library list | -2 per exercise add | Low |
| 4 | **Add +10/+25 increment buttons** (or scroll wheel) | -2 to -6 per weight change | Low |
| 5 | **Make Focus View "Use Suggestion" complete the set** | -1 per set (currently fills but doesn't log) | Trivial |

With all 5 changes, FormIQ would achieve 1-tap set logging in Focus View (already there) and 1-tap in Full View for returning users (eliminate warmup card).

*S1 complete.*
