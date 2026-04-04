# Step 7: Nutrition Tab Audit

**File:** `apps/mobile/app/(tabs)/nutrition.tsx` (816 lines)
**Role:** Primary nutrition dashboard showing calorie ring, macro bars, hydration tracker, meal log, supplements, and navigation to recipes/saved meals/grocery list.

---

## Executive Summary

The Nutrition Tab is **feature-rich and well-designed**, with a prominent calorie ring, 4 macro bars (protein/carbs/fat/fiber), an interactive hydration tracker with quick-add buttons, supplement tracking with streaks, and a floating action button for meal logging. The paywall gating and usage limits are cleanly implemented.

Key strengths: the water quick-add (8oz/16oz/Custom) with ripple animation and haptic feedback is one of the best micro-interactions in the app. The date selector enables historical tracking. The meal type badges (Breakfast/Lunch/Dinner/Snack) with variant colors create visual categorization.

Key weaknesses: hardcoded water colors (`#3B82F6`, `#EFF6FF`, `#22C55E`) bypass the theme system, the calorie ring uses a CSS-border-hack that only shows 4 stages (0/25/50/75/100%), and there's no macro trend visualization.

---

## Section-by-Section Assessment

### 1. Calorie Ring + Macros (Lines 173-237)

**What works:**
- 160px ring with 12px stroke -- large and prominent
- Center shows consumed/target with "remaining" or "over" context
- 4 macro bars (Protein, Carbs, Fat, Fiber) use the `MacroBar` component
- Color changes to warning when over target

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Ring progress is approximated with 4 border segments | HIGH | The ring uses `borderTopColor`, `borderRightColor`, etc., creating a 4-stage progress (0-25%, 25-50%, 50-75%, 75-100%). This is visually inaccurate -- 30% and 49% look identical. Should use the `ProgressRing` component from the UI library or SVG. |
| No animation on ring fill | MEDIUM | Ring renders at its final value instantly. Should animate from 0 to current value on mount and on data change. |
| No macro trend | MEDIUM | Shows today's macros but no trend (7-day average, weekly adherence %). MacroFactor shows macro trends as the primary view. |
| Ring doesn't show percentage | LOW | Center shows absolute calories but not percentage. Adding "72%" as a subtle label would help at-a-glance assessment. |

### 2. Hydration Tracker (Lines 239-421)

**What works:**
- Water ring (100px) with percentage display
- Quick-add buttons: 8oz, 16oz, Custom -- each with haptic feedback
- Toast notification on water add ("+8oz water logged")
- Ripple animation on water add -- visual satisfaction
- Custom water modal with auto-focus and validation

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Hardcoded colors bypass theme | HIGH | `#3B82F6`, `#EFF6FF`, `#22C55E` appear throughout the hydration section instead of `colors.info`, `colors.infoLight`, `colors.success`. This breaks dark mode theming -- blue buttons on dark surface will look different than expected. |
| Water ring uses same 4-segment border hack | MEDIUM | Same issue as the calorie ring. Should use `ProgressRing`. |
| No undo for water add | MEDIUM | `subtract8oz` exists in the hook but only a `-8oz` button is available somewhere. If the user accidentally taps +8oz, they can't easily undo. Should add undo via toast action. |
| Water only tracks in oz | MEDIUM | No metric (ml) support. Users outside the US will find "oz" confusing. |
| No water history/trend | LOW | No weekly hydration chart. |

### 3. Today's Meals (Lines 423-493)

**What works:**
- Meal cards with type badge (color-coded), time, name, food items preview, and calorie total
- Sorted chronologically
- Empty state with contextual messaging (different for today vs. past dates)
- Tappable for navigation to meal detail
- Meal count ("3 logged") in section header

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No delete/swipe-to-delete on meals | MEDIUM | Users must drill into meal detail to delete. Swipe-to-delete from the list would be faster. |
| No meal grouping by type | LOW | All meals render in chronological order. Grouping by meal type (Breakfast, Lunch, Dinner, Snacks) with subtotals would match MyFitnessPal's pattern and help users see if they're balanced. |
| Meal items text truncated to 1 line | LOW | `numberOfLines={1}` on food items list. For complex meals, user can't see what's in them without tapping in. |

### 4. Supplements (Lines 496-563)

**What works:**
- Collapsible section with completion counter ("2/4")
- Checkmark toggle with strike-through text
- Streak display per supplement
- "Manage Supplements" link at bottom

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| No haptic feedback on supplement toggle | LOW | Unlike water quick-add (which has haptics), supplement check/uncheck is silent. |
| No time tracking for supplements | LOW | Shows taken/not-taken but not when the supplement was taken. Some users split supplements (AM/PM). |

### 5. Quick Links (Lines 567-601)

**What works:**
- 3-4 icon grid: Saved Meals, Recipes, Grocery List, Supplements
- Supplements link only appears when no active supplements (avoids duplication)

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| Grid becomes uneven with 3 vs 4 items | LOW | When supplements section is showing, quick links has 3 items. When hidden, it has 4. The grid stretches unevenly. |

### 6. FAB (Lines 641-650)

**What works:**
- Floating "Log Meal" button with count for free tier
- Haptic feedback on press
- Shadow/elevation for visual prominence

**What needs to change:**

| Issue | Severity | Detail |
|-------|----------|--------|
| FAB position is `position: absolute, right: 16, bottom: spacing['2xl']` | MEDIUM | On some devices, this may overlap with the bottom tab bar. Should use `useSafeAreaInsets().bottom` for dynamic positioning. |
| No FAB animation on scroll | LOW | FAB is always visible. Common pattern: hide on scroll down, show on scroll up. |

---

## Cross-Cutting Issues

### Accessibility

| Issue | Severity |
|-------|----------|
| No `accessibilityLabel` on any element | CRITICAL |
| Calorie ring has no screen reader value | HIGH |
| Water quick-add buttons have no descriptive labels | HIGH |
| Meal type conveyed primarily by badge color | MEDIUM |
| Date selector arrows have no labels | MEDIUM |

### Theme Compliance

At least 12 hardcoded color values in the hydration section:
- `#3B82F6` (should be `colors.info`)
- `#EFF6FF` (should be `colors.infoLight`)
- `#22C55E` (should be `colors.success`)
- `#FFFFFF` (should be `colors.textInverse`)

### Performance

| Issue | Severity |
|-------|----------|
| `checkMealLogLimit` called on every `meals.length` change | LOW |
| All sections render simultaneously | LOW |

---

## Prioritized Recommendations

### P0 -- Must Fix

1. **Replace hardcoded colors** with theme tokens (12+ instances)
2. **Replace border-hack rings** with `ProgressRing` or SVG for accurate progress
3. **Add accessibility labels** to all interactive elements

### P1 -- High Impact

4. **Add macro trend visualization** -- 7-day adherence chart or weekly average
5. **Add undo toast for water** -- "Added 8oz. Undo?"
6. **Add metric (ml) support** for water tracking
7. **Animate calorie ring** on mount and data change
8. **Fix FAB positioning** with safe area insets

### P2 -- Polish

9. **Add swipe-to-delete** on meal cards
10. **Group meals by type** with subtotals
11. **Add haptic feedback** to supplement toggles
12. **Add percentage** to calorie ring center text
13. **Add water weekly trend** chart

### P3 -- Nice to Have

14. **Animate FAB** on scroll direction
15. **Add meal type grouping** with per-group calorie subtotals
16. **Add supplement timing** (AM/PM split)
17. **Fix quick links grid** for consistent 4-item layout

---

*Step 7 complete. Proceeding to Step 8: Nutrition Flow Screens Audit.*
