# Step 11: Settings, Profile, Onboarding, and Auth Screens Audit

**Files:**
- `apps/mobile/app/settings.tsx` (381 lines)
- `apps/mobile/app/(onboarding)/welcome.tsx` (106 lines)
- `apps/mobile/app/(onboarding)/profile.tsx` (161 lines)
- `apps/mobile/app/(onboarding)/body.tsx` (160 lines)
- `apps/mobile/app/(onboarding)/goals.tsx` (119 lines)
- `apps/mobile/app/(onboarding)/mode.tsx` (128 lines)
- `apps/mobile/app/(onboarding)/coach-tone.tsx` (125 lines)
- `apps/mobile/app/(onboarding)/complete.tsx` (210 lines)

---

## A. Settings Screen

**What works:** Well-organized sections, profile card with tier badge, SettingRow component with `minHeight: 44`, sign out with confirmation, subscription awareness, comprehensive links (notifications, health, AI settings, data export)

**Critical issues:**
- **Dark mode toggle is dead** -- `value={false}`, `onValueChange={() => {}}`. Users see a toggle that does nothing.
- **Missing account deletion** -- App Store requires this capability
- **Plan row is a no-op for subscribers** -- chevron implies navigation but `onPress` does nothing
- **No accessibility labels** on any setting row

---

## B. Onboarding Flow

**Flow:** Welcome -> Profile -> Body -> Goals -> Mode -> Coach Tone -> Complete (7 screens, 6 steps in progress bar)

**What works:** Consistent progress bar, `slide_from_right` animations, Welcome has `gestureEnabled: false`, form validation with zod on Profile/Body, inclusive gender options (Non-binary, Prefer not to say), goal multi-select with good touch targets (56px), "You can always change this later" reduces commitment anxiety, completion screen with summary of all choices

**Critical issues:**

| Screen | Issue | Severity |
|--------|-------|----------|
| Profile | Date of birth requires typing `YYYY-MM-DD` -- no native DatePicker | HIGH |
| Body | Height asks for total inches (e.g., 70) not feet/inches (5'10") | MEDIUM |
| Complete | No back button to review/change choices | MEDIUM |
| Complete | `catch {}` silently swallows save errors | MEDIUM |
| All | Zero accessibility labels across all 7 screens | CRITICAL |
| All | No skip option for users who want to set up later | LOW |

---

## Prioritized Recommendations

### P0
1. **Fix or remove dead dark mode toggle** -- misleading UI
2. **Add native DatePicker** to profile onboarding
3. **Add account deletion** to settings (App Store requirement)
4. **Add accessibility labels** to all screens

### P1
5. Fix imperial height input to use feet/inches format
6. Add back button to completion screen
7. Fix subscriber plan row to navigate to subscription management
8. Add error feedback on save failure in completion screen

### P2
9. Add "Skip for now" to onboarding
10. Replace brand lettermark with proper logo asset
11. Add onboarding skip/resume capability

---

*Step 11 complete. Proceeding to Step 12.*
