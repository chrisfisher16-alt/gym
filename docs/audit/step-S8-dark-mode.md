# S8: Dark Mode Quality Audit

## Infrastructure Status

| Component | Status |
|-----------|--------|
| Dark color palette (`colors.ts`) | Complete -- 54 tokens, all mapped |
| System detection (`useColorScheme()`) | Working |
| Theme hook (`useTheme()`) | Returns correct palette based on OS setting |
| Manual toggle (Settings) | **Dead** -- `value={false}`, `onValueChange={() => {}}` |
| Override persistence store | Does not exist |

The app **does respond to system dark mode** via `useColorScheme()`. If a user enables dark mode in iOS/Android settings, the theme switches automatically. However, the in-app toggle is a no-op, and there is no manual override store.

---

## Screen-by-Screen Readiness

| Screen | Rating | Issues |
|--------|--------|--------|
| Today tab | Ready | All colors use theme tokens |
| Workout tab | Ready | All colors via `colors.xxx` |
| **Nutrition tab** | **Not Ready** | ~25 hardcoded hex values in hydration section |
| Progress tab | Partially Ready | `MUSCLE_COLORS` (8 hardcoded chart colors), otherwise themed |
| Coach tab | Ready | All colors use tokens |
| Active workout | Ready | Thoroughly themed |
| Settings | Ready | Toggle dead but screen renders correctly |
| Auth screens | Ready | Apple OAuth correctly uses `dark` boolean |
| Onboarding | Ready | All screens use `colors.xxx` |

**8 of 9 areas are ready. Nutrition is the blocker.**

---

## Nutrition Tab Hydration Section (Blocker)

The hydration section (`nutrition.tsx:239-421`) contains ~25 hardcoded hex values:

| Hardcoded | Count | Should Be | Dark Mode Impact |
|-----------|-------|-----------|------------------|
| `#3B82F6` | ~15 | `colors.info` | Blue on dark bg -- may be acceptable but breaks consistency |
| `#EFF6FF` | 3 | `colors.infoLight` | Light blue on `#0F172A` -- nearly invisible |
| `#22C55E` | 6 | `colors.success` | Green on dark bg -- may be acceptable |
| `#FFFFFF` | 1 | `colors.textInverse` | White on white -- invisible on dark bg surface |

The `#EFF6FF` button backgrounds are the critical failure -- they render as near-white on a near-black surface, making the water quick-add buttons invisible in dark mode.

---

## Other Hardcoded Colors

| File | Color | Impact |
|------|-------|--------|
| `Toast.tsx:172` | `shadowColor: '#000'` | Acceptable -- black shadow works in both modes |
| `ChatBubble.tsx:74` | `rgba(255,255,255,0.6)` | Acceptable -- user bubble timestamp on primary bg |
| `progress.tsx:64-73` | 8 `MUSCLE_COLORS` hex values | Chart colors -- acceptable but could benefit from dark-mode-tuned variants |
| `sign-in/sign-up.tsx` | `#000000`/`#FFFFFF` for Apple OAuth | Already uses `dark` boolean correctly |

---

## Effort to Fix

**Low.** Two changes needed:

1. **Wire the settings toggle** -- create a `useSettingsStore` with a `themePreference: 'system' | 'light' | 'dark'` field. Wrap `useColorScheme()` in the theme hook to respect the manual override. Persist to AsyncStorage.

2. **Replace hardcoded hex in hydration section** -- substitute ~25 instances of `#3B82F6` with `colors.info`, `#EFF6FF` with `colors.infoLight`, `#22C55E` with `colors.success`, and `#FFFFFF` with `colors.textInverse`. This is a search-and-replace task within a single file.

*S8 complete.*
