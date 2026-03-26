// ── Coach Chat Edge Function ────────────────────────────────────────
// Main chat endpoint: receives user message, loads context, calls AI, returns response.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { createAIProvider, estimateCost } from '../_shared/ai-provider.ts';
import {
  loadUserContext,
  loadConversationMessages,
  buildContextString,
  loadStableContext,
  loadDynamicContext,
  buildStableContextString,
  buildDynamicContextString,
  classifyIntent,
} from '../_shared/memory.ts';
import { validateInput, validateOutput, checkRateLimit, logSafetyEvent, SAFETY_SYSTEM_PROMPT } from '../_shared/safety.ts';
import type { ChatRequest, ChatResponse, AIMessage, AIToolDefinition, CoachTone, StructuredContent, ToolCallResult, CacheableSystemBlock } from '../_shared/types.ts';

// ── Tool Definitions for AI ─────────────────────────────────────────

const COACH_TOOLS: AIToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: 'Get the user\'s profile including goals and preferences. NOTE: Basic profile data is already provided in the system context — only call this tool if you need additional detail not present in the context above.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_workouts',
      description: 'Get the user\'s recent workout sessions with full exercise/set details. NOTE: A summary of recent workouts may already be in the system context — only call this if you need more detailed data (e.g., specific set weights, exercise order).',
      parameters: {
        type: 'object',
        properties: { count: { type: 'number', description: 'Number of sessions to return (default 5)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_nutrition',
      description: 'Get the user\'s recent nutrition data with full meal breakdowns. NOTE: A summary of recent nutrition may already be in the system context — only call this if you need more detailed data (e.g., specific meal items, timing).',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: 'Number of days to return (default 3)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_progress_metrics',
      description: 'Get progress metrics including weight trends, PR history, and adherence',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_workout_plan',
      description: 'Create a personalized workout program',
      parameters: {
        type: 'object',
        properties: {
          days_per_week: { type: 'number', description: 'How many days per week' },
          goal: { type: 'string', description: 'Primary goal: strength, hypertrophy, endurance, or general' },
          experience_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_load_for_set',
      description: 'Suggest weight and reps for progressive overload',
      parameters: {
        type: 'object',
        properties: {
          exercise_id: { type: 'string' },
          exercise_name: { type: 'string' },
        },
        required: ['exercise_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'parse_meal_text',
      description: 'Parse natural language meal description into structured nutrition data',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: 'Meal description' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_daily_targets',
      description: 'Calculate personalized calorie and macro targets',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_meal_plan',
      description: 'Generate a daily or weekly meal plan',
      parameters: {
        type: 'object',
        properties: {
          duration: { type: 'string', enum: ['day', 'week'] },
          dietary_preferences: { type: 'string', description: 'E.g., vegetarian, keto, no dairy' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_weekly_summary',
      description: 'Create a comprehensive weekly review',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ── System Prompt Layer Builders (cache-optimized) ─────────────────

const toneInstructions: Record<CoachTone, string> = {
  direct: 'Be concise, data-driven, and straightforward. Skip pleasantries and focus on actionable advice. Use numbers and metrics when possible.',
  balanced: 'Be friendly but focused. Provide clear advice with brief explanations. Balance encouragement with honest assessment.',
  encouraging: 'Be warm, supportive, and motivating. Celebrate progress, no matter how small. Frame challenges positively and emphasize growth.',
};

/**
 * Layer 1: Static system instructions — CACHED globally, identical for all users.
 */
function buildStaticSystemLayer(): string {
  return `You are an AI health and fitness coach in a mobile app. You help users with workouts, nutrition, and health goals.

${SAFETY_SYSTEM_PROMPT}

## Response Format
- Keep responses concise and mobile-friendly (users read on phones).
- Use structured data when returning workout plans, meal analyses, or summaries.
- When generating workout plans, use the generate_workout_plan tool.
- When parsing meals, use the parse_meal_text tool.
- All nutritional estimates should be clearly labeled as estimates.
- Include actionable next steps when relevant.

## Available Tools
You can call tools to fetch data or generate structured content. Use them proactively when the user's question would benefit from real data.`;
}

/**
 * Layer 2: User-specific stable context — CACHED per user session.
 * Includes profile, goals, preferences, and communication tone.
 */
function buildUserContextLayer(stableContextString: string, coachTone: CoachTone): string {
  return `## Communication Style
${toneInstructions[coachTone]}

## User Context
${stableContextString}`;
}

/**
 * Layer 3: Dynamic context — NOT cached, changes every request.
 * Includes recent workouts, nutrition, memory summaries.
 */
function buildDynamicContextLayer(dynamicContextString: string): string {
  if (!dynamicContextString.trim()) return '';
  return `## Recent Activity
${dynamicContextString}`;
}

/**
 * @deprecated Use buildStaticSystemLayer + buildUserContextLayer + buildDynamicContextLayer
 * with cacheOptions for cache-optimized prompting. Kept for backward compatibility.
 */
function buildSystemPrompt(contextString: string, coachTone: CoachTone): string {
  return `You are an AI health and fitness coach in a mobile app. You help users with workouts, nutrition, and health goals.

${SAFETY_SYSTEM_PROMPT}

## Communication Style
${toneInstructions[coachTone]}

## User Context
${contextString}

## Response Format
- Keep responses concise and mobile-friendly (users read on phones).
- Use structured data when returning workout plans, meal analyses, or summaries.
- When generating workout plans, use the generate_workout_plan tool.
- When parsing meals, use the parse_meal_text tool.
- All nutritional estimates should be clearly labeled as estimates.
- Include actionable next steps when relevant.

## Available Tools
You can call tools to fetch data or generate structured content. Use them proactively when the user's question would benefit from real data.`;
}

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startTime = Date.now();
  let userMessageId: string | undefined;
  let supabase: SupabaseClient | null = null;

  try {
    // Auth
    const auth = await verifyAuth(req);
    const { user_id } = auth;
    supabase = auth.supabase;

    // Parse request
    const body: ChatRequest = await req.json();
    const { message, conversation_id, context: coachContext = 'general' } = body;

    // Input validation
    const inputCheck = validateInput(message);
    if (!inputCheck.safe) {
      return errorResponse(inputCheck.reason ?? 'Invalid input', 400);
    }

    // Rate limiting
    const { data: entitlementData } = await supabase
      .from('entitlements')
      .select('tier')
      .eq('user_id', user_id)
      .single();
    const tier = entitlementData?.tier ?? 'free';

    const rateLimitCheck = await checkRateLimit(supabase, user_id, tier);
    if (!rateLimitCheck.safe) {
      return errorResponse(rateLimitCheck.reason ?? 'Rate limit exceeded', 429);
    }

    // Classify intent for context-aware loading
    const intent = classifyIntent(message);

    // Load stable + dynamic context in parallel
    const [stableCtx, dynamicCtx] = await Promise.all([
      loadStableContext(supabase, user_id),
      loadDynamicContext(supabase, user_id, intent),
    ]);

    const coachTone: CoachTone = (stableCtx.preferences?.coach_tone as CoachTone) ?? 'balanced';

    // Build cache-optimized system prompt layers
    const staticLayer = buildStaticSystemLayer();
    const userLayer = buildUserContextLayer(buildStableContextString(stableCtx), coachTone);
    const dynamicLayer = buildDynamicContextLayer(buildDynamicContextString(dynamicCtx));

    const cachedSystemBlocks: CacheableSystemBlock[] = [
      { text: staticLayer, cacheControl: true },
      { text: userLayer, cacheControl: true },
      ...(dynamicLayer.trim() ? [{ text: dynamicLayer }] : []),
    ];

    // Build userContext-compatible object for safety checks (backward compat)
    const userContext = {
      ...stableCtx,
      recent_workouts: dynamicCtx.recent_workouts,
      recent_nutrition: dynamicCtx.recent_nutrition,
      memory_summaries: dynamicCtx.memory_summaries,
    };

    // Get or create conversation
    let convId = conversation_id;
    if (convId) {
      // Verify the conversation belongs to the authenticated user
      const { data: conv } = await supabase
        .from('coach_conversations')
        .select('id')
        .eq('id', convId)
        .eq('user_id', user_id)
        .single();
      if (!conv) {
        return errorResponse('Conversation not found', 404);
      }
    }
    if (!convId) {
      const { data: newConv } = await supabase
        .from('coach_conversations')
        .insert({
          user_id,
          context: coachContext,
          started_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      convId = newConv?.id;
    }

    if (!convId) {
      return errorResponse('Failed to create conversation', 500);
    }

    // Save user message
    const { data: userMsg } = await supabase
      .from('coach_messages')
      .insert({
        conversation_id: convId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    userMessageId = userMsg?.id;

    // Build messages array (no system message — system content goes via cacheOptions)
    const previousMessages = await loadConversationMessages(supabase, convId);
    const aiMessages: AIMessage[] = [
      ...previousMessages.slice(0, -1).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Call AI with cache-optimized system blocks
    const aiProvider = createAIProvider();
    const aiResponse = await aiProvider.chat(aiMessages, {
      tools: COACH_TOOLS,
      temperature: 0.7,
      max_tokens: 2048,
      cacheOptions: { cachedSystemBlocks: cachedSystemBlocks },
    });

    // Handle tool calls if present
    let finalContent = aiResponse.content ?? '';
    const toolCallResults: ToolCallResult[] = [];
    let totalToolTokens = 0;
    let followUpCacheReadTokens = 0;
    let followUpCacheCreationTokens = 0;

    if (aiResponse.tool_calls.length > 0) {
      // Execute tool calls by calling the coach-tools function
      const toolMessages: AIMessage[] = [...aiMessages];
      toolMessages.push({
        role: 'assistant',
        content: aiResponse.content ?? '',
        tool_calls: aiResponse.tool_calls,
      });

      for (const toolCall of aiResponse.tool_calls) {
        let toolResult: Record<string, unknown>;
        try {
          const toolResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/coach-tools`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: req.headers.get('Authorization') ?? '',
              },
              body: JSON.stringify({
                tool_name: toolCall.function.name,
                params: (() => { try { return JSON.parse(toolCall.function.arguments); } catch { return {}; } })(),
                user_id,
              }),
            },
          );
          toolResult = await toolResponse.json();
        } catch {
          toolResult = { error: 'Tool execution failed' };
        }

        toolCallResults.push({
          tool_name: toolCall.function.name,
          result: toolResult,
        });

        toolMessages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      }

      // Get final response with tool results (re-use cached system blocks)
      const followUpResponse = await aiProvider.chat(toolMessages, {
        temperature: 0.7,
        max_tokens: 2048,
        cacheOptions: { cachedSystemBlocks: cachedSystemBlocks },
      });

      finalContent = followUpResponse.content ?? finalContent;
      totalToolTokens = followUpResponse.input_tokens + followUpResponse.output_tokens;
      followUpCacheReadTokens = followUpResponse.cache_read_tokens ?? 0;
      followUpCacheCreationTokens = followUpResponse.cache_creation_tokens ?? 0;
    }

    // Output safety check
    const outputCheck = validateOutput(finalContent, userContext.profile.gender);
    if (!outputCheck.safe) {
      await logSafetyEvent(supabase, user_id, {
        conversation_id: convId,
        message_id: userMsg?.id,
        category: outputCheck.category ?? 'unknown',
        reason: outputCheck.reason ?? 'Output safety check failed',
        content_snippet: finalContent,
        direction: 'output',
        context: coachContext,
      });
      // Replace with safe fallback
      finalContent = "I want to make sure I give you safe advice. For this particular question, I'd recommend consulting with a healthcare professional who can give you personalized guidance. Is there something else I can help you with regarding your workouts or nutrition?";
    }

    // Parse structured content from tool results
    const structuredContent: StructuredContent[] = toolCallResults
      .filter((tc) => tc.result && !('error' in tc.result))
      .map((tc) => {
        const typeMap: Record<string, StructuredContent['type']> = {
          generate_workout_plan: 'workout_plan',
          parse_meal_text: 'meal_analysis',
          calculate_daily_targets: 'nutrition_summary',
          create_weekly_summary: 'weekly_summary',
          get_progress_metrics: 'progress_chart',
        };
        return {
          type: typeMap[tc.tool_name] ?? 'text',
          data: tc.result,
        };
      });

    // Save assistant message
    const { data: assistantMsg } = await supabase
      .from('coach_messages')
      .insert({
        conversation_id: convId,
        role: 'assistant',
        content: finalContent,
        tool_calls: toolCallResults.length > 0 ? toolCallResults : null,
        model: aiResponse.model,
        tokens_used: aiResponse.total_tokens + totalToolTokens,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // Update conversation timestamp
    await supabase
      .from('coach_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', convId);

    // Log telemetry
    const latencyMs = Date.now() - startTime;
    const totalInputTokens = aiResponse.input_tokens;
    const totalOutputTokens = aiResponse.output_tokens;
    const totalTokens = totalInputTokens + totalOutputTokens + totalToolTokens;
    const totalCacheReadTokens = (aiResponse.cache_read_tokens ?? 0) + followUpCacheReadTokens;
    const totalCacheCreationTokens = (aiResponse.cache_creation_tokens ?? 0) + followUpCacheCreationTokens;

    await supabase.from('ai_usage_events').insert({
      user_id,
      conversation_id: convId,
      message_id: assistantMsg?.id,
      model: aiResponse.model,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimateCost(aiResponse.model, totalInputTokens, totalOutputTokens),
      latency_ms: latencyMs,
      status: outputCheck.flagged ? 'flagged' : 'success',
      tool_calls_count: aiResponse.tool_calls.length,
      cache_read_tokens: totalCacheReadTokens,
      cache_creation_tokens: totalCacheCreationTokens,
      cache_hit: totalCacheReadTokens > 0,
      intent: intent,
      created_at: new Date().toISOString(),
    });

    // Build response
    const response: ChatResponse = {
      conversation_id: convId,
      message_id: assistantMsg?.id ?? '',
      content: finalContent,
      structured_content: structuredContent.length > 0 ? structuredContent : undefined,
      tool_calls: toolCallResults.length > 0 ? toolCallResults : undefined,
      model: aiResponse.model,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalTokens,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }

    console.error('Coach chat error:', error);

    // Clean up orphaned user message if AI call failed
    if (userMessageId && supabase) {
      await supabase.from('coach_messages').delete().eq('id', userMessageId).catch(() => {});
    }

    return errorResponse('Coach is temporarily unavailable. Please try again.', 500);
  }
});
