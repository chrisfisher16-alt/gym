import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachContext } from '@health-coach/shared';
import * as coachApi from '../lib/coach-api';
import type { AIMessage } from '../lib/ai-provider';

// ── Types ───────────────────────────────────────────────────────────

export interface CoachMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  structured_content?: StructuredContent[];
  tool_calls?: ToolCallResult[];
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
  id: string;
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
  loadConversation: (conversationId: string) => void;
  loadHistory: () => Promise<void>;
  clearError: () => void;
  setPrefilledContext: (context: CoachContext, message?: string) => void;
  prefilledContext: CoachContext | null;
  prefilledMessage: string | null;
  clearPrefilledContext: () => void;
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

      // Call the API with conversation history
      const response = await coachApi.sendChatMessage(
        conversation.id,
        text,
        context ?? conversation.context,
        aiHistory,
      );

      // Add assistant message
      const assistantMessage: CoachMessage = {
        id: response.message_id ?? generateId('msg'),
        conversation_id: conversation.id,
        role: 'assistant',
        content: response.content,
        model: response.model,
        created_at: new Date().toISOString(),
      };

      // Update conversation
      const updatedConversation: CoachConversation = {
        ...conversation,
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
      messages: [],
      conversations: [conversation, ...s.conversations],
      error: null,
    }));

    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, JSON.stringify(conversation));
  },

  loadConversation: (conversationId: string) => {
    const state = get();
    const conversation = state.conversations.find((c) => c.id === conversationId);
    if (!conversation) return;

    const messages = state.messages.filter((m) => m.conversation_id === conversationId);

    set({
      activeConversation: conversation,
      messages,
      error: null,
    });
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
}));
