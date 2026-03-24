# Step 16: Design System Token Violations

## Theme System Reference

| Category | File | Tokens |
|----------|------|--------|
| **Colors** | `colors.ts` | 54 tokens per mode (light + dark) |
| **Spacing** | `spacing.ts` | `xs:4, sm:8, md:12, base:16, lg:20, xl:24, 2xl:32, 3xl:40, 4xl:48` |
| **Radius** | `spacing.ts` | `sm:6, md:10, lg:14, xl:20, full:9999` |
| **Typography** | `typography.ts` | 12 presets: `displayLarge`(32) through `caption`(11) |
| **Theme hook** | `index.ts` | `useTheme()` returns `{ colors, typography, spacing, radius, dark }` |

---

## Hardcoded Colors

### Critical: `nutrition.tsx` Hydration Section (~25 violations)

The hydration section is the worst offender. Every color is hardcoded, meaning dark mode will render blue and green elements on a dark background with no adaptation.

| Line(s) | Hardcoded | Should Be |
|---------|-----------|-----------|
| 243, 291, 327, 328, 335, 336, 343, 344 | `#3B82F6` (blue icon/text) | `colors.info` |
| 279, 280-283 | `#3B82F6` (water ring borders) | `colors.info` |
| 279-283 | `#22C55E` (completed ring) | `colors.success` |
| 314 | `#3B82F6` (ripple overlay) | `colors.info` |
| 323, 331, 339 | `#EFF6FF` (button bg) | `colors.infoLight` or new `colors.infoSubtle` |
| 400 | `#3B82F6` (confirm button bg) | `colors.info` |
| 415 | `#FFFFFF` (button text) | `colors.textInverse` |

### Critical: `progress.tsx` Muscle Group Colors

| Line | Hardcoded | Should Be |
|------|-----------|-----------|
| 64-73 | `MUSCLE_COLORS` with 8 raw hex values (`#EF4444`, `#3B82F6`, `#F59E0B`, `#10B981`, `#8B5CF6`, `#EC4899`, `#06B6D4`, `#6366F1`) | New `colors.muscleGroups` object in theme |

### High: Shadow Colors

| File | Line | Hardcoded | Should Be |
|------|------|-----------|-----------|
| `Toast.tsx` | 172 | `shadowColor: '#000'` | `colors.shadow` |
| `LockedFeature.tsx` | 166 | `shadowColor: '#000'` | `colors.shadow` |
| `nutrition.tsx` (FAB) | - | `shadowColor: '#000'` | `colors.shadow` |

### Medium: Auth Screens

| File | Line | Hardcoded | Should Be |
|------|------|-----------|-----------|
| `sign-in.tsx` | 88-89 | `dark ? '#FFFFFF' : '#000000'` | `colors.textInverse` / `colors.text` |
| `sign-in.tsx` | 96-97 | `dark ? '#000000' : '#FFFFFF'` | Inverse of above |
| `welcome.tsx` | 20 | `color: colors.primary` inline (acceptable) | -- |

### Medium: Coach Bubble

| File | Line | Hardcoded | Should Be |
|------|------|-----------|-----------|
| `ChatBubble.tsx` | 74 | `rgba(255,255,255,0.6)` | New `colors.textInverseSecondary` |

### Low: ErrorBoundary

`ErrorBoundary.tsx:142-209` has an entirely self-contained color scheme (`#0F172A`, `#EF4444`, etc.). This is partially defensible -- the error boundary intentionally avoids the theme system to remain functional when the theme system itself has errors. Document the intent with a comment.

---

## Hardcoded Spacing

### `nutrition.tsx` (18 violations)

