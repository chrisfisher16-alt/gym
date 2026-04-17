# Architecture Decision Records

> Each decision is numbered and immutable once accepted. Superseded decisions are marked as such with a link to the replacement.

---

## ADR-001: Monorepo Over Separate Repos

**Status:** Accepted  
**Date:** 2026-03-16

### Context

We are building a mobile app (Expo/React Native) and an admin portal (Next.js) that share a Supabase backend. Both apps consume the same database types, validation schemas, and business constants.

### Decision

Use a single monorepo with pnpm workspaces containing `apps/mobile`, `apps/admin`, `packages/shared`, and `supabase/`.

### Consequences

**Positive:**

- Shared types and Zod schemas are imported directly — no package publishing, no version drift
- Database migration files live alongside the code that consumes them
- Single CI pipeline can validate cross-app type compatibility
- Atomic commits can update types, schemas, and both consumers in one PR
- One set of linting, formatting, and TypeScript config

**Negative:**

- Larger repo clone size over time
- CI must be configured to detect affected packages and skip unrelated builds
- Developers must understand workspace tooling (pnpm workspaces)

**Alternatives Considered:**

- Separate repos with a published shared package — rejected due to version sync overhead and slower iteration
- Nx or Turborepo — may adopt later if build orchestration becomes a bottleneck; pnpm workspaces are sufficient for v1

---

## ADR-002: Expo + React Native for Mobile

**Status:** Accepted  
**Date:** 2026-03-16

### Context

We need a mobile app for iOS and Android. The team has strong TypeScript/React skills. The app is primarily UI-driven with some native needs (health data, SQLite, camera).

### Decision

Use Expo (managed workflow) with React Native and Expo Router for file-based navigation.

### Consequences

**Positive:**

- Single TypeScript codebase for iOS and Android
- Expo's managed workflow handles native build complexity
- EAS Build and EAS Update enable fast iteration and OTA updates
- Expo Router provides Next.js-style file-based routing
- Rich ecosystem of Expo modules (Camera, SQLite, SecureStore, etc.)
- Hot reload for rapid development

**Negative:**

- Some native modules may require custom dev clients or ejecting
- Expo SDK updates can introduce breaking changes
- Performance ceiling is lower than fully native for animation-heavy UIs (mitigated by Reanimated)

**Alternatives Considered:**

- Flutter — rejected because team has stronger React/TS skills; Flutter would require Dart ramp-up
- Native (Swift + Kotlin) — rejected due to 2x development cost and inability to share types with admin portal
- React Native CLI (bare) — rejected because Expo's managed workflow removes significant native build overhead

---

## ADR-003: Supabase Over Custom Backend

**Status:** Accepted  
**Date:** 2026-03-16

### Context

We need authentication, a relational database, file storage, and serverless functions. Building and maintaining a custom backend (e.g., Express + Prisma + S3 + Cognito) is significant infrastructure work.

### Decision

Use Supabase as the backend platform, leveraging Auth, PostgreSQL, Storage, Row-Level Security, and Edge Functions.

### Consequences

**Positive:**

- Auth, DB, storage, and edge functions from one provider — minimal integration glue
- Row-Level Security eliminates the need for a separate authorization layer
- PostgreSQL is battle-tested; we get full SQL, indexes, triggers, and pg extensions
- Edge Functions (Deno) allow server-side TypeScript with access to secrets
- Generous free tier for development; predictable pricing for production
- Realtime subscriptions available when needed
- Database migrations are first-class

**Negative:**

- Vendor dependency on Supabase (mitigated: Supabase is open-source, data is standard Postgres)
- Edge Functions have cold start latency (acceptable for AI calls which are already slow)
- RLS policies must be carefully written and tested — bugs are security vulnerabilities
- Less flexibility than a fully custom backend for complex business logic

**Alternatives Considered:**

- Firebase — rejected due to NoSQL data model (relational data like workouts, sets, food items is inherently relational)
- Custom backend (Express/Fastify + Prisma + AWS) — rejected due to maintenance overhead and slower iteration for a small team
- Convex — considered for realtime, but Supabase's PostgreSQL foundation is more suitable for our analytics-heavy admin portal

