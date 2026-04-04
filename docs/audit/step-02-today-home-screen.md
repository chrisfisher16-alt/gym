# Step 2: Today / Home Screen Audit

**File:** `apps/mobile/app/(tabs)/index.tsx` (644 lines)
**Role:** Primary landing screen. This is the first thing every user sees on every app open.

---

## Executive Summary

The Today screen is **ambitious and information-rich**, successfully combining workout status, nutrition tracking, coaching, streaks, insights, weekly review, and quick actions into a single scrollable view. The component is architecturally sound: it uses proper hooks, memoization, and Zustand selectors.

However, it suffers from three systemic problems:

1. **Information overload without hierarchy** -- 8 sections render simultaneously with equal visual weight, violating the progressive disclosure pattern that Whoop and Fitbod use to great effect.
2. **Touch target violations** -- at least 4 interactive elements fall below Apple's 44pt minimum.
3. **No animation or transition** -- every section appears as static cards with no entry animation, scroll-driven effects, or micro-interactions, making the screen feel flat compared to competitors.

---

## Section-by-Section Assessment

### 1. Header (Lines 253-265)

**What works:**
- Time-aware greeting ("Good morning, Fisher") is warm and contextual
- Date string is well-formatted with weekday + month + day
- LinearGradient hero creates visual separation from the content below
- First name extraction (`split(' ')[0]`) is a good touch

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Avatar button is 36x36 | HIGH | `S.avatar: { width: 36, height: 36 }` (line 613) is below Apple's 44pt minimum tap target. Users with larger fingers will struggle. |
| No safe area padding | MEDIUM | `heroInner` uses `paddingTop: 12` (line 611). On notched iPhones this may collide with the status bar. The `ScreenContainer` is set to `padded={false}`, so safe area handling depends on the container's implementation. |
| Greeting text is `h1` (24px) | LOW | Works, but the date line above it (`bodySmall`, 12px) creates a 2:1 size ratio. The date feels visually detached from the greeting. |
| No profile photo | LOW | Avatar is a generic person icon. If the user has a profile photo, it should be shown. Hevy/Strong show user avatars. |

**Recommended fix:**
- Avatar: increase to `width: 44, height: 44`, or add `hitSlop: { top: 8, bottom: 8, left: 8, right: 8 }` at minimum
- Add `useSafeAreaInsets()` and apply `top` inset to `heroInner`
- Consider grouping date + greeting tighter (reduce `marginTop: spacing.xs` between them, or use a single text block with styled runs)

---

### 2. Daily Coaching Card (Lines 267-286)

**What works:**
- Sparkle icon + "YOUR DAILY COACHING" label establishes AI branding
- Forced refresh button is a power-user feature that adds control
- Loading state with "Preparing your briefing..." is clear
- Fallback text for when AI fails is time-of-day aware (good detail)

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Refresh button has no explicit size | HIGH | The button is a bare `Ionicons` wrapped in `TouchableOpacity`. Touch area is icon-size only (16px) + `hitSlop: 12px` each side = effective 40px. Still below 44pt. |
| Briefing text has no max length | MEDIUM | `generateDailyBriefing()` can return any length. Long briefings push all content below the fold on smaller devices. Should cap at ~3 lines or add "Read more". |
| No skeleton loader | LOW | The loading state uses `ActivityIndicator` + text. A shimmer/skeleton placeholder matching the text block shape would feel more polished (Fitbod pattern). |
| Card has `shadowOpacity: 1` | LOW | Full shadow opacity is heavy. Most modern designs use `0.05`-`0.15`. The current `1` combined with `shadowColor: colors.shadow` (which is `rgba(0,0,0,0.08)`) works mathematically, but the approach is fragile -- changing the shadow color to a non-alpha value would produce a harsh shadow. |

**Recommended fix:**
- Wrap refresh in a minimum 44x44 `TouchableOpacity` with centered icon
- Add `numberOfLines={4}` to briefing text with ellipsizeMode, plus "Read more" link
- Consider replacing `ActivityIndicator` with a 3-line shimmer skeleton