| Line | Property | Value | Token |
|------|----------|-------|-------|
| 665 | `paddingHorizontal` | `8` | `spacing.sm` |
| 669 | `paddingVertical` | `8` | `spacing.sm` |
| 700 | `marginTop` | `12` | `spacing.md` |
| 717 | `gap` | `8` | `spacing.sm` |
| 724 | `paddingVertical` | `14` | No exact token |
| 725 | `paddingHorizontal` | `10` | No exact token |
| 726 | `minHeight` | `48` | `spacing['4xl']` |
| 736 | `padding` | `24` | `spacing.xl` |
| 740, 750, 755 | `paddingVertical` | `12` | `spacing.md` |
| 744 | `gap` | `12` | `spacing.md` |
| 761 | `marginBottom` | `14` | No exact token |
| 762 | `marginTop` | `8` | `spacing.sm` |
| 767 | `paddingVertical` | `24` | `spacing.xl` |
| 800 | `paddingVertical` | `16` | `spacing.base` |
| 801 | `paddingHorizontal` | `8` | `spacing.sm` |
| 808 | `paddingHorizontal` | `20` | `spacing.lg` |
| 810 | `borderRadius` | `28` | No token |

### `workout.tsx` (6 violations)

| Line | Property | Value | Token |
|------|----------|-------|-------|
| 555 | `gap` | `12` | `spacing.md` |
| 560 | `paddingVertical` | `20` | `spacing.lg` |
| 561 | `paddingHorizontal` | `12` | `spacing.md` |
| 568 | `marginBottom` | `12` | `spacing.md` |
| 582 | `width` | `20` | `spacing.lg` |
| 594 | `paddingVertical` | `24` | `spacing.xl` |

### `coach.tsx` (3 violations)

| Line | Property | Value | Token |
|------|----------|-------|-------|
| 362 | `paddingHorizontal` | `20` | `spacing.lg` |
| 367 | `marginHorizontal` | `12` | `spacing.md` |
| 368 | `borderRadius` | `8` | `radius.sm` (6) -- no exact match |

### `_layout.tsx` (3 violations)

| Line | Property | Value | Token |
|------|----------|-------|-------|
| 17 | `paddingBottom` | `4` | `spacing.xs` |
| 18 | `height` | `56` | No token |
| 21 | `fontSize` | `11` | `typography.caption.fontSize` |

### Other Files (scattered)

| File | Line | Property | Value | Token |
|------|------|----------|-------|-------|
| `sign-in.tsx` | 82 | `gap` | `12` | `spacing.md` |
| `sign-in.tsx` | 216 | `marginBottom` | `32` | `spacing['2xl']` |
| `sign-in.tsx` | 229 | `height` | `50` | `spacing['4xl']` (48) -- close |
| `sign-in.tsx` | 229 | `borderRadius` | `12` | `radius.md` (10) or `radius.lg` (14) |
| `ChatBubble.tsx` | 233 | `marginVertical` | `4` | `spacing.xs` |
| `ChatBubble.tsx` | 234 | `paddingHorizontal` | `12` | `spacing.md` |
| `ChatBubble.tsx` | 244 | `marginRight` | `8` | `spacing.sm` |
| `UpgradeBanner.tsx` | 108 | `marginRight` | `12` | `spacing.md` |
| `UpgradeBanner.tsx` | 112 | `marginRight` | `8` | `spacing.sm` |
| `welcome.tsx` | 84 | `paddingTop` | `60` | No token |
| `welcome.tsx` | 92 | `borderRadius` | `60` | `radius.full` |
| `welcome.tsx` | 97 | `paddingHorizontal` | `8` | `spacing.sm` |
| `LockedFeature.tsx` | 162 | `padding` | `20` | `spacing.lg` |
| `settings.tsx` | 348 | `marginLeft` | `16` | `spacing.base` |

**Values that don't match any token:** `10`, `14`, `15`, `28`, `50`, `56`, `60`, `80`. These either need rounding to the nearest token or new tokens added.

---

## Hardcoded Typography

