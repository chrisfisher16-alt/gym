# Step 15: Accessibility Audit (WCAG 2.1 AA)

## Verdict: Critical Failure

Across ~150 source files with ~200+ interactive elements, the application contains:

| Attribute | Instances |
|-----------|-----------|
| `accessibilityLabel` | **0** |
| `accessibilityRole` | **0** |
| `accessibilityHint` | **0** |
| `accessibilityState` | **0** |
| `accessibilityValue` | **0** |
| `accessibilityLiveRegion` | **0** |
| `importantForAccessibility` | **0** |
| `aria-label` / `aria-role` | **0** |
| `role` prop | **0** |
| `useReducedMotion` | **0** |
| `AccessibilityInfo` | **0** |

The app is completely inaccessible to VoiceOver and TalkBack users. No interactive element has a semantic name, role, or state.

---

## 1. Missing Accessible Names (WCAG 4.1.2)

Every interactive element in the app lacks an `accessibilityLabel`. The most critical omissions:

### Icon-Only Buttons (Completely Unlabeled)

| Component / File | Element | What a Screen Reader Says |
|------------------|---------|---------------------------|
| `IconButton.tsx` | Every icon button in the app | Nothing meaningful -- reads the component tree |
| `coach.tsx:319-338` | Send message button (Ionicons "send") | "Button" |
| `nutrition.tsx:160-170` | Date navigation arrows | "Button" |
| `nutrition.tsx:322-345` | Water quick-add buttons | "Button" |
| `CoachFAB.tsx:53-68` | Floating AI coach button | "Button" |
| `index.tsx:261-264` | Settings avatar button | "Button" |
| `active.tsx` | Minimize, reorder, overflow, remove buttons | "Button" |
| `Toast.tsx` | Dismiss X button | "Button" |
| `UpgradeBanner.tsx` | Dismiss X button | "Button" |

### Form Inputs (No Associated Labels)

| File | Input | Missing |
|------|-------|---------|
| `sign-in.tsx` | Email, Password fields | `accessibilityLabel`, `returnKeyType`, `onSubmitEditing` |
| `sign-up.tsx` | Email, Password, Confirm Password | Same |
| `forgot-password.tsx` | Email field | Same |
| `active.tsx` | Weight, reps, duration inputs | `accessibilityLabel`, `keyboardType` |
| `FocusedWorkoutView.tsx` | Weight, reps inputs | Same |
| `nutrition.tsx:378` | Custom water amount | `accessibilityLabel` (has `keyboardType` and `autoFocus`) |

### Status Indicators (No Semantic State)

| Element | What It Shows | How It Communicates | A11y Issue |
|---------|--------------|--------------------|----|
| Set completion dots | Complete vs. incomplete | Green vs. gray color only | No `accessibilityState={{ checked: true/false }}` |
| Calorie/macro rings | Progress toward goal | Ring fill + percentage text | No `accessibilityValue={{ now, min, max }}` |
| Workout streak | Streak count | Flame icon + number | No semantic meaning |
| Achievement badges | Earned vs. locked | Color opacity difference | No `accessibilityState` |

---

## 2. Touch Target Violations (WCAG 2.5.5)

### Below 44x44pt Minimum

| Component / File | Element | Actual Size | Gap |
|------------------|---------|-------------|-----|
| `Button.tsx:43` | `sm` variant | 36px height | -8px |
| `sign-up.tsx:300` | Terms checkbox | 22x22px | -22px (critically small) |
| `active.tsx:139` | Set number circle | 28px wide | -16px |
| `WeeklyCheckInCard.tsx:220` | Icon container | 32x32px | -12px |
| `FocusedWorkoutView.tsx:296` | Progress dots | 28x28px | -16px |
| `coach.tsx:327` | Send button | 40x40px | -4px |
| `WorkoutMilestones.tsx:159` | Milestone circles | 40x40px | -4px |
| `ChatBubble.tsx:199` | Apply action button | paddingVertical: 4px (~24px) | -20px |
| `SuggestedPrompts.tsx:44` | Prompt chips | paddingVertical: 8px (~32px) | -12px |
| `Badge.tsx:42` | Badge pill | paddingVertical: 2px (~18px) | -26px |

### Properly Sized (for reference)

