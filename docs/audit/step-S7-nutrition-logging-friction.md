# S7: Nutrition Logging Friction

## Method Comparison

| Method | Taps | AI? | Accuracy | Speed | Best For |
|--------|------|-----|----------|-------|----------|
| **Quick Add** | 4-5 | No | User-dependent | Fastest | Rough tracking, known calories |
| **Saved Meals** | 4 | No | High (template) | Fast | Repeated meals |
| **Text Log** | 5 + AI wait | Yes | Medium (AI) | Medium | Varied meals, natural language |
| **Photo Log** | 7 + AI wait | Yes | Low-Medium | Slowest | Novel meals, visual reference |
| **Recipe Log** | 3 | No | High (recipe data) | Fast | Recipes already in library |

---

## Method 1: Quick Add

**Path:** Nutrition tab -> FAB -> log-meal -> Quick Add -> enter/preset -> Add

**Tap count: 4-5**

**Strengths:**
- Calorie input auto-focused on screen open
- Preset buttons [100, 200, 300, 500] reduce to 2-tap entry
- Macro fields optional (protein, carbs, fat)

**Issues:**
- No macro validation -- a 500 cal meal can be saved with 0g protein/carbs/fat (nutritionally impossible)
- No confirmation toast after save -- `router.dismiss()` fires immediately
- Cannot save as template from this screen
- `parseInt(calories) || 0` silently converts non-numeric to 0

---

## Method 2: Saved Meals

**Path:** Nutrition tab -> FAB -> log-meal -> Saved Meals -> tap meal

**Tap count: 4** (fastest method)

**Strengths:**
- Sorted by use count (most-used first)
- Single tap to log -- no confirmation needed
- Template has exact macros (`is_estimate: false`)

**Issues:**
- One-tap logging has no undo -- accidental taps log the meal
- Cannot edit a saved meal's items before logging (logs template as-is)
- Long-press to delete is undiscoverable
- Saved meals can only be created from meal-detail "Save as Template" -- no standalone creation flow

---

## Method 3: Text Log (AI)

**Path:** Nutrition tab -> FAB -> log-meal -> "Type it" -> describe -> analyze -> review -> save

**Tap count: 5 + typing + AI wait**

**Strengths:**
- Natural language input ("chicken breast, rice, broccoli")
- AI returns structured nutrition data per item
- Items individually editable after parsing

**Issues:**
- **Silent AI fallback** -- when AI fails, the keyword parser (`meal-parser.ts`) silently takes over with hardcoded values (150 cal, 5g protein, 15g carbs, 7g fat for unrecognized items). User never knows AI wasn't used.
- `try/finally` with no catch in `text-log.tsx:36-47` -- errors are swallowed
- Explanation truncated to 1 line per item
- Macro edit fields are 32-36px (below 44pt touch target)
- `router.dismiss()` on save returns to log-meal hub, not nutrition tab (inconsistent with photo-review's `router.dismiss(2)`)

---

## Method 4: Photo Log (AI)

**Path:** Nutrition tab -> FAB -> log-meal -> Photo -> capture/select -> photo-review -> save

**Tap count: 7 + camera + AI wait**

**Strengths:**
- Claude Vision multimodal analysis
- Auto-triggers analysis on mount (no manual "analyze" tap needed)
- `router.dismiss(2)` correctly returns to nutrition tab

**Issues:**
- **Critical: mock data fallback** -- when AI fails, returns hardcoded items ("Grilled Chicken" 248 cal, "White Rice" 206 cal, "Mixed Vegetables" 45 cal) regardless of photo content. User sees fabricated data with no warning.
- `loading` state in photo-log.tsx is declared but never set to `true` -- dead prop
- `media_type: 'image/jpeg'` hardcoded -- PNG/HEIC photos may cause issues
- Two-screen flow (photo-log -> photo-review) adds unnecessary navigation
- `router.dismiss(2)` is fragile navigation

---

## Method 5: Recipe Log

**Path:** Nutrition tab -> Quick Links -> Recipes -> "Log" button

**Tap count: 3** (from nutrition tab)

**Strengths:**
- AI recipe generation with full context (goals, allergies, equipment, macros)
- Error handling is the best in the app (red error box + retry)
- Grocery list integration

**Issues:**
- **Bug: `handleLogRecipe` hardcodes `'lunch'` as meal type** (line 200: `logRecipe(recipeId, 'lunch' as MealType)`)
- Manual recipe creation is tedious -- per-ingredient name + macros entry
- No recipe editing after creation

---

## Hydration Tracking

**Path:** Nutrition tab -> tap "8oz" or "16oz" or "Custom"

**Tap count: 1** (quick-add) or **3** (custom amount)

This is the best UX in the app. One-tap water logging with haptic feedback, toast confirmation, and ripple animation. The `subtract8oz` function exists in the hook but has no UI to undo -- consider adding a long-press to subtract.

---

## Supplement Tracking

**Path:** Nutrition tab -> expand Supplements section -> tap supplement row

**Tap count: 2**

Clean checkbox-style toggle with strikethrough for completed items. Streak tracking per supplement.

---

## Missing Features

| Feature | Status | Competitor |
|---------|--------|------------|
| Barcode scanning | Not implemented | MyFitnessPal, MacroFactor |
| Food database search | Not implemented | MyFitnessPal, Cronometer |
| Copy yesterday's meals | Not implemented | MyFitnessPal, MacroFactor |
| Meal template from scratch | Not implemented | Only via "Save as Template" from logged meal |
| Undo meal log | Not implemented | -- |

---

## Competitor Speed Comparison

| Action | FormIQ | MyFitnessPal | MacroFactor |
|--------|--------|-------------|-------------|
| Fastest meal log | 4 taps (saved meal) | 3 taps (barcode scan) | 3 taps (smart search) |
| Quick calorie add | 4-5 taps | 4 taps | N/A |
| Water log | **1 tap** | 2 taps | 2 taps |
| Repeat yesterday | N/A | 1-2 taps | 1-2 taps |

FormIQ's water logging is best-in-class. Its meal logging is competitive for quick-add and saved meals but lacks the two fastest methods in competing apps: barcode scanning and food database search.

---

## Recommendations

| # | Change | Impact |
|---|--------|--------|
| 1 | **Add barcode scanner** (OpenFoodFacts or USDA API) | Closes #1 competitive gap |
| 2 | **Show error state when AI fails** instead of silent fallback | Prevents logging fabricated data |
| 3 | **Fix recipe log meal type** -- use time-of-day suggestion or let user choose | Correct data |
| 4 | **Add "Copy yesterday" button** to log-meal hub | Common use case, 1-tap |
| 5 | **Fix text-log `router.dismiss()` -> `router.dismiss(2)`** | Consistent post-save navigation |
| 6 | **Add macro validation** to quick-add (cal ~= P*4 + C*4 + F*9) | Prevents impossible entries |

*S7 complete.*