---

### 3. Today's Workout Card (Lines 291-603)

**What works:**
- **5 distinct states** are well thought out: active session (resume), completed (stats), scheduled (start), new user (first workout), no program (AI workout / empty), and rest day. This is excellent state coverage.
- Completed state shows duration/volume/sets with PR badge -- good post-workout satisfaction
- Active session state with green resume button and "In Progress" label is clear
- New user state copy is encouraging without being condescending
- No-program state offers two clear CTAs (AI Workout vs. Empty)
- Rest day state suggests light activity with an escape hatch ("Start a Workout Anyway")

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No exercise preview in scheduled state | HIGH | When `todayWorkout` exists, the card shows only the workout name and exercise count. Hevy/Strong/Alpha show the first 3-4 exercise names. This preview helps the user mentally prepare and reduces the "what's today?" friction. |
| No estimated duration for scheduled workout | MEDIUM | Users want to know how long the workout will take before committing. Fitbod shows estimated time on every workout card. The data exists (exercise count * avg set time). |
| CTA button text inconsistency | LOW | "Resume Workout" / "Start Workout" / "Let's Go" / "AI Workout" / "Empty Workout" / "Start a Workout Anyway" -- 6 different CTA phrasings. Should normalize primary action language. |
| Completed state is non-interactive | LOW | The completed card has no tap action. Tapping should navigate to the workout summary/detail. Users may want to review their workout. |
| `renderWorkoutCard` is a nested function | LOW | 120+ line function defined inside the component body. This re-creates on every render. Should be extracted to a separate component or at least wrapped in `useCallback`. |
| Rest day card offers no active recovery suggestions | LOW | The text says "Stretch, walk, or light mobility work" but doesn't link to any stretching/mobility routine. |

**Recommended fix:**
- Add exercise preview (first 3 names, faded "and N more") to scheduled state
- Calculate and display estimated duration based on exercise count and historical average
- Make completed card tappable, navigating to workout detail
- Extract `renderWorkoutCard` to `<WorkoutStatusCard />` component

---

### 4. Nutrition Snapshot (Lines 294-343)

**What works:**
- 3 progress rings (Calories, Protein, Water) give at-a-glance macro status
- Afternoon mode switching ("left" vs absolute values) is a clever contextual detail
- "Log Meal" and "Add Water" pill buttons provide direct action from the home screen
- Supplement tracking row with checkmark completion state is useful

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Progress rings are 64px (small) | MEDIUM | At size 64 with strokeWidth 5, the inner content area is ~50px. Center text uses `fontSize: 13` which is readable but tight. Fitbod/MyFitnessPal use ~80-100px rings on their home screens. Consider sizing up to 72-80px. |
| No carbs/fat rings | MEDIUM | Only Calories, Protein, Water are shown. Carbs and fat are tracked in the nutrition tab but not surfaced here. The "See All" link bridges the gap, but even a secondary row of smaller rings or a horizontal bar would give a more complete picture. |
| Supplement pills have small touch targets | HIGH | `paddingVertical: spacing.xs` (4px) + `paddingHorizontal: spacing.sm` (8px) = very small hit area. Text is `caption` (11px). These are well below 44pt. |
| No haptic feedback on supplement check-off | LOW | Button.tsx has haptics, but supplement `logSupplement` calls don't trigger haptic feedback. Checking off a supplement should feel satisfying (success haptic). |
| "Add Water" navigates to nutrition tab, not a quick-add | MEDIUM | The water button goes to `/(tabs)/nutrition` instead of a quick modal to add 8oz/16oz. This breaks the "quick action" promise. Competitors (MyFitnessPal) offer inline +8oz buttons. |

**Recommended fix:**
- Increase ring size to 72-80px
- Add a compact secondary macro row (carbs/fat as small horizontal bars below the rings)
- Increase supplement pill `paddingVertical` to at least `spacing.md` (12px)
- Add haptic feedback to supplement completion
- Replace water "Add" with inline quick-add (+8oz button) or a bottom sheet

