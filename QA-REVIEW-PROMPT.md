# Comprehensive QA Review — FormIQ Health Coach

You are performing a thorough end-to-end QA review of the FormIQ Health Coach mobile app running in the iOS Simulator. Your goal is to test **every screen, every button, every flow, every data interaction, and every edge case** in the app. Report all bugs, UI issues, broken flows, and unexpected behavior.

For each issue found, report:
- **Screen/Location**: Which screen or flow
- **Steps to Reproduce**: Exact steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Severity**: Critical / High / Medium / Low / Cosmetic

---

## Phase 1: Fresh Install & Onboarding

### 1.1 Welcome Screen
- [ ] App launches to Welcome screen (first install / cleared data)
- [ ] "Health Coach" title and description text render correctly
- [ ] Three feature bullet points display (Smart Workout Programming, AI-Powered Nutrition Tracking, Personal AI Coach)
- [ ] **Continue with Google** button visible and tappable
- [ ] **Continue with Email** button visible and tappable
- [ ] **Get Started** (skip auth) button visible and tappable
- [ ] "or" divider renders between auth options and skip
- [ ] "You can create an account later" caption shows under Get Started

### 1.2 Google Sign-In Flow
- [ ] Tap "Continue with Google" → browser opens to Google OAuth page
- [ ] Select Google account → browser redirects back to app
- [ ] App receives tokens and sets session (no "Signing in..." hang)
- [ ] If new user → routes to onboarding (health-sync)
- [ ] If returning user (onboarding complete) → routes to main tabs
- [ ] User cancel/dismiss → returns to Welcome, no error shown

### 1.3 Email Sign-Up / Sign-In Flow
- [ ] Tap "Continue with Email" → email/password form appears
- [ ] "← Back to options" link returns to main welcome view
- [ ] Empty submission shows "Please enter both email and password"
- [ ] Password < 8 chars shows "Password must be at least 8 characters"
- [ ] New email → creates account and proceeds to onboarding
- [ ] Existing email → falls back to sign-in automatically
- [ ] Wrong password for existing email → "Incorrect password for this email"
- [ ] Continue button shows loading state during submission

### 1.4 Skip Auth Flow
- [ ] Tap "Get Started" → goes directly to health-sync onboarding step
- [ ] App works in preview/demo mode without auth

### 1.5 Onboarding — Health Sync (Step 1)
- [ ] Progress bar shows correct step position
- [ ] Unit preference toggle (Imperial / Metric) works
- [ ] Switching units updates all measurement labels (ft/in ↔ cm, lbs ↔ kg)
- [ ] Date of birth picker works, calculates age correctly
- [ ] Gender selection works (Male / Female / Other / Prefer not to say)
- [ ] Height input accepts valid values, respects unit selection
- [ ] Weight input accepts valid values, respects unit selection
- [ ] "Connect Health" option (Apple Health) shows permission dialog
- [ ] Continue button enabled only when required fields filled
- [ ] Data persists if you go back and return

### 1.6 Onboarding — Goals (Step 2)
- [ ] All 5 goals displayed: Build Muscle, Lose Fat, Get Stronger, Stay Active, Athletic Performance
- [ ] Multi-select works (can select multiple goals)
- [ ] Selected state visually distinct from unselected
- [ ] At least one goal required to continue
- [ ] Continue button works

### 1.7 Onboarding — Schedule (Step 3)
- [ ] Training days per week selector works (1-7)
- [ ] OR specific day selection (M/T/W/Th/F/Sa/Su) works
- [ ] Session duration options: 30 / 45 / 60 / 75+ min
- [ ] Consistency level selection works
- [ ] Experience level selection (Beginner / Intermediate / Advanced) works
- [ ] Continue button works

