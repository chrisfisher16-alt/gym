# S3: Navigation Depth Analysis

## Navigation Tree

```
Root Stack
+-- (auth)/          sign-in, sign-up, forgot-password
+-- (onboarding)/    welcome, profile, goals, body, mode, coach-tone, complete
+-- (tabs)/          5-tab main shell
|   +-- index        Today dashboard
|   +-- workout      Workout hub
|   +-- nutrition    Nutrition dashboard
|   +-- coach        AI Coach chat
|   +-- progress     Progress analytics
+-- workout/         Nested stack
|   +-- active       Active workout (gestureEnabled: false)
|   +-- exercises    Exercise library
|   +-- [exerciseId] Exercise detail
|   +-- create-exercise  (modal)
|   +-- history      Workout history
|   +-- ai-generate  AI workout generator
|   +-- programs/
|   |   +-- index    Program list
|   |   +-- [id]     Program detail
|   |   +-- create   Create program (modal)
|   +-- session/
|       +-- [id]     Past session detail
+-- nutrition/       Nested stack
|   +-- log-meal     Method picker hub
|   +-- text-log     AI text entry
|   +-- quick-add    Direct calorie entry (modal)
|   +-- photo-log    Photo capture
|   +-- photo-review AI photo analysis
|   +-- saved-meals  Saved meal templates
|   +-- meal-detail  Meal view/edit
|   +-- supplements  Supplement tracker
|   +-- recipes      Recipe browser
|   +-- targets      Nutrition targets (modal)
|   +-- grocery-list Grocery list
+-- progress/
|   +-- measurements Body measurements + photos
+-- settings, profile, notifications, paywall, health-connect,
    health-settings, ai-settings, export-data, privacy, terms, about
    (all modals from root)
```

---

## Depth by Task

| Task | Path | Taps from Tab | Max Depth |
|------|------|---------------|-----------|
| Log a set (active workout) | Workout -> Start -> Active -> log | 2 | 2 |
| View exercise history | Workout -> History -> Session | 2-3 | 3 |
| Log meal (text) | Nutrition -> FAB -> log-meal -> text-log | 3 | 3 |
| Log meal (photo) | Nutrition -> FAB -> log-meal -> photo-log -> photo-review | 4 | 4 |
| View/edit nutrition targets | Nutrition -> gear icon -> targets modal | 1 | 1 |
| Create a program | Workout -> Programs card -> list -> create | 3 | 3 |
| View a recipe | Nutrition -> Recipes link -> recipes (inline expand) | 2 | 2 |
| Access AI Coach | Coach tab | 0 | 0 |
| View achievements | Progress tab -> scroll | 0 + scroll | 0 |
| Change settings | Today -> avatar icon -> settings modal | 1 | 1 |
| Add exercise mid-workout | Active -> Add Exercise -> Library -> Detail -> back | 3 (from active) | 4 total |

### Tasks Exceeding 3 Taps

**Photo meal logging (4 taps)** is the deepest standard flow. Mitigated by `router.dismiss(2)` on save -- user returns to nutrition tab, not intermediate screens.

**Exercise addition mid-workout (3 taps from active, 4 total)** -- the 3-screen detour (Active -> Library -> Detail -> Active) is the most friction-heavy navigation. Exercise detail is informational overhead when the intent is "add quickly."

---

## Navigation Inconsistencies

### `router.dismiss()` vs `router.dismiss(2)` vs `router.back()`

| File | Action | Method | Result |
|------|--------|--------|--------|
| `text-log.tsx` | Save meal | `router.dismiss()` | Returns to log-meal hub (needs another back tap) |
| `photo-review.tsx` | Save meal | `router.dismiss(2)` | Returns to nutrition tab (skips intermediates) |
| `targets.tsx` | Save targets | `router.back()` | Returns to previous screen |
| `[exerciseId].tsx` | Add to workout | `router.dismiss(2)` | Returns to active workout (skips library) |

**Issue:** Saving a text-logged meal leaves the user at the log-meal hub, requiring another back tap to reach the nutrition tab. Saving a photo-logged meal returns directly to the nutrition tab. This inconsistency should be resolved -- text-log should also use `router.dismiss(2)`.

### Active Workout: Gesture Disabled

`workout/active` sets `gestureEnabled: false` -- the user cannot swipe back, which is correct (prevents accidental workout loss). Discard requires explicit action through the toolbar.

### No Dead Ends Found

Every screen has a back button, close button, or dismiss mechanism. The only potential confusion is when saving from text-log leaves the user at the log-meal hub rather than the nutrition tab.

---

## Recommendations

| # | Change | Impact |
|---|--------|--------|
| 1 | Fix text-log save to use `router.dismiss(2)` matching photo-review | Consistent post-save navigation |
| 2 | Add inline "+" to exercise library rows (skip detail screen) | Reduce exercise-add from 3 to 1 tap within active workout |
| 3 | Consider adding "Recent Exercises" section at top of exercise library | Reduce browsing friction for returning users |

*S3 complete.*
