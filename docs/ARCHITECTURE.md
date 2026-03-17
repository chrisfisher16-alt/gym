# Technical Architecture — Gym Health Coach App

> **Version:** 1.0 · **Last Updated:** 2026-03-16

---

## 1. Monorepo Structure

```
/
├── apps/
│   ├── mobile/          # Expo + React Native (TypeScript)
│   └── admin/           # Next.js (TypeScript) admin portal
├── packages/
│   └── shared/          # Shared types, Zod schemas, constants
├── supabase/
│   ├── migrations/      # PostgreSQL migrations (sequential)
│   ├── functions/       # Supabase Edge Functions (Deno/TypeScript)
│   └── seed.sql         # Development seed data
├── docs/                # Project documentation
├── CLAUDE.md            # Claude Code project memory
├── README.md            # Setup guide
└── package.json         # Root workspace config
```

**Workspace manager:** pnpm workspaces

**Package relationships:**

```
apps/mobile  ──depends on──▶  packages/shared
apps/admin   ──depends on──▶  packages/shared
supabase/functions ──imports──▶  packages/shared (types only)
```

---

## 2. Technology Stack

### Mobile App (`apps/mobile/`)

| Layer | Technology |
|---|---|
| Framework | Expo SDK (managed workflow) |
| UI | React Native + custom components |
| Navigation | Expo Router (file-based) |
| State (client) | Zustand (lightweight stores) |
| State (server) | TanStack Query (caching, sync) |
| Forms | React Hook Form + Zod resolvers |
| Offline DB | Expo SQLite |
| Subscriptions | RevenueCat |
| Health Data | Apple Health (iOS) / Health Connect (Android) |
| Analytics | PostHog (product) + Sentry (errors) |

### Admin Portal (`apps/admin/`)

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| UI | React + Tailwind CSS + shadcn/ui |
| State (server) | TanStack Query |
| Auth | Supabase Auth (admin role) |
| Charts | Recharts |
| Tables | TanStack Table |

### Backend (Supabase)

| Layer | Technology |
|---|---|
| Auth | Supabase Auth (email, Apple, Google) |
| Database | PostgreSQL with RLS |
| Storage | Supabase Storage (meal photos, avatars) |
| Edge Functions | Deno-based TypeScript functions |
| Realtime | Supabase Realtime (selective) |

### Shared (`packages/shared/`)

| Content | Purpose |
|---|---|
| TypeScript types | Database row types, API request/response types |
| Zod schemas | Runtime validation shared between client and server |
| Constants | Entitlement keys, plan IDs, feature flag names |
| Utilities | Date helpers, unit conversions, macro calculators |

---

## 3. State Management Strategy

```
┌─────────────────────────────────────────────────┐
│                  Mobile App                      │
│                                                  │
│  ┌──────────────┐  ┌────────────────────────┐   │
│  │   Zustand     │  │    TanStack Query       │   │
│  │   Stores      │  │    Cache                 │   │
│  │               │  │                          │   │
│  │ • UI state    │  │ • Server data            │   │
│  │ • Active      │  │ • Workouts, meals        │   │
│  │   workout     │  │ • User profile           │   │
│  │ • Theme       │  │ • Plans, exercises       │   │
│  │ • Navigation  │  │ • Auto refetch/stale     │   │
│  │   context     │  │ • Optimistic updates     │   │
│  └──────────────┘  └────────────────────────┘   │
│                                                  │
│  ┌──────────────┐  ┌────────────────────────┐   │
│  │  React Hook   │  │    Expo SQLite           │   │
│  │  Form + Zod   │  │    (Offline)             │   │
│  │               │  │                          │   │
│  │ • Workout     │  │ • Pending workout logs   │   │
│  │   log forms   │  │ • Sync queue             │   │
│  │ • Meal edit   │  │ • Cached exercise lib    │   │
│  │ • Profile     │  │ • Offline workout plans  │   │
│  │ • Onboarding  │  │                          │   │
│  └──────────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Rules:**

- **Zustand** for ephemeral client state (UI, active session, preferences)
- **TanStack Query** for all server-derived data (single source of truth for remote state)
- **React Hook Form + Zod** for all form state and validation
- **Expo SQLite** for offline persistence and sync queue

---

## 4. Offline Architecture

Workout logging must work without network connectivity.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User logs   │────▶│  Expo SQLite  │────▶│  Sync Queue   │
│   a set       │     │  (local DB)   │     │  (pending ops) │
└──────────────┘     └──────────────┘     └───────┬──────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  Network check   │
                                          │  (connectivity)  │
                                          └────────┬────────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │   Supabase REST API          │
                                    │   (batch sync on reconnect)  │
                                    └──────────────────────────────┘
```

**Sync strategy:**