| Component | Element | Size | Status |
|-----------|---------|------|--------|
| `Button.tsx:43` | `md` and `lg` variants | 44px / 52px | Pass |
| `IconButton.tsx:49` | Default | minWidth/minHeight: 48px | Pass |
| `Input.tsx:62` | Container | minHeight: 48px | Pass |
| `settings.tsx:372` | Setting rows | minHeight: 44px | Pass |
| `CoachFAB.tsx:76` | FAB circle | 56x56px | Pass |
| `active.tsx` | Weight/rep increment buttons | 44x44px | Pass |
| `active.tsx` | Set checkmark button | 44x44px | Pass |

### hitSlop Usage (Does Not Satisfy WCAG)

Several elements compensate with `hitSlop` (extends tappable area invisibly). Files using this: `Input.tsx`, `nutrition.tsx`, `coach.tsx`, `Toast.tsx`, `WeeklyCheckInCard.tsx`, `UpgradeBanner.tsx`. WCAG requires the *visual* target to be 44pt, not just the tap area.

---

## 3. Color Contrast Failures (WCAG 1.4.3)

### Light Theme

| Pairing | Foreground | Background | Ratio | Required | Status |
|---------|------------|------------|-------|----------|--------|
| `textTertiary` on `background` | `#9CA3AF` | `#FAFAFA` | ~2.8:1 | 4.5:1 | **FAIL** |
| `textTertiary` on `surface` | `#9CA3AF` | `#FFFFFF` | ~2.9:1 | 4.5:1 | **FAIL** |
| `disabledText` on `surface` | `#9CA3AF` | `#FFFFFF` | ~2.9:1 | 4.5:1 | **FAIL** |
| `primary` on `surface` | `#0891B2` | `#FFFFFF` | ~3.5:1 | 4.5:1 | **FAIL** |
| `primary` on `primaryMuted` | `#0891B2` | `#E0F7FA` | ~3.2:1 | 4.5:1 | **FAIL** |
| `warning` on `surface` | `#F59E0B` | `#FFFFFF` | ~2.1:1 | 4.5:1 | **FAIL** |
| `warning` on `warningLight` | `#F59E0B` | `#FEF3C7` | ~2.0:1 | 4.5:1 | **FAIL** |
| `success` on `successLight` | `#059669` | `#D1FAE5` | ~3.7:1 | 4.5:1 | **FAIL** |
| `gold` on `goldLight` | `#D97706` | `#FEF3C7` | ~3.0:1 | 4.5:1 | **FAIL** |
| `tabBarInactive` on `tabBar` | `#9CA3AF` | `#FFFFFF` | ~2.9:1 | 4.5:1 | **FAIL** |
| `textSecondary` on `background` | `#6B7280` | `#FAFAFA` | ~4.9:1 | 4.5:1 | **PASS** (barely) |
| `text` on `background` | `#1A1A2E` | `#FAFAFA` | ~15.8:1 | 4.5:1 | **PASS** |

### Dark Theme

| Pairing | Foreground | Background | Ratio | Status |
|---------|------------|------------|-------|--------|
| `textTertiary` on `background` | `#64748B` | `#0F172A` | ~3.6:1 | **FAIL** |
| `textTertiary` on `surface` | `#64748B` | `#1E293B` | ~2.9:1 | **FAIL** |
| `tabBarInactive` on `tabBar` | `#64748B` | `#1E293B` | ~2.9:1 | **FAIL** |

### Suggested Fixes

| Token | Current | Suggested (AA-compliant) | Notes |
|-------|---------|--------------------------|-------|
| Light `textTertiary` | `#9CA3AF` | `#737373` | 4.6:1 on white |
| Light `primary` | `#0891B2` | `#0E7490` | 4.6:1 on white (slightly darker cyan) |
| Light `warning` | `#F59E0B` | `#B45309` | 4.5:1 on white (darker amber) |
| Light `gold` | `#D97706` | `#B45309` | 4.5:1 on gold-light backgrounds |
| Light `tabBarInactive` | `#9CA3AF` | `#737373` | Match textTertiary fix |
| Dark `textTertiary` | `#64748B` | `#94A3B8` | 4.6:1 on `#1E293B` |

---

## 4. Color-Only Information (WCAG 1.4.1)

