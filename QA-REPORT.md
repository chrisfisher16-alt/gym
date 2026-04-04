# QA Report — FormIQ Health Coach
**Date**: 2026-03-24  
**Scope**: Full codebase review — all screens, flows, data, and infrastructure  
**Total Issues Found**: 131 (7 Critical, 21 High, 46 Medium, 36 Low, 21 Cosmetic)

---

## Executive Summary

The app is well-architected with clean state management, good component reuse, and thoughtful UX patterns. The core workout tracking, nutrition logging, and navigation all work. However, there are several **critical issues** in the AI pipeline (the main differentiating feature), **data integrity gaps** in sign-out/multi-user scenarios, and **systemic timezone bugs** that affect all date-keyed data.

**Overall Stability Rating**: 6.5/10  
**Blocking Issues**: 5 (must fix before any public release)

---

## Top 10 Highest Priority Fixes

### 1. 🔴 CRITICAL — AI meal/body analyzers bypass proxy, broken for all proxy users
**Files**: `src/lib/ai-meal-analyzer.ts:29-36`, `src/lib/ai-body-analyzer.ts:24-31`  
Both files hardcode `http://localhost:3001/api/anthropic` and bypass the unified `callAI()` pipeline. Photo meal analysis and body analysis are completely broken for any user without their own API key. They must be refactored to use `callAI()` like `ai-recipe-generator.ts` already does.

### 2. 🔴 CRITICAL — 30-second streaming timeout kills long AI responses
**File**: `src/lib/ai-provider.ts:63`  
The fixed 30-second timeout aborts streaming responses mid-generation. Complex workout plans or detailed nutrition advice can take 45-90 seconds. The timeout should reset on each received chunk (idle timeout), not fire from request start.

### 3. 🔴 CRITICAL — Rapid message sends corrupt streaming state
**File**: `src/stores/coach-store.ts:144-294`  
No concurrency guard on `sendMessage`. Two concurrent calls interleave tokens, producing garbled output. Add an `AbortController` pattern — abort the previous stream when a new message is sent.

### 4. 🔴 HIGH — Sign-out doesn't clear local stores — data leaks between users
**File**: `app/settings.tsx:45-58`  
`handleSignOut` clears auth state but NOT: profile-store, measurements-store, achievements-store, health-store, space-store, or AsyncStorage keys for these stores. A different user signing in sees the previous user's data.

### 5. 🔴 HIGH — `getDateString()` uses UTC — wrong date in most timezones
**File**: `src/lib/nutrition-utils.ts:19-21`  
`date.toISOString().split('T')[0]` returns UTC date. For US Pacific users after 5pm, meals are logged under tomorrow's date. For UTC+10 users before 10am, meals go under yesterday. This affects ALL date-keyed data (meals, water, supplements, briefings, achievements).  
**Fix**: Use local date: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

### 6. 🔴 HIGH — Goals screen uses V1 data model — user selections ignored
**Files**: `app/(onboarding)/goals.tsx:9-16,21`  
Goals screen writes to `selectedGoals` (V1 string array with IDs like `lose_weight`) while the rest of V2 onboarding reads `fitnessGoal` and `experienceLevel` (V2 enums like `build_muscle`). The user's goal selection is completely ignored during workout generation.

### 7. 🔴 HIGH — Free tier limits bypassed via multiple paths
- Coach: `handlePromptSelect` in `coach.tsx:136-143` bypasses AI message limit check
- Workout: Program detail `launchDay` and exercise detail `handleBuildOwn` bypass workout limit
- Nutrition: `incrementUsage('meal_logs')` called before user actually saves, wasting quota on cancellation

### 8. 🔴 HIGH — Promo code not persisted + hardcoded client-side
**File**: `src/stores/subscription-store.ts:217-241`  
`FISHER25` is hardcoded in client bundle (discoverable). Granted tier is in-memory only — resets on app restart. No server validation or expiration.

### 9. 🔴 HIGH — Auth gate only checks `isOnboarded`, not session validity
**File**: `app/index.tsx:4-11`  
Users with expired Supabase sessions are routed to the main app. All Supabase calls fail silently. Should also check `session` state.

