// ── Edge Function Shared Types ──────────────────────────────────────

export interface EdgeFunctionRequest {
  user_id: string;
  [key: string]: unknown;
}

// ── AI Provider Types ──────────────────────────────────────────────

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface AIResponse {
  content: string | null;
  tool_calls: AIToolCall[];
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  finish_reason: string;
}

export interface AIProviderOptions {
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
  tools?: AIToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIProvider {
  chat(messages: AIMessage[], options?: AIProviderOptions): Promise<AIResponse>;
}

// ── Coach Types ───────────────────────────────────────────────────

export type CoachContext = 'general' | 'workout' | 'nutrition' | 'progress' | 'onboarding';
export type CoachTone = 'direct' | 'balanced' | 'encouraging';

export interface ChatRequest {
  conversation_id?: string;
  message: string;
  context?: CoachContext;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  content: string;
  structured_content?: StructuredContent[];
  tool_calls?: ToolCallResult[];
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
}

export interface StructuredContent {
  type: 'workout_plan' | 'nutrition_summary' | 'meal_analysis' | 'weekly_summary' | 'progress_chart' | 'action_button' | 'text';
  data: Record<string, unknown>;
}

export interface ToolCallResult {
  tool_name: string;
  result: Record<string, unknown>;
}

// ── Tool Types ──────────────────────────────────────────────────────

export interface ToolRequest {
  tool_name: string;
  params: Record<string, unknown>;
  user_id: string;
}

export interface ToolResponse {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
}

// ── Meal Parse Types ────────────────────────────────────────────────

export interface MealParseRequest {
  text: string;
}

export interface ParsedMealItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  quantity: number;
  unit: string;
  is_estimate: boolean;
  confidence: number;
}

export interface MealParseResponse {
  items: ParsedMealItem[];
  raw_text: string;
  parse_method: 'ai' | 'database_fallback';
}

// ── Photo Analysis Types ────────────────────────────────────────────

export interface PhotoAnalyzeRequest {
  image_base64?: string;
  image_url?: string;
}

export interface PhotoAnalyzeResponse {
  items: ParsedMealItem[];
  analysis_method: 'ai_vision' | 'placeholder';
  description: string;
}

// ── Weekly Summary Types ────────────────────────────────────────────

export interface WeeklySummaryRequest {
  week_start?: string; // YYYY-MM-DD, defaults to current week
}

export interface WeeklySummaryResponse {
  period: { start: string; end: string };
  workout_adherence: {
    completed: number;
    planned: number;
    percentage: number;
  };
  nutrition_adherence: {
    avg_calories: number;
    target_calories: number;
    avg_protein_g: number;
    target_protein_g: number;
    percentage: number;
  };
  prs_achieved: Array<{
    exercise: string;
    type: string;
    value: string;
  }>;
  trends: {
    workout: 'improving' | 'maintaining' | 'declining';
    nutrition: 'improving' | 'maintaining' | 'declining';
    overall: 'improving' | 'maintaining' | 'declining';
  };
  recommendations: string[];
  motivational_message: string;
  coach_tone: CoachTone;
}

// ── Memory Types ──────────────────────────────────────────────────

export interface UserContext {
  profile: {
    display_name: string;
    gender?: string;
    height_cm?: number;
    weight_kg?: number;
    unit_preference: string;
  };
  goals: {
    goal_type: string;
    target_weight_kg?: number;
    target_calories?: number;
    activity_level: number;
  } | null;
  preferences: {
    product_mode: string;
    coach_tone: CoachTone;
    focus_areas: string[];
  } | null;
  recent_workouts: WorkoutSummary[];
  recent_nutrition: NutritionDaySummary[];
  memory_summaries: string[];
}

export interface WorkoutSummary {
  id: string;
  name: string;
  completed_at: string;
  duration_seconds: number;
  total_sets: number;
  total_volume: number;
  pr_count: number;
  exercises: Array<{
    name: string;
    sets: number;
    best_set: string; // e.g. "185lbs × 8"
  }>;
}

export interface NutritionDaySummary {
  date: string;
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meals_count: number;
  water_ml: number;
}

// ── Telemetry Types ─────────────────────────────────────────────────

export interface AIUsageEvent {
  user_id: string;
  conversation_id?: string;
  message_id?: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  status: 'success' | 'error' | 'fallback' | 'flagged';
  tool_calls_count: number;
  error_message?: string;
  context?: CoachContext;
}

// ── Safety Types ────────────────────────────────────────────────────

export interface SafetyCheckResult {
  safe: boolean;
  flagged: boolean;
  reason?: string;
  category?: 'medical_diagnosis' | 'dangerous_calorie_advice' | 'unsafe_supplement' | 'eating_disorder' | 'concerning_symptoms' | 'rate_limit' | 'content_length';
}

export interface RateLimitConfig {
  tier: string;
  max_per_hour: number;
  max_per_day: number;
}
