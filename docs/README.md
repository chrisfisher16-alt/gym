# Health Coach Platform

AI-powered health coaching platform with a React Native mobile app, Next.js admin portal, and Supabase backend with Edge Functions.

## Architecture

```
health-coach-platform/
├── apps/
│   ├── mobile/          # Expo / React Native mobile app
│   └── admin/           # Next.js admin dashboard
├── packages/
│   └── shared/          # Shared types, constants, schemas
├── supabase/
│   ├── functions/       # Deno Edge Functions (AI, webhooks)
│   ├── migrations/      # Database migrations
│   └── config.toml      # Supabase local config
└── docs/                # Documentation
```

## Prerequisites

- **Node.js** >= 18
- **npm** (comes with Node.js)
- **Expo CLI**: `npm install -g expo-cli` (optional, npx works too)
- **Supabase CLI**: `npm install -g supabase` (for local dev / deploying Edge Functions)
- **EAS CLI**: `npm install -g eas-cli` (for building native binaries)
- **iOS Simulator** (macOS) or **Android Emulator** for device testing

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url> health-coach-platform
cd health-coach-platform
npm install
```

### 2. Environment Variables

Copy example environment files and fill in values:

**Mobile app** (`apps/mobile/.env`):
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your-revenuecat-ios-key
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your-revenuecat-android-key
```

**Admin portal** (`apps/admin/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Supabase Edge Functions** (set via Supabase dashboard or CLI):
```env
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
REVENUECAT_WEBHOOK_SECRET=your-webhook-secret
```

### 3. Set Up Supabase

#### Option A: Supabase Cloud (Recommended)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy the URL + anon key
3. Run migrations:
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```
4. (Optional) Seed data:
   ```bash
   supabase db seed
   ```

#### Option B: Local Supabase

```bash
supabase start
# Note the API URL and anon key from the output
supabase db push
```

### 4. Deploy Edge Functions

```bash
# Deploy all Edge Functions
supabase functions deploy coach-chat
supabase functions deploy ai-meal-parse
supabase functions deploy ai-photo-analyze
supabase functions deploy coach-tools
supabase functions deploy weekly-summary
supabase functions deploy revenuecat-webhook
supabase functions deploy send-notification

# Set secrets
supabase secrets set OPENAI_API_KEY=your-key
supabase secrets set ANTHROPIC_API_KEY=your-key
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your-secret
```

### 5. Run the Mobile App

```bash
# Development server
npm run mobile

# Or directly
cd apps/mobile && npx expo start

# iOS Simulator
npm run mobile:ios

# Android Emulator
npm run mobile:android
```

For a **development build** (required for native modules like HealthKit):

```bash
cd apps/mobile
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

### 6. Run the Admin Portal

```bash
npm run admin

# Or directly
cd apps/admin && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Setting Up RevenueCat

1. Create a project at [revenuecat.com](https://revenuecat.com)
2. Add your app (iOS + Android)
3. Create Products that match the plan IDs:
   - `hc_workout_coach_monthly`
   - `hc_workout_coach_annual`
   - `hc_nutrition_coach_monthly`
   - `hc_nutrition_coach_annual`
   - `hc_full_health_coach_monthly`
   - `hc_full_health_coach_annual`
4. Create an Offering with these packages
5. Set up the webhook URL: `https://your-project.supabase.co/functions/v1/revenuecat-webhook`
6. Copy API keys to your `.env` files

## Creating an Admin Account

1. Sign up in the mobile app or directly via Supabase Auth
2. In the Supabase dashboard SQL editor, run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE user_id = '<your-user-id>';
   ```
3. Access the admin portal at `http://localhost:3000` and log in

## Demo Mode

Sign in with these credentials for a pre-populated demo experience:
- **Email**: `demo@healthcoach.app`
- **Password**: `demo1234`

Demo mode provides 2 weeks of workout history, 1 week of nutrition data, coach conversations, personal records, and supplement tracking.

## Development Build Instructions

### iOS (requires macOS)

```bash
cd apps/mobile

# Configure EAS project (first time only)
eas build:configure

# Create development build
eas build --profile development --platform ios

# Create production build
eas build --profile production --platform ios
```

### Android

```bash
cd apps/mobile

# Create development build
eas build --profile development --platform android

# Create production build (AAB for Play Store)
eas build --profile production --platform android
```

### Web Export

```bash
cd apps/mobile
npx expo export --platform web
```

### Admin Production Build

```bash
cd apps/admin
npm run build
npm run start  # production server
```

## Project Structure — Key Files

| Path | Description |
|------|-------------|
| `apps/mobile/app/` | Expo Router file-based routes |
| `apps/mobile/src/components/ui/` | Reusable UI components |
| `apps/mobile/src/stores/` | Zustand state stores |
| `apps/mobile/src/hooks/` | Custom React hooks |
| `apps/mobile/src/lib/` | Utilities, API clients, services |
| `apps/mobile/src/theme/` | Design system (colors, typography, spacing) |
| `apps/admin/src/app/` | Next.js App Router pages |
| `apps/admin/src/components/` | Admin UI components |
| `apps/admin/src/lib/` | Admin utilities and queries |
| `packages/shared/` | Shared types, constants, schemas |
| `supabase/functions/` | Deno Edge Functions |
| `supabase/migrations/` | Database schema migrations |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run mobile` | Start Expo dev server |
| `npm run mobile:ios` | Start on iOS Simulator |
| `npm run mobile:android` | Start on Android Emulator |
| `npm run admin` | Start admin dev server |
| `npm run admin:build` | Build admin for production |

## Tech Stack

- **Mobile**: React Native (Expo SDK 55), Expo Router, Zustand, React Query
- **Admin**: Next.js 16, Recharts, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **AI**: OpenAI / Anthropic via Edge Functions
- **Payments**: RevenueCat
- **Health**: Apple HealthKit (iOS), Health Connect (Android)
