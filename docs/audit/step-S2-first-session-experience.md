# S2: First Session Experience + S11: Onboarding-to-Value Time

## Onboarding Flow

### Screen Sequence (New User)

```
Sign Up -> Welcome -> Profile -> Body -> Goals -> Mode -> Coach Tone -> Complete -> [Health Connect] -> Main App
```

**Total screens before main app: 8-9** (1 auth + 7 onboarding + optional Health Connect)

### Data Collected Per Step

| Screen | Fields | Required? | Skip Option? |
|--------|--------|-----------|-------------|
| Sign Up | Email, password, confirm password, terms checkbox | All required | No |
| Welcome | None (informational) | -- | No |
| Profile | Display name, DOB (`YYYY-MM-DD` text), gender | All required (Zod) | No |
| Body | Height, weight, unit preference | All required | No |
| Goals | Multi-select from 6 options | Min 1 required | No |
| Mode | Workout Coach / Nutrition Coach / Full Coach | Required | No |
| Coach Tone | Direct / Balanced / Encouraging | Pre-selected "balanced" | Effectively skippable |
| Complete | None (review + save) | -- | No |
| Health Connect | Health permissions | Optional | Yes (skip button) |

**No steps are skippable except Health Connect.** Every onboarding screen requires data entry and "Continue." A user who wants to explore immediately cannot.

### Tap Count: App Install to First Completed Set

| Step | Action | Taps |
|------|--------|------|
| 1 | Open app, arrive at Sign In | 0 |
| 2 | Tap "Sign Up" link | 1 |
| 3 | Fill email + password + confirm + checkbox + "Create Account" | 5 |
| 4 | "Get Started" on Welcome | 6 |
| 5 | Fill name + DOB + gender + "Continue" | ~10 |
| 6 | Fill height + weight + "Continue" | ~13 |
| 7 | Select goal(s) + "Continue" | ~15 |
| 8 | Select mode + "Continue" | ~17 |
| 9 | "Continue" on Coach Tone (accept default) | 18 |
| 10 | "Start Your Journey" | 19 |
| 11 | Skip Health Connect | 20 |
| 12 | Navigate to Workout tab | 21 |
| 13 | Tap "Empty Workout" | 22 |
| 14 | Dismiss warmup card | 23 |
| 15 | Add exercise (3-screen flow) | 26 |
| 16 | Enter weight + reps + checkmark | **~29** |

**With OAuth (Apple/Google): ~25 taps** (saves ~4 vs. email signup).

Most fitness apps target under 10 taps to first value. The mandatory 7-screen onboarding adds significant friction.

### Tap Count: First Logged Meal (from Main App)

| Path | Taps | Notes |
|------|------|-------|
| Quick Add | 4-6 | Nutrition tab -> FAB -> log-meal -> Quick Add -> enter cal -> Save |
| Text Log | 5-8 | Nutrition tab -> FAB -> log-meal -> "Type it" -> describe -> confirm -> Save |
| Photo Log | 6-9 | Nutrition tab -> FAB -> log-meal -> Photo -> capture -> review -> Save |

Quick Add at 4-6 taps is reasonable.

---

## Empty States Assessment

### Today Tab -- Good

- Shows "Ready for your first workout?" card with "Let's Go" CTA
- AI daily briefing falls back to time-of-day motivational message
- Nutrition rings show 0% (provides structure without data)
- Streaks section hidden when streak=0 and totalWorkouts=0

### Workout Tab -- Good

- Quick Start card always visible: "Empty Workout" + "AI Workout" buttons
- Programs and Exercises navigation cards available
- "No workouts yet. Start your first one!" empty state for history

### Nutrition Tab -- Good

- Calorie/macro display shows 0 values (structure without data)
- `<EmptyState>` component: "No Meals Logged" + "Log Your First Meal" CTA
- Hydration immediately interactive (8oz, 16oz quick-add)

### Progress Tab -- Problematic

- Shows a wall of zeros across all metrics
- No dedicated empty state message
- Every chart section renders with zero data
- Achievements show locked badges (good) but surrounded by empty charts (discouraging)

### Coach Tab -- Best

- Immediately functional with no prior data
- Suggested prompts: "Create a workout plan for me", "What should I eat today?", etc.
- Avatar + description create a welcoming presence
- This is potentially the strongest "aha moment" for new users

---

## Onboarding Quality Issues

### 1. No Skip Option (Critical)

Users cannot explore the app without completing all 7 onboarding screens. A "Skip for now" or "Set up later" option on each screen would let curious users reach value faster. Data can be collected later via profile settings.

### 2. No Onboarding Persistence

The onboarding store is plain Zustand with no `persist` middleware. If the user force-quits during onboarding, all entered data is lost and they restart from the welcome screen.

### 3. DOB Requires Manual Text Entry

The DOB field on the Profile screen requires typing `YYYY-MM-DD` format manually. No native `DateTimePicker` is provided. This was also flagged in Step 11.

### 4. Height Input for Imperial

When imperial is selected, height asks for total inches (e.g., "70") rather than the familiar feet/inches format ("5'10"). Also flagged in Step 11.

### 5. No Guided First Action

After onboarding, the user lands on the Today tab with no tutorial, walkthrough, or directed path. There are no coach marks, tooltips, or "Try this first!" prompts. The Coach tab's suggested prompts are the closest thing to guidance, but the user must navigate there independently.

### 6. Generic Value Proposition

Welcome screen tagline: "Smart workout tracking with AI-powered coaching, nutrition logging, and progress analytics." This is functional but doesn't differentiate from competitors or create excitement. Missing: social proof, key differentiator highlight, or compelling visual demo.

### 7. No Per-Field Explanations

Only the Body screen explains why data is needed ("This helps us calculate your nutrition needs"). Other screens use generic "Let's personalize your experience" language.

---

## Bright Spots

1. **Coach tab as aha moment** -- Tapping "Create a workout plan for me" could be the first compelling experience
2. **AI Workout from Workout tab** -- New users can generate a personalized workout immediately
3. **Time-of-day greeting** -- Adds personalization from the first moment
4. **Progress bar on onboarding** -- Shows 1/6 through 6/6, setting expectations
5. **Save failure fallback** -- `complete.tsx:87-89` marks onboarding done even if Supabase save fails, preventing users from getting stuck

---

## Recommendations

| # | Change | Impact |
|---|--------|--------|
| 1 | Add "Skip for now" option on Profile, Body, Goals screens | Reduces time-to-first-value from ~29 taps to ~10 |
| 2 | Persist onboarding state to AsyncStorage | Prevents data loss on mid-flow abandonment |
| 3 | Add post-onboarding guided action: "Log your first workout" or "Chat with your coach" | Directs users to the first aha moment |
| 4 | Replace DOB text input with DateTimePicker | Eliminates format errors |
| 5 | Add feet/inches split input for imperial height | Matches user expectations |
| 6 | Add dedicated empty state to Progress tab | Replace wall of zeros with "Complete your first workout to see progress here" |
| 7 | Consider reducing onboarding to 3 screens | Collect name + goals only; infer or collect body metrics later via profile |

*S2 + S11 complete.*
