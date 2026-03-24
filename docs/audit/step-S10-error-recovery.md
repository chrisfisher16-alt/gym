# S10: Error Recovery Audit

## Scorecard

| Area | User Notification | Retry | Fallback | Risk |
|------|------------------|-------|----------|------|
| AI Photo Analysis | **FAIL** | **FAIL** | Mock data (fabricated) | **CRITICAL** |
| AI Text Analysis | **FAIL** | **FAIL** | Silent parser fallback | **HIGH** |
| Workout Completion Save | **FAIL** | **FAIL** | Data loss possible | **HIGH** |
| AsyncStorage Writes | **FAIL** | **FAIL** | Data loss possible | **MEDIUM** |
| Form Validation (nutrition) | **FAIL** | N/A | No validation | **MEDIUM** |
| AI Recipe Generation | PASS | PASS | Error displayed | Low |
| AI Workout Generation | PASS | PASS | Error displayed | Low |
| Coach Chat | PASS | PASS | Error message in chat | Low |
| InNutritionCoach | PASS | PASS | Error in response | Low |
| Auth / Sign-in | PASS | PASS | Error banner + field errors | Low |
| AI Provider (HTTP errors) | PASS | N/A | Status-specific messages | Low |
| Image Picker | PASS | N/A | Alert dialog | Low |

---

## Critical Issues

### 1. AI Photo Analysis Returns Fabricated Data

**File:** `ai-meal-analyzer.ts:122-181`

When Claude Vision fails, the catch block falls back to `generateMockPhotoItems()` which returns hardcoded items ("Grilled Chicken" 248 cal, "White Rice" 206 cal, "Mixed Vegetables" 45 cal) regardless of photo content. The user sees these items presented as real analysis with no error indication.

**Fix:** Replace mock fallback with an error UI state + retry button. Show a clear message: "Photo analysis failed. Please try again or enter meals manually."

### 2. AI Text Analysis Silently Degrades

**File:** `ai-meal-analyzer.ts:77-117`

When AI fails, the keyword parser takes over with hardcoded nutrition values (150 cal, 5g protein, 15g carbs, 7g fat for unrecognized foods). No user notification.

Additionally, `text-log.tsx:36-47` uses `try/finally` with **no catch block** -- if the analyzer throws past the internal catch, it's completely swallowed.

**Fix:** Show a toast/banner: "AI analysis unavailable, using estimated values. Results may be less accurate." Add a visual indicator (e.g., warning icon) on fallback items.

### 3. Workout Completion Data Loss Risk

**File:** `workout-store.ts:852-870`

```typescript
completeWorkout: () => {
  const completed = activeToCompleted(state.activeSession, ...);
  set({ activeSession: null, history }); // ← state cleared synchronously
  AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION); // ← async, not awaited
  AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history)); // ← async, not awaited
}
```

The active session is cleared from state **before** persistence is confirmed. If AsyncStorage writes fail (storage full, crash, etc.), the workout is lost permanently -- cleared from memory AND not saved to disk.

**Fix:** Await persistence, add error handling, and only clear the active session after confirmed write. Or at minimum, catch errors and show a warning toast.

### 4. Fire-and-Forget Persistence

Multiple stores call `persistAll()` or `AsyncStorage.setItem()` without awaiting or error handling:

| Store | Pattern | Consequence |
|-------|---------|-------------|
| `nutrition-store.ts` | `get().persistAll()` -- 15+ call sites | Meal data may not persist |
| `workout-store.ts` | `AsyncStorage.setItem(...)` no await | Workout history may not persist |
| `coach-store.ts` | `catch { set({ isInitialized: true }); }` | Conversation history silently lost |

If any write fails, user data is in memory only and lost on app restart. No warning is shown.

**Fix:** At minimum, wrap `persistAll()` in a try/catch and show a toast on failure.

---

## Swallowed Error Patterns

| Location | Pattern | Consequence |
|----------|---------|-------------|
| `ai-provider.ts:46-48` | `catch { /* Ignore */ }` | AI config may not load |
| `ai-provider.ts:75-77` | `catch { /* Ignore */ }` | Config migration silently fails |
| `coach-store.ts:129` | `catch { set({ init: true }); }` | History load fails, resets to empty |
| `coach-store.ts:284` | `catch { /* Fall back to state */ }` | Disk read fails silently |
| `coach-store.ts:300-302` | `catch { /* Ignore */ }` | History enumeration fails |
| `nutrition-store.ts:382` | `catch { set({ ...seeds }); }` | User data replaced with seed data |
| `auth-store.ts:135` | `catch { /* Session check failed */ }` | User appears logged out |

---

## Well-Handled Areas

**Coach Chat** -- Best error handling in the app. Network-specific messaging ("I'm having trouble connecting"), error displayed as an assistant message in the conversation, user can retry by sending another message.

**AI Recipe Generation** -- Proper error state with red error box, user can modify prompt and retry.

**AI Workout Generation** -- Same pattern as recipes. Error displayed, retry available.

**Auth Screens** -- Zod validation with inline field errors, error banner for server errors, form stays filled for retry.

**AI Provider HTTP Errors** -- Status-specific messages (401 = invalid key, 429 = rate limit, 404 = model not found). These surface correctly when callers display them (recipes, workouts) but are swallowed by the meal analyzer's catch blocks.

---

## Recommendations

| # | Change | Priority |
|---|--------|----------|
| 1 | Replace photo analysis mock fallback with error UI + retry | **P0** |
| 2 | Add AI failure notification to text analysis | **P0** |
| 3 | Await persistence in `completeWorkout()` before clearing state | **P0** |
| 4 | Add error handling to `persistAll()` calls | **P1** |
| 5 | Add retry button to text-log and photo-review when AI fails | **P1** |
| 6 | Add a global persistence error toast utility | **P2** |
| 7 | Consider optimistic UI with rollback pattern for critical writes | **P2** |

*S10 complete.*
