# Step 12: Modals, Sheets, Alerts, and Toasts Audit

**Files:**
- `apps/mobile/src/components/Toast.tsx` (178 lines)
- `apps/mobile/src/components/UpgradeBanner.tsx` (114 lines)
- `apps/mobile/src/components/WorkoutMilestones.tsx` (165 lines)
- Modal patterns across the app

---

## A. Toast System (`Toast.tsx`)

**What works:** Context-based architecture (`ToastProvider` + `useToast()`), 4 semantic variants (success/error/info/warning), spring-in animation with timed fade-out, safe area aware, auto-dismiss with configurable duration, queue management (max 3), dismissible close button, theme-compliant colors, subtle variant border

**What needs to change:**
- No `accessibilityLiveRegion="polite"` -- screen readers won't announce toasts (HIGH)
- Close button hitSlop only 8px = ~34px total, below 44pt (MEDIUM)
- Hardcoded `shadowColor: '#000'` (LOW)
- No swipe-to-dismiss gesture (LOW)

## B. UpgradeBanner (`UpgradeBanner.tsx`)

**What works:** Conditional rendering for free users, configurable message/plan/feature, clean layout, theme-compliant, dismiss with hitSlop

**What needs to change:**
- Dismissal resets on re-render (not persisted) -- banner comes back on tab switch (MEDIUM)
- Nested TouchableOpacity (banner tap + dismiss tap) -- gesture conflicts on Android (MEDIUM)
- No accessibility labels (HIGH)
- `colors.primary + '30'` string concatenation for opacity is fragile (LOW)

## C. WorkoutMilestones (`WorkoutMilestones.tsx`)

**What works:** Clear visual hierarchy, milestone badges (10/25/50/100/250), streak logic, theme-compliant

**What needs to change:**
- No accessibility on stats or badges (HIGH)
- Hardcoded spacing values (~5 instances) (MEDIUM)
- Milestone badges look tappable but aren't (LOW)
- No animation on newly earned milestones (LOW)

---

## D. Modal Presentation Pattern Audit

| Component | Style | Animation | Backdrop | Handle |
|-----------|-------|-----------|----------|--------|
| InWorkoutCoach | Modal transparent | slide | rgba(0,0,0,0.3) | Yes |
| InNutritionCoach | Modal transparent | slide | rgba(0,0,0,0.3) | Yes |
| RestTimerOverlay | Absolute position | none | colors.overlay | No |
| WorkoutSummary | Modal pageSheet | slide | System | No |
| ExerciseReplacement | Modal pageSheet | slide | System | No |
| SupersetSelection | Modal pageSheet | slide | System | No |
| CooldownSuggestion | Modal transparent | fade | rgba(0,0,0,0.6) | No |
| Progress congrats | Modal transparent | fade | rgba(0,0,0,0.6) | No |
| Custom water | Modal transparent | fade | rgba(0,0,0,0.5) | No |
| Coach paywall | Alert.alert | native | native | N/A |

**Patterns identified:**
1. **Bottom sheets** (InWorkoutCoach, InNutritionCoach): transparent modal + slide + handle -- consistent
2. **Full-screen modals** (WorkoutSummary, ExerciseReplacement, SupersetSelection): pageSheet + slide -- consistent
3. **Center dialogs** (CooldownSuggestion, congrats, custom water): transparent modal + fade + centered card -- consistent
4. **Outlier**: Alert.alert for coach paywall breaks visual consistency

**Backdrop color inconsistency:** Three different opacity values (0.3, 0.5, 0.6) used across modals. Should standardize to a single `colors.overlay` token.

---

## Prioritized Recommendations

### P0
1. Add `accessibilityLiveRegion="polite"` to toast container
2. Add accessibility labels to UpgradeBanner and WorkoutMilestones

### P1
3. Persist UpgradeBanner dismissal in AsyncStorage
4. Fix nested touchable gesture conflict in UpgradeBanner
5. Standardize backdrop opacity across all modals (use single `colors.overlay`)
6. Increase toast close button touch target to 44pt

### P2
7. Add milestone earned animation
8. Add swipe-to-dismiss on toasts
9. Replace Alert.alert paywall with styled modal
10. Make milestone badges tappable for detail view

---

*Step 12 complete. Proceeding to Step 13.*
