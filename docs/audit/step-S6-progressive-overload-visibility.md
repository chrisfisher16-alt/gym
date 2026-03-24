# S6: Progressive Overload Visibility

## The Suggestion Engine

`apps/mobile/src/lib/suggested-load.ts` provides two code paths:

### History-Based (returning users)

Finds the most recent completed session for the exercise and applies:

| Condition | Suggestion | Confidence |
|-----------|-----------|------------|
| All sets exceeded target by 2+ reps | +10 lbs / +5 kg | High |
| All sets hit target max | +5 lbs / +2.5 kg | High |
| Some sets fell short of target min | Same weight, aim for top of range | Medium |
| In between | Same weight, push for max reps | Medium |

Returns a human-readable `explanation` string (e.g., "You crushed all sets last time (135lbs x 10). Time to go heavier: 145lbs x 8.")

### Beginner Estimation (new users)

Uses body-weight multiplier tables for 60+ exercises, factored by gender and training experience. Confidence is always `low`.

---

## Where Suggestions Are Visible

### List View (`active.tsx`)

| Element | Location | Presentation |
|---------|----------|--------------|
| Last performance | `active.tsx:1279-1283` | Single-line gray text: "Last: 135lbs x 10, 135lbs x 9" below exercise header |
| Suggestion banner | `active.tsx:1286-1311` | Tappable colored banner: green (high confidence), blue (medium/low). Shows "Suggested: 145 lbs x 8 reps" with trending-up icon |
| Explanation | Below suggestion text | Shown but `numberOfLines={1}` truncates it |
| Pre-fill | `active.tsx:967-975` | `useEffect` auto-fills all empty sets with suggested values on mount |

**Accept/Reject:** Tapping the banner applies suggestion to ALL incomplete sets. No explicit "reject" -- user ignores or manually enters different values. Pre-fill means the suggestion is **auto-accepted by default**.

### Focus View (`FocusedWorkoutView.tsx`)

| Element | Location | Presentation |
|---------|----------|--------------|
| Suggestion card | Lines 342-358 | Prominent card: "Based on your last workout, try:" + large `h2`-styled weight x reps |
| "Use Suggestion" button | Lines 104-111 | Explicit button with flash icon. Fills current set only |
| Last performance | Not shown | Focus view does NOT display last session values |

**Issue:** "Use Suggestion" fills values but does NOT complete the set. User must still tap LOG SET -- confusing extra step.

### Workout Hub Tab

No suggestion visibility. The "Today's Workout" card shows exercise names and sets x reps targets but no progressive overload cues like "you should go heavier today."

### Today Tab

AI Insights include aggregate volume trends ("Volume up 15% this month") and PR counts, but no per-exercise progressive overload suggestions pre-workout.

---

## What's Missing

### 1. No PREVIOUS Column

Hevy and Strong show a dedicated PREVIOUS column in the set table displaying last session's exact weight x reps per set, always visible inline. FormIQ shows a single-line summary below the exercise header that collapses multiple sets into one string. This makes it harder to compare set-by-set.

### 2. Hardcoded Rep Range

Both views pass `'8-12'` as the target rep range to the suggestion engine rather than the exercise's actual `targetReps` from the program (`FocusedWorkoutView.tsx:95`, `active.tsx:962`). This makes suggestions inaccurate for:
- Strength work (3-5 reps) -- engine thinks you "exceeded target" when you hit 6
- Endurance work (15-20 reps) -- engine thinks you "hit target" at 12

### 3. No Visual Distinction for Pre-filled Values

Auto-pre-filled values look identical to manually entered values. Users may not realize the suggestion was applied. Ghost text, a different input border color, or an italic font would distinguish "suggested" from "user-entered."

### 4. Explanation Truncated

`numberOfLines={1}` on the suggestion explanation cuts off the detailed reasoning that the engine generates. The explanation is one of the engine's best features -- it tells users exactly why the suggestion was made.

### 5. No Estimated 1RM

No estimated one-rep max calculation exists anywhere in the app. This is a standard feature in serious strength training apps (Strong, Alpha Progression) and a key metric for progressive overload tracking.

### 6. No Progression Curve

The Progress tab shows isolated PR data points in a list format, not a continuous graph of working weights over sessions. Users cannot see their strength trajectory for an exercise.

### 7. No Pre-Workout Overload Cues

Before starting a workout, users have no idea what the suggestion engine will recommend. A "Today's targets" preview on the Workout Hub or Today tab showing key lifts and their progressive overload suggestions would set expectations and motivate.

---

## Recommendations

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Fix hardcoded '8-12'** -- use exercise's actual `targetReps` from program | Correct suggestions for all rep ranges | Trivial |
| 2 | **Add PREVIOUS column** to set table (or ghost text in inputs) | Matches competitor standard, enables set-by-set comparison | Medium |
| 3 | **Show full explanation** -- remove `numberOfLines={1}` or use expandable text | Surfaces the engine's best feature | Trivial |
| 4 | **Distinguish pre-filled values** -- ghost text, italic, or different border | Clarifies what's suggested vs. user-entered | Low |
| 5 | **Add e1RM display** to exercise detail and progress | Standard strength training metric | Low |
| 6 | **Add progression chart** to Progress tab strength section | Shows trajectory, not just isolated PRs | Medium |
| 7 | **Make "Use Suggestion" in Focus View also complete the set** | Eliminates confusing extra tap | Trivial |
| 8 | **Show last performance in Focus View** | Currently absent -- users lose context | Low |

*S6 complete.*