---

### 5. Streaks & Momentum Strip (Lines 346-373)

**What works:**
- 3-stat horizontal strip is compact and scannable
- Color-coded streak threshold (gold when >= 3) adds positive reinforcement
- Icon + number + label structure is clear and consistent
- Vertical dividers create clean separation

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Not tappable | MEDIUM | None of the 3 stats are interactive. Tapping the streak should navigate to achievements/streaks, tapping "This Week" should go to progress, tapping PRs should show PR history. |
| No animation on streak milestone | LOW | When streak reaches 3, 7, 14, 30, the flame icon should animate (scale pulse). Currently static. |
| PRs count shows all-time total | LOW | "PRs" with a number like "12" is ambiguous -- is that this week? This month? All time? Should clarify with a subtitle like "All Time" or show recent PRs. |
| Strip only shows when `streak > 0 || totalWorkouts > 0` | LOW | New users with 0 workouts see no stats strip at all. This is correct for brand-new users, but could show "0" with encouraging copy ("Complete your first workout!"). |

**Recommended fix:**
- Wrap each stat in `TouchableOpacity` routing to the relevant detail screen
- Add `Animated.View` scale pulse when streak crosses milestone thresholds
- Clarify PR count with "This Month" or "All Time" subtitle

---

### 6. AI Insights (Lines 375-391)

**What works:**
- Contextual, rule-based insights (protein low, streak high, volume trending up, hydration low) are genuinely useful
- Dismissible via persistent AsyncStorage
- Limited to 2 insights max -- good restraint
- Icon + colored background pill creates visual distinctiveness

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Insights are purely text-based | MEDIUM | No CTA button on insights. "Protein at 40%. A shake or chicken breast can close the gap" should have a "Log Protein" action button. |
| Dismiss button is 16px icon only | HIGH | Close icon is 16px with `hitSlop: 12px` = effective 40px. Below 44pt minimum. |
| No insight if user has no data | LOW | New users with no nutrition/workout data get no insights at all. Could show onboarding-style tips ("Set up your nutrition targets to get personalized insights"). |
| Insights re-derive every render | LOW | `useMemo` dependency on `hour` means the insight list is stable within the same hour, but technically `hour` changes on every render that crosses an hour boundary. Minor, but the dismissed set persistence handles this edge case. |

**Recommended fix:**
- Add a primary action CTA to each insight ("Log Protein", "See Recovery Suggestions", "View Progress")
- Increase dismiss touch target to 44px minimum
- Add onboarding insight for new users

---

### 7. Weekly Check-In (Lines 393-430)

**What works:**
- Only appears on Sunday/Monday -- smart timing
- Dismissible and persisted per week
- 5-stat grid (Workouts, Volume, PRs, Avg Cal, Adherence) is comprehensive
- AI insight text adds personalized coaching
- "See Progress" CTA bridges to the progress tab

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Week grid uses `width: '30%'` | MEDIUM | With 5 items and `flexWrap`, the grid creates an uneven layout: 3 items on row 1, 2 on row 2, left-aligned. This looks unbalanced. Should be 5 across or 2 rows of 3+2 with centered second row. |
| Emoji in label text | LOW | `WEEKLY CHECK-IN` label includes a chart emoji. The design system doesn't use emoji elsewhere. Replace with an Ionicons icon for consistency. |
| Loading state blocks the whole card | LOW | While generating the weekly summary, the card shows a spinner. If the AI call is slow, this creates a loading card that takes up real estate. Consider lazy-loading the check-in below the fold. |

**Recommended fix:**
- Restructure grid: 3 items row 1 (Workouts, Volume, PRs), 2 items row 2 centered (Avg Cal, Adherence)
- Replace emoji with `<Ionicons name="bar-chart-outline" />` icon
- Load weekly summary lazily (only when scrolled into view)

---

### 8. Quick Actions (Lines 432-443)

