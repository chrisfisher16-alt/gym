# Step 17: Prioritized Implementation Roadmap

This roadmap synthesizes findings from Steps 1-16 into an actionable implementation plan. Items are grouped by priority tier based on user impact, risk, and effort.

---

## Tier 0: Critical Bugs and Blockers

These issues are broken functionality, security risks, or policy violations that should be fixed immediately.

| # | Issue | Source | File(s) | Impact |
|---|-------|--------|---------|--------|
| **T0-1** | **Nutrition targets auto-calculate uses hardcoded profile** (`sex: 'male', age: 30, weight_kg: 80, height_cm: 178`) instead of actual user data | Step 8 | `targets.tsx` | Users get wrong calorie targets -- potentially harmful |
| **T0-2** | **API keys stored on client** -- CLAUDE.md states "API keys never touch the client" but keys are in AsyncStorage with direct API calls | Step 13 | `ai-provider.ts` | Security vulnerability, cost exposure |
| **T0-3** | **Dead dark mode toggle** -- `value={false}`, `onValueChange={() => {}}` visible to users | Step 11 | `settings.tsx` | Broken feature visible in production |
| **T0-4** | **Missing account deletion** -- required by App Store and Google Play policies | Step 11 | `settings.tsx` | App Store rejection risk |
| **T0-5** | **Hardcoded `'lbs'` unit** -- `const unit = 'lbs'; // TODO: from user prefs` | Step 6 | `[exerciseId].tsx:29` | Metric users see wrong units |
| **T0-6** | **Recipe logs always as 'lunch'** -- `handleLogRecipe` hardcodes meal type | Step 8 | `recipes.tsx` | Data corruption |
| **T0-7** | **`loading` state never set to true** in photo-log | Step 8 | `photo-log.tsx` | Dead prop, no loading indicator |

---

## Tier 1: High-Impact UX Improvements

These address the biggest gaps identified against competitors and have the most potential to improve retention.

### 1A: Rest Timer Redesign (Highest Single-Impact Change)

**Source:** Step 5

The full-screen blocking rest timer overlay is the highest-impact single change opportunity identified in the entire audit. Users stare at a static countdown for 60-90 seconds, unable to review or edit the next set.

**Current:** Full-screen modal with large countdown text, skip and +15s buttons.

**Target:** Non-blocking compact timer bar at the top or bottom of the workout screen. Timer visible while the user can scroll, edit weights, review upcoming sets. Expand to full-screen on tap if desired.

**Includes:**
- Visual countdown ring (arc that depletes, color shift green-yellow-red)
- Pulsing animation in last 5 seconds
- Auto-collapse to compact bar
- Keep the double-pulse haptic at completion

### 1B: Workout Completion Celebration

**Source:** Step 14

The workout summary modal is the emotional peak of the app experience and currently shows a static modal with a generic message.

**Target:**
- Confetti animation on modal appear
- Animated stat counters (count up from 0)
- Heavy haptic burst
- Share card for social media
- Comparison to previous session ("12% more volume than last Push Day")

### 1C: PR Celebration Banner

**Source:** Step 14

PRs are the core dopamine loop of a workout app. Currently a small inline trophy bouncing from 1x to 1.5x in a set row.

**Target:**
- Full-width "NEW PERSONAL RECORD" banner slides in above the exercise card
- Gold gradient background
- Persists 3-5 seconds
- Heavy + success haptic sequence
- Consider: toast notification if the app is backgrounded

### 1D: Barcode Scanner for Food Logging

**Source:** Steps 8, 13

The #1 competitive gap vs. MyFitnessPal. Most-requested feature in any nutrition app.

**Target:**
- `expo-camera` barcode detection
- Lookup against OpenFoodFacts or USDA FoodData Central API
- Pre-populate macro fields from scan result
- Edit before logging

### 1E: Achievement Unlock System

**Source:** Step 14

Achievements unlock silently into a Zustand store. The `newlyEarned` flag is set but never read by any UI component.

**Target:**
- `AchievementUnlockOverlay` triggers on `newlyEarned` changes
- Badge scale-up + glow animation
- Success haptic
- Toast notification if the unlock happens during a different flow

---

## Tier 2: Accessibility Foundation

These are WCAG compliance requirements. The app currently has zero accessibility attributes across 200+ interactive elements.

### 2A: Reusable Component Accessibility

**Source:** Step 15

Fix accessibility at the component level so it propagates everywhere:

