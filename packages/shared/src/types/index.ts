// ── Enums & Literal Types ────────────────────────────────────────────

export type ProductMode = 'workout_coach' | 'nutrition_coach' | 'full_health_coach';
export type SetType = 'warmup' | 'working' | 'drop' | 'failure';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealSource = 'manual' | 'text_parse' | 'photo' | 'barcode' | 'quick_add' | 'saved_meal';
export type CoachContext = 'general' | 'workout' | 'nutrition' | 'progress' | 'onboarding';
export type CoachTone = 'direct' | 'balanced' | 'encouraging';
export type GoalType = 'lose_fat' | 'build_muscle' | 'maintain' | 'recomp' | 'strength' | 'endurance';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type UnitPreference = 'metric' | 'imperial';
export type EntitlementTier = 'free' | 'workout_coach' | 'nutrition_coach' | 'full_health_coach';

// ── User & Profile ───────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  subscription?: Subscription;
}

export interface Profile {
  user_id: string;
  display_name: string;
  date_of_birth?: string;
  gender?: Gender;
  height_cm?: number;
  weight_kg?: number;
  unit_preference: UnitPreference;
  avatar_url?: string;
  timezone?: string;
  created_at: string;
  updated_at: string;
}

export interface Goals {
  id: string;
  user_id: string;
  goal_type: GoalType;
  status: GoalStatus;
  target_weight_kg?: number;
  target_calories?: number;
  activity_level: number; // 1-5
  started_at: string;
  target_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CoachPreferences {
  user_id: string;
  product_mode: ProductMode;
  coach_tone: CoachTone;
  focus_areas: string[];
  notification_preferences?: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

// ── Workout ──────────────────────────────────────────────────────────

export interface WorkoutProgram {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  days: WorkoutDay[];
  is_active: boolean;
  created_by: 'user' | 'ai';
  created_at: string;
  updated_at: string;
}

export interface WorkoutDay {
  id: string;
  program_id: string;
  day_number: number;
  name: string;
  exercises: Exercise[];
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  category: string;
  default_sets: number;
  default_reps: string; // e.g. "8-12"
  default_rest_seconds: number;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  program_id?: string;
  day_id?: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  sets: SetLog[];
  notes?: string;
  created_at: string;
}

export interface SetLog {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  set_type: SetType;
  weight_kg?: number;
  reps?: number;
  duration_seconds?: number;
  rpe?: number; // 1-10
  is_pr: boolean;
  notes?: string;
  logged_at: string;
}

// ── Nutrition ────────────────────────────────────────────────────────

export interface NutritionDayLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  meals: MealLog[];
  supplements: UserSupplement[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  created_at: string;
  updated_at: string;
}

export interface MealLog {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  source: MealSource;
  items: MealItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  photo_url?: string;
  notes?: string;
  logged_at: string;
}

export interface MealItem {
  id: string;
  meal_id: string;
  name: string;
  serving_size: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  barcode?: string;
}

export interface SavedMeal {
  id: string;
  user_id: string;
  name: string;
  items: MealItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  use_count: number;
  created_at: string;
}

export interface SupplementCatalog {
  id: string;
  name: string;
  category: string;
  default_dose: string;
  unit: string;
  description?: string;
}

export interface UserSupplement {
  id: string;
  user_id: string;
  supplement_id: string;
  name: string;
  dose: string;
  taken_at: string;
}

// ── Coach ────────────────────────────────────────────────────────────

export interface CoachConversation {
  id: string;
  user_id: string;
  context: CoachContext;
  title?: string;
  messages: CoachMessage[];
  started_at: string;
  last_message_at: string;
}

export interface CoachMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: Record<string, unknown>[];
  tokens_used?: number;
  model?: string;
  created_at: string;
}

export interface CoachMemorySummary {
  id: string;
  user_id: string;
  summary: string;
  key_facts: string[];
  preferences: Record<string, string>;
  last_updated: string;
}

// ── Subscription & Entitlement ───────────────────────────────────────

export interface Subscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  entitlement: Entitlement;
  platform: 'ios' | 'android' | 'web';
  product_id: string;
  started_at: string;
  expires_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Entitlement {
  tier: EntitlementTier;
  features: string[];
  limits: {
    workout_logs_per_month: number;
    meal_logs_per_day: number;
    ai_messages_per_day: number;
  };
}

// ── Notifications ────────────────────────────────────────────────────

export interface NotificationPreferences {
  workout_reminders: boolean;
  meal_reminders: boolean;
  supplement_reminders: boolean;
  coach_tips: boolean;
  progress_updates: boolean;
  quiet_hours_start?: string; // HH:mm
  quiet_hours_end?: string;
}

export interface NotificationEvent {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  scheduled_at: string;
  sent_at?: string;
  opened_at?: string;
}

// ── Analytics & Events ───────────────────────────────────────────────

export interface UsageEvent {
  id: string;
  user_id: string;
  event_name: string;
  event_data?: Record<string, unknown>;
  screen?: string;
  timestamp: string;
}

export interface AIUsageEvent {
  id: string;
  user_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  context: CoachContext;
  duration_ms: number;
  timestamp: string;
}

export interface SubscriptionEvent {
  id: string;
  user_id: string;
  event_type: 'started' | 'renewed' | 'cancelled' | 'expired' | 'restored' | 'upgraded' | 'downgraded';
  from_tier?: EntitlementTier;
  to_tier?: EntitlementTier;
  revenue_usd?: number;
  timestamp: string;
}

// ── Feature Flags & Config ───────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  rollout_percentage: number;
  targeting?: Record<string, unknown>;
  description?: string;
  updated_at: string;
}

export interface PricingConfig {
  id: string;
  tier: EntitlementTier;
  monthly_price_usd: number;
  annual_price_usd: number;
  trial_days: number;
  features: string[];
  is_active: boolean;
}

// ── Admin ────────────────────────────────────────────────────────────

export type AdminRole = 'super_admin' | 'admin' | 'support' | 'viewer';

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  display_name: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  timestamp: string;
}