**What works:**
- Icon circles with labels are a familiar pattern (iOS Shortcuts style)
- Product-mode aware filtering (`showWorkout`/`showNutrition`) is thoughtful
- Routes to core tabs efficiently

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Only 4 actions (or fewer) | MEDIUM | The row uses `space-around` with 4 items max. On wide screens this creates excessive gaps. On narrow screens 4 circles work. But competitors show 5-6 quick actions. Missing: Body Measurements, Workout History, Exercise Library, Supplements. |
| Circle size is 52x52 | LOW | Touch target is fine (above 44pt), but the visual weight is light compared to the rest of the screen. Consider 56-60px for better visual prominence. |
| Position at bottom of long scroll | HIGH | Quick actions are the LAST section on the screen, below weekly check-in, insights, streaks, nutrition, workout card, and coaching. Users must scroll past everything to reach them. These should be much higher -- ideally right below the workout card -- since they represent primary navigation shortcuts. |
| No haptic feedback on tap | LOW | Quick action circles don't trigger haptic feedback (they use `router.push` directly, not the Button component). |

**Recommended fix:**
- Move quick actions UP to position 3 (after workout card, before nutrition)
- Add 2 more contextual actions (e.g., Body Measurements, Exercise Library)
- Add `lightImpact()` haptic on tap

---

## Cross-Cutting Issues

### A. Accessibility

| Issue | Severity |
|-------|----------|
| No `accessibilityLabel` on ANY interactive element | CRITICAL |
| No `accessibilityRole` assignments (button, link, header, etc.) | CRITICAL |
| Progress rings have no accessibility value (`accessibilityValue={{ now: 72, min: 0, max: 100 }}`) | HIGH |
| Streak icons are decorative but not marked `accessibilityElementsHidden` | MEDIUM |
| No `accessibilityHint` on CTA buttons ("Starts your scheduled workout") | MEDIUM |
| Screen has no accessibility header hierarchy (`accessibilityRole="header"` on section titles) | MEDIUM |

**Impact:** Screen readers (VoiceOver/TalkBack) will read raw text without context. A blind user hearing "0.72" for a progress ring with no label is unusable.

### B. Performance

| Issue | Severity |
|-------|----------|
| `generateDailyBriefing()` called on every mount (not debounced across tab switches) | MEDIUM |
| `generateWeeklySummary()` makes an AI call on Sunday/Monday on every mount | MEDIUM |
| 8 sections always rendered (no lazy loading or virtualization) | LOW |
| `renderWorkoutCard` is re-created on every render (not memoized) | LOW |
| Multiple `useMemo` blocks with `demo` in deps re-evaluate when demo mode toggles | LOW |

### C. Design System Compliance

| Issue | Detail |
|-------|--------|
| Inline styles everywhere | Virtually every element has inline `style={[S.foo, { color: colors.x, marginTop: spacing.y }]}`. This is not wrong per se, but it means style changes require editing JSX, not token files. |
| Shadow values inconsistent | `coachCard` uses `shadowOpacity: 1` (line 615) while `Card` component uses `shadowOpacity: 1` too, but `strip` uses `shadowOpacity: 0.5` (line 630). Should standardize. |
| `hitSlop` values vary | `{ top: 12, bottom: 12, left: 12, right: 12 }` in some places, `{ top: 8, bottom: 8, left: 8, right: 8 }` in others. Should define constants. |
| No `Animated` usage | Zero animations or transitions. Every card appears instantly. Entry animations on cards, number countups on stats, and ring fill animations would add polish. |

### D. Content Density vs. Competitors

