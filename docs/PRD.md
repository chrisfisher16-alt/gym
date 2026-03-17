# Product Requirements Document — Gym Health Coach App

> **Version:** 1.0 · **Status:** Active · **Last Updated:** 2026-03-16

---

## 1. Product Vision

A **premium, all-in-one AI health platform** that combines a personal trainer, nutrition coach, and accountability mentor into a single mobile experience. The app uses AI to deliver personalised guidance while keeping humans in control — AI augments decision-making, it never replaces it.

### Mission

Make expert-level fitness and nutrition coaching accessible and affordable for everyone through intelligent software.

### Target Users

| Segment | Description |
|---|---|
| **Fitness Beginners** | People starting their health journey who need structured guidance |
| **Intermediate Lifters** | Gym-goers who want smarter programming and tracking |
| **Nutrition-Conscious** | Users focused on diet quality, meal planning, and macro awareness |
| **Holistic Health Seekers** | Users who want workout + nutrition + accountability in one place |

---

## 2. Core Product Modes

Users subscribe to one or more coaching modes. Each mode unlocks a distinct set of features.

### 2.1 Workout Coach

Covers exercise programming, logging, and progress tracking.

- AI-generated workout plans tailored to goals, equipment, and experience
- Fast workout logging (target: <2 seconds per set)
- Exercise library with form guidance
- Progressive overload tracking
- Rest timer with auto-advance
- Workout history and volume analytics
- Apple Health / Health Connect integration (read/write workouts)

### 2.2 Nutrition Coach

Covers meal tracking, planning, and dietary guidance.

- Photo-based meal logging with AI recognition
- Editable AI-detected food items (users always have final say)
- Daily/weekly macro and calorie summaries
- AI meal suggestions based on goals and preferences
- Grocery list generation
- Water intake tracking
- Apple Health / Health Connect integration (read/write nutrition)

### 2.3 Full Health Coach

Combines Workout Coach + Nutrition Coach plus cross-domain AI coaching.

- Everything in Workout Coach and Nutrition Coach
- Unified daily briefing combining workout and nutrition priorities
- Cross-domain AI insights (e.g., "You've been in a calorie deficit for 3 days — consider a lighter workout today")
- Weekly accountability check-ins
- Goal-setting and milestone tracking
- Priority support

---

## 3. Pricing

| Plan | Monthly Price | Includes |
|---|---|---|
| Workout Coach | $1.99/mo | Workout features only |
| Nutrition Coach | $1.99/mo | Nutrition features only |
| Full Health Coach | $2.99/mo | All features + cross-domain coaching |

- Managed via RevenueCat
- Config-driven entitlements (pricing and feature gates controlled by server config, not hard-coded)
- 7-day free trial for all plans
- No ads, ever

---

## 4. Mobile App Surfaces

The mobile app is organised into five primary tabs.

### 4.1 Today Tab

The user's daily command centre.

| Feature | Description |
|---|---|
| Daily briefing | AI-generated summary of today's priorities |
| Quick actions | Start workout, log meal, log water |
| Today's schedule | Planned workout and meal targets |
| Streak and motivation | Current streak, motivational nudge |
| Recent activity | Last 3-5 logged activities |

**User Stories:**

- As a user, I want to open the app and immediately see what I should do today so I don't have to think about it.
- As a user, I want one-tap access to start my workout or log a meal.
- As a user, I want to see my streak so I stay motivated.

### 4.2 Workout Tab

The workout hub for planning, executing, and reviewing workouts.

| Feature | Description |
|---|---|
| Active workout | Real-time logging with set tracking, rest timer, exercise swap |
| Workout plan | Current week's plan with upcoming sessions |
| Exercise library | Searchable list with muscle group filters |
| Quick log | Log a freestyle workout without a plan |
| History | Past workouts with volume and PR highlights |

**User Stories:**

- As a user, I want to log sets in under 2 seconds so tracking doesn't interrupt my flow.
- As a user, I want AI to generate a workout plan based on my goals and available equipment.
- As a user, I want to swap an exercise mid-workout if equipment is taken.
- As a user, I want to see my personal records and volume trends.
- As a user, I want my workouts to work offline so I can log in a basement gym with no signal.

### 4.3 Nutrition Tab

The nutrition hub for tracking meals and managing diet.

| Feature | Description |
|---|---|
| Meal log | Photo-first logging with AI food detection |
| Daily summary | Calories, protein, carbs, fat vs. targets |
| Meal plan | AI-suggested meals for the day/week |
| Grocery list | Auto-generated from meal plan |
| Water tracker | Simple tap-to-log water intake |

**User Stories:**

- As a user, I want to snap a photo of my meal and have AI estimate the contents so logging is fast.
- As a user, I want to edit what the AI detected so I'm always in control of accuracy.
- As a user, I want to see how my actual intake compares to my targets at a glance.
- As a user, I want AI to suggest meals that fit my remaining macros for the day.
- As a user, I want a grocery list generated from my meal plan so shopping is easy.

### 4.4 Coach Tab

The conversational AI coaching interface.

| Feature | Description |
|---|---|
| Chat interface | Natural language conversation with the AI coach |
| Context-aware | Coach has access to user's workout/nutrition history |
| Suggestions | Proactive tips and adjustments based on data |
| Check-ins | Weekly accountability summaries (Full Health Coach) |

**User Stories:**

