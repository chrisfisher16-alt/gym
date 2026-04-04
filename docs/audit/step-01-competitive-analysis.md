# Step 1: Competitive Analysis Report

## How to Read This Document

For each competitor, I document: what they do better than FormIQ today, specific UI patterns worth adopting (with concrete descriptions), how they handle the same screens/flows, and where they fall short. At the end, I synthesize the findings into actionable recommendations sorted by impact.

---

## 1. Hevy

**What they are:** The most popular free workout logger. Social-first design with a feed-based home screen.

### What Hevy Does Better Than FormIQ

**1. Set logging speed via auto-fill + PREVIOUS column**
Hevy shows a dedicated `PREVIOUS` column on every exercise during active logging. It displays the exact weight x reps from your last session for that exercise, always visible inline -- no tap required. When you start a set, the weight and reps fields are pre-filled from your previous session. If you're doing the same weight, logging a set is **1 tap** (the checkmark). FormIQ shows "Last: 80 lbs x 8" as a text line below the exercise title and has a suggestion banner, but neither pre-fills the input fields. FormIQ's current flow is: tap weight field, type number, tap reps field, type number, tap checkmark = **5 taps minimum** for a new value, or stepper-adjust from zero.

**2. Rest timer auto-starts on set completion**
The moment you tap the checkmark in Hevy, the rest timer begins counting down automatically. No separate action needed. In FormIQ, the rest timer exists but the auto-start behavior needs verification -- the rest timer overlay appears to require manual triggering from the exercise card's rest time display area.

**3. Social feed creates daily open-reasons**
Hevy's home tab is a social feed showing friends' workouts. This gives users a reason to open the app on rest days. FormIQ's home tab is a personal dashboard -- useful, but doesn't create social pull.

### Specific UI Patterns Worth Adopting