### 10. 🔴 HIGH — API keys stored in AsyncStorage (unencrypted)
**File**: `src/lib/ai-provider.ts:98,124`  
User API keys for Claude/OpenAI/Groq stored as plaintext JSON. Should use `expo-secure-store` (Keychain/EncryptedSharedPreferences).

---

## All Issues by Area

### Onboarding & Auth (28 issues)

| # | Sev | Issue | File |
|---|-----|-------|------|
| 1 | CRIT | `isOnboarded` race after Google OAuth — profile not loaded yet | `welcome.tsx:32` |
| 2 | CRIT | Double `initialize()` calls create duplicate auth listeners | `auth-store.ts:246,301` |
| 3 | HIGH | Goals screen uses V1 data model — selections ignored | `goals.tsx:9-21` |
| 4 | HIGH | Goal IDs don't match V2 FitnessGoal enum | `goals.tsx:9-16` |
| 5 | HIGH | Progress bar hardcoded in goals, inconsistent with flow | `goals.tsx:43` |
| 6 | HIGH | Progress bar never reaches 100% (off-by-one) | `onboarding-store.ts:262-266` |
| 7 | HIGH | `gym-search` inflates progress for non-large-gym users | `onboarding-store.ts:266` |
| 8 | HIGH | `signOut` doesn't prevent re-access via deep link | `auth-store.ts:331-346` |
| 9 | HIGH | `signOut` error handling — if Supabase call fails, stores not cleared | `auth-store.ts:332` |
| 10 | MED | `handleSync` doesn't actually connect to HealthKit | `health-sync.tsx:97-101` |
| 11 | MED | Weight not reconverted when unit preference changes | `health-sync.tsx:131-134` |
| 12 | MED | Age out of range silently keeps old DOB | `health-sync.tsx:148-159` |
| 13 | MED | Notifications screen doesn't request push permission | `notifications.tsx:42-46` |
| 14 | MED | Email error detection relies on message strings, not codes | `welcome.tsx:57-72` |
| 15 | MED | Email flow missing catch block | `welcome.tsx:56-81` |
| 16 | MED | Equipment preset not re-applied on gym type change | `equipment.tsx:70-78` |
| 17 | MED | `generating.tsx` uses `.update()` instead of `.upsert()` | `generating.tsx:170-192` |
| 18 | MED | No double-tap protection on onboarding Next buttons | All onboarding screens |
| 19 | MED | `resetPassword` throws instead of returning error | `auth-store.ts:326-329` |
| 20 | MED | Deferred profile fetch has no stale session check | `auth-store.ts:99-120` |
| 21 | MED | `sign-up.tsx` Google sign-in doesn't navigate on success | `sign-up.tsx:46-57` |
| 22 | LOW | Skip auth has no data loss warning | `welcome.tsx:84-86` |
| 23 | LOW | Terms/Privacy links conflict with checkbox press handler | `sign-up.tsx:219-228` |
| 24 | LOW | Location requested on mount without user initiation | `gym-search.tsx:97-99` |
| 25 | LOW | Double padding in generating.tsx back header | `generating.tsx:420` |
| 26 | COSM | Goals screen visual style doesn't match other onboarding | `goals.tsx` |
| 27 | COSM | `typography` imported twice in notifications | `notifications.tsx:7` |
| 28 | COSM | `isSubmitting` state declared but never used | `onboarding-store.ts:72` |

### Today Tab + Workout Tab (24 issues)