- As a user, I want to ask my coach questions about my training and get responses that reference my actual data.
- As a user, I want my coach to proactively suggest adjustments when my data shows a pattern.
- As a Full Health Coach subscriber, I want weekly check-ins that review my progress across workouts and nutrition.

### 4.5 Progress Tab

Data visualisation and milestone tracking.

| Feature | Description |
|---|---|
| Body metrics | Weight, measurements (optional photo timeline) |
| Workout stats | Volume, frequency, PRs over time |
| Nutrition stats | Average intake, adherence to targets |
| Milestones | Achievement badges and goal progress |
| Trends | Week-over-week and month-over-month charts |

**User Stories:**

- As a user, I want to see my strength progress over time so I know my training is working.
- As a user, I want to track body measurements alongside workout data for a complete picture.
- As a user, I want to celebrate milestones to stay motivated.

---

## 5. Admin Portal Surfaces

A Next.js web application for the team to monitor and manage the platform.

### 5.1 Overview Dashboard

- Key metrics at a glance: DAU/MAU, revenue, active subscriptions, churn rate
- Graphs for trends over 7d / 30d / 90d
- System health status (API latency, error rates, AI provider status)

### 5.2 Users

- Searchable user list with filters (plan, status, signup date)
- User detail view: profile, subscription, activity log, AI interactions
- Ability to view (not edit in v1) user data for support purposes

### 5.3 Revenue

- MRR, ARR, and revenue breakdown by plan
- Subscription analytics: new, churned, reactivated
- RevenueCat webhook event log
- Cohort retention charts

### 5.4 Usage

- Feature usage heatmaps (which tabs, which actions)
- Workout and meal logging frequency distributions
- Session duration and retention curves
- Funnel analysis: signup → trial → paid → retained

### 5.5 AI Ops

- AI provider status and latency monitoring
- Token usage and cost tracking per provider
- Prompt version management and A/B status
- Error rates and fallback trigger frequency
- Model performance comparison dashboard

### 5.6 Notifications

- Push notification campaign management
- Template editor for notification content
- Audience targeting by segment
- Delivery and engagement metrics
- Scheduled notification queue

### 5.7 Feature Flags

- Toggle features on/off globally or per segment
- Percentage rollouts
- A/B test configuration
- Flag history and audit trail

### 5.8 Audit

- Admin action log (who did what, when)
- Data access log for compliance
- System event timeline
- Export capability for compliance reviews

**Admin User Stories:**

- As an admin, I want to see key business metrics on one page so I can assess platform health quickly.
- As an admin, I want to look up a user to help with support requests.
- As an admin, I want to monitor AI costs and performance so I can optimise spend.
- As an admin, I want to toggle feature flags without deploying code.
- As an admin, I want an audit trail so we maintain compliance and accountability.

---

## 6. What NOT to Build in v1

These are explicitly out of scope for the initial release:

| Excluded Feature | Rationale |
|---|---|
| **Live ads or ad-supported tier** | Premium-only experience; ads degrade UX |
| **Social features** (friends, leaderboards, sharing) | Adds complexity; focus on individual coaching first |
| **Complex recipe marketplace** | User-generated content moderation is expensive; start with AI-generated suggestions |
| **Deep wearable integrations** beyond Apple Health / Health Connect | Each wearable SDK is a maintenance burden; Health Connect and Apple Health cover 90%+ of users |
| **Live video coaching** | Infrastructure cost and complexity; AI chat is the v1 coaching model |
| **Web app for end users** | Mobile-first; web comes later if demand warrants |
| **Custom workout plan builder** (drag-and-drop) | AI generation + editing covers most use cases; builder is engineering-heavy |
| **Barcode/UPC food scanning** | Requires licensed food database; photo-first approach is more novel and sufficient for v1 |
| **Multi-language support** | English-only in v1; internationalise architecture but don't translate yet |
| **Trainer/coach marketplace** | Human coaches add moderation, payments, liability; AI-only in v1 |

---

## 7. Success Metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Monthly Active Users | 10,000 |
| Trial → Paid Conversion | >15% |
| 30-Day Retention | >40% |
| Average Workouts Logged / User / Week | ≥3 |
| Meal Logging Adoption (Nutrition/Full subscribers) | >60% log ≥1 meal/day |
| App Store Rating | ≥4.5 stars |
| Monthly Churn | <8% |
| AI Coach NPS | >50 |

---

## 8. Build Phases

### Phase 1 — Foundation

- Auth, onboarding, profile setup
- Subscription infrastructure (RevenueCat)
- Core data models and Supabase schema
- Basic Today tab
- Admin portal skeleton with Overview dashboard

### Phase 2 — Workout Coach

- Exercise library
- AI workout plan generation
- Workout logging (offline-capable)
- Workout history and basic stats
- Admin: Users and Usage pages

### Phase 3 — Nutrition Coach

- Photo meal logging with AI detection
- Editable food items
- Daily macro summary
- AI meal suggestions
- Admin: Revenue and AI Ops pages

### Phase 4 — Full Health Coach

- Coach chat interface
- Cross-domain AI insights
- Weekly check-ins
- Progress tab with charts
- Admin: Notifications, Feature Flags, Audit pages

### Phase 5 — Polish and Launch

- Performance optimisation
- Accessibility audit
- App Store assets and submission
- Analytics and monitoring hardening
- Beta testing and iteration