| Pattern | How Hevy Does It | How to Adapt for FormIQ |
|---------|-------------------|------------------------|
| **PREVIOUS column** | Dedicated column in the set table showing last session's weight x reps | Add a "Previous" row or ghost text inside the weight/reps input fields showing last session's values. When the user taps the input, pre-fill with the previous value instead of blank. |
| **Auto-fill inputs on exercise start** | Weight and reps fields start with last session's values | When an exercise card renders, auto-populate the first incomplete set's weight/reps with the suggested load (FormIQ already calculates this via `getSuggestedLoad` -- the data exists, it's just shown as a banner instead of being in the fields) |
| **Checkmark triggers rest timer** | Single action: tap check = set logged + timer starts | Wire the `handleComplete` function to automatically start the rest timer overlay (currently these are separate actions) |
| **Routine folders** | Templates organized into named folders (PPL, Upper/Lower, etc.) | FormIQ has programs but not folder organization for templates |

### Where Hevy Falls Short (FormIQ's Advantage)

- **No nutrition tracking at all** -- FormIQ covers workout + nutrition + coaching
- **No AI coaching or intelligence** -- Hevy is a pure manual logger
- **No progressive overload suggestions** -- shows what you did, doesn't suggest what to do next. FormIQ's suggestion banner is genuinely ahead here
- **Social feed is noise for solo trainers** -- Many Hevy users complain about the feed-first home screen
- **Analytics behind paywall** -- FormIQ can differentiate with deeper free-tier analytics

---

## 2. Strong

**What they are:** The gold standard for speed and simplicity in workout logging. No-frills, template-driven.

### What Strong Does Better Than FormIQ

**1. Absolute minimum UI chrome**
Strong's set logging screen contains: set number, previous, weight input, reps input, checkmark. Nothing else. No suggestion banners, no exercise illustrations, no overflow menus cluttering the set row. Every pixel serves data entry. FormIQ's ExerciseCard includes: illustration, title, "Last:" text, suggestion banner, set header (SET/WEIGHT/REPS columns), per-set rows with stepper buttons, add set button, add warmup button, rest time editor. This is significantly more visual weight per exercise.

**2. Template-first launch experience**
Strong's center tab is "Start Workout." Your templates are the first thing you see. One tap to start training. FormIQ's Workout tab shows: active session status, today's programmed workout, quick start options, program progress, exercise/program navigation cards, volume chart, recent history, milestones. The primary action (start a workout) competes with 8+ other information sections.

**3. Apple Watch as primary input device**
Strong's Watch app allows complete set logging from the wrist. Phone stays in the gym bag. FormIQ has no Watch support currently (scaffolded for future).

### Specific UI Patterns Worth Adopting

| Pattern | How Strong Does It | How to Adapt for FormIQ |
|---------|---------------------|------------------------|
| **Template as hero element** | Templates displayed as cards, one tap to start | On FormIQ's Workout tab, make "Today's Workout" (from the active program) the dominant element with a single prominent "Start" button. Push secondary content below the fold. |
| **Exercise detail tabs** | Tap exercise title during workout to see 4 tabs: About/History/Charts/Records | FormIQ currently navigates to a separate Exercise Detail screen. Consider an inline expandable detail or bottom sheet accessible from within the active workout, so users don't lose their place. |
| **Data density in set rows** | Tight spacing, no icons, just numbers. Rows are ~40px tall | FormIQ's set rows with stepper buttons are taller (~56px with the +-5/+-1 buttons). For experienced lifters who want to see more sets without scrolling, offer a compact row mode. |

### Where Strong Falls Short (FormIQ's Advantage)

- **No intelligence or suggestions** -- you're completely on your own for progression
- **3-template limit on free tier** -- aggressive paywall on core functionality
- **No social features, no motivation mechanics** -- solo tool only
- **Stagnant development** -- users report it feels abandoned
- **No nutrition, no coaching, no analytics beyond basics** -- FormIQ is dramatically more feature-rich
- **No exercise illustrations or form guidance** -- Strong assumes you know what you're doing

---

## 3. Fitbod

**What they are:** AI-driven workout generator. The app tells you what to do; you execute.

### What Fitbod Does Better Than FormIQ

**1. Muscle recovery visualization (body heat map)**
Fitbod's signature feature is a 3D body avatar with a color-coded heat map: green (fresh) through red (fatigued). Users can rotate the figure and tap muscle groups to see recovery percentages. This makes the abstract concept of "which muscles are ready to train" immediately visceral. FormIQ has no muscle readiness visualization.

**2. Pre-filled workout with one-tap confirmation**
Fitbod generates the entire workout (exercises, sets, reps, weights) and pre-fills every field. The user's job is to confirm or adjust, then tap the checkmark. This inverts the logging paradigm: instead of "what should I do?" (then type it in), it's "here's what to do" (just tap yes). FormIQ generates AI workouts and has suggestions, but the active workout screen is still a manual-entry interface.

**3. Equipment profiles**
Users define their available equipment (full gym, home dumbbells, hotel gym, etc.) and Fitbod instantly adapts exercise selection. FormIQ's AI workout generator takes a text prompt but doesn't have saved equipment profiles.

### Specific UI Patterns Worth Adopting

| Pattern | How Fitbod Does It | How to Adapt for FormIQ |
|---------|---------------------|------------------------|
| **Recovery body map** | 3D avatar with green/yellow/red muscle group overlay | Even a simplified 2D front/back body silhouette with color-coded muscle groups (based on days since last trained) would be valuable on FormIQ's Progress tab or Today screen. The data to power this exists in workout session history. |
| **Pre-populated set inputs** | AI-suggested weight/reps already in the input fields | FormIQ calculates suggestions via `getSuggestedLoad()` -- move these values into the input fields as default values instead of displaying them as a separate banner. Users edit if needed, or just tap the checkmark. This alone could reduce tap count from 5 to 1. |
| **RIR (Reps in Reserve) as input** | Optional per-set field for how many reps you had left | Adding a lightweight "how hard was that?" input (even just easy/moderate/hard) after completing a set would feed FormIQ's AI with effort data for smarter progression. |

### Where Fitbod Falls Short (FormIQ's Advantage)

- **No free tier** -- $15.99/month, 6x FormIQ's price
- **No nutrition tracking** -- doesn't connect fueling to performance
- **No conversational AI coach** -- generates workouts but can't have a dialogue
- **Recovery model is simplistic** -- ~14% per day regardless of intensity (Reddit reverse-engineered)
- **Limited manual control** -- experienced lifters find it constraining
- **No social features** -- solo tool

---

## 4. Alpha Progression

**What they are:** Evidence-based periodization engine. German-engineered, hypertrophy-focused.

### What Alpha Progression Does Better Than FormIQ

**1. Inline progression suggestions that tell you what to do THIS time**
Instead of just showing what you did last time, Alpha Progression actively suggests: "Last: 80kg x 8 -> Try 82.5kg x 8." FormIQ has suggestion banners with this data, but they're a secondary element below the exercise title, not integrated into the set input flow. Alpha Progression makes the suggestion the primary reference point.

**2. RIR-based periodization with auto-deload**
The app programs mesocycles with decreasing RIR week-over-week (Week 1: 3 RIR, Week 4: 0 RIR) and automatically schedules deload weeks. FormIQ has no periodization awareness or deload detection.

**3. Volume tracking per muscle group**
Aggregated weekly volume per muscle group ensures no muscle is under/over-trained. FormIQ's Progress tab shows muscle group balance but it's a static display, not used to influence future workout recommendations.

### Specific UI Patterns Worth Adopting

| Pattern | How Alpha Does It | How to Adapt for FormIQ |
|---------|---------------------|------------------------|
| **Inline "Try this" text in set rows** | The suggested weight/reps appears directly alongside or inside the input area | In FormIQ's SetRow component, show the suggestion as ghost/placeholder text inside the weight/reps inputs: the weight field shows "82.5" in gray, reps shows "8" in gray. User taps checkmark to accept, or types to override. |
| **Mesocycle week view** | Calendar showing training plan across 4-6 weeks with intensity progression | FormIQ programs could benefit from a week-by-week view showing planned vs completed volume, with visual indicators for deload weeks. |
| **Volume per muscle group dashboard** | Bar chart showing weekly sets per muscle group vs recommended range | Add to FormIQ's Progress tab or as a section in the Workout tab: "This week: Chest 12 sets (good), Back 8 sets (low), Legs 6 sets (low)." |

### Where Alpha Progression Falls Short

- **Steeper learning curve** -- RIR and periodization concepts confuse beginners
- **No nutrition** -- purely workout-focused
- **No AI coaching conversation** -- generates plans but doesn't explain or discuss
- **Less polished UI** -- functional but not as visually refined as Hevy or Strong

---

## 5. JEFIT

**What they are:** The exercise encyclopedia. 1,400+ exercise database with community workout sharing.

### What JEFIT Does Better Than FormIQ

**1. Body-part-to-exercise navigation**
JEFIT has a body map where you tap a muscle group to see all exercises targeting it. This is the most intuitive exercise discovery pattern for beginners. FormIQ's exercise library uses filter chips (muscle group, equipment) which is functional but less visual.

**2. Community workout programs**
Thousands of user-shared and curated programs browsable by goal and experience level. FormIQ's program creation is manual-only or AI-generated on demand.

### Where JEFIT Falls Short

- **Dated UI** -- widely described as "cluttered" and "not as polished as modern alternatives"
- **No AI anything** -- no adaptive features, no intelligence, no coaching
- **No nutrition features**
- **The social features add noise** -- gamification and leaderboards can feel gimmicky

### Specific Pattern Worth Adopting

| Pattern | How to Adapt for FormIQ |
|---------|------------------------|
| **Body map exercise discovery** | Add an optional body silhouette view to the exercise library. Tap a muscle group to filter. This is more engaging than chip-based filtering for visual learners. |

---

## 6. Whoop

**What they are:** Biometric recovery platform. Premium dark UI, data visualization best-in-class.

### What Whoop Does Better Than FormIQ

**1. Progressive disclosure for data density**
Whoop's home shows 3 numbers: Recovery %, Strain, Sleep. Tap any one to expand into detailed charts. Tap again for deep dive. This layered approach means casual users see simplicity while data-hungry users access depth. FormIQ's Progress tab (1,257 lines) tries to show everything at once: stats overview, achievements, volume chart, heatmap, muscle balance, strength progress, nutrition adherence, body measurements, PRs -- all in a single scrolling page.

**2. Color-coded readiness system**
Green/yellow/red with clear thresholds. Universally intuitive. "You're in the green -- push hard today" or "Yellow -- moderate session recommended." FormIQ's Today screen coaching card provides text-based recommendations but lacks this immediate visual signal.

**3. Proactive AI daily briefing**
Whoop's "Daily Outlook" synthesizes multiple signals (HRV, sleep, recent strain) into a natural language morning summary without the user asking. FormIQ has a coaching briefing on the Today screen, which is the right idea, but the implementation could learn from Whoop's synthesis quality.

**4. Premium dark aesthetic**
Whoop's dark-only UI with instrument-panel visual language communicates quality and seriousness. FormIQ's dark mode works but uses standard Material/iOS dark patterns rather than an intentional premium aesthetic.

### Specific UI Patterns Worth Adopting

| Pattern | How Whoop Does It | How to Adapt for FormIQ |
|---------|---------------------|------------------------|
| **Progressive disclosure** | Level 1: 3 numbers. Level 2: expanded detail. Level 3: full charts. Level 4: ask the AI. | Apply to FormIQ's Today screen: hero metrics (today's workout, calories remaining, streak) at top; expandable sections for deeper detail; "Ask Coach" for synthesis. |
| **Readiness indicator** | Single color-coded circle: Green/Yellow/Red | Add a "Training Readiness" indicator to FormIQ's Today screen. Based on: days since last workout for each muscle group, yesterday's nutrition (deficit = less ready), sleep from HealthKit. Show as a colored badge or ring. |
| **Daily Outlook format** | AI-generated morning narrative: "Based on X and Y, today I recommend Z" | FormIQ's coaching briefing should synthesize: workout schedule, nutrition status, streak, recovery estimate into one clear directive sentence. |