| Component | Required Changes |
|-----------|-----------------|
| `IconButton.tsx` | Require `accessibilityLabel` prop (or warn when absent) |
| `Button.tsx` | Add `accessibilityRole="button"`, pass label from `title` prop |
| `Input.tsx` | Add `accessibilityLabel` from placeholder/label, add `returnKeyType` |
| `Badge.tsx` | Add `accessibilityLabel` with variant + text |
| `ProgressRing.tsx` | Add `accessibilityValue={{ now, min: 0, max: 100 }}` |
| `MacroBar.tsx` | Add `accessibilityValue` + `accessibilityLabel` |
| `Card.tsx` | Add `accessible` prop forwarding |

### 2B: Color Contrast Fix

**Source:** Step 15

Change 4 color tokens in `colors.ts` to fix all contrast failures simultaneously:

| Token | Current | Fixed | Ratio on White |
|-------|---------|-------|----------------|
| Light `textTertiary` | `#9CA3AF` | `#737373` | 4.6:1 |
| Light `primary` | `#0891B2` | `#0E7490` | 4.6:1 |
| Light `warning` | `#F59E0B` | `#B45309` | 4.5:1 |
| Light `tabBarInactive` | `#9CA3AF` | `#737373` | 4.6:1 |
| Dark `textTertiary` | `#64748B` | `#94A3B8` | 4.6:1 |

### 2C: Touch Target Remediation

**Source:** Steps 2-12, 15

| Element | Current | Fix |
|---------|---------|-----|
| Button `sm` variant | 36px | 44px |
| Sign-up checkbox | 22x22 | 44x44 |
| Coach send buttons (3 locations) | 36-40px | 44px |
| Active workout overflow button | 36x36 | 44x44 |
| Active workout remove button | 28x28 | 44x44 |
| Nutrition supplement pills | ~20px | 44px minHeight |
| Today tab avatar | 36x36 | 44x44 |
| Progress filter tabs | paddingVertical: 4px | 44px minHeight |
| ChatBubble apply button | paddingVertical: 4px | 44px minHeight |
| SuggestedPrompts chips | paddingVertical: 8px | 44px minHeight |

### 2D: Screen-by-Screen Accessibility Pass

**Source:** Step 15

After component-level fixes, each screen needs:
- `accessibilityRole="header"` on section headings
- `accessibilityLabel` on all remaining icon-only buttons
- `accessibilityState` on toggles, checkboxes, completion indicators
- Keyboard navigation (`returnKeyType` + `onSubmitEditing`) on auth forms

---

## Tier 3: Design System Cleanup

### 3A: Nutrition Hydration Color Token Migration

**Source:** Step 16

Replace ~25 hardcoded hex values in `nutrition.tsx` hydration section with theme tokens. This is the single worst offender -- dark mode will be broken for this entire section.

### 3B: Shadow Standardization

**Source:** Step 16

Add `shadows.sm / .md / .lg` presets to theme. Migrate 6 different shadow implementations across `Card.tsx`, `Toast.tsx`, `CoachFAB.tsx`, `LockedFeature.tsx`, `nutrition.tsx`, `ChatBubble.tsx`.

### 3C: Typography Token Adoption

**Source:** Step 16

Add missing tokens (`typography.captionSmall`, `typography.displayHero`). Replace ~20 inline `fontSize`/`fontWeight` overrides with token references.

### 3D: Spacing Token Adoption

**Source:** Step 16

Replace ~50 hardcoded spacing values with tokens. Start with exact matches (`8`->`spacing.sm`, `12`->`spacing.md`, `16`->`spacing.base`, etc.).

### 3E: Component Extraction

**Source:** Step 16

Extract `SectionHeader`, `Chip`, and `StatCell` as reusable UI components.

---

## Tier 4: Architecture and Code Quality

### 4A: Active Workout File Decomposition

**Source:** Step 4

`active.tsx` at 2824 lines is the largest file in the codebase and contains: set rows, exercise cards, modals, summary, rest timer, reorder logic, and exercise picker.

**Target decomposition:**
- `SetRow.tsx` (standard, bodyweight, timed variants)
- `ExerciseCard.tsx`
- `RestTimerBar.tsx` (new non-blocking design from T1-A)
- `WorkoutSummaryModal.tsx`
- `ExercisePickerModal.tsx`
- `WorkoutStatsBar.tsx`

### 4B: AI Infrastructure Migration

**Source:** Step 13

Migrate client-side AI calls to Supabase Edge Functions. The server infrastructure already exists with rate limiting, safety filtering, and usage tracking.

### 4C: Coach Component Deduplication

**Source:** Step 10

`InWorkoutCoach.tsx` (625 lines) and `InNutritionCoach.tsx` (257 lines) share ~80% structural duplication. Extract shared `CoachSheet` base component.

### 4D: Progress Tab Decomposition

**Source:** Step 9

`progress.tsx` at 1257 lines. Extract chart components, filter logic, and data aggregation into separate files.

