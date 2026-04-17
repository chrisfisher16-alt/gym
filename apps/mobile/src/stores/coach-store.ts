import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachContext } from '@health-coach/shared';
import * as coachApi from '../lib/coach-api';
import type { AIMessage } from '../lib/ai-provider';
import { parseCoachActions, executeCoachAction, type CoachAction } from '../lib/coach-actions';

// ── Types ───────────────────────────────────────────────────────────

export interface CoachActionState {
  action: CoachAction;
  status: 'pending' | 'applied' | 'failed';
  message?: string; // Result message from execution
}

export interface CoachMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structured_content?: StructuredContent[];
  tool_calls?: ToolCallResult[];
  actions?: CoachActionState[];
  model?: string;
  tokens_used?: number;
  created_at: string;
}

export interface StructuredContent {
  type: 'workout_plan' | 'nutrition_summary' | 'meal_analysis' | 'weekly_summary' | 'progress_chart' | 'action_button' | 'text';
  data: Record<string, unknown>;
}

export interface ToolCallResult {
  tool_name: string;
  result: Record<string, unknown>;
}

export interface CoachConversation {
  /** Local id used for client-side grouping and persistence. */
  id: string;
  /** Server-side conversation id returned by the `coach-chat` Edge Function. */
  remoteId?: string;
  context: CoachContext;
  title?: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
}

// ── Storage Keys ────────────────────────────────────────────────────

const STORAGE_KEYS = {
  CONVERSATIONS: '@coach/conversations',
  MESSAGES: '@coach/messages',
  ACTIVE_CONVERSATION: '@coach/active_conversation',
} as const;

// ── State ───────────────────────────────────────────────────────────

interface CoachState {
  conversations: CoachConversation[];
  activeConversation: CoachConversation | null;
  messages: CoachMessage[];
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  sendMessage: (text: string, context?: CoachContext) => Promise<void>;
  startConversation: (context?: CoachContext) => void;
  loadConversation: (conversationId: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  clearError: () => void;
  setPrefilledContext: (context: CoachContext, message?: string) => void;
  prefilledContext: CoachContext | null;
  prefilledMessage: string | null;
  clearPrefilledContext: () => void;
  executeAction: (messageId: string, actionIndex: number) => Promise<void>;
}

// ── Helpers ─────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Convert coach messages to AIMessage format for the provider.
 */
function toAIHistory(messages: CoachMessage[]): AIMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

// ── Store ───────────────────────────────────────────────────────────

export const useCoachStore = create<CoachState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoading: false,
  error: null,
  isInitialized: false,
  prefilledContext: null,
  prefilledMessage: null,

