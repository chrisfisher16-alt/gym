// ── Conversation Summarizer ──────────────────────────────────────────
// After every N user messages, compress older conversation history into a
// summary paragraph. This prevents context loss when conversations get
// long and the token-budget windowing in ai-client.ts drops old messages.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { callAI, getAIConfig, getTextContent, type AIMessage } from './ai-provider';

// ── Configuration ───────────────────────────────────────────────────

const SUMMARIZE_THRESHOLD = 10; // Trigger after every 10 user messages
const SUMMARY_KEY_PREFIX = '@coach/summaries/';
const MAX_SUMMARIES = 5;

const SUMMARY_PROMPT = `Summarize this conversation between a user and their AI fitness coach. Focus on:
- Key decisions made (exercise swaps, program changes, nutrition targets)
- Important user preferences or constraints revealed
- Progress milestones or concerns mentioned
- Specific advice given that should be remembered

Keep the summary concise (2-3 sentences). Use third person ("The user...").
Return ONLY the summary text, nothing else.`;

// ── Summarization Trigger ───────────────────────────────────────────

/**
 * Check if the conversation needs summarization and generate one if so.
 * Fire-and-forget — never blocks the chat flow.
 */
export function maybeSummarizeConversation(
  fullHistory: AIMessage[],
  onSummaryGenerated: (summary: string) => void,
): void {
  // Only trigger every SUMMARIZE_THRESHOLD user messages
  const messageCount = fullHistory.filter((m) => m.role === 'user').length;
  if (messageCount < SUMMARIZE_THRESHOLD || messageCount % SUMMARIZE_THRESHOLD !== 0) return;

  // Take older messages (beyond the last 6) for summarization
  const olderMessages = fullHistory.slice(0, -6);
  if (olderMessages.length < 4) return;

  // Fire and forget — no awaiting, no blocking
  void (async () => {
    try {
      const config = await getAIConfig();
      if (config.provider === 'demo') return;

      const messages: AIMessage[] = [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: formatConversationForSummary(olderMessages) },
      ];

      const response = await callAI(messages, config);
      if (response.content) {
        onSummaryGenerated(response.content.trim());
      }
    } catch {
      // Silently ignore summarization failures — never disrupt chat
    }
  })();
}

function formatConversationForSummary(messages: AIMessage[]): string {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${getTextContent(m.content).slice(0, 500)}`)
    .join('\n');
}

// ── AsyncStorage Persistence ────────────────────────────────────────

export async function saveSummary(conversationId: string, summary: string): Promise<void> {
  const key = `${SUMMARY_KEY_PREFIX}${conversationId}`;
  try {
    const existing = await AsyncStorage.getItem(key);
    const summaries: string[] = existing ? JSON.parse(existing) : [];
    summaries.push(summary);
    // Keep only the most recent summaries
    const trimmed = summaries.slice(-MAX_SUMMARIES);
    await AsyncStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
}

export async function loadSummaries(conversationId: string): Promise<string[]> {
  try {
    const key = `${SUMMARY_KEY_PREFIX}${conversationId}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}