1. All workout log writes go to SQLite first (instant, <50ms)
2. A sync queue table tracks pending operations with timestamps
3. On network availability, a background sync worker processes the queue
4. Conflict resolution: last-write-wins with client timestamp
5. TanStack Query cache is updated after successful sync
6. Sync status indicator in the UI shows pending/synced state

**What works offline:**

- Workout logging (full CRUD)
- Exercise library browsing (cached on first load)
- Viewing current workout plan (cached)
- Viewing recent workout history (cached)

**What requires network:**

- AI features (plan generation, coach chat, meal photo analysis)
- Meal photo upload
- Subscription management
- Profile sync

---

## 5. AI Orchestration

All AI interactions are server-side through Supabase Edge Functions.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Mobile App   │────▶│  Edge Function    │────▶│  AI Provider     │
│  (client)     │     │  (orchestrator)   │     │  (OpenAI/Claude/ │
│               │     │                   │     │   Gemini/etc.)   │
│  • Chat msg   │     │  • Auth check     │     │                  │
│  • Photo      │     │  • Rate limit     │     │  • Completions   │
│  • Plan req   │     │  • Context build  │     │  • Vision        │
│               │     │  • Provider route  │     │  • Embeddings    │
│               │     │  • Response parse  │     │                  │
│               │     │  • Usage tracking  │     │                  │
└──────────────┘     └──────────────────┘     └──────────────────┘
```

### Provider-Agnostic Layer

```typescript
// Simplified architecture (in Edge Functions)

interface AIProvider {
  chat(messages: Message[], options: ChatOptions): Promise<ChatResponse>
  vision(image: Buffer, prompt: string): Promise<VisionResponse>
}

// Provider selection is config-driven
// Fallback chain: primary → secondary → error
// All API keys live in Edge Function secrets (never on client)
```

### AI Features by Domain

| Feature | Input | Output | Provider Needs |
|---|---|---|---|
| Workout plan generation | Goals, equipment, history | Structured plan JSON | Chat completion |
| Exercise swap suggestion | Current exercise, constraints | Alternative exercises | Chat completion |
| Meal photo analysis | Photo + optional text | Detected foods + macros | Vision + chat |
| Meal suggestion | Remaining macros, preferences | Meal ideas | Chat completion |
| Coach chat | Conversation + user context | Coaching response | Chat completion |
| Weekly check-in | Week's data summary | Review + suggestions | Chat completion |

---

## 6. Authentication Flow

### Mobile Auth

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Mobile App   │────▶│  Supabase Auth    │────▶│  PostgreSQL   │
│               │     │                   │     │               │
│  Sign-in via: │     │  • JWT issued     │     │  • Profile    │
│  • Apple      │     │  • Refresh token  │     │    created    │
│  • Google     │     │  • Session mgmt   │     │  • RLS active │
│  • Email/Pass │     │                   │     │               │
└──────────────┘     └──────────────────┘     └──────────────┘
        │
        ▼
┌──────────────┐
│  RevenueCat   │
│               │
│  • User ID    │
│    linked     │
│  • Entitle-   │
│    ments      │
│    synced     │
└──────────────┘
```

1. User signs in via Supabase Auth (Apple/Google/Email)
2. Supabase issues JWT with user ID and role
3. A trigger creates the user profile row in `profiles` table
4. App identifies user to RevenueCat with Supabase user ID
5. RevenueCat webhooks update entitlements in Supabase
6. All subsequent API calls use the Supabase JWT (RLS enforces access)

### Admin Auth

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Admin Portal │────▶│  Supabase Auth    │────▶│  PostgreSQL   │
│  (Next.js)    │     │                   │     │               │
│               │     │  • JWT with role  │     │  • admin role │
│  Email/Pass   │     │  • Session cookie │     │    in JWT     │
│  only         │     │                   │     │  • RLS checks │
│               │     │                   │     │    role claim  │
└──────────────┘     └──────────────────┘     └──────────────┘
```

1. Admin signs in via email/password only (no social auth for admin)
2. User must have `role: 'admin'` in their profile / JWT claims
3. Supabase RLS policies check the `role` claim for admin-specific tables and views
4. Next.js middleware validates the session server-side on each request

---

## 7. Data Flow — Workout Logging

```
User taps "Log Set"
        │
        ▼
┌──────────────────┐
│  React Hook Form  │  ← Zod validates weight, reps, RPE
│  captures input   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Zustand store    │  ← Active workout state updated
│  (active workout) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Expo SQLite      │  ← Persisted immediately (offline-safe)
│  (local write)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Sync queue       │  ← Entry added for background sync
│  (if online →     │
│   sync now)       │
└────────┬─────────┘
         │ (when online)
         ▼
┌──────────────────┐
│  Supabase REST    │  ← RLS ensures user owns the workout
│  (remote write)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  TanStack Query   │  ← Cache invalidated, UI refreshes
│  (cache update)   │
└──────────────────┘
```

---

## 8. Data Flow — Meal Photo Logging

```
User takes photo
        │
        ▼