| App | Home Screen Sections | Scroll Depth |
|-----|---------------------|--------------|
| Hevy | 2 (Social Feed + Start Workout FAB) | Infinite scroll |
| Strong | 1 (Workout History + Start Workout button) | Minimal |
| Fitbod | 3 (Today's Workout, Muscle Recovery, Streak) | ~1.5 screens |
| Whoop | 3 (Strain, Recovery, Sleep) | ~1 screen |
| **FormIQ** | **8 sections** | **~3-4 screens** |

FormIQ shows 2-3x more content than any competitor. This isn't inherently bad (FormIQ covers more domains), but without progressive disclosure it creates cognitive overload.

---

## Prioritized Recommendations

### P0 -- Must Fix (Accessibility/Usability)

1. **Add accessibility labels to ALL interactive elements** -- every TouchableOpacity, every progress ring, every icon button
2. **Fix touch targets** -- avatar (36px), supplement pills (~20px), refresh button (~40px effective), insight dismiss (~40px effective) all need to reach 44pt minimum
3. **Move quick actions up** -- from position 8 (last) to position 3 (after workout card)

### P1 -- High Impact UX Improvements

4. **Add exercise preview to scheduled workout card** -- show first 3 exercise names + "and N more"
5. **Add estimated workout duration** -- display "~45 min" on the scheduled workout card
6. **Add action CTAs to insights** -- "Log Protein", "See Recovery", etc.
7. **Make nutrition rings tappable** -- navigate to macro detail
8. **Add inline water quick-add** -- +8oz button instead of navigating to nutrition tab
9. **Make stats strip interactive** -- streak -> achievements, week -> progress, PRs -> PR history

### P2 -- Polish & Delight

10. **Add entry animations** -- staggered card fade-in on mount, ring fill animation on the nutrition rings
11. **Add haptic feedback** -- supplement check-off, quick action taps, workout start
12. **Add skeleton loading** -- replace ActivityIndicator with shimmer placeholders for coaching card
13. **Make completed workout tappable** -- navigate to workout detail/summary
14. **Progressive disclosure** -- collapse insights and weekly check-in by default behind a "More" affordance when the user has > 3 sections showing
15. **Streak milestone animation** -- scale pulse on flame icon at 3, 7, 14, 30 day milestones

### P3 -- Nice to Have

16. **Show profile photo** in avatar if available
17. **Cap briefing text length** at 4 lines with "Read more"
18. **Clarify PR count** with "All Time" or "This Month" subtitle
19. **Replace emoji** in weekly check-in label with Ionicons
20. **Extract `renderWorkoutCard`** to a separate component for performance and readability
21. **Standardize shadow and hitSlop values** across the screen

---

## Component Architecture Recommendation

The current 644-line monolith should be decomposed:

```
app/(tabs)/index.tsx              -- ~80 lines (orchestrator + layout)
  components/today/HeroHeader.tsx        -- greeting, date, avatar
  components/today/CoachingCard.tsx       -- daily briefing
  components/today/WorkoutStatusCard.tsx  -- 5-state workout card
  components/today/NutritionSnapshot.tsx  -- rings, pills, supplements
  components/today/StatsStrip.tsx         -- streaks, week, PRs
  components/today/InsightCards.tsx       -- dismissible AI insights
  components/today/WeeklyCheckIn.tsx      -- Sunday/Monday review
  components/today/QuickActions.tsx       -- icon circle shortcuts
```

Benefits: Each sub-component can be independently memoized, tested, and lazy-loaded. The parent orchestrator becomes a clean layout file.

---

## Competitive Gap Summary

| Feature | FormIQ Today | Best-in-Class |
|---------|-------------|---------------|
| Workout preview depth | Name + count only | Hevy: exercise names + previous weights |
| Nutrition at-a-glance | 3 rings (cal/protein/water) | MacroFactor: 4 macros + trend line |
| Quick water add | Navigates away | MyFitnessPal: inline +8oz button |
| Content density | 8 sections, ~3-4 scrolls | Whoop: 3 sections, ~1 scroll |
| Animation/delight | Zero animations | Fitbod: muscle map, ring fills, card transitions |
| Accessibility | No labels | Most competitors: partial (Fitbod leads) |
| Progressive disclosure | None (all sections always visible) | Whoop: 3 numbers -> expand -> charts -> AI |

---

*Step 2 complete. Ready to proceed to Step 3: Workout Tab + Pre-Workout Flow Audit.*
