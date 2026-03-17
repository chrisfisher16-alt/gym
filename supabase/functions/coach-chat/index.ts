// ── Coach Chat Edge Function ────────────────────────────────────────
// Main chat endpoint: receives user message, loads context, calls AI, returns response.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';
import { createAIProvider, estimateCost } from '../_shared/ai-provider.ts';
import { loadUserContext, loadConversationMessages, buildContextString } from '../_shared/memory.ts';
import { validateInput, validateOutput, checkRateLimit, logSafetyEvent, SAFETY_SYSTEM_PROMPT } from '../_shared/safety.ts';
import type { ChatRequest, ChatResponse, AIMessage, AIToolDefinition, CoachTone, StructuredContent, ToolCallResult } from '../_shared/types.ts';

// ── Tool Definitions for AI ─────────────────────────────────────────

const COACH_TOOLS: AIToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: 'Get the user\'s profile including goals and preferences',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_workouts',
      description: 'Get the user\'s recent workout sessions',
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
      description: 'Get the user\'s recent nutrition data',
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

// ── System Prompt Builder ───────────────────────────────────────────

function buildSystemPrompt(contextString: string, coachTone: CoachTone): string {
  const toneInstructions: Record<CoachTone, string> = {
    direct: 'Be concise, data-driven, and straightforward. Skip pleasantries and focus on actionable advice. Use numbers and metrics when possible.',
    balanced: 'Be friendly but focused. Provide clear advice with brief explanations. Balance encouragement with honest assessment.',
    encouraging: 'Be warm, supportive, and motivating. Celebrate progress, no matter how small. Frame challenges positively and emphasize growth.',
  };

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

  try {
    // Auth
    const { user_id, supabase } = await verifyAuth(req);

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
      .from('subscriptions')
      .select('entitlement')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();
    const tier = entitlementData?.entitlement?.tier ?? 'free';

    const rateLimitCheck = await checkRateLimit(supabase, user_id, tier);
    if (!rateLimitCheck.safe) {
      return errorResponse(rateLimitCheck.reason ?? 'Rate limit exceeded', 429);
    }

    // Load user context
    const userContext = await loadUserContext(supabase, user_id);
    const contextString = buildContextString(userContext);
    const coachTone: CoachTone = (userContext.preferences?.coach_tone as CoachTone) ?? 'balanced';
    const systemPrompt = buildSystemPrompt(contextString, coachTone);

    // Get or create conversation
    let convId = conversation_id;
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
        user_id,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // Build messages array
    const previousMessages = await loadConversationMessages(supabase, convId);
    const aiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...previousMessages.slice(0, -1).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Call AI
    const aiProvider = createAIProvider();
    const aiResponse = await aiProvider.chat(aiMessages, {
      tools: COACH_TOOLS,
      temperature: 0.7,
      max_tokens: 2048,
    });

    // Handle tool calls if present
    let finalContent = aiResponse.content ?? '';
    const toolCallResults: ToolCallResult[] = [];
    let totalToolTokens = 0;

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
                params: JSON.parse(toolCall.function.arguments),
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

      // Get final response with tool results
      const followUpResponse = await aiProvider.chat(toolMessages, {
        temperature: 0.7,
        max_tokens: 2048,
      });

      finalContent = followUpResponse.content ?? finalContent;
      totalToolTokens = followUpResponse.input_tokens + followUpResponse.output_tokens;
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
        user_id,
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
      context: coachContext,
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

    // Log error telemetry (best effort)
    try {
      const { user_id, supabase } = await verifyAuth(req);
      await supabase.from('ai_usage_events').insert({
        user_id,
        model: 'unknown',
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: 0,
        latency_ms: latencyMs,
        status: 'error',
        tool_calls_count: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        created_at: new Date().toISOString(),
      });
    } catch {
      // Ignore telemetry errors
    }

    return errorResponse('Coach is temporarily unavailable. Please try again.', 500);
  }
});