### Where Whoop Falls Short

- **No workout logging at all** -- tells you how hard to train but not what to do
- **Requires $30/month hardware** -- FormIQ is software-only
- **No nutrition** -- no understanding of fueling
- **No exercise guidance** -- purely biometric

---

## 7. Strava

**What they are:** Social fitness platform for endurance athletes. The gold standard for activity sharing.

### What Strava Does Better Than FormIQ

**1. Single-tap positive reinforcement (Kudos)**
One tap = acknowledgment. No decisions (no emoji picker, no reaction types). Research-proven to increase exercise frequency. FormIQ has no social interaction model currently (scaffolded for future).

**2. Activity sharing with visual identity**
Strava's GPS route maps are instantly recognizable. Activities shared to Instagram Stories carry the Strava brand organically. The route map IS the content. FormIQ has `shareWorkoutSummary()` in `deep-linking.ts` but the shared output is plain text, not a visually distinctive card.

**3. Privacy-granular sharing**
Users choose which stats to show/hide when sharing. Want to share the workout but not the weight you lifted? Fine. FormIQ's share function is all-or-nothing.

### Specific UI Patterns Worth Adopting

| Pattern | How to Adapt for FormIQ |
|---------|------------------------|
| **Shareable visual card** | Generate a branded workout summary image: FormIQ logo + workout name + key stats (volume, duration, PRs) + muscle group heat map of what was trained. This becomes FormIQ's equivalent of Strava's route map. |
| **Kudos-style interaction** | When social features ship, use a single-tap "Fire" or "Strong" reaction -- not a like button with options. Simplicity is the feature. |
| **Privacy controls on shared content** | Let users select which metrics appear when sharing: show exercises but hide weights, show duration but hide volume. |