---

## ADR-004: Server-Side AI Orchestration

**Status:** Accepted  
**Date:** 2026-03-16

### Context

The app relies heavily on AI for workout plan generation, meal photo analysis, coaching chat, and suggestions. AI provider APIs require secret keys and cost money per token.

### Decision

All AI interactions are routed through Supabase Edge Functions. The client never communicates directly with AI providers. The Edge Function layer is provider-agnostic.

### Consequences

**Positive:**

- API keys are stored as Edge Function secrets — never exposed to the client
- Provider-agnostic interface allows switching between OpenAI, Anthropic, Google, etc. without client changes
- Server-side rate limiting and cost controls per user
- Token usage is tracked and logged for the AI Ops admin dashboard
- Prompt templates are managed server-side — can be updated without app deployment
- Fallback chains (primary → secondary provider) are invisible to the client

**Negative:**

- Every AI interaction requires network connectivity (no offline AI)
- Edge Function cold starts add latency on top of AI provider latency
- More complex debugging — must trace through Edge Function logs

**Alternatives Considered:**

- Client-side AI SDK calls — rejected because API keys would be exposed in the app bundle and extractable
- On-device models (Core ML, etc.) — rejected for v1; model quality is insufficient for our use cases; may revisit for simple tasks later

---

## ADR-005: Offline-First Workout Logging with Expo SQLite

**Status:** Accepted  
**Date:** 2026-03-16

### Context

Users frequently work out in places with poor connectivity (basements, parking garages, rural gyms). Workout logging must be instantaneous and reliable regardless of network status. Dropping a logged set due to network failure is unacceptable.

### Decision

Use Expo SQLite as the local database for workout logging. All writes go to SQLite first, then sync to Supabase via a background queue when online.

### Consequences

**Positive:**

- Workout logging is instant (<50ms write to SQLite)
- No data loss — sets are persisted locally before any network call
- Users can complete entire workouts offline and sync later
- Sync queue provides visibility into pending operations
- Exercise library can be cached locally for offline browsing

**Negative:**

- Dual data layer adds complexity (SQLite + Supabase)
- Conflict resolution needed if same data is modified on multiple devices (mitigated: last-write-wins is acceptable for personal data)
- SQLite schema must be kept in sync with Supabase schema
- More testing surface area (offline writes, sync, conflict scenarios)

**Alternatives Considered:**

- TanStack Query persistence only — rejected because it's designed for cache, not durable offline writes
- WatermelonDB — considered but adds a heavy ORM layer; Expo SQLite is lighter and sufficient
- Realm — rejected due to MongoDB dependency and SDK size

---

## ADR-006: "Nutrition Coach" Naming

**Status:** Accepted  
**Date:** 2026-03-16

### Context

The app provides AI-powered meal tracking, macro guidance, and food suggestions. We need to name this feature and its associated subscription tier.

### Decision

Use "Nutrition Coach" as the product name. Never use "dietitian," "nutritionist," "medical," "prescribe," "diagnose," or other clinical terminology.

### Consequences

**Positive:**

- Avoids regulatory and legal risks associated with clinical nutrition terminology
- "Coach" sets appropriate user expectations — guidance, not medical advice
- Consistent with "Workout Coach" naming for the other tier
- App Store review is less likely to flag non-clinical language

**Negative:**

- Must be vigilant in all copy, prompts, and AI responses to maintain this boundary
- AI system prompts must explicitly instruct the model to stay in "coaching" framing
- Marketing must avoid implying clinical-grade accuracy

**Rules:**

- AI prompts must include: "You are a nutrition coach, not a medical professional. Never diagnose conditions or prescribe diets for medical purposes."
- All disclaimers must state: "Not a substitute for professional medical or dietary advice."
- Marketing copy review checklist must include terminology audit

---

## ADR-007: Config-Driven Pricing and Entitlements

**Status:** Accepted  
**Date:** 2026-03-16

### Context

Pricing will likely change as we learn from the market. Feature entitlements need to be adjustable without app deployments.

### Decision

