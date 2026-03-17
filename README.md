# Gym — AI Health Coach App

An AI-powered health coaching platform combining a personal trainer, nutrition coach, and accountability mentor.

| App | Stack |
|---|---|
| Mobile | Expo + React Native + TypeScript |
| Admin Portal | Next.js + TypeScript |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions) |
| Shared | TypeScript types, Zod schemas, constants |

---

## Prerequisites

- **Node.js** ≥ 20 (LTS)
- **pnpm** ≥ 9 (`corepack enable` to activate)
- **Git**
- **Expo CLI** (`npx expo` — no global install needed)
- **Supabase CLI** (`npx supabase` or install globally)
- **iOS Simulator** (Xcode, macOS only) and/or **Android Emulator** (Android Studio)

---

## Getting Started

### 1. Clone and Install

```bash
git clone <repo-url> Gym
cd Gym
pnpm install
```

### 2. Environment Setup

Copy the example env files and fill in your values:

```bash
# Mobile app
cp apps/mobile/.env.example apps/mobile/.env

# Admin portal
cp apps/admin/.env.example apps/admin/.env

# Supabase (if running locally)
cp supabase/.env.example supabase/.env
```

**Required environment variables:**

| Variable | Where | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | Supabase anonymous key |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` | mobile | RevenueCat iOS API key |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` | mobile | RevenueCat Android API key |
| `NEXT_PUBLIC_SUPABASE_URL` | admin | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | admin | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | admin | Supabase service role key (server-side only) |

### 3. Start Supabase (Local Development)

```bash
npx supabase start
npx supabase db reset   # Apply migrations and seed data
```

### 4. Run the Mobile App

```bash
cd apps/mobile
npx expo start
```

Press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code with Expo Go.

### 5. Run the Admin Portal

```bash
cd apps/admin
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
/
├── apps/
│   ├── mobile/              # Expo + React Native app
│   │   ├── app/             # Expo Router (file-based routes)
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities, Supabase client, AI client
│   │   ├── stores/          # Zustand stores
│   │   └── constants/       # App constants
│   │
│   └── admin/               # Next.js admin portal
│       ├── app/             # App Router pages
│       ├── components/      # UI components (shadcn/ui)
│       ├── lib/             # Utilities, Supabase client
│       └── hooks/           # Custom React hooks
│
├── packages/
│   └── shared/              # Shared across apps
│       ├── types/           # TypeScript type definitions
│       ├── schemas/         # Zod validation schemas
│       ├── constants/       # Plan IDs, entitlement keys, etc.
│       └── utils/           # Shared utility functions
│
├── supabase/
│   ├── migrations/          # SQL migrations (sequential)
│   ├── functions/           # Edge Functions (Deno/TypeScript)
│   ├── seed.sql             # Development seed data
│   └── config.toml          # Supabase local config
│
└── docs/
    ├── PRD.md               # Product requirements
    ├── ARCHITECTURE.md      # Technical architecture
    └── DECISIONS.md         # Architecture decision records
```

---

## Development Workflow

### Common Commands

```bash
# Install all dependencies
pnpm install

# Run mobile app
cd apps/mobile && npx expo start

# Run admin portal
cd apps/admin && pnpm dev

# Run shared package build (watch mode)
cd packages/shared && pnpm dev

# Type check everything
pnpm -r typecheck

# Lint everything
pnpm -r lint

# Run tests
pnpm -r test

# Supabase
npx supabase start              # Start local Supabase
npx supabase db reset           # Reset DB and apply migrations
npx supabase migration new <name>  # Create new migration
npx supabase functions serve    # Run Edge Functions locally
```

### Creating a New Migration

```bash
npx supabase migration new descriptive_name
# Edit supabase/migrations/<timestamp>_descriptive_name.sql
npx supabase db reset  # Apply and test locally
```

### Adding a Shared Type or Schema

1. Add the type to `packages/shared/types/`
2. Add the Zod schema to `packages/shared/schemas/`
3. Export from `packages/shared/index.ts`
4. Import in mobile or admin: `import { MyType } from '@gym/shared'`

---

## Build Phases

| Phase | Focus | Key Deliverables |
|---|---|---|
| **1 — Foundation** | Infrastructure | Auth, onboarding, subscriptions, DB schema, admin skeleton |
| **2 — Workout Coach** | Core workout features | Exercise library, AI plans, offline logging, history |
| **3 — Nutrition Coach** | Core nutrition features | Photo logging, macro tracking, AI suggestions |
| **4 — Full Health Coach** | Unified coaching | Coach chat, cross-domain insights, weekly check-ins, progress |
| **5 — Polish & Launch** | Production readiness | Performance, accessibility, App Store submission |

---

## Documentation

- [Product Requirements](docs/PRD.md)
- [Technical Architecture](docs/ARCHITECTURE.md)
- [Architecture Decisions](docs/DECISIONS.md)