---

## Tier 5: Feature Additions

### 5A: Voice-Controlled Workout Logging

**Source:** Step 13

No major competitor has shipped this. The exercise matching infrastructure already exists in `ai-workout-generator.ts`.

### 5B: AI Progress Narratives

**Source:** Step 13

Replace raw charts on the Progress tab with AI-generated insights. The prompt engineering patterns and data aggregation already exist in `daily-briefing.ts` and `weekly-summary.ts`.

### 5C: Conversational Meal Planning Screen

**Source:** Step 13

Surface the existing `generate_meal_plan` and `generate_grocery_list` coach actions through a dedicated UI flow instead of requiring users to discover them in chat.

### 5D: Program Editing

**Source:** Step 6

Programs can be created and deleted but not edited. Users must delete and recreate to make changes.

### 5E: Onboarding DOB DatePicker

**Source:** Step 11

Replace manual `YYYY-MM-DD` text input with native DateTimePicker.

### 5F: Pull-to-Refresh on All Tabs

**Source:** Step 14

Add `RefreshControl` to Today, Nutrition, Progress, and Workout tabs.

### 5G: Reduced Motion Support

**Source:** Step 15

Wrap all animations in `AccessibilityInfo.isReduceMotionEnabled()` check.

---

## Cross-Cutting Themes

These patterns emerged across multiple audit steps and should inform all future development:

### 1. "Zero Accessibility" Is the Biggest Systemic Issue

Every single audit step (2-12) flagged the same finding: zero `accessibilityLabel`, zero `accessibilityRole`, zero `accessibilityHint`. This is not a per-screen problem -- it's a development practice problem. **Recommendation:** Add ESLint rule `jsx-a11y/accessible-emoji`, `jsx-a11y/label-has-associated-control` or equivalent React Native a11y linting. Make accessibility review part of PR checks.

### 2. The App Is Functionally Strong but Emotionally Flat

FormIQ's set logging speed is competitive with Hevy and Strong (1-tap with pre-fill). The FocusedWorkoutView is a genuine differentiator. The AI breadth exceeds every competitor. But the app lacks celebration, delight, and reinforcement at the moments that drive retention: workout completion, PRs, goal attainment, streaks, and achievements.

### 3. Hydration Section Is the Dark Mode Landmine

`nutrition.tsx`'s hydration section contains 25 hardcoded hex colors that will render incorrectly in dark mode. This is by far the most concentrated token violation in the codebase.

### 4. Two AI Architectures Exist in Parallel

The client-side AI implementation (active, with keys on device) and the server-side Edge Functions (built but unused) need to be reconciled. The server-side architecture is more mature (rate limiting, safety, tracking) but the client-side is what ships.

### 5. Monolith Files Slow Down Iteration

`active.tsx` (2824 lines), `progress.tsx` (1257 lines), and `nutrition.tsx` (816 lines) are difficult to modify without risking regressions. Decomposition enables parallel development and targeted testing.

---

## Implementation Order Summary

| Order | Tier | Focus | Estimated Items |
|-------|------|-------|----------------|
| 1st | T0 | Critical bugs (hardcoded targets, dead toggles, security) | 7 items |
| 2nd | T1 | High-impact UX (rest timer, celebrations, barcode) | 5 items |
| 3rd | T2 | Accessibility foundation (component a11y, contrast, touch targets) | 4 items |
| 4th | T3 | Design system cleanup (color tokens, shadows, typography) | 5 items |
| 5th | T4 | Architecture (file decomposition, AI migration, dedup) | 4 items |
| 6th | T5 | Feature additions (voice logging, AI narratives, meal planning) | 7 items |

Total: **32 items** across 6 tiers.

---

## Audit Complete

This concludes the 17-step UX/UI audit of FormIQ. All findings are documented in `docs/audit/step-01` through `step-17`. The audit covered:

- **12 screen groups** across the entire app
- **~50 source files** reviewed
- **9 competitor apps** benchmarked
- **~200 interactive elements** assessed for accessibility
- **~115 design token violations** cataloged
- **10 animations and 7 haptic triggers** inventoried
- **32 prioritized action items** in the roadmap

The three highest-leverage changes identified across the entire audit:
1. **Non-blocking rest timer** (Step 5, T1-A) -- transforms dead time into productive time
2. **Reusable component accessibility** (Step 15, T2-A) -- fixes ~80% of a11y issues through 7 component changes
3. **Nutrition hydration color migration** (Step 16, T3-A) -- fixes 25 token violations and dark mode in one file

*Spec audit complete (Steps 1-17). The additional suggestion steps (S1-S12) from the original plan remain available if desired.*