Pricing tiers, feature gates, and entitlement mappings are driven by server-side configuration (Supabase + RevenueCat), not hard-coded in the client.

### Consequences

**Positive:**

- Price changes don't require app store review or deployment
- Feature gates can be toggled per plan without client updates
- A/B testing different pricing is straightforward
- Entitlement logic lives in one place (RevenueCat + server config)
- Admin portal can display and eventually manage pricing config

**Negative:**

- Client must fetch entitlements on launch and handle loading states
- Offline users see cached entitlements (which may be stale — acceptable tradeoff)
- More moving parts than a simple hard-coded price

**Implementation:**

- RevenueCat manages App Store / Play Store products and subscription lifecycle
- Supabase stores feature-to-entitlement mappings
- Client checks entitlements via RevenueCat SDK + Supabase config
- Edge Functions validate entitlements server-side for protected actions

---

## ADR-008: Read-Mostly Admin Portal First

**Status:** Accepted  
**Date:** 2026-03-16

### Context

The admin portal needs to provide visibility into users, revenue, usage, and AI operations. Full CRUD admin capabilities (editing users, managing content) are desirable but significantly increase scope, security surface, and testing requirements.

### Decision

Build the admin portal as read-mostly in v1. Admins can view all data but write operations are limited to:

- Feature flag toggles
- Notification campaign management
- Their own admin profile

All other write operations (user management, plan changes, data corrections) are done via Supabase dashboard or SQL for v1.

### Consequences

**Positive:**

- Dramatically reduced scope and security surface
- Read-only RLS policies for admin are simpler and safer to implement
- Faster delivery of a useful admin tool
- Supabase dashboard is a capable fallback for write operations
- Can incrementally add write features based on actual admin needs

**Negative:**

- Some admin tasks require Supabase dashboard access (less convenient)
- Non-technical team members may struggle with direct database access
- Must plan the upgrade path to writable admin carefully

---

## ADR-009: Minimal Health Permissions in v1

**Status:** Accepted  
**Date:** 2026-03-16

### Context

Apple Health (iOS) and Health Connect (Android) provide access to a wide range of health data: heart rate, sleep, steps, blood pressure, body temperature, and more. Requesting many permissions triggers user distrust and App Store review scrutiny.

### Decision

In v1, request only the minimum health data permissions:

**Read:**

- Active energy burned
- Workouts (type, duration, calories)
- Body mass (weight)
- Dietary energy (if available)

**Write:**

- Workouts (log completed workouts back to health platform)

### Consequences

**Positive:**

- Minimal permission prompts increase user trust and acceptance rate
- Simpler App Store / Play Store review process
- Less data to process, store, and secure
- Smaller integration surface area to test across devices

**Negative:**

- Cannot provide insights based on sleep, heart rate, or steps in v1
- Users who want a "complete health picture" may find the integration limited
- Must request additional permissions in future updates (which re-prompts users)

**Future Expansion (post-v1):**

- Sleep data → recovery recommendations
- Heart rate → workout intensity validation
- Steps → daily activity score
- Each new permission will be its own ADR when the time comes

---

## ADR-010: Write-Through Summary Sync (Client → Supabase)

**Status:** Accepted
**Date:** 2026-04-17

### Context

The mobile app is local-first: workouts, meal logs, measurements, water intake, supplements, PRs, and achievements all live in Zustand stores persisted to AsyncStorage. At the same time, Supabase-side features — coach memory, weekly-summary Edge Function, admin Overview KPIs — expect to read user activity from the relational tables (`workout_sessions`, `set_logs`, `nutrition_day_logs`, `meal_logs`, `meal_items`).

Before this ADR, only `profiles` and `coach_preferences` were ever written to Supabase by the client. Every server-side feature that depends on user activity returned empty results for real users.

Full normalized sync (resolving local exercise IDs to server UUIDs, joining meal items on barcodes, reconciling conflicts on edits) is a substantial design that needs its own spec. We want to unblock server-side features now without committing to that larger design.

### Decision

Implement a **write-through summary sync** with these properties:

