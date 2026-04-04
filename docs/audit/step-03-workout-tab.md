# Step 3: Workout Tab + Pre-Workout Flow Audit

**File:** `apps/mobile/app/(tabs)/workout.tsx` (596 lines)
**Role:** Main workout hub. Shows today's workout, active program progress, quick start, navigation to programs/exercises, weekly volume chart, milestones, program selection, and recent workout history.

---

## Executive Summary

The Workout Tab is a **well-structured, feature-complete hub** that correctly handles multiple user states: active session in progress, scheduled workout ready, cardio/rest/mobility day types, no active program, and first-time user. The paywall gating and usage limit tracking are cleanly implemented.

However, it suffers from three key problems:

1. **Redundancy with Today screen** -- the Today's Workout card appears on both the Today tab and Workout tab with slightly different implementations, creating maintenance burden and inconsistent exercise previews.
2. **Information architecture is flat** -- 7+ sections stack vertically with no visual grouping or progressive disclosure, requiring 4-5 scrolls to see everything.
3. **No workout-specific orientation** -- the screen doesn't answer the most important question a user has when they land: "What should I do today?"

---

## Section-by-Section Assessment

### 1. Header (Lines 166-173)

**What works:**
- Clean "Workout" title with `h1` typography
- "In Progress" badge appears when active session exists -- good global awareness

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| "In Progress" badge touch target is ambiguous | MEDIUM | The badge wraps a `TouchableOpacity` navigating to active workout, but it looks like a static label. Should be more button-like (border, shadow) or include an arrow icon. |
| No page-level loading state feedback | LOW | Header renders immediately even while `checkWorkoutLogLimit` async resolves. |

---

### 2. Active Session Card (Lines 176-245)

**What works:**
- Green border (2px) visually distinguishes active state from all other cards
- Exercise preview shows first 3 exercises with completion checkmarks -- exactly what Step 2 audit recommended the Today screen lacks
- Progress stats (completed sets, elapsed time) give at-a-glance status
- "Discard Workout" is correctly destructive-styled with confirmation Alert
- "+N more" exercises indicator prevents card from becoming too tall

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Elapsed time is static | MEDIUM | `Math.floor((Date.now() - startedAt) / 60000)` calculates once on render, doesn't tick. If the user sits on this tab, the timer freezes. Need `useEffect` interval or re-render trigger. |
| No volume display in active card | LOW | The active session card shows sets count and time but not volume. Volume is prominently shown in the active workout screen itself -- but a preview here helps the user decide whether to resume or view stats. |
| "Resume Workout" button uses custom backgroundColor override | LOW | `style={{ marginTop: spacing.md, backgroundColor: colors.success }}` -- should use a `variant="success"` on Button instead of inline override. |

---

### 3. Today's Workout Card - Not Active (Lines 247-324)

**What works:**
- Handles 3 day types well: lifting (with exercise preview), cardio (with suggestions), and rest/mobility/active recovery
- Exercise preview for lifting shows first 3 exercises with sets x reps -- excellent detail
- Day type badges and color-coded icons create clear visual distinction
- Recovery notes display for rest days

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No estimated duration | HIGH | The scheduled workout shows exercise count but not estimated time. This is the #1 info users want before starting. Hevy/Strong/Fitbod all show estimated duration. |
| Cardio suggestions limited to 2 | LOW | `todayWorkout.cardioSuggestions.slice(0, 2)` -- if the program provides 3-4 suggestions, user only sees 2 with no "see more". |
| Rest day card has no CTA | MEDIUM | Rest/mobility/active_recovery day types show recovery notes but no action button. Should offer "Start light session" or "View recovery routine". |
| Day type labels don't show which program day | LOW | The card doesn't show "Day 3 of 4 this week" or which program day name. Users on a structured program want to know where they are in the week. |

---

### 4. Active Program Progress (Lines 326-348)

