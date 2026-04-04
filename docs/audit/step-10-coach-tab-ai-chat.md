# Step 10: Coach Tab + AI Chat Audit

**Files:**
- `apps/mobile/app/(tabs)/coach.tsx` (381 lines) -- Main AI chat
- `apps/mobile/src/components/InWorkoutCoach.tsx` (625 lines) -- In-workout AI modal
- `apps/mobile/src/components/InNutritionCoach.tsx` (257 lines) -- Nutrition AI modal
- `apps/mobile/src/components/CoachFAB.tsx` (91 lines) -- Floating action button

---

## Executive Summary

The Coach system is well-architected with a dedicated chat tab, contextual in-workout and in-nutrition modals, and a floating action button that bridges all tabs. The InWorkoutCoach's multi-adjustment UI (per-item apply/skip with "Apply All") is a standout feature. Usage limit tracking and paywall gating are properly implemented.

Key weakness: InWorkoutCoach and InNutritionCoach share ~80% structural duplication and should be refactored into a shared `CoachSheet` base component.

---

## Coach Tab (`coach.tsx`)

**What works:** Professional chat UX, error banner with retry, empty state with suggested prompts, prefilled context from other tabs, usage limit badge
**Fix:** Send button is 40x40 (below 44pt), no conversation history UI, Alert.alert for paywall breaks visual consistency, no accessibility labels

## InWorkoutCoach (`InWorkoutCoach.tsx`)

**What works:** Smart keyword detection routing between adjustment API and general chat, multi-adjustment UI with individual apply/skip, contextual quick prompts adapting to current exercise, proper bottom sheet pattern
**Fix:** Send button 36x36 (below 44pt), hardcoded `#fff` colors (4 instances), no error retry button, quick prompt chips lack minHeight, response area maxHeight 200px clips long responses, no accessibility

## InNutritionCoach (`InNutritionCoach.tsx`)

**What works:** Clean focused design, consistent sheet pattern, proper loading state
**Fix:** Send button 36x36, hardcoded rgba backdrop, only 3 static prompts (not contextual), ~80% code duplication with InWorkoutCoach, no error retry, no accessibility

## CoachFAB (`CoachFAB.tsx`)

**What works:** Two variants (icon-only 56x56, labeled pill), proper elevation/shadow, contextual navigation with prefilled context
**Fix:** No accessibility labels, labeled variant may be undersized, hardcoded position values, no haptic feedback

---

## Key Recommendations

### P0
1. **Add accessibility labels** to all interactive elements across all 4 components
2. **Fix send buttons to 44x44** minimum (coach tab, InWorkoutCoach, InNutritionCoach)

### P1
3. **Extract shared CoachSheet** component -- eliminate ~80% duplication between InWorkoutCoach and InNutritionCoach
4. **Add error retry** to both in-context coaches
5. **Add conversation history** browsing to coach tab
6. **Replace hardcoded colors** (`#fff`, rgba) with theme tokens
7. **Make nutrition prompts contextual** (time of day, current macro status)

### P2
8. Add haptic feedback to CoachFAB
9. Replace Alert.alert paywall with styled modal
10. Add streaming response indicator for AI quality perception

---

*Step 10 complete. Proceeding to Step 11.*
