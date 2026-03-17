# CLAUDE.md — Project Memory for Claude Code

## Project Overview

**Gym** is an AI-first health coaching app — a premium all-in-one platform combining personal trainer, nutrition coach, and accountability mentor.

**Monorepo structure:**

- `apps/mobile/` — Expo + React Native + TypeScript (end-user mobile app)
- `apps/admin/` — Next.js + TypeScript (internal admin portal)
- `packages/shared/` — Shared types, Zod schemas, constants
- `supabase/` — Migrations, Edge Functions, seed data
- `docs/` — PRD, architecture, decision records

**Package manager:** pnpm (workspaces)

---

## Stack

| Layer | Technology |
|---|---|
| Mobile | Expo (managed), React Native, Expo Router |
| Admin | Next.js (App Router), Tailwind, shadcn/ui |
| Backend | Supabase (Auth, PostgreSQL + RLS, Storage, Edge Functions) |
| State (client) | Zustand |
| State (server) | TanStack Query |
| Forms | React Hook Form + Zod |
| Offline | Expo SQLite + sync queue |
| Subscriptions | RevenueCat |
| Health data | Apple Health / Health Connect |
| AI | Server-side via Supabase Edge Functions (provider-agnostic) |
| Analytics | PostHog (product), Sentry (errors) |

---

## Key Conventions

### TypeScript Everywhere

- All code is TypeScript — mobile, admin, shared, edge functions
- Strict mode enabled in all tsconfigs
- No `any` — use `unknown` and narrow with type guards or Zod

### Shared Types and Schemas

- Database row types live in `packages/shared/types/`
- Zod schemas live in `packages/shared/schemas/`
- Both apps import from `@gym/shared`
- When adding a new table or API endpoint, always add types AND Zod schemas to shared first

### Zod for Validation

- All API request/response bodies validated with Zod
- All form inputs validated with Zod (via React Hook Form resolvers)
- Zod schemas are the single source of truth for validation — do not duplicate rules

---

## File Organization

### Mobile (`apps/mobile/`)

```
app/               # Expo Router file-based routes
  (tabs)/          # Tab navigator group
    today.tsx
    workout.tsx
    nutrition.tsx
    coach.tsx
    progress.tsx
  (auth)/          # Auth flow screens
  _layout.tsx      # Root layout
components/        # Reusable UI components
  ui/              # Primitive components (Button, Input, Card, etc.)
  workout/         # Workout domain components
  nutrition/       # Nutrition domain components
  coach/           # Coach domain components
hooks/             # Custom hooks
  useAuth.ts
  useWorkout.ts
  useNutrition.ts
  useSync.ts
lib/               # Utilities and clients
  supabase.ts      # Supabase client init
  ai.ts            # AI interaction helpers
  sync.ts          # Offline sync logic
  health.ts        # Apple Health / Health Connect
stores/            # Zustand stores
  useActiveWorkout.ts
  usePreferences.ts
constants/         # App constants, theme, config
```

### Admin (`apps/admin/`)

```
app/               # Next.js App Router
  (dashboard)/     # Dashboard layout group
    page.tsx       # Overview
    users/
    revenue/
    usage/
    ai-ops/
    notifications/
    feature-flags/
    audit/
  (auth)/          # Admin auth pages
components/        # UI components
  ui/              # shadcn/ui components
lib/               # Utilities and clients
hooks/             # Custom hooks
```

### Shared (`packages/shared/`)

```
types/             # TypeScript type definitions
  database.ts      # Database row types (generated from Supabase)
  api.ts           # API request/response types
  enums.ts         # Shared enums
schemas/           # Zod schemas
  workout.ts
  nutrition.ts
  user.ts
  subscription.ts
constants/         # Shared constants
  plans.ts         # Plan IDs, entitlement keys
  features.ts      # Feature flag names
utils/             # Pure utility functions
  macros.ts        # Macro calculations
  dates.ts         # Date formatting helpers
  units.ts         # Unit conversions
```