1. **Local store remains the source of truth for the UI.** Reads from Zustand, unchanged.
2. **Summary-level push.** On workout completion and meal log, the client fires a best-effort push to Supabase containing:
   - Session/meal metadata + a `*_json` column with the denormalized payload.
   - Added columns: `workout_sessions.total_volume/total_sets/pr_count/exercises_json/sets_json` and `meal_logs.items_json/local_id/is_synced`. (Migration `00003_sync_summary_columns.sql`.)
3. **No read-back.** The client never pulls server state to reconcile. Local wins.
4. **Retry queue.** Failed pushes are stored in AsyncStorage under `@sync/queue` and retried on the next app launch (`flushSyncQueue` in `_layout.tsx`).
5. **Idempotent upserts.** All writes use `onConflict: 'user_id,local_id'` so retries are safe.
6. **No UI status surface.** Sync is silent. A status indicator can be added later if needed.

### Consequences

**Positive:**

- Weekly-summary, coach memory, admin KPIs, and AI Ops telemetry see real user data.
- No change to the offline-first UX — local writes always succeed immediately.
- Small scope; small surface area to debug.

**Negative:**

- Server-side data is denormalized JSON rather than queryable columns for set-level analytics.
- No conflict resolution: if the same local session is edited on two devices, last-write-wins at the Supabase layer (local wins in the UI).
- `set_logs`, `meal_items`, `exercises` tables remain empty — any feature that depends on them (e.g. SQL aggregations on set-level data) won't work until full sync is built.

**Deferred work (separate ADR when we need it):**

- **Full relational sync.** Map local exercise IDs → server `exercises` rows; populate `set_logs` and `meal_items`; design for edits/deletes and conflict rules.
- **Sync status UI.** A small indicator showing queued / syncing / synced.
- **Multi-device reconciliation.** If/when a user installs the app on a second device, decide whether to pull server state or treat each install as isolated.

---

## ADR-011: Deferred UX / Infra Items

**Status:** Accepted
**Date:** 2026-04-17

This is a consolidated record of items surfaced during the April 2026 QA pass that we deliberately chose not to land in the same wave. Each is individually small but collectively would have blown up the blast radius.

### 1. Exercise library in code, not the database

`apps/mobile/src/lib/exercise-data.ts` is 3.8K LOC of hard-coded exercise definitions. Moving it to a Supabase `exercises` table would let us:

- Update the library without shipping an app update.
- Share exercises between mobile and admin tools.
- Unblock the full relational sync from ADR-010.

Blockers: designing the migration path (local IDs are strings like `ex_bench_press`; server IDs are UUIDs), seeding the table, keeping offline-first (library needs to be cached locally on first launch).

### 2. Large component splits

Two components are each ~630 LOC and getting painful to maintain:

- `src/components/FocusedWorkoutView.tsx`
- `src/components/InWorkoutCoach.tsx`

These should be broken into smaller pieces (set row, rest timer, coach prompt, etc.). Not urgent — both work correctly — and we have no tests yet, so refactoring blind is risky.

### 3. Demo-mode code volume

`src/lib/demo-mode.ts` (~560 LOC) plus `src/lib/ai-demo-responses.ts` (~800 LOC) add up to ~1,400 lines of fixture data. Worth revisiting when we know which demo flows we still need.

Options: keep it, move behind a separate bundle that only ships in `__DEV__`, or replace with a small seed dataset loaded into a real Supabase project.

### 4. Sentry for the admin portal

Next.js 16.1 landed inside the window where `@sentry/nextjs` hasn't published a peer-compatible release (peer-dep resolve fails). The mobile `@sentry/react-native` wiring landed; admin side has PostHog but no error reporting yet. Revisit once `@sentry/nextjs` supports Next 16.

### 5. Mobile/admin test coverage

Shared package has vitest + 28 unit tests (schemas + utilities). Mobile and admin have none yet — adding jest-expo for RN and jest/playwright for Next.js is a meaningful project on its own.

### 6. Sync status UI

ADR-010 intentionally ships silent sync. Users can't see if a workout is queued for upload. Fine for v1; if we start seeing confusion we'll add a small status chip on Today tab.