### 1.8 Onboarding — Gym Type (Step 4)
- [ ] All 5 options displayed: Large Gym, Small Gym, Garage Gym, At Home, No Equipment
- [ ] Single selection (radio behavior)
- [ ] Selecting "Large Gym" → next screen is gym-search (conditional step)
- [ ] Selecting any other → skips gym-search, goes to equipment
- [ ] Continue button works

### 1.9 Onboarding — Gym Search (Step 5, conditional)
- [ ] Only shown when "Large Gym" was selected
- [ ] Search input works
- [ ] Can skip or select a gym
- [ ] Continue button works

### 1.10 Onboarding — Equipment (Step 6)
- [ ] Equipment catalog displays all categories: small weights, bars & plates, benches & racks, cable machines, machines, cardio, other
- [ ] Items are selectable/deselectable
- [ ] Weight selection for dumbbells, kettlebells, barbells, plates works (if applicable)
- [ ] Multi-select across categories works
- [ ] Continue button works

### 1.11 Onboarding — Notifications (Step 7)
- [ ] Push notification permission prompt appears
- [ ] Allow → enables notifications
- [ ] Don't Allow → gracefully continues without error
- [ ] Skip option available

### 1.12 Onboarding — Attribution (Step 8)
- [ ] All sources shown: Instagram, TikTok, YouTube, X, Reddit, Friend, App Store, Other
- [ ] Single selection works
- [ ] Can proceed without selecting (optional)

### 1.13 Onboarding — Generating (Step 9)
- [ ] Loading animation plays
- [ ] AI workout plan generation completes (or demo fallback)
- [ ] Transitions to main app (tabs) upon completion
- [ ] `onboarding_completed` set on profile

---

## Phase 2: Today Tab (Home Dashboard)

### 2.1 Layout & Greeting
- [ ] Correct time-based greeting (Good morning/afternoon/evening)
- [ ] User's first name displayed in greeting
- [ ] Current date displayed correctly
- [ ] SmartHeader contextual sub-text renders

### 2.2 Daily Briefing Card
- [ ] AI daily briefing card appears
- [ ] Briefing text loads (or shows loading indicator)
- [ ] ExpandableCard expands on tap — preview text hides, full text shows
- [ ] ExpandableCard collapses — preview text reappears
- [ ] No duplicate text (preview + full) when expanded
- [ ] Refresh/regenerate briefing works
- [ ] Briefing cached per day (same content on re-visit same day)