**What works:**
- Progress bar with percentage badge is clear
- Shows both weekly progress (day X of Y this week) and total program completion
- Only renders when program is active and has progress data

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Not tappable | MEDIUM | Card is non-interactive. Tapping should navigate to the program detail view (`/workout/programs/[id]`). |
| Progress bar has no animation | LOW | ProgressBar renders static. Should animate from 0 to current value on mount. |
| No program schedule preview | LOW | Doesn't show what's coming next (tomorrow's workout, days remaining this week). Fitbod shows a mini-calendar of the current program week. |

---

### 5. Quick Start (Lines 350-389)

**What works:**
- Two clear options: Empty Workout and AI Workout
- Free tier usage counter badge shows remaining workouts
- Proper paywall gating with upgrade prompt

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Template selection is missing | HIGH | There's no "Start from Template" option. Users who have saved previous workouts should be able to select from recent templates here. Hevy's quick start flow shows recent templates first. |
| No "Repeat Last Workout" option | MEDIUM | A very common pattern is repeating last session. Strong shows "Repeat Last" as a one-tap action. |
| AI Workout icon uses hardcoded color | LOW | `color="#8B5CF6"` (purple) instead of a theme color. |

---

### 6. Navigation Cards (Lines 391-414)

**What works:**
- 2-column grid with Programs and Exercises is clean and scannable
- Active program name shows beneath "Programs" label

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Only 2 navigation options | MEDIUM | Missing: Workout History, Workout Templates. These are buried in section headers below. |
| No haptic feedback | LOW | Nav cards use direct `router.push` without haptic feedback. |
| Cards have no shadow/elevation | LOW | Cards look flat compared to other sections with shadows. Visual inconsistency. |

---

### 7. Weekly Volume Chart (Lines 416-445)

**What works:**
- Simple 7-day bar chart with M-S labels is readable
- Empty days get minimal height (3px) so the chart never looks broken
- Bars are color-coded (primary when active, secondary when zero)

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No volume numbers | MEDIUM | Bars show relative height but no actual volume values. User can't tell if they did 5,000 or 50,000 lbs. Should show the value above the tallest bar, or on tap. |
| Chart is not interactive | LOW | Tapping a bar should show the day's detail (workout name, volume, time). |
| No comparison to previous week | LOW | A ghost/outline bar behind each day showing last week's volume would add progression context. |
| Today bar doesn't highlight differently | LOW | All bars are the same primary color. Today should be highlighted or pulsing. |

---

### 8. Milestones (Line 448)

**What works:**
- `<WorkoutMilestones />` component is cleanly separated

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Position is buried | MEDIUM | Milestones appear after Quick Start, nav grid, and volume chart. By this point the user has scrolled 2-3 screens. If the user just hit a milestone, it should be near the top. |

---

### 9. Program Selection (Lines 450-481)

**What works:**
- Shows up to 3 inactive programs with clean card layout
- "See All" link navigates to programs list
- One-tap to activate a program

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Activating a program has no confirmation | HIGH | `onPress={() => setActiveProgram(program.id)}` immediately switches the active program. If the user has an existing program in progress, this should confirm: "Switch to {name}? Current program progress will be paused." |
| No visual indication of program difficulty | LOW | Difficulty text is present but not color-coded. "Advanced" should feel different from "Beginner". |

---

### 10. Recent Workouts (Lines 483-532)

**What works:**
- Clean history list with workout name, date, duration, sets
- PR badge with trophy icon for sessions with personal records
- "See All" navigates to full history
- Empty state with icon and encouraging copy

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No volume in history cards | LOW | Shows date, duration, sets but not total volume. Volume is the most important metric for progressive overload. |
| "See All" touch target is text-only | LOW | "See All" is plain text without padding. Below 44pt minimum. |

---

## Cross-Cutting Issues

### A. Accessibility

| Issue | Severity |
|-------|----------|
| No `accessibilityLabel` on navigation cards | CRITICAL |
| Chart bars have no accessibility representation | HIGH |
| PR badges on history items are visual-only | MEDIUM |
| "See All" links have no `accessibilityRole="link"` | MEDIUM |
| Day type icons (cardio, rest, mobility) convey information through color alone | MEDIUM |

### B. Performance

| Issue | Severity |
|-------|----------|
| `weeklyDayProgress` calls `useWorkoutStore.getState().history` directly instead of using a selector, bypassing React's render optimization | MEDIUM |
| `checkWorkoutLogLimit` called on every mount for free users, not cached | LOW |
| All 7+ sections render simultaneously | LOW |

### C. Redundancy with Today Tab

The Today/Home screen (`app/(tabs)/index.tsx`) has its own workout card (`renderWorkoutCard`) that shows 5 states. The Workout Tab has a similar but different implementation. Key differences:

| Feature | Today Tab | Workout Tab |
|---------|-----------|-------------|
| Exercise preview (active) | None | First 3 with checkmarks |
| Exercise preview (scheduled) | None | First 3 with sets x reps |
| Elapsed time (active) | None | Shown (but static) |
| Day type support | Basic | Full (cardio, rest, mobility, active_recovery) |
| Program progress | None | Progress bar + weekly/total |
| Discard option | None | Yes with confirmation |

**Recommendation:** Extract a shared `<TodayWorkoutCard />` component used by both screens, with a `compact` prop for the Today tab variant.

---

## Prioritized Recommendations

### P0 -- Must Fix

1. **Add confirmation when switching active program** -- destructive action without confirmation
2. **Add estimated workout duration** to scheduled workout card
3. **Add accessibility labels** to all interactive elements

### P1 -- High Impact

4. **Add "Start from Template" to Quick Start** -- most common competitor pattern
5. **Add "Repeat Last Workout" one-tap** option
6. **Make elapsed time tick** on active session card (useEffect interval)
7. **Add rest/mobility day CTA** -- "Start Light Session" or "View Recovery"
8. **Make program progress card tappable** -- navigate to program detail
9. **Move milestones higher** when a new milestone is achieved

### P2 -- Polish

10. **Add volume values to weekly chart** -- at least on tallest bar
11. **Add volume to recent workout cards**
12. **Make chart bars interactive** -- tap for day detail
13. **Extract shared `TodayWorkoutCard`** -- reduce code duplication between tabs
14. **Add week comparison to chart** -- ghost bars for previous week
15. **Add template quick-start grid** showing recent 3-4 templates

### P3 -- Nice to Have

16. **Animate progress bar** on mount
17. **Color-code difficulty** on program cards
18. **Highlight today's bar** in the volume chart
19. **Add navigation cards** for History and Templates
20. **Replace hardcoded AI color** (`#8B5CF6`) with theme token

---

*Step 3 complete. Proceeding to Step 4: Active Workout Screen Audit (List View).*
