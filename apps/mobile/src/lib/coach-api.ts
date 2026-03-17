// ── Coach API Layer ─────────────────────────────────────────────────
// Functions to call Supabase Edge Functions for AI coach features.

import { supabase } from './supabase';

// ── Types ───────────────────────────────────────────────────────────

interface ChatResponse {
  conversation_id: string;
  message_id: string;
  content: string;
  structured_content?: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
  tool_calls?: Array<{
    tool_name: string;
    result: Record<string, unknown>;
  }>;
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
}

interface MealParseResponse {
  items: ParsedMealItem[];
  raw_text: string;
  parse_method: 'ai' | 'database_fallback';
}

interface PhotoAnalyzeResponse {
  items: ParsedMealItem[];
  analysis_method: string;
  description: string;
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

interface WeeklySummaryResponse {
  period: { start: string; end: string };
  workout_adherence: { completed: number; planned: number; percentage: number };
  nutrition_adherence: {
    avg_calories: number;
    target_calories: number;
    avg_protein_g: number;
    target_protein_g: number;
    percentage: number;
  };
  prs_achieved: Array<{ exercise: string; type: string; value: string }>;
  trends: {
    workout: 'improving' | 'maintaining' | 'declining';
    nutrition: 'improving' | 'maintaining' | 'declining';
    overall: 'improving' | 'maintaining' | 'declining';
  };
  recommendations: string[];
  motivational_message: string;
}

// ── API Functions ───────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  retries = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) {
        throw new Error(error.message ?? `Edge function ${functionName} failed`);
      }

      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error(`Failed to call ${functionName}`);
}

/**
 * Send a chat message to the AI coach.
 */
export async function sendChatMessage(
  conversationId: string | undefined,
  message: string,
  context: string = 'general',
): Promise<ChatResponse> {
  return callEdgeFunction<ChatResponse>('coach-chat', {
    conversation_id: conversationId,
    message,
    context,
  });
}

/**
 * Parse natural language meal text into structured nutrition data.
 */
export async function parseMealText(text: string): Promise<MealParseResponse> {
  return callEdgeFunction<MealParseResponse>('ai-meal-parse', { text });
}

/**
 * Analyze a food photo and return estimated nutrition data.
 */
export async function analyzePhoto(imageUri: string): Promise<PhotoAnalyzeResponse> {
  // For base64, we'd need to read the file — for now pass as URL
  return callEdgeFunction<PhotoAnalyzeResponse>('ai-photo-analyze', {
    image_url: imageUri,
  });
}

/**
 * Generate a weekly coaching summary.
 */
export async function generateWeeklySummary(
  weekStart?: string,
): Promise<WeeklySummaryResponse> {
  return callEdgeFunction<WeeklySummaryResponse>('weekly-summary', {
    week_start: weekStart,
  });
}

/**
 * Execute a specific coach tool.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return callEdgeFunction<Record<string, unknown>>('coach-tools', {
    tool_name: toolName,
    params,
  });
}