---

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `WorkoutCard.tsx` |
| Files (hooks) | camelCase, `use` prefix | `useActiveWorkout.ts` |
| Files (utils, lib) | camelCase | `supabase.ts` |
| Files (types) | camelCase | `database.ts` |
| Files (schemas) | camelCase | `workout.ts` |
| Components | PascalCase | `<WorkoutCard />` |
| Hooks | camelCase, `use` prefix | `useAuth()` |
| Zustand stores | camelCase, `use` prefix | `useActiveWorkout` |
| Types/Interfaces | PascalCase | `WorkoutLog` |
| Zod schemas | camelCase + `Schema` suffix | `workoutLogSchema` |
| Constants | UPPER_SNAKE_CASE | `PLAN_WORKOUT_COACH` |
| DB tables | snake_case | `workout_logs` |
| DB columns | snake_case | `created_at` |
| Edge Functions | kebab-case | `analyze-meal` |
| Migrations | `<timestamp>_snake_case` | `20260316000000_create_workout_logs.sql` |

---

## Non-Negotiables

These principles are not optional. Every PR and code change must respect them.

1. **Premium UI** — The app must feel polished and premium. No janky animations, no ugly defaults. Every screen should feel intentional.

2. **Fast Logging** — Workout set logging must complete in <2 seconds from tap to confirmed. Meal photo capture to review must feel instant. Never make the user wait for network on a logging action.

3. **AI Augments, Never Replaces** — AI generates suggestions and plans. The user always has the final say. Every AI output must be editable. Never auto-apply AI recommendations without user confirmation.

4. **Offline-Safe Workouts** — Workout logging works without network. Period. SQLite writes first, sync later. The user must never lose a logged set.

5. **Editable Meal Photos** — When AI detects food items from a photo, the user can always add, remove, or edit items before saving. AI detection is a starting point, not the final word.

6. **Server-Side AI** — All AI provider calls go through Supabase Edge Functions. API keys never touch the client. Prompts are managed server-side.

7. **"Nutrition Coach" Naming** — Never use "dietitian," "nutritionist," "prescribe," "diagnose," or any medical terminology. We are a coaching app, not a clinical tool.

8. **Config-Driven Pricing** — Pricing, feature gates, and entitlements are server-configured. Never hard-code prices or plan features in the client.

---

## Current Phase

**Phase 1 — Foundation**

- [ ] Auth (Supabase Auth + Apple/Google/Email)
- [ ] Onboarding flow
- [ ] Profile setup
- [ ] Subscription infrastructure (RevenueCat)
- [ ] Core database schema and migrations
- [ ] Basic Today tab
- [ ] Admin portal skeleton with Overview dashboard
- [ ] Shared package setup (types, schemas, constants)

---

## Common Commands

```bash
# Install dependencies
pnpm install

# Mobile
cd apps/mobile && npx expo start        # Start Expo dev server
cd apps/mobile && npx expo start --ios   # Start on iOS simulator
cd apps/mobile && npx expo start --android  # Start on Android emulator

# Admin
cd apps/admin && pnpm dev               # Start Next.js dev server

# Shared
cd packages/shared && pnpm build        # Build shared package
cd packages/shared && pnpm dev          # Watch mode

# Type checking
pnpm -r typecheck                       # Type check all packages

# Linting
pnpm -r lint                            # Lint all packages

# Testing
pnpm -r test                            # Run all tests

# Supabase
npx supabase start                      # Start local Supabase
npx supabase stop                       # Stop local Supabase
npx supabase db reset                   # Reset DB (migrations + seed)
npx supabase migration new <name>       # New migration
npx supabase functions serve            # Local Edge Functions
npx supabase gen types typescript --local > packages/shared/types/database.ts  # Generate types
```

---

## Important Patterns

### Adding a New Feature

1. Define types in `packages/shared/types/`
2. Define Zod schemas in `packages/shared/schemas/`
3. Write the migration in `supabase/migrations/`
4. Add RLS policies in the migration
5. Implement the Edge Function if AI/server logic is needed
6. Build the UI in the appropriate app
7. Add TanStack Query hooks for data fetching
8. Test offline behaviour for workout features

### Adding a New Database Table

1. `npx supabase migration new create_table_name`
2. Write CREATE TABLE with RLS enabled
3. Add policies: user reads/writes own data, admin reads all
4. Run `npx supabase db reset` to test
5. Run `npx supabase gen types typescript --local` to regenerate types
6. Add corresponding Zod schema in shared

### Adding an AI Feature

1. Create Edge Function in `supabase/functions/`
2. Use the provider-agnostic AI interface
3. Add rate limiting and entitlement checks
4. Track token usage for AI Ops dashboard
5. Add explicit system prompt guardrails (no medical claims)
6. Make all AI outputs editable in the client UI