  initialize: async () => {
    try {
      const [storedConversations, storedMessages, storedActive] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION),
      ]);

      const conversations: CoachConversation[] = storedConversations
        ? JSON.parse(storedConversations)
        : [];
      const messages: CoachMessage[] = storedMessages
        ? JSON.parse(storedMessages)
        : [];
      const activeConversation: CoachConversation | null = storedActive
        ? JSON.parse(storedActive)
        : null;

      set({ conversations, messages, activeConversation, isInitialized: true });
    } catch {
      set({ isInitialized: true });
    }
  },

  sendMessage: async (text: string, context?: CoachContext) => {
    const state = get();
    let conversation = state.activeConversation;

    // Create a new conversation if none active
    if (!conversation) {
      conversation = {
        id: generateId('conv'),
        context: context ?? 'general',
        started_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        message_count: 0,
      };
      set((s) => ({
        activeConversation: conversation,
        conversations: [conversation!, ...s.conversations],
      }));
    }

    // Add user message to local state immediately
    const userMessage: CoachMessage = {
      id: generateId('msg'),
      conversation_id: conversation.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      // Build history from current conversation messages
      const currentMessages = get().messages.filter(
        (m) => m.conversation_id === conversation!.id,
      );
      // Exclude the just-added user message from history (it's the current input)
      const historyMessages = currentMessages.slice(0, -1);
      const aiHistory = toAIHistory(historyMessages);

      // Call the API with conversation history. Pass the server-side
      // (remote) conversation id so the Edge Function threads context
      // correctly; otherwise pass undefined to let the server create one.
      const response = await coachApi.sendChatMessage(
        conversation.remoteId,
        text,
        context ?? conversation.context,
        aiHistory,
      );

      // Parse actions from AI response
      const { text: cleanContent, actions } = parseCoachActions(response.content);

      // Add assistant message with parsed actions
      const assistantMessage: CoachMessage = {
        id: response.message_id ?? generateId('msg'),
        conversation_id: conversation.id,
        role: 'assistant',
        content: cleanContent,
        structured_content: response.structured_content,
        actions: actions.length > 0
          ? actions.map((action) => ({ action, status: 'pending' as const }))
          : undefined,
        model: response.model,
        created_at: new Date().toISOString(),
      };

      // Update conversation, capturing the server-side id on first reply.
      const updatedConversation: CoachConversation = {
        ...conversation,
        remoteId: conversation.remoteId ?? (response.conversation_id || undefined),
        last_message_at: new Date().toISOString(),
        message_count: (conversation.message_count ?? 0) + 2,
      };

      set((s) => ({
        messages: [...s.messages, assistantMessage],
        activeConversation: updatedConversation,
        conversations: s.conversations.map((c) =>
          c.id === conversation!.id ? updatedConversation : c,
        ),
        isLoading: false,
      }));

      // Persist
      const updatedState = get();
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedState.messages.slice(-200))),
        AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(updatedState.conversations)),
        AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, JSON.stringify(updatedConversation)),
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Coach is temporarily unavailable. Please try again.';

      // Add a fallback message if API fails
      const fallbackMessage: CoachMessage = {
        id: generateId('msg'),
        conversation_id: conversation.id,
        role: 'assistant',
        content: errorMessage.includes('network')
          ? "I'm having trouble connecting right now. Please check your internet connection and try again."
          : "I'm temporarily unavailable. Please try again in a moment.",
        created_at: new Date().toISOString(),
      };

      set((s) => ({
        messages: [...s.messages, fallbackMessage],
        isLoading: false,
        error: errorMessage,
      }));
    }
  },

  startConversation: (context = 'general') => {
    const conversation: CoachConversation = {
      id: generateId('conv'),
      context,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      message_count: 0,
    };

    set((s) => ({
      activeConversation: conversation,
      conversations: [conversation, ...s.conversations],
      error: null,
    }));

    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, JSON.stringify(conversation));
  },

  loadConversation: async (conversationId: string) => {
    const state = get();
    const conversation = state.conversations.find((c) => c.id === conversationId);
    if (!conversation) return;

    // Read from persisted storage rather than state.messages, which may have
    // been zeroed by startConversation.
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
      const allMessages: CoachMessage[] = stored ? JSON.parse(stored) : [];
      const messages = allMessages.filter((m) => m.conversation_id === conversationId);

      set({
        activeConversation: conversation,
        messages,
        error: null,
      });
    } catch {
      // Fall back to whatever is in state
      set({
        activeConversation: conversation,
        messages: state.messages.filter((m) => m.conversation_id === conversationId),
        error: null,
      });
    }
  },

  loadHistory: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (stored) {
        set({ conversations: JSON.parse(stored) });
      }
    } catch {
      // Ignore
    }
  },

  clearError: () => set({ error: null }),

  setPrefilledContext: (context: CoachContext, message?: string) => {
    set({ prefilledContext: context, prefilledMessage: message ?? null });
  },

  clearPrefilledContext: () => {
    set({ prefilledContext: null, prefilledMessage: null });
  },

  executeAction: async (messageId: string, actionIndex: number) => {
    const state = get();
    const msgIdx = state.messages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1) return;

    const message = state.messages[msgIdx];
    if (!message.actions || !message.actions[actionIndex]) return;

    const actionState = message.actions[actionIndex];
    if (actionState.status === 'applied') return; // Already applied

    try {
      const result = await executeCoachAction(actionState.action);

      // Update the action status in the message
      const updatedActions = [...message.actions];
      updatedActions[actionIndex] = {
        ...actionState,
        status: result.success ? 'applied' : 'failed',
        message: result.message,
      };

      const updatedMessages = [...state.messages];
      updatedMessages[msgIdx] = { ...message, actions: updatedActions };

      set({ messages: updatedMessages });

      // Persist
      await AsyncStorage.setItem(
        STORAGE_KEYS.MESSAGES,
        JSON.stringify(updatedMessages.slice(-200)),
      );
    } catch (error) {
      const updatedActions = [...message.actions!];
      updatedActions[actionIndex] = {
        ...actionState,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Action failed',
      };

      const updatedMessages = [...state.messages];
      updatedMessages[msgIdx] = { ...message, actions: updatedActions };

      set({ messages: updatedMessages });
    }
  },
}));