### Where Strava Falls Short

- **Hostile to strength training** -- gym workouts are second-class citizens
- **No nutrition features**
- **No coaching or intelligence for weight training**

---

## 8. MyFitnessPal

**What they are:** The dominant nutrition tracker with the largest food database (14M+ items).

### What MFP Does Better Than FormIQ

**1. Barcode scanning (when it works)**
Scan a barcode, food is identified, macros auto-populated. 3-4 taps, ~8 seconds. FormIQ has no barcode scanner -- all meal logging is text-based, photo-based, or quick-add.

**2. Database size and food recognition**
14M+ food items means nearly everything is findable. FormIQ relies on AI analysis which is powerful for prepared meals but may miss packaged foods that a barcode scan would nail instantly.

**3. Recent/Frequent meals list**
MFP surfaces your most-logged foods at the top of the meal entry flow. Repeat logging is ~3 taps. FormIQ's `log-meal.tsx` shows recent meals but the flow requires more navigation.

### Where MFP Falls Short (FormIQ's Major Advantages)

- **Inaccurate user-submitted database** -- the 14M entries include massive amounts of wrong data. Users must verify everything.
- **Aggressive ads in free tier** -- placed between meal slots, breaking the experience
- **Static calorie targets** -- never adapts based on actual progress
- **No workout intelligence** -- calorie counting without exercise awareness
- **No AI coaching** -- tracks data but doesn't interpret or advise
- **$19.99/month premium** -- nearly 10x FormIQ's price
- **Recent redesign made logging slower** -- community backlash over added navigation steps
- **Encourages calorie fixation** -- no contextual coaching about nutrition quality

