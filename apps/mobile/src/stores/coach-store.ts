import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachContext } from '@health-coach/shared';
import * as coachApi from '../lib/coach-api';
import type { AIMessage, AIContentBlock } from '../lib/ai-provider';

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
  imageUri?: string;
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

  // Streaming state
  streamingContent: string;
  isStreaming: boolean;

  // Demo fallback tracking
  lastMessageWasDemo: boolean;

  // Actions
  initialize: () => Promise<void>;
  sendMessage: (text: string, context?: CoachContext, imageUri?: string) => Promise<void>;
  abortCurrentRequest: () => void;
  startConversation: (context?: CoachContext) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  clearError: () => void;
  clearDemoWarning: () => void;
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
 * For messages with images, we only include the text content in history
 * (the image was already processed by the AI on the original send).
 */
function toAIHistory(messages: CoachMessage[]): AIMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      // If the message had an image, try to preserve image content blocks
      if (m.imageUri) {
        // We don't re-encode the image for history — just include text.
        // The original image was already processed on the initial send.
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
    });
}

// ── Old cache cleanup ───────────────────────────────────────────────

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Remove stale briefing and summary cache entries older than 30 days.
 * Called on store initialization — fire-and-forget.
 */
async function cleanupOldCaches(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(
      (k) => k.startsWith('@briefing/') || k.startsWith('@coach/summaries/') || k.startsWith('@weekly-summary/'),
    );
    if (cacheKeys.length === 0) return;

    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const key of cacheKeys) {
      // Try to extract a date from the key (e.g. @briefing/2025-01-15)
      const datePart = key.split('/').pop();
      if (!datePart) continue;

      // Check if the suffix looks like a date (YYYY-MM-DD)
      const dateMatch = datePart.match(/^(\d{4}-\d{2}-\d{2})/); 
      if (dateMatch) {
        const entryDate = new Date(dateMatch[1]).getTime();
        if (!isNaN(entryDate) && now - entryDate > CACHE_MAX_AGE_MS) {
          keysToDelete.push(key);
        }
      }
    }

    if (keysToDelete.length > 0) {
      await Promise.all(keysToDelete.map((k) => AsyncStorage.removeItem(k)));
    }
  } catch {
    // Never disrupt app startup
  }
}

// ── Concurrency guard ───────────────────────────────────────────────

let _currentAbortController: AbortController | null = null;

// ── Store ───────────────────────────────────────────────────────────

export const useCoachStore = create<CoachState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoading: false,
  error: null,
  isInitialized: false,
  streamingContent: '',
  isStreaming: false,
  prefilledContext: null,
  prefilledMessage: null,
  lastMessageWasDemo: false,

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

      // Fire-and-forget: clean up stale cache entries
      void cleanupOldCaches();
    } catch {
      set({ isInitialized: true });
    }
  },

  abortCurrentRequest: () => {
    if (_currentAbortController) {
      _currentAbortController.abort();
      _currentAbortController = null;
    }
    set({ isLoading: false, isStreaming: false, streamingContent: '' });
  },

  sendMessage: async (text: string, context?: CoachContext, imageUri?: string) => {
    // Abort any in-flight request
    if (_currentAbortController) {
      _currentAbortController.abort();
      _currentAbortController = null;
    }

    // Guard against concurrent sends
    if (get().isLoading) {
      return;
    }

    const abortController = new AbortController();
    _currentAbortController = abortController;

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
      imageUri,
      created_at: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    // If there's an image, read it as base64 and build multipart content
    let messageContent: string | AIContentBlock[] = text;
    if (imageUri) {
      try {
        const FileSystem = await import('expo-file-system');

        // Validate image size before encoding (max 4MB)
        const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (fileInfo.exists && 'size' in fileInfo && fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
          throw new Error('Image too large. Please select a smaller image (under 4MB).');
        }

        const base64data = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' as any });

        // Detect mime type from file extension
        const ext = imageUri.split('.').pop()?.toLowerCase();
        let mediaType: string;
        switch (ext) {
          case 'png':  mediaType = 'image/png';  break;
          case 'webp': mediaType = 'image/webp'; break;
          case 'gif':  mediaType = 'image/gif';  break;
          case 'jpg':
          case 'jpeg':
          default:     mediaType = 'image/jpeg'; break;
        }

        const blocks: AIContentBlock[] = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as any,
              data: base64data,
            },
          },
        ];
        if (text) {
          blocks.push({ type: 'text', text });
        }
        messageContent = blocks;
      } catch (err) {
        console.warn('Failed to read image for AI:', err);
        // Re-throw user-facing size errors so the UI can display them
        if (err instanceof Error && err.message.includes('too large')) {
          set({ isLoading: false, error: err.message });
          return;
        }
        // Fall back to text-only for other errors
      }
    }

    try {
      // Build history from current conversation messages
      const currentMessages = get().messages.filter(
        (m) => m.conversation_id === conversation!.id,
      );
      // Exclude the just-added user message from history (it's the current input)
      const historyMessages = currentMessages.slice(0, -1);
      const aiHistory = toAIHistory(historyMessages);

      // Call the API with conversation history and streaming callback
      const response = await coachApi.sendChatMessage(
        conversation.id,
        messageContent,
        context ?? conversation.context,
        aiHistory,
        (token) => {
          set((s) => ({
            streamingContent: s.streamingContent + token,
            isStreaming: true,
          }));
        },
        abortController.signal,
      );

      // Parse actions from AI response
      const { text: cleanContent, actions } = parseCoachActions(response.content);

      // Add assistant message with parsed actions
      const assistantMessage: CoachMessage = {
        id: response.message_id ?? generateId('msg'),
        conversation_id: conversation.id,
        role: 'assistant',
        content: cleanContent,
        actions: actions.length > 0
          ? actions.map((action) => ({ action, status: 'pending' as const }))
          : undefined,
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
        isStreaming: false,
        streamingContent: '',
        lastMessageWasDemo: response.isDemo,
      }));

      // Persist
      const updatedState = get();
      await Promise.all([
        // Keep last 500 messages in storage — older messages are not persisted
        AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedState.messages.slice(-500))),
        AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(updatedState.conversations)),
        AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, JSON.stringify(updatedConversation)),
      ]);

      if (_currentAbortController === abortController) {
        _currentAbortController = null;
      }
    } catch (error) {
      if (_currentAbortController === abortController) {
        _currentAbortController = null;
      }

      // Aborted requests are expected — silently return
      if (error instanceof Error && error.name === 'AbortError') {
        set({ isLoading: false, isStreaming: false, streamingContent: '' });
        return;
      }

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
        isStreaming: false,
        streamingContent: '',
        error: errorMessage,
      }));
    }
  },

  startConversation: async (context = 'general') => {
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

    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, JSON.stringify(conversation));
    await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify([conversation, ...get().conversations.filter(c => c.id !== conversation.id)]));
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

      set((s) => {
        // Keep messages from other conversations, replace/add messages for this conversation
        const otherMessages = s.messages.filter((m) => m.conversation_id !== conversationId);
        return {
          activeConversation: conversation,
          messages: [...otherMessages, ...messages],
          error: null,
        };
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
  clearDemoWarning: () => set({ lastMessageWasDemo: false }),

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
        JSON.stringify(updatedMessages.slice(-500)),
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