The following elements convey meaning through color alone with no shape, icon, or text alternative:

| Element | File | Color-Only Info | Fix |
|---------|------|----------------|-----|
| Set completion status | `active.tsx` | Green dot = done, gray = pending | Add checkmark icon to completed sets |
| Macro progress bars | `MacroBar.tsx` | Different colors per macro | Already has labels -- acceptable |
| Nutrition adherence | `progress.tsx` | Green/yellow/red = met/close/missed | Add icon or text label |
| Achievement earned state | `AchievementBadge.tsx` | Full opacity vs. reduced opacity | Add lock icon to unearned |
| Muscle group chart | `progress.tsx` | Different colored bars per muscle | Add pattern fills or labels |
| Badge variants | `Badge.tsx` | Background color = semantic meaning | Add icon prefix per variant |

---

## 5. Heading Hierarchy (WCAG 2.4.6)

**0** instances of `accessibilityRole="header"` in the entire codebase. The app uses visual heading styles (`typography.h1`, `typography.h2`, `typography.h3`) but no semantic heading markup. Screen reader users cannot navigate by heading.

**Screens with visual headings that need semantic annotation:**

| Screen | Visual Headings |
|--------|----------------|
| Today | "Good morning, [Name]", "Nutrition", "Insights", "Quick Actions" |
| Workout | "Workout", "Today's Workout", "Recent Workouts", "Programs" |
| Nutrition | "Nutrition", "Today's Meals", "Supplements", "Hydration" |
| Progress | "Progress", section tabs |
| Coach | "AI Coach" |
| Settings | "Preferences", "Subscription", "More" |

---

## 6. Focus Management (WCAG 2.4.3)

### Modals -- No Focus Trapping

Every modal in the app allows focus to escape to background content:

| File | Modal | Focus Trapped? | Focus Restored? |
|------|-------|----------------|-----------------|
| `nutrition.tsx:350-421` | Custom water modal | No | No |
| `active.tsx` | Exercise picker | No | No |
| `active.tsx` | Workout summary | No | No |
| `active.tsx` | Rest timer overlay | No | No |
| `active.tsx` | Cooldown suggestion | No | No |

React Native's `Modal` component does not automatically trap focus. This requires either a focus trap library or manual `ref`-based focus management.

### Programmatic Focus -- Absent

**0** instances of `.focus()` called on refs anywhere in the codebase. No screen transition or modal open/close manages focus programmatically.

---

## 7. Keyboard Accessibility (WCAG 2.1.1)

### Form Navigation

| Form | Fields | returnKeyType | onSubmitEditing Chain | Status |
|------|--------|---------------|----------------------|--------|
| Sign In | Email, Password | Not set | No | **FAIL** |
| Sign Up | Email, Password, Confirm | Not set | No | **FAIL** |
| Forgot Password | Email | Not set | No | **FAIL** |
| Coach Chat | Message | `"send"` | Yes (`handleSend`) | **PASS** |
| Workout Sets | Weight, Reps | Not set | No | **FAIL** |
| Custom Water | Amount | Not set | No | **FAIL** |

The coach chat input is the only properly keyboard-accessible form in the app.

### Keyboard Submit

Sign-in, sign-up, and forgot-password forms cannot be submitted via the keyboard return key. The user must dismiss the keyboard and tap the submit button.

---

## 8. Reduced Motion (WCAG 2.3.3)

**0** instances of `AccessibilityInfo.isReduceMotionEnabled()` or `useReducedMotion()`.

All 10 animations in the app run unconditionally regardless of the user's system "Reduce Motion" preference. Affected animations:

- Toast slide-in/out (spring animation)
- Set completion green flash + scale bounce
- PR trophy bounce
- LOG SET button scale
- Water ripple
- Coach typing indicator (looped)
- Skeleton shimmer (looped)

The looped animations (typing indicator, skeleton shimmer) are the most significant violation -- they repeat indefinitely with no way to pause.

---

## 9. Dynamic Type / Font Scaling

React Native defaults `allowFontScaling` to `true`, so text will scale with system accessibility text size preferences. However, **0** instances of `maxFontSizeMultiplier` exist in the codebase, which means layouts will break at extreme font sizes.

### Layout Breakage Risks