| # | Sev | Issue | File |
|---|-----|-------|------|
| 29 | CRIT | `deleteSession` doesn't revert personal records | `workout-store.ts:1044-1048` |
| 30 | HIGH | `completeWorkout` TOCTOU — crash between state set and storage write | `workout-store.ts:1017-1035` |
| 31 | HIGH | Program detail `launchDay` bypasses free tier workout limit | `programs/[id].tsx:45-65` |
| 32 | HIGH | Exercise detail `handleBuildOwn` bypasses free tier limit | `[exerciseId].tsx:60-65` |
| 33 | HIGH | Briefing force-refresh caches empty string (race condition) | `index.tsx:153-157` |
| 34 | HIGH | Empty workout (no exercises/sets) can be "completed" | `workout-store.ts:1017-1035` |
| 35 | MED | `exercisesExpanded` shared between active and planned sections | `workout.tsx:56` |
| 36 | MED | Session detail hardcodes 'lbs' unit | `session/[id].tsx:28` |
| 37 | MED | Session detail uses `Math.random()` as React key | `session/[id].tsx:109` |
| 38 | MED | `cascadeWeight` can overwrite manually-entered sets | `workout-store.ts:409-437` |
| 39 | MED | Briefing todayWorkout differs from main app calculation | `daily-briefing.ts:87-93` |
| 40 | MED | PR detection skips bodyweight exercises (weight=0) | `workout-store.ts:456` |
| 41 | MED | Weekly summary wrong week on Sundays | `weekly-summary.ts:76-85` |
| 42 | MED | Dismissed insights permanent — never reset | `index.tsx:180-186` |
| 43 | MED | Extremely large weight values have no input validation | `workout-store.ts:387-407` |
| 44 | MED | App kill during workout — rest timer state stale on restore | `workout-store.ts:166-276` |
| 45 | LOW | Smart insights not filtered by dismissed state | `index.tsx:221-235` |
| 46 | LOW | Greeting time not reactive across time boundaries | `index.tsx:118-120` |
| 47 | LOW | `deleteProgram` silently skips seed programs | `workout-store.ts:300-306` |
| 48 | LOW | Rest timer not cleared on session cancel | `workout-store.ts:1037-1040` |
| 49 | LOW | AI generate stale system prompt ref | `ai-generate.tsx:213-221` |
| 50 | LOW | `updateExerciseRestTime` restarts full timer | `workout-store.ts:770-772` |
| 51 | COSM | Overlapping FABs on workout tab | `workout.tsx:854-875` |
| 52 | COSM | Weekly volume chart day labels misaligned | `workout.tsx:279-283` |

### Nutrition Tab (28 issues)

| # | Sev | Issue | File |
|---|-----|-------|------|
| 53 | HIGH | Date navigation allows future dates without indication | `nutrition.tsx:180-184` |
| 54 | HIGH | Free tier meal limit incremented before user saves | `nutrition.tsx:162-166` |
| 55 | HIGH | Text log silently swallows AI analysis errors | `text-log.tsx:34-46` |
| 56 | HIGH | Re-log meal goes to selected date, not today | `nutrition.tsx:216-228` |
| 57 | HIGH | Meal timestamps don't match storage date | `nutrition-store.ts:420-450` |
| 58 | HIGH | Meal detail stale data reference | `meal-detail.tsx:30` |
| 59 | HIGH | `persistAll` race condition on rapid actions | `nutrition-store.ts:818-827` |
| 60 | MED | Water streak shows 0 until today's first log | `nutrition.tsx:198-213` |
| 61 | MED | Supplement streak DST bug (24hr subtraction) | `nutrition-store.ts:666-675` |
| 62 | MED | Quick add allows 0-calorie meal with just a name | `quick-add.tsx:24-26` |
| 63 | MED | `getDateString` uses UTC (systemic timezone bug) | `nutrition-utils.ts:19-21` |
| 64 | MED | Negative values accepted in macro/calorie inputs | `quick-add.tsx`, `targets.tsx` |
| 65 | MED | Photo log `loading` state variable never used | `photo-log.tsx:15` |
| 66 | MED | Photo review uses fragile `router.dismiss(2)` | `photo-review.tsx:91` |
| 67 | MED | `readAsStringAsync` from `expo-file-system/legacy` | `ai-meal-analyzer.ts:1` |
| 68 | MED | Targets screen silently applies defaults on empty input | `targets.tsx:158-166` |
| 69 | MED | Haptics import on web has no Platform guard | `useWaterTracking.ts:4-5` |
| 70 | LOW | Duplicate re-log logic (swipe vs long-press) | `nutrition.tsx` |
| 71 | LOW | `getMealTypeLabel` no validation of search param | `quick-add.tsx:55` |
| 72 | LOW | Saved meals no confirmation toast on log | `saved-meals.tsx:20-21` |
| 73 | LOW | Supplement streak pluralization ("1 day streak") | `nutrition.tsx:958` |
| 74 | LOW | Custom water modal no upper bound | `nutrition.tsx:724-730` |
| 75 | LOW | Food database no fuzzy matching | `food-database.ts` |
| 76 | LOW | `logRecipe` sets source as 'manual' not 'recipe' | `nutrition-store.ts:806` |
| 77 | LOW | Recipes don't let user pick meal type | `recipes.tsx:200-201` |
| 78 | COSM | Water buttons hardcoded color `#EFF6FF` | `nutrition.tsx:642-658` |
| 79 | COSM | Water section uses hardcoded `#3B82F6` | `nutrition.tsx:560-663` |
| 80 | COSM | Supplement streak fire icon hardcoded color | `nutrition.tsx:568` |