### Specific Pattern Worth Adopting

| Pattern | How to Adapt for FormIQ |
|---------|------------------------|
| **Quick-access recent meals** | On FormIQ's meal logging screen, show the 5 most recent meals as one-tap cards at the top, before any method selection. "Log again" should be the fastest path. |
| **Copy previous day** | MacroFactor does this better (see below), but the concept applies: for meal preppers, copy yesterday's entire food log in one tap. |

---

## 9. MacroFactor

**What they are:** Adaptive nutrition coaching. The smartest nutrition app on the market.

### What MacroFactor Does Better Than FormIQ

**1. Adaptive targets based on real outcomes**
MacroFactor's expenditure algorithm adjusts calorie/macro targets weekly based on actual weight trend vs. intake. Static targets (like FormIQ's `nutrition/targets.tsx` where users manually set calories) are the #1 reason users plateau and quit. This is the single most valuable feature in the nutrition space.

**2. Timeline-based logging instead of meal slots**
MacroFactor ditches rigid Breakfast/Lunch/Dinner slots for a timeline. You log what you ate when you ate it. This matches real eating patterns (snacking, irregular schedules). FormIQ's nutrition tab uses a traditional meal list grouped by type.

**3. Copy/paste days**
One tap to copy an entire day's food log. For meal preppers who eat the same things 5 days a week, this eliminates 80% of logging effort. FormIQ has saved meals but not day-level copying.

**4. "Fastest food logger" claim**
MacroFactor obsesses over tap count reduction. AI Describe (voice/text), smart history, and copy/paste combine to achieve consistent sub-5-minute daily logging. FormIQ's AI meal logging (text or photo) is powerful but the flow has more steps: navigate to log-meal -> choose method -> enter text/photo -> wait for AI -> review -> save.

### Specific UI Patterns Worth Adopting

| Pattern | How MacroFactor Does It | How to Adapt for FormIQ |
|---------|-------------------------|------------------------|
| **Adaptive targets** | Algorithm adjusts weekly based on intake vs. weight trend | FormIQ could implement a simplified version: if weekly average intake is consistently over/under target while weight isn't moving as expected, surface a coach suggestion to adjust targets. The AI coach context (from `coach-system-prompt.ts`) already has access to nutrition and weight data. |
| **Copy previous day** | One tap on the day view to duplicate all meals | Add a "Copy Yesterday" button to FormIQ's nutrition tab. For users who meal prep, this is transformative. |
| **Expenditure visualization** | Line chart showing estimated daily expenditure over time | Add a "Energy Balance" card to FormIQ's Progress tab showing intake vs. estimated expenditure trend. Even a simplified version (intake trend vs. weight trend on the same axis) adds significant insight. |
| **Log-as-you-go timeline** | Foods added to a timeline, not bucketed into meals | Consider making FormIQ's meal type selection optional rather than required. Let users log food first, categorize later (or never). |

### Where MacroFactor Falls Short

- **No workout features at all** -- purely nutrition
- **No free tier** -- $72/year minimum
- **Smaller food database** -- some regional/niche foods missing
- **No social features** -- solo experience
- **Learning curve** -- expenditure concept confuses beginners
- **No meal suggestions** -- tracks what you ate, doesn't suggest what to eat

---

## Synthesis: What FormIQ Should Take Away

### The 10 Highest-Impact Competitive Insights

**1. Pre-fill set inputs with suggested values** (from Hevy, Strong, Fitbod, Alpha Progression)
FormIQ already calculates suggested loads via `getSuggestedLoad()`. Move these values INTO the weight/reps input fields as default values. This single change could reduce set logging from 5 taps to 1 tap. Every competitor does this. FormIQ shows the data as a banner below the title instead.

**Priority: Critical | Effort: Small**

**2. Auto-start rest timer on set completion** (from Hevy, Strong, Fitbod, Alpha Progression)
Every major competitor does this. Tap checkmark = set logged + timer starts. Two separate actions collapsed into one.