### 2.3 Weekly Check-In Card
- [ ] Appears on Sunday or Monday
- [ ] AI-generated weekly summary content loads
- [ ] Dismiss button works and persists (doesn't reappear after dismissal)

### 2.4 Today's Workout Card
- [ ] Shows today's scheduled workout from active program (if any)
- [ ] Exercise list preview is accurate
- [ ] "Start Workout" button navigates to active workout screen
- [ ] Empty state if no workout scheduled today

### 2.5 Quick Start
- [ ] "Quick Start" empty workout button visible
- [ ] Tapping starts a new empty workout session

### 2.6 Nutrition Dashboard
- [ ] Calorie progress ring shows correct value/target
- [ ] Protein progress bar shows correct value/target
- [ ] Water progress bar shows correct value/target
- [ ] 7-day sparkline charts render (calories, protein, water)
- [ ] Tapping nutrition section navigates to Nutrition tab

### 2.7 Stats Row
- [ ] Streak count accurate
- [ ] Workouts this week count accurate
- [ ] Total PRs count accurate

### 2.8 Supplement Tracking
- [ ] Supplement row shows today's supplements
- [ ] Toggle taken/untaken works
- [ ] State persists

### 2.9 AI Insights
- [ ] Up to 2 insight badges render
- [ ] Dismiss button works on each
- [ ] "Ask" action navigates to Coach tab with context

### 2.10 Quick Actions
- [ ] Quick action sheet opens
- [ ] Log meal option works
- [ ] Quick add water option works
- [ ] Start workout option works
- [ ] Other actions navigate correctly

### 2.11 Quick Log Sheets
- [ ] QuickLogMealSheet opens and allows meal entry
- [ ] QuickAddWaterSheet opens with +8oz / +16oz / custom buttons
- [ ] Water amount updates nutrition store immediately

---

## Phase 3: Workout Tab

### 3.1 Layout
- [ ] WeeklyCalendarRow shows correct training days
- [ ] Active workout banner shows if workout in progress
- [ ] UpgradeBanner shows for free tier users (if applicable)

### 3.2 Active Program Card
- [ ] Program name, difficulty, days/week displayed
- [ ] Progress bar accurate
- [ ] ExpandableCard shows today's exercises when expanded
- [ ] Long-press opens QuickActionSheet (start today, preview, switch, ask coach)
- [ ] Each action in QuickActionSheet works

### 3.3 Start Workout
- [ ] "Start Today's Workout" button works (loads program workout)
- [ ] "Quick Start" button works (empty workout)
- [ ] StartWorkoutSheet opens with options

### 3.4 Exercise Library
- [ ] Navigate to exercise library via button/link
- [ ] Search exercises by name works
- [ ] Filter by muscle group works
- [ ] Filter by equipment works
- [ ] Exercise cards display name, muscle group, equipment
- [ ] Tap exercise → exercise detail screen
- [ ] Exercise detail shows description, muscles, equipment, images/silhouettes
- [ ] "Create Custom Exercise" button → modal opens

### 3.5 Create Custom Exercise
- [ ] Modal presents correctly
- [ ] Name, muscle group, equipment inputs work
- [ ] Save creates exercise and adds to library
- [ ] Cancel dismisses modal without saving

### 3.6 Active Workout Session
- [ ] Active workout screen renders (gesture disabled — can't swipe back)
- [ ] Exercise list shows all exercises for the workout
- [ ] Can add sets to each exercise (weight + reps or bodyweight or timed)
- [ ] Weight/rep inputs accept values, keyboard appears
- [ ] Set completion toggle (checkmark) works
- [ ] Set row shows ghost set data (previous workout reference) if available
- [ ] Rest timer auto-starts when set completed (if auto-rest enabled)
- [ ] RestTimerOverlay shows countdown, can be dismissed
- [ ] RestTimerBar shows minimized timer
- [ ] Can add exercises during workout (ExerciseLibrarySheet)
- [ ] Can reorder exercises (drag and drop)
- [ ] Can create supersets (SupersetSelectionModal)
- [ ] Can replace exercise (ExerciseReplacementModal)
- [ ] ExerciseOptionsSheet shows context options per exercise
- [ ] Haptic feedback triggers on set completion
- [ ] Sound effects play appropriately
- [ ] AmbientStatusBar shows workout phase
- [ ] CommandCenterCard shows workout controls
- [ ] InWorkoutCoach accessible during workout
- [ ] RewindOverlay (undo) works
- [ ] "Finish Workout" button works

### 3.7 Workout Completion
- [ ] WorkoutSummaryModal shows post-workout stats
- [ ] Total volume, duration, sets completed accurate
- [ ] Personal records detected and highlighted
- [ ] PRCelebrationBanner shows for new PRs
- [ ] Session saved to workout history
- [ ] Can dismiss summary and return to Workout tab

### 3.8 Workout History
- [ ] Navigate to workout history
- [ ] List of past workouts with dates, WorkoutFingerprint, stats
- [ ] Tap workout → session detail view
- [ ] Session detail shows all exercises, sets, weights, reps
- [ ] Long-press workout → QuickActionSheet (repeat, view, share, delete)
- [ ] Delete workout with confirmation

### 3.9 Programs
- [ ] Navigate to programs list
- [ ] Active program highlighted
- [ ] Tap program → program detail
- [ ] Program detail shows schedule, exercises per day
- [ ] "Create Program" button → modal
- [ ] Program creation flow works (name, days, exercises)
- [ ] Switch active program works

### 3.10 AI Workout Generation
- [ ] Navigate to AI generate screen
- [ ] Input preferences/goals
- [ ] AI generates workout plan
- [ ] Can save generated plan as program

### 3.11 Workout Milestones
- [ ] WorkoutMilestones component renders
- [ ] Accurate milestone data

### 3.12 Weekly Volume Chart
- [ ] Bar chart renders with daily volume data
- [ ] Correct values for current week

---

## Phase 4: Nutrition Tab

### 4.1 Layout & Date Navigation
- [ ] Current date displayed
- [ ] Back arrow navigates to previous day
- [ ] Forward arrow navigates to next day
- [ ] Can't navigate to future dates (or handled gracefully)

### 4.2 Calorie Ring
- [ ] Central calorie ProgressRing renders correctly
- [ ] Shows current/target calories
- [ ] Meal type breakdown visible

### 4.3 Macro Bars
- [ ] Protein bar shows current/target
- [ ] Carbs bar shows current/target
- [ ] Fat bar shows current/target
- [ ] Expanding macro bar shows per-meal breakdown

### 4.4 Water Tracking
- [ ] Water ProgressRing shows current/target
- [ ] +8oz button adds water, updates immediately
- [ ] +16oz button adds water, updates immediately
- [ ] Custom amount button works
- [ ] -8oz (subtract) button works
- [ ] Water streak displays
- [ ] Ripple animation plays on add

### 4.5 Today's Meals
- [ ] Meals logged today are listed
- [ ] Each meal shows name, calories, time
- [ ] Swipe right → re-log meal (adds duplicate entry)
- [ ] Swipe left → delete meal (confirmation dialog)
- [ ] Long-press → QuickActionSheet (edit, save as template, log again, get recipe, delete)
- [ ] Edit navigates to meal-detail
- [ ] Save as template saves to saved meals
- [ ] Delete removes meal and updates totals

### 4.6 Log Meal Flow
- [ ] "Log Meal" button works
- [ ] Navigate to log-meal screen
- [ ] Can search foods
- [ ] Can add items to meal
- [ ] Can set quantities
- [ ] Save logs the meal and returns to nutrition tab
- [ ] Totals update immediately

### 4.7 Text Log
- [ ] Navigate to text-log screen
- [ ] Type natural language meal description
- [ ] AI parses into structured meal data
- [ ] Review parsed items before saving
- [ ] Save logs meal correctly

### 4.8 Quick Add
- [ ] Quick-add modal opens
- [ ] Enter calories/protein/carbs/fat manually
- [ ] Save adds entry to daily log

### 4.9 Photo Log
- [ ] Navigate to photo-log
- [ ] Camera/library picker works
- [ ] Photo captured/selected
- [ ] Navigate to photo-review
- [ ] AI analyzes food photo
- [ ] Shows estimated nutrition breakdown
- [ ] Can adjust/confirm before saving
- [ ] Save logs meal with photo reference

### 4.10 Saved Meals
- [ ] Navigate to saved meals
- [ ] List of saved meal templates
- [ ] Tap to re-log saved meal
- [ ] Delete saved meal works

### 4.11 Supplements
- [ ] Navigate to supplements screen
- [ ] List of supplements (built-in + custom)
- [ ] Toggle taken/untaken per supplement
- [ ] Add new supplement works
- [ ] Delete supplement works

### 4.12 Recipes
- [ ] Navigate to recipes screen
- [ ] Recipe list or AI recipe generation
- [ ] Tap recipe → detail view
- [ ] Can log recipe as meal

### 4.13 Targets
- [ ] Navigate to targets modal
- [ ] Current targets displayed (calories, protein, carbs, fat, fiber, water)
- [ ] Can edit each target value
- [ ] Save updates targets
- [ ] Changes reflected on nutrition dashboard

### 4.14 Grocery List
- [ ] Navigate to grocery list
- [ ] AI-generated grocery list based on recipes/meal plan
- [ ] Can toggle items as purchased
- [ ] Can clear list

### 4.15 Inline Nutrition Coach
- [ ] InNutritionCoach accessible
- [ ] Can ask nutrition-related questions
- [ ] Receives AI responses

### 4.16 Insight Badge
- [ ] Nutrition insight badge appears when relevant
- [ ] Dismiss works
- [ ] "Ask" navigates to coach with context

---

## Phase 5: Coach Tab (AI Chat)

### 5.1 Empty State
- [ ] Empty conversation shows suggested prompts
- [ ] CoachAvatar displayed
- [ ] Each suggested prompt is tappable

### 5.2 Sending Messages
- [ ] Type message in input field
- [ ] Send button (arrow icon) sends message
- [ ] User message appears as chat bubble immediately
- [ ] TypingIndicator shows while AI responds
- [ ] AI response streams in real-time (tokens appear progressively)
- [ ] Response completes and renders as full markdown
- [ ] Scroll follows new content

### 5.3 AI Response Quality
- [ ] Responses are NOT demo mode (no "AI provider is temporarily unavailable" message)
- [ ] Responses are contextual to user's profile (references their goals, stats, program)
- [ ] Markdown renders correctly (bold, bullets, headers)
- [ ] Structured content cards render when appropriate (WorkoutPlanCard, MealAnalysisCard, etc.)
- [ ] Action buttons in responses work (e.g., "Create this workout" button)

### 5.4 Image Attachment
- [ ] Camera/library icon accessible
- [ ] Can select image from photo library
- [ ] Image preview shows before sending
- [ ] Image sent with message for AI analysis
- [ ] AI responds with analysis of the image (food photo, form check, etc.)

### 5.5 Conversations
- [ ] New conversation button (+ icon) creates fresh conversation
- [ ] Previous conversation messages persist (scroll up)
- [ ] Settings shortcut (gear icon) in header navigates to AI Settings

### 5.6 Error Handling
- [ ] If AI fails, error banner shows with retry option
- [ ] Retry button re-sends the failed message
- [ ] Network error handled gracefully

### 5.7 Pre-filled Messages
- [ ] Coming from another tab with context (e.g., "Ask Coach about protein") → message pre-filled
- [ ] Pre-filled context used in the request

### 5.8 Usage Limits (Free Tier)
- [ ] Usage counter shows (e.g., 3/5 messages today)
- [ ] After hitting limit, paywall shown
- [ ] Counter resets daily

---

## Phase 6: Progress Tab

### 6.1 Date Range Selector
- [ ] Week / Month / 3 Months / Year options
- [ ] Switching changes all charts/data below
- [ ] Default selection reasonable

### 6.2 Overview Stats
- [ ] Total workouts count accurate
- [ ] Total volume accurate
- [ ] Streak count accurate
- [ ] Total PRs count accurate

### 6.3 Monthly Volume Comparison
- [ ] Current month vs previous month volume
- [ ] Percentage change displayed
- [ ] Positive/negative change styled differently

### 6.4 Workout Frequency Chart
- [ ] Bar chart shows workouts per week
- [ ] Bars correspond to correct weeks
- [ ] Scales with date range selection

### 6.5 Muscle Group Balance
- [ ] MuscleAnatomyDiagram renders (front/back body)
- [ ] Muscle groups color-coded by hit count
- [ ] Interactive — tapping a muscle group highlights it
- [ ] Pie chart shows distribution
- [ ] Data matches actual workout history

### 6.6 Muscle Heatmap
- [ ] Front and back anatomy with color intensity
- [ ] Intensity corresponds to training volume/frequency

### 6.7 Personal Records
- [ ] List of exercises with PRs
- [ ] Expandable to show PR history per exercise
- [ ] Most recent PR highlighted
- [ ] Data accurate based on workout history

### 6.8 Nutrition Tracking
- [ ] Calorie sparkline over selected date range
- [ ] Protein sparkline over selected date range
- [ ] Data matches nutrition log

### 6.9 Health Data (if connected)
- [ ] Steps data renders (if Apple Health connected)
- [ ] Active energy data renders
- [ ] Weight trend data renders
- [ ] Sleep data renders
- [ ] "Not connected" state handled if health not connected

### 6.10 Body Measurements
- [ ] Latest measurement card shows
- [ ] Weight trend indicator (up/down/same arrow)
- [ ] "Add Measurement" navigates to measurements screen
- [ ] Measurements screen: can enter weight, chest, waist, hips, arms, thighs
- [ ] Save persists measurement
- [ ] Historical measurements viewable

### 6.11 Progress Photos
- [ ] Photo count displayed
- [ ] Can add new progress photo (camera/library)
- [ ] Can label photo (front/side/back)
- [ ] Photos viewable in gallery

### 6.12 Achievements
- [ ] Earned vs total achievement count
- [ ] Achievement badges display with icons
- [ ] Earned badges visually distinct from locked
- [ ] Tap achievement shows detail

### 6.13 XP / Level System
- [ ] XP progress bar shows current XP / next level
- [ ] Level number displayed
- [ ] XP increments after workouts/activities

### 6.14 Coach FAB
- [ ] Floating coach button visible
- [ ] Tapping opens coach (or navigates to Coach tab with context)

---

## Phase 7: Settings & Profile

### 7.1 Settings Screen
- [ ] Accessible from tab bar or header gear icon
- [ ] Modal slides up from bottom

### 7.2 Profile Section
- [ ] User avatar, name, email displayed
- [ ] Tap profile row → Profile editor modal
- [ ] All profile fields editable:
  - [ ] Display name
  - [ ] Date of birth
  - [ ] Gender
  - [ ] Height (with unit conversion)
  - [ ] Weight (with unit conversion)
  - [ ] Target weight
  - [ ] Health goals (multi-select)
  - [ ] Primary goal (free text)
  - [ ] Activity level (1-5)
  - [ ] Training experience
  - [ ] Fitness equipment (multi-select)
  - [ ] Preferred workout days
  - [ ] Training days per week
  - [ ] Preferred training time
  - [ ] Injuries/limitations
  - [ ] Allergies (multi-select + custom)
  - [ ] Dietary preferences (14 options)
  - [ ] Cooking skill level
  - [ ] Cooking equipment (9 options)
- [ ] Save persists changes to store and Supabase

### 7.3 Training Spaces
- [ ] SpaceSwitcher visible
- [ ] Can view current space
- [ ] Can create new space (SpaceEditor)
- [ ] Space templates available (Cutting, Bulking, Maintenance, Recomp)
- [ ] Switching spaces updates context (nutrition targets, program, etc.)
- [ ] Can edit existing space
- [ ] Can delete space

### 7.4 Preferences
- [ ] Units toggle (Imperial / Metric) works, updates all measurements app-wide
- [ ] Coach Tone selector works (Encouraging, Direct, Scientific, Casual, Drill Sergeant)
- [ ] Appearance selector (Light / Dark / Auto) works, UI theme updates immediately

### 7.5 Subscription
- [ ] Current tier displayed
- [ ] Usage limits shown
- [ ] "Upgrade" navigates to paywall
- [ ] Paywall shows plan options (monthly/yearly toggle)
- [ ] Promo code input works
- [ ] Restore purchases button works
- [ ] Purchase flow completes (or sandbox behavior in simulator)

### 7.6 Notifications
- [ ] Navigate to notification preferences
- [ ] Workout reminders (per day toggles)
- [ ] Hydration reminders (interval setting)
- [ ] Meal reminders (breakfast/lunch/dinner/snack toggles)
- [ ] Coach notification toggle
- [ ] Changes persist

### 7.7 Health Integrations
- [ ] Navigate to health settings
- [ ] Connection status displayed
- [ ] Can connect/disconnect Apple Health
- [ ] Per-data-type sync toggles (steps, energy, weight, sleep)
- [ ] Last sync timestamp shown

### 7.8 AI Settings
- [ ] Navigate to AI Settings modal
- [ ] Provider selection: Demo, Groq, OpenAI-Compatible, Claude, Ollama
- [ ] Default is Claude (Anthropic) for new users
- [ ] API key input works (per-provider, remembered when switching)
- [ ] Model dropdown fetches and shows available models
- [ ] Custom model ID input works
- [ ] Base URL input shows for OpenAI-Compatible / Ollama
- [ ] Test Connection button → success/failure alert
- [ ] Save Settings persists to AsyncStorage
- [ ] Switching providers preserves other providers' API keys

### 7.9 Other Settings
- [ ] Sync status badge shows current sync state
- [ ] About page shows app version
- [ ] Privacy Policy navigable
- [ ] Terms of Service navigable
- [ ] Export Data screen works
- [ ] Support email link works

### 7.10 Sign Out
- [ ] "Sign Out" button visible (if signed in)
- [ ] Confirmation dialog appears
- [ ] Sign out clears session, resets stores
- [ ] Redirects to Welcome screen
- [ ] Cannot access protected screens after sign out

---

## Phase 8: Cross-Cutting Concerns

### 8.1 Navigation
- [ ] All tab switches work (Today, Workout, Nutrition, Coach, Progress)
- [ ] Tab bar icons and labels correct
- [ ] Active tab visually highlighted
- [ ] Back navigation works on all push screens
- [ ] Modal dismiss (swipe down or X button) works on all modals
- [ ] Deep links work if applicable
- [ ] Active workout screen blocks back gesture (gesture disabled)

### 8.2 Data Persistence
- [ ] Kill app and reopen → all data preserved (workouts, meals, settings)
- [ ] Profile data syncs to Supabase when online
- [ ] Workout sessions sync to Supabase
- [ ] Offline changes queued and synced when back online

### 8.3 Offline Behavior
- [ ] Enable Airplane Mode
- [ ] Can still log workouts locally
- [ ] Can still log meals locally
- [ ] AI features show appropriate error (not crash)
- [ ] Sync queue builds up
- [ ] Disable Airplane Mode → queued data syncs
- [ ] NetworkBanner shows offline status

### 8.4 Loading States
- [ ] Skeleton loaders appear while data loads (WorkoutTabSkeleton, NutritionTabSkeleton, ProgressTabSkeleton)
- [ ] No blank/white flash screens between navigation
- [ ] Splash screen shows until app is ready

### 8.5 Empty States
- [ ] No workout history → appropriate empty state message
- [ ] No meals logged → appropriate empty state
- [ ] No measurements → appropriate empty state
- [ ] No programs → appropriate empty state
- [ ] No achievements earned → appropriate display
- [ ] Empty coach conversation → suggested prompts

### 8.6 Error States
- [ ] ErrorBoundary catches React errors without crashing
- [ ] Network failures show user-friendly messages
- [ ] Invalid inputs show validation errors
- [ ] AI failures fall back gracefully (with retry option)

### 8.7 Haptic Feedback & Sounds
- [ ] Haptic on set completion during workout
- [ ] Haptic on button presses where expected
- [ ] Sound effects play at appropriate times

### 8.8 Toast Notifications
- [ ] Success toasts appear for completed actions (meal logged, workout saved, etc.)
- [ ] Error toasts appear for failures
- [ ] Toast auto-dismisses after timeout
- [ ] Toast is non-blocking (can continue using app)

### 8.9 Command Palette
- [ ] CommandPalette accessible (shake gesture or button)
- [ ] Search across app features
- [ ] Quick navigation to screens
- [ ] Quick actions executable

### 8.10 Theme / Dark Mode
- [ ] Light mode renders correctly (all text readable, correct colors)
- [ ] Dark mode renders correctly (all text readable, correct contrast)
- [ ] Auto mode follows system preference
- [ ] All screens respect theme (no hardcoded colors)
- [ ] Charts and visualizations visible in both modes

### 8.11 Performance
- [ ] Tab switches feel instant (no lag)
- [ ] Scrolling smooth on all lists (workout history, exercise library, meals)
- [ ] Chat message streaming renders smoothly
- [ ] No memory warnings or crashes during extended use
- [ ] Large datasets (many workouts/meals) don't cause slowdowns

### 8.12 Free Tier Limits
- [ ] AI message limit enforced (5/day)
- [ ] Workout log limit enforced
- [ ] Meal log limit enforced
- [ ] Paywall appears when limit hit
- [ ] UpgradeBanner shows on gated tabs
- [ ] LockedFeature components render for premium features
- [ ] Limits reset at appropriate intervals

### 8.13 Subscription Tiers
- [ ] `workout_coach` tier: nutrition sections hidden/locked
- [ ] `nutrition_coach` tier: workout sections hidden/locked
- [ ] Full tier: all features accessible
- [ ] Free tier: limited access with upgrade prompts

---

## Phase 9: Social Features

### 9.1 Social Hub
- [ ] Navigate to social section
- [ ] Activity feed loads

### 9.2 Feed
- [ ] Feed items display (workout_share, pr_share, achievement_share, milestone)
- [ ] Like/unlike works
- [ ] Delete own items works

### 9.3 Friends
- [ ] Search users works
- [ ] Send friend request works
- [ ] Accept/decline incoming requests works
- [ ] Remove friend works

### 9.4 Leaderboard
- [ ] Leaderboard loads with rankings
- [ ] Current user position highlighted

---

## Phase 10: Edge Cases & Stress Tests

### 10.1 Rapid Interactions
- [ ] Double-tap buttons don't trigger duplicate actions
- [ ] Rapid set logging during workout doesn't cause data corruption
- [ ] Quick tab switching doesn't cause navigation issues
- [ ] Multiple quick water adds register correctly

### 10.2 Large Data
- [ ] App handles 100+ completed workouts without performance issues
- [ ] Hundreds of logged meals don't slow nutrition tab
- [ ] Long coach conversation (50+ messages) scrolls smoothly
- [ ] Exercise library with many custom exercises loads quickly

### 10.3 Interrupted Flows
- [ ] Kill app during active workout → can resume on reopen
- [ ] Kill app during meal logging → partial data handled
- [ ] Kill app during onboarding → can continue where left off
- [ ] Background/foreground cycling doesn't lose state

### 10.4 Input Validation
- [ ] Negative weight/rep values rejected
- [ ] Extremely large values handled (9999 lbs, 999 reps)
- [ ] Special characters in text inputs don't cause issues
- [ ] Empty strings handled for required fields
- [ ] Decimal values in weight inputs work correctly

### 10.5 Sign Out / Sign In Cycle
- [ ] Sign out → all user data cleared from UI
- [ ] Sign in with same account → data restored from Supabase
- [ ] Sign in with different account → different data shown
- [ ] No data leakage between accounts

---

## Issue Tracking Template

For each issue found, use this format:

```
### Issue: [Brief title]
- **Screen**: [Screen name / route]
- **Severity**: Critical | High | Medium | Low | Cosmetic
- **Steps**:
  1. [Step 1]
  2. [Step 2]
  3. ...
- **Expected**: [What should happen]
- **Actual**: [What actually happens]
- **Screenshot**: [If applicable]
- **Notes**: [Additional context]
```

---

## Summary Checklist

After completing all phases, provide:
1. **Total issues found** by severity (Critical / High / Medium / Low / Cosmetic)
2. **Blocking issues** that prevent core functionality
3. **Top 5 highest priority fixes**
4. **Areas that work well** (positive findings)
5. **Overall app stability rating** (1-10)
6. **Recommendations** for next steps