| File | Line | Hardcoded | Should Be |
|------|------|-----------|-----------|
| `_layout.tsx` | 21 | `fontSize: 11` | `typography.caption.fontSize` |
| `_layout.tsx` | 22 | `fontWeight: '500'` | `typography.labelSmall.fontWeight` |
| `sign-in.tsx` | 68 | `fontSize: 32, fontWeight: '700'` | Remove -- already in `typography.displayLarge` spread |
| `sign-in.tsx` | 238 | `fontSize: 15` | No token (body=14, bodyLarge=16) |
| `sign-in.tsx` | 239 | `fontWeight: '600'` | `typography.labelLarge.fontWeight` |
| `welcome.tsx` | 20 | `fontSize: 48, fontWeight: '800'` | New `typography.displayHero` token |
| `coach.tsx` | 216 | `fontWeight: '600'` | Use typography spread |
| `coach.tsx` | 299 | `fontSize: 14` | `typography.body.fontSize` |
| `nutrition.tsx` | 622-625 | `fontSize: 13, fontWeight: '600'` | `typography.labelSmall` (12) or `typography.label` (14) |
| `progress.tsx` | 844 | `fontSize: 9` | Below minimum token |
| `AchievementBadge.tsx` | 74 | `fontSize: 10` | Below `caption` (11) |
| `CoachFAB.tsx` | 44 | `fontSize: 13, fontWeight: '600'` | `typography.labelSmall` (12) |
| `ChatBubble.tsx` | 204 | `fontSize: 12` | `typography.labelSmall.fontSize` |
| `ChatBubble.tsx` | 169 | `fontWeight: '500'` | `typography.label.fontWeight` |
| `WeeklyCheckInCard.tsx` | 141 | `fontWeight: '600'` | `typography.h2.fontWeight` |
| `Button.tsx` | 44 | `fontSizes: { sm: 13, md: 14, lg: 16 }` | `sm: 13` has no token match |
| `Button.tsx` | 93 | `fontWeight: '600'` | `typography.labelLarge.fontWeight` |
| `profile.tsx` | 366, 373 | `fontWeight: '600'/'400'` | Use typography spread |

**Font sizes that don't match any token:** `9`, `10`, `13`, `15`, `48`. These need either rounding or new tokens.

---

## Inconsistent Patterns

### Shadow/Elevation Styles (5 variants)

| Component | shadowOffset | shadowOpacity | shadowRadius | elevation |
|-----------|-------------|---------------|-------------|-----------|
| `Card.tsx` | `{0, 2}` | `1` | `8` | `2` |
| `Toast.tsx` | `{0, 4}` | `0.15` | `12` | `8` |
| `CoachFAB.tsx` | `{0, 4}` | `0.3` | `8` | `8` |
| `LockedFeature.tsx` | `{0, 4}` | `0.15` | `12` | `4` |
| `nutrition.tsx` FAB | `{0, 2}` | `0.25` | `8` | `4` |
| `ChatBubble.tsx` | `{0, 1}` | `0.05` | `4` | `1` |

**Recommendation:** Add to theme:
```typescript
shadows: {
  sm: { shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  md: { shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  lg: { shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
}
```

### Modal Backdrop Opacity (3 variants)

| File | Opacity | Context |
|------|---------|---------|
| `active.tsx` (exercise picker) | `0.5` | Standard modal |
| `active.tsx` (summary) | `0.5` | Standard modal |
| `active.tsx` (cooldown) | `0.3` | Fade modal |
| `LockedFeature.tsx` | `0.6` | Overlay |

**Recommendation:** Standardize to `0.5` for all modals. Add `colors.backdrop: 'rgba(0,0,0,0.5)'`.

### Disabled State Opacity

| File | Value | Context |
|------|-------|---------|
| `Button.tsx` | `0.5` | Disabled buttons |
| `nutrition.tsx` | `0.5` | Disabled water button |
| `LockedFeature.tsx` | `0.6` | Dimmed preview |

**Recommendation:** Standardize as `opacity.disabled: 0.5`.

### activeOpacity on TouchableOpacity

Mixed use of `0.7` (~25 instances) and `0.8` (~5 instances). **Recommendation:** Standardize on `0.7` for all interactions, define as constant.

---

## Component Adoption

### Card.tsx -- Well Adopted

Used consistently across all tab screens. No screens manually recreate card styles.

### Button.tsx -- Mostly Adopted, With Violations