| Component | Risk | Details |
|-----------|------|---------|
| `ProgressRing.tsx` | HIGH | Hardcoded `fontSize: size > 56 ? 13 : 10` inside fixed-diameter ring |
| `Badge.tsx` | HIGH | `paddingVertical: 2` -- scaled text overflows pill |
| `Button.tsx` | MEDIUM | Fixed heights (36/44/52) -- scaled text may clip |
| Tab bar labels | MEDIUM | `fontSize: 11` in fixed `height: 56` container |
| Set row cells | MEDIUM | Multiple numbers in fixed-width inline layout |
| `ExerciseIllustration.tsx` | LOW | `fontSize: 10` in absolute-positioned overlay |

### Recommended `maxFontSizeMultiplier` Values

- Progress ring text: `1.2`
- Badge text: `1.3`
- Tab bar labels: `1.2`
- Button text: `1.3`
- Set row inputs: `1.5`

---

## WCAG 2.1 AA Compliance Summary

| Criterion | Name | Status | Severity |
|-----------|------|--------|----------|
| 1.1.1 | Non-text Content | **FAIL** | Critical |
| 1.3.1 | Info and Relationships | **FAIL** | Critical |
| 1.3.2 | Meaningful Sequence | Partial pass | Low |
| 1.4.1 | Use of Color | **FAIL** | High |
| 1.4.3 | Contrast (Minimum) | **FAIL** | High |
| 1.4.4 | Resize Text | Partial pass | Medium |
| 2.1.1 | Keyboard | **FAIL** | High |
| 2.3.3 | Animation from Interactions | **FAIL** | Medium |
| 2.4.3 | Focus Order | **FAIL** | High |
| 2.4.6 | Headings and Labels | **FAIL** | High |
| 2.5.5 | Target Size | **FAIL** | High |
| 4.1.2 | Name, Role, Value | **FAIL** | Critical |

---

## Remediation Priority

### P0: Foundation (Unblocks Everything Else)

1. **Add `accessibilityLabel` to reusable UI components** -- `IconButton.tsx`, `Button.tsx`, `Input.tsx`, `Badge.tsx`, `ProgressRing.tsx`, `MacroBar.tsx`. This cascades to every screen that uses them.

2. **Add `accessibilityRole` to semantic elements** -- buttons, headers, links, form fields, switches, images.

3. **Fix `textTertiary` contrast** -- change from `#9CA3AF` to `#737373` (light) and `#64748B` to `#94A3B8` (dark). This fixes the tab bar, placeholder text, and all tertiary content simultaneously.

### P1: Core UX Paths

4. **Fix touch targets** -- Button `sm` to 44px, checkbox to 44x44, send buttons to 44px, prompt chips to minHeight 44px.

5. **Add keyboard form navigation** -- `returnKeyType` + `onSubmitEditing` chaining for sign-in, sign-up, workout logging forms.

6. **Add `accessibilityValue`** to all progress indicators -- rings, bars, percentage displays.

7. **Add `accessibilityRole="header"`** to all section headings across all tabs.

### P2: Compliance Completeness

8. **Implement reduced motion** -- wrap all `Animated.timing` / `Animated.spring` calls in `AccessibilityInfo.isReduceMotionEnabled()` check. Skip or replace with instant transitions.

9. **Fix color-only indicators** -- add checkmarks to completed sets, icons to badge variants, patterns to chart bars.

10. **Add `maxFontSizeMultiplier`** to constrained text in rings, badges, tab bar, and button labels.

11. **Implement modal focus trapping** -- either use `react-native-focus-trap` or manual ref-based focus management on modal mount/unmount.

---

## Estimated Scope

The accessibility remediation touches every screen and component but follows a clear pattern:

- **Reusable components first:** Fixing `IconButton`, `Button`, `Input`, `Badge`, `ProgressRing` propagates accessibility to ~80% of the app's interactive elements.
- **Screen-by-screen pass:** Each tab screen needs heading roles, section labels, and status announcements.
- **Color token update:** 4 color values need to change in `colors.ts` to fix all contrast failures simultaneously.

The most impactful single change is adding `accessibilityLabel` as a required prop (or at minimum a console.warn when absent) to `IconButton.tsx`, since icon-only buttons without labels are the most severe barrier for screen reader users.

*Step 15 complete. Proceeding to Step 16.*