**Priority: Critical | Effort: Small**

**3. Progressive disclosure on data-heavy screens** (from Whoop)
FormIQ's Today screen and Progress tab try to show everything simultaneously. Adopt the Whoop pattern: hero metrics visible immediately, detail expandable on tap, deep analysis via the Coach.

**Priority: High | Effort: Medium**

**4. "Last session" data visible inline during active workout** (from Hevy, Strong)
FormIQ shows "Last: 80 lbs x 8" as small text below the exercise title. Make it more prominent -- either a dedicated PREVIOUS column in the set table (like Hevy/Strong) or ghost text inside the input fields showing last session's values.

**Priority: High | Effort: Small**

**5. Shareable workout summary card with visual identity** (from Strava)
When users share a workout, generate a branded image card with FormIQ's visual identity. Include: workout name, key stats, muscle groups trained (as a small heat map), duration, PR count. This is free brand marketing.

**Priority: High | Effort: Medium**

**6. Muscle recovery/readiness visualization** (from Fitbod, Whoop)
A body silhouette with color-coded muscle groups (green = fresh, red = recently trained) on the Today screen or Progress tab. FormIQ has the workout history data to power this. Even a simplified version (time since last trained) adds significant value.

**Priority: High | Effort: Medium**

**7. Recent meals as one-tap re-log** (from MFP, MacroFactor)
The fastest meal logging is re-logging something you've eaten before. Surface the 5 most recent meals as one-tap cards at the very top of the meal logging flow.

**Priority: High | Effort: Small**

**8. Readiness indicator on Today screen** (from Whoop)
A simple green/yellow/red indicator synthesizing: muscle recovery, yesterday's nutrition quality, sleep data (from HealthKit), streak status. Gives the user an instant signal for how to approach today.

**Priority: Medium | Effort: Medium**

**9. Copy-previous-day for nutrition** (from MacroFactor)
One-tap to duplicate yesterday's entire food log. Massive time saver for meal preppers. Increases nutrition logging adherence.

**Priority: Medium | Effort: Small**

**10. Compact set row mode for experienced lifters** (from Strong)
Strong's set rows are ~40px tall -- just numbers. FormIQ's are ~56px with stepper buttons. Offer a toggleable compact mode that removes the +-5/+-1 stepper buttons and relies on direct text input (which experienced lifters prefer anyway). This fits more sets on screen without scrolling.

**Priority: Medium | Effort: Small**

---

### FormIQ's Competitive Position

| Dimension | FormIQ vs. Market |
|-----------|-------------------|
| **Workout + Nutrition + Coaching in one app** | Unique. No competitor combines all three meaningfully. |
| **AI coaching with conversational interface** | Ahead of all competitors except Whoop's AI (which lacks workout context). |
| **Progressive overload suggestions** | Exists (suggestion banner) but underutilized vs. Alpha Progression's integration depth. |
| **Set logging speed** | Behind Hevy/Strong due to non-pre-filled inputs. Fixable with small changes. |
| **Nutrition logging** | AI photo/text logging is innovative but needs faster paths for repeat meals. |
| **Data visualization** | Comprehensive but lacks progressive disclosure. Too much at once. |
| **Price** | Dramatically cheaper than every competitor ($2-3/mo vs. $10-30/mo). |
| **Social features** | Not yet shipped. Tables scaffolded. When built, should learn from Strava's simplicity, not JEFIT's complexity. |
| **Dark mode quality** | Functional but not premium. Could learn from Whoop's intentional dark aesthetic. |
| **Accessibility** | Zero implementation. Behind all major competitors. |

### Where FormIQ Can Genuinely Differentiate

1. **Cross-domain intelligence**: "Your bench press plateau correlates with your calorie deficit this week" -- only FormIQ has both the workout and nutrition data to make these connections.

2. **AI coaching that knows everything**: The Coach tab has context from workouts, nutrition, body measurements, and goals. No competitor has this breadth of context in a conversational AI.

3. **Price disruption**: At $2-3/month, FormIQ can offer 80% of what $15-30/month apps provide. The value proposition is extraordinary if execution is strong.

4. **Offline-first architecture**: FormIQ works without internet for the core workout logging flow. This matters in basement gyms and underground facilities with poor signal.

---

*End of Step 1. Ready for Step 2: Today/Home Screen Audit.*