### Coach Tab + AI Integration (23 issues)

| # | Sev | Issue | File |
|---|-----|-------|------|
| 81 | CRIT | Meal/body analyzers bypass proxy — broken for proxy users | `ai-meal-analyzer.ts:29-36` |
| 82 | CRIT | 30s streaming timeout too short for complex responses | `ai-provider.ts:63` |
| 83 | CRIT | Rapid sends corrupt streaming state (no concurrency guard) | `coach-store.ts:144-294` |
| 84 | HIGH | Streaming timeout not reset on received data | `ai-provider.ts:479,513` |
| 85 | HIGH | `handlePromptSelect` bypasses free tier usage limit | `coach.tsx:136-143` |
| 86 | HIGH | `cachedConfig` can become stale | `ai-provider.ts:105-131` |
| 87 | HIGH | Error fallback creates misleading assistant messages | `ai-client.ts:213-237` |
| 88 | HIGH | `response.body` null assertion in streaming (potential crash) | `ai-provider.ts:503` |
| 89 | HIGH | No abort/cancellation from UI to provider | `coach-store.ts`, `coach-api.ts` |
| 90 | MED | Demo fallback masks real errors silently | `ai-client.ts:213-237` |
| 91 | MED | `estimateTokens` ignores image content blocks | `ai-client.ts:19-22` |
| 92 | MED | Conversation summaries fire-and-forget with no retry | `conversation-summarizer.ts:43-60` |
| 93 | MED | System prompt can exceed context limits for power users | `coach-system-prompt.ts` |
| 94 | MED | Image size not validated before base64 encoding | `coach-store.ts:183-184` |
| 95 | MED | `media_type` hardcoded to `image/jpeg` | `coach-store.ts:190` |
| 96 | MED | `callWithRetry` retries streaming — duplicate tokens | `ai-provider.ts:702-743` |
| 97 | MED | Response cache serves stale data without context | `response-cache.ts:57-60` |
| 98 | LOW | `handleSend` async usage check allows double-send | `coach.tsx:109-128` |
| 99 | LOW | Proxy allows any API key passthrough | `api/anthropic.js:25` |
| 100 | LOW | CORS wildcard on proxy | `api/anthropic.js:5` |
| 101 | LOW | `toAIHistory` drops image context | `coach-store.ts:97-104` |
| 102 | LOW | No cleanup of old summaries/briefing caches | Various |
| 103 | LOW | `getActionDescription` default case suppresses exhaustive check | `coach-actions.ts:722` |

### Progress Tab + Settings/Profile (28 issues)