Custom button implementations found that bypass `<Button>`:
- `nutrition.tsx:605-629` -- "Ask Coach" button built with raw `TouchableOpacity`
- `nutrition.tsx:641-650` -- FAB meal-log button from scratch
- `index.tsx:316-325` -- "Log Meal" and "Add Water" pill buttons
- `sign-in.tsx:84-119` -- Social auth buttons (partially justified for brand styling)

### Input.tsx -- Well Adopted

Used on auth screens and profile. The one exception (`nutrition.tsx:366-381` custom water modal input) is acceptable as a one-off.

### Missing Reusable Components

Patterns repeated across 3+ files without a shared component:

| Pattern | Found In | Recommendation |
|---------|----------|---------------|
| **Section Header** (uppercase label, letter-spacing) | `settings.tsx:94/135/181`, `profile.tsx:314-333` | Promote `profile.tsx`'s `SectionHeader` to `ui/SectionHeader.tsx` |
| **Pill/Chip** (small rounded button) | `index.tsx:316`, `nutrition.tsx:323-344`, `progress.tsx` filter tabs | Create `ui/Chip.tsx` |
| **Stat Cell** (icon + value + label grid item) | `index.tsx`, `progress.tsx`, `WeeklyCheckInCard.tsx` | Create `ui/StatCell.tsx` |

---

## Recommended New Tokens

| Token | Purpose | Suggested Value |
|-------|---------|-----------------|
| `colors.muscleGroups` | Per-muscle-group chart colors | Object with named entries |
| `colors.textInverseSecondary` | Semi-transparent white text on dark bg | `rgba(255,255,255,0.6)` |
| `colors.backdrop` | Modal backdrop | `rgba(0,0,0,0.5)` |
| `colors.shadow` | Already exists -- enforce usage | -- |
| `shadows.sm / .md / .lg` | Standardized elevation presets | See recommendation above |
| `typography.displayHero` | Welcome screen title | `fontSize: 48, fontWeight: '800'` |
| `typography.captionSmall` | Sub-caption text | `fontSize: 10, fontWeight: '400'` |
| `opacity.disabled` | Disabled state | `0.5` |
| `activeOpacity` | TouchableOpacity default | `0.7` |

---

## Remediation Approach

### Phase 1: Color Token Migration (Highest Impact)

1. Fix `nutrition.tsx` hydration section -- replace all 25 hardcoded hex values with theme colors. This file alone accounts for ~40% of all color violations.
2. Move `MUSCLE_COLORS` in `progress.tsx` to `colors.muscleGroups` in `colors.ts`.
3. Replace `shadowColor: '#000'` with `colors.shadow` in `Toast.tsx`, `LockedFeature.tsx`, `nutrition.tsx`.

### Phase 2: Add Missing Tokens

4. Add `shadows` presets to theme and migrate all 5 shadow variants.
5. Add `typography.captionSmall` and `typography.displayHero`.
6. Add `colors.backdrop`, `colors.textInverseSecondary`.
7. Add `opacity.disabled` and `activeOpacity` constants.

### Phase 3: Spacing and Typography Cleanup

8. Search-and-replace hardcoded spacing values with tokens (start with the exact matches: `8`->`spacing.sm`, `12`->`spacing.md`, `16`->`spacing.base`, `20`->`spacing.lg`, `24`->`spacing.xl`, `32`->`spacing['2xl']`).
9. Replace hardcoded `fontSize`/`fontWeight` with typography spread where possible.
10. Decide on `borderRadius` values that don't match tokens -- round to nearest or add new radius tokens.

### Phase 4: Component Extraction

11. Extract `SectionHeader`, `Chip`, and `StatCell` components.
12. Replace custom button implementations with `<Button>` variants.

---

## Violation Count Summary

| Category | Count | Severity |
|----------|-------|----------|
| Hardcoded colors | ~45 | Critical (dark mode breakage) |
| Hardcoded spacing | ~50 | Medium |
| Hardcoded typography | ~20 | Medium |
| Shadow inconsistencies | 6 variants | Medium |
| Missing reusable components | 3 patterns | Low |
| Backdrop opacity variants | 3 values | Low |

Total: ~115 individual token violations across ~15 files.

*Step 16 complete. Proceeding to Step 17.*