┌──────────────────┐
│  Image picker     │  ← Compress, resize for upload
│  (Expo)           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Supabase Storage │  ← Upload to meal-photos bucket
│  (photo upload)   │     (RLS: user can write own folder)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Edge Function    │  ← Receives storage URL
│  (analyze-meal)   │     Calls AI Vision API
└────────┬─────────┘     Returns detected foods + macros
         │
         ▼
┌──────────────────┐
│  Mobile App       │  ← Shows detected items
│  (review screen)  │     User can EDIT/ADD/REMOVE items
└────────┬─────────┘
         │ (user confirms)
         ▼
┌──────────────────┐
│  Supabase DB      │  ← Meal log + food items saved
│  (meal_logs,      │     Linked to photo URL
│   food_items)     │
└──────────────────┘
```

---

## 9. Security Model

### Row-Level Security (RLS)

Every table has RLS enabled. Core policies:

```sql
-- Users can only read/write their own data
CREATE POLICY "users_own_data" ON workout_logs
  FOR ALL USING (auth.uid() = user_id);

-- Admin can read all data (not write in v1)
CREATE POLICY "admin_read_all" ON workout_logs
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

### Security Layers

| Layer | Mechanism |
|---|---|
| **Authentication** | Supabase Auth (JWT-based, short-lived access tokens) |
| **Authorization** | RLS policies on every table; admin role checks |
| **API Keys** | AI provider keys stored in Edge Function secrets only |
| **Storage** | Bucket policies — users can only access own folder |
| **Admin access** | Email/password only; role verified in JWT claims |
| **Edge Functions** | Validate JWT, check entitlements, rate limit per user |
| **Input validation** | Zod schemas shared between client and server |
| **Sensitive logic** | Pricing, entitlement checks, AI orchestration — all server-side |

### What Never Touches the Client

- AI provider API keys
- RevenueCat webhook secrets
- Raw subscription pricing logic
- Admin-only database views
- Other users' data

---

## 10. Analytics Architecture

```
┌──────────────────────────────────────────────┐
│                Mobile App                     │
│                                               │
│  ┌─────────────┐      ┌─────────────────┐   │
│  │   PostHog     │      │     Sentry       │   │
│  │   (product)   │      │     (errors)     │   │
│  │               │      │                  │   │
│  │ • Screen views│      │ • Crashes        │   │
│  │ • Feature use │      │ • JS exceptions  │   │
│  │ • Funnels     │      │ • Performance    │   │
│  │ • Retention   │      │ • Breadcrumbs    │   │
│  └──────┬──────┘      └────────┬────────┘   │
│         │                       │             │
└─────────┼───────────────────────┼─────────────┘
          │                       │
          ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  PostHog Cloud   │    │  Sentry Cloud    │
│                  │    │                  │
│  • Dashboards    │    │  • Alerts        │
│  • Cohorts       │    │  • Issue tracker │
│  • Feature flags │    │  • Performance   │
│  • Experiments   │    │    monitoring    │
└─────────────────┘    └─────────────────┘
```

**Events tracked (examples):**

| Event | Properties |
|---|---|
| `workout_started` | plan_id, workout_type |
| `set_logged` | exercise_id, duration_ms |
| `meal_photo_taken` | meal_type (breakfast/lunch/dinner/snack) |
| `meal_items_edited` | items_added, items_removed, items_modified |
| `coach_message_sent` | message_length, context_type |
| `subscription_started` | plan_id, trial |
| `feature_flag_evaluated` | flag_name, variant |

**Privacy:**

- No PII in analytics events
- User ID is pseudonymous (Supabase UUID)
- Consent flow on first launch
- Data retention policies configured per platform

---

## 11. Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                              │
│                                                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐ │
│  │   Auth    │  │ PostgreSQL │  │ Storage   │  │  Edge Fns  │ │
│  │          │  │  + RLS     │  │ (photos)  │  │ (AI, sync) │ │
│  └──────────┘  └───────────┘  └──────────┘  └───────────┘ │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
     ┌──────────┐  ┌──────────┐  ┌──────────────┐
     │  Mobile   │  │  Admin    │  │  RevenueCat   │
     │  App      │  │  Portal   │  │  (webhooks)   │
     │  (Expo)   │  │  (Vercel) │  │               │
     └──────────┘  └──────────┘  └──────────────┘
```

### Hosting

| Component | Host |
|---|---|
| Database, Auth, Storage, Edge Functions | Supabase (managed) |
| Mobile App | App Store / Google Play |
| Admin Portal | Vercel |
| Subscriptions | RevenueCat (managed) |
| Analytics | PostHog Cloud |
| Error Monitoring | Sentry Cloud |