| # | Sev | Issue | File |
|---|-----|-------|------|
| 104 | HIGH | Sign-out doesn't clear local stores — data leak | `settings.tsx:45-58` |
| 105 | HIGH | Promo code not persisted — resets on restart | `subscription-store.ts:217-241` |
| 106 | HIGH | Profile save doesn't update profile-store shared fields | `profile.tsx:228-255` |
| 107 | HIGH | Achievement progress hints use hardcoded placeholder data | `progress.tsx:842-846` |
| 108 | HIGH | Weight Trend ignores measurements-store data | `progress.tsx:1186-1231` |
| 109 | MED | Monthly volume always shows "kg" regardless of units | `progress.tsx:896-897` |
| 110 | MED | PRs always display in "kg" regardless of units | `progress.tsx:1289,1421,1462` |
| 111 | MED | Date range selector doesn't affect all sections | `progress.tsx:139` |
| 112 | MED | Achievement check runs excessively (no debounce) | `progress.tsx:199-207` |
| 113 | MED | Measurements weight chart min/max breaks with empty data | `measurements.tsx:148-150` |
| 114 | MED | Measurements pre-fill effect missing dependencies | `measurements.tsx:109-139` |
| 115 | MED | Progress photos stored by temporary URI | `measurements-store.ts:141-150` |
| 116 | MED | Unit toggle in settings doesn't sync to profile-store | `settings.tsx:176` |
| 117 | MED | Coach tone does nothing when coachPreferences is null | `settings.tsx:462-466` |
| 118 | MED | Profile DOB field has no validation | `profile.tsx:403-408` |
| 119 | MED | Unit conversion in profile doesn't persist until save | `profile.tsx:482-505` |
| 120 | MED | Space switching doesn't save pre-switch state for revert | `space-store.ts:108-151` |
| 121 | MED | Notification reminders scheduled without permission check | `notification-store.ts:117-149` |
| 122 | MED | `lastSyncAt` no date validation | `health-store.ts:131` |
| 123 | MED | Hardcoded "Save 16%" in billing toggle | `paywall.tsx:354` |
| 124 | MED | Consecutive meal day calculation has timezone issue | `achievements-store.ts:85-96` |
| 125 | LOW | Measurements no duplicate date protection | `measurements-store.ts:99-109` |
| 126 | LOW | Profile init useEffect only runs once (slow hydration) | `profile.tsx:177-201` |
| 127 | LOW | About/Support rows not pressable | `settings.tsx:281-296` |
| 128 | LOW | AI settings initial state defaults to 'demo' | `ai-settings.tsx:63` |
| 129 | LOW | AI settings API key trim on every keystroke | `ai-settings.tsx:293` |
| 130 | LOW | AI settings timeout ref not cleared on unmount | `ai-settings.tsx:93-109` |
| 131 | LOW | XP persist is fire-and-forget | `achievements-store.ts:140-142` |

### Cross-Cutting Concerns (30 issues from dedicated agent — key ones above)

Covered in the numbered list above plus: sync queue race conditions, unbounded AsyncStorage growth, ErrorBoundary not in root layout, NetworkBanner only event-driven, store bridge over-subscribing, nutrition `persistAll` writing 5 keys on every action, no input upper bounds on weight/reps, water logging no debounce.

---

## Areas That Work Well

1. **Theme system** — Clean `useTheme()` hook, symmetric light/dark palettes, charts have dedicated color tokens
2. **Haptics** — Centralized with descriptive function names, lazy-loads to avoid web crashes
3. **Skeleton loaders** — Dedicated per-tab skeletons matching real UI structure
4. **Component reuse** — ExpandableCard, SwipeableRow, QuickActionSheet, ProgressRing well-abstracted
5. **Workout tracking core** — Set logging, PR detection, superset support, rest timer all solid
6. **Auth store** — The `onAuthStateChange` deadlock fix (setTimeout defer) is correct
7. **Error/Empty state components** — Reusable, theme-aware, retry support
8. **CoachMarkdown** — Native rendering (no WebView), zero XSS risk
9. **Active workout persistence** — Survives app kills, correct restore logic
10. **Supabase auth integration** — Token refresh handled by SDK, session persistence correct

---

## Recommendations

### Immediate (before any public release)
1. Fix `getDateString()` UTC bug — affects all date-keyed data
2. Refactor `ai-meal-analyzer.ts` and `ai-body-analyzer.ts` to use `callAI()`
3. Fix streaming timeout (reset on data received)
4. Add concurrency guard + AbortController to coach `sendMessage`
5. Fix sign-out to clear all local stores and AsyncStorage

### Short-term
6. Rewrite goals screen to use V2 data model
7. Move API keys to `expo-secure-store`
8. Add session validity check to auth gate
9. Fix free tier limit enforcement (suggested prompts, program launch, meal log timing)
10. Debounce `persistAll()` in nutrition store

### Medium-term
11. Server-side promo code validation
12. Server-side usage limit enforcement for AI messages
13. Add unit preference support to Progress tab (kg → lbs)
14. Implement proper health sync in onboarding
15. Add progress photo persistence (copy to app documents directory)
