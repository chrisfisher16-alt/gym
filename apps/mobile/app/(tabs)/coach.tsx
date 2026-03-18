import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useCoachStore } from '../../src/stores/coach-store';
import { ChatBubble } from '../../src/components/coach/ChatBubble';
import { TypingIndicator } from '../../src/components/coach/TypingIndicator';
import { SuggestedPrompts } from '../../src/components/coach/SuggestedPrompts';
import { CoachAvatar } from '../../src/components/coach/CoachAvatar';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { usePaywall } from '../../src/hooks/usePaywall';
import { checkAIMessageLimit, incrementUsage, type UsageCheck } from '../../src/lib/usage-limits';
import type { CoachMessage } from '../../src/stores/coach-store';
import type { CoachContext } from '@health-coach/shared';

export default function CoachTab() {
  const { colors, spacing, typography, radius } = useTheme();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const pendingContextRef = useRef<CoachContext | null>(null);

  const {
    messages,
    activeConversation,
    isLoading,
    error,
    isInitialized,
    prefilledMessage,
    prefilledContext,
    initialize,
    sendMessage,
    startConversation,
    clearError,
    clearPrefilledContext,
    executeAction,
  } = useCoachStore();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Handle prefilled message from other tabs.
  // Capture the context in a ref so it survives clearing the store — handleSend
  // reads from the ref at send time rather than the (already-cleared) store.
  useEffect(() => {
    if (prefilledMessage && isInitialized) {
      pendingContextRef.current = prefilledContext ?? null;
      setInputText(prefilledMessage);
      clearPrefilledContext();
    }
  }, [prefilledMessage, isInitialized, prefilledContext, clearPrefilledContext]);

  const { tier, canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();
  const [aiUsage, setAIUsage] = useState<UsageCheck | null>(null);

  // Check AI message limits for free users
  useEffect(() => {
    if (tier === 'free') {
      checkAIMessageLimit().then(setAIUsage);
    }
  }, [tier]);

  const currentMessages = activeConversation
    ? messages.filter((m) => m.conversation_id === activeConversation.id)
    : [];

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    // Use the ref-captured context (survives store clear) then reset it.
    const contextToSend = pendingContextRef.current ?? prefilledContext ?? undefined;
    pendingContextRef.current = null;

    // Check AI message limit for free users
    if (!canAccess('unlimited_ai') && tier === 'free') {
      checkAIMessageLimit().then((usage) => {
        setAIUsage(usage);
        if (usage.allowed) {
          incrementUsage('ai_messages');
          setInputText('');
          sendMessage(text, contextToSend);
        } else {
          Alert.alert(
            'Daily Message Limit Reached',
            'You\'ve used all 5 free AI messages today. Upgrade for unlimited coaching.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => showPaywall({ feature: 'unlimited_ai', source: 'coach_tab' }) },
            ],
          );
        }
      });
      return;
    }

    setInputText('');
    sendMessage(text, contextToSend);
  }, [inputText, isLoading, sendMessage, prefilledContext, canAccess, tier, showPaywall]);

  const handlePromptSelect = useCallback(
    (prompt: string) => {
      if (isLoading) return;
      sendMessage(prompt);
    },
    [isLoading, sendMessage],
  );

  const handleNewConversation = useCallback(() => {
    startConversation();
  }, [startConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (currentMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentMessages.length, isLoading]);

  const handleExecuteAction = useCallback(
    (messageId: string, actionIndex: number) => {
      executeAction(messageId, actionIndex);
    },
    [executeAction],
  );

  const renderMessage = useCallback(
    ({ item }: { item: CoachMessage }) => (
      <ChatBubble message={item} onExecuteAction={handleExecuteAction} />
    ),
    [handleExecuteAction],
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <CoachAvatar size={80} />
      <Text
        style={[
          typography.h2,
          { color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
        ]}
      >
        Your AI Health Coach
      </Text>
      <Text
        style={[
          typography.body,
          {
            color: colors.textSecondary,
            marginTop: spacing.sm,
            textAlign: 'center',
            paddingHorizontal: spacing['2xl'],
          },
        ]}
      >
        Ask anything about workouts, nutrition, or your health goals. I can create plans, analyze
        meals, and track your progress.
      </Text>
      <SuggestedPrompts onSelect={handlePromptSelect} />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderLight,
            paddingTop: Platform.OS === 'ios' ? 52 : spacing.base,
            paddingBottom: spacing.md,
            paddingHorizontal: spacing.base,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <CoachAvatar size={36} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={[typography.labelLarge, { color: colors.text }]}>AI Coach</Text>
            <Text style={[typography.caption, { color: colors.success }]}>
              {isLoading ? 'Thinking...' : 'Online'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {tier === 'free' && aiUsage && (
            <View
              style={{
                backgroundColor: aiUsage.remaining <= 1 ? colors.warningLight : colors.surfaceSecondary,
                borderRadius: 12,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text style={[typography.caption, { color: aiUsage.remaining <= 1 ? colors.warning : colors.textSecondary, fontWeight: '600' }]}>
                {aiUsage.remaining}/{aiUsage.limit} left
              </Text>
            </View>
          )}
          <TouchableOpacity onPress={handleNewConversation} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      {currentMessages.length === 0 && !isLoading ? (
        renderEmptyState()
      ) : (
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isLoading ? <TypingIndicator /> : null}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Error banner */}
      {error && (
        <View
          style={[styles.errorBanner, { backgroundColor: colors.errorLight, padding: spacing.sm }]}
        >
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, marginLeft: spacing.xs, flex: 1 }]} numberOfLines={2}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => {
              clearError();
              const lastUserMsg = [...currentMessages].reverse().find((m) => m.role === 'user');
              if (lastUserMsg) sendMessage(lastUserMsg.content);
            }}
            style={{ marginRight: spacing.sm }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[typography.label, { color: colors.error }]}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearError}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* Suggested prompts inline (when there are messages but user might want suggestions) */}
      {currentMessages.length > 0 && currentMessages.length < 4 && !isLoading && (
        <SuggestedPrompts onSelect={handlePromptSelect} />
      )}

      {/* Input area */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.sm,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.base,
              paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
              color: colors.text,
              fontSize: 14,
              maxHeight: 100,
            },
          ]}
          placeholder="Ask your coach..."
          placeholderTextColor={colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          onKeyPress={(e: any) => {
            if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault?.();
              handleSend();
            }
          }}
          editable={!isLoading}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() && !isLoading ? colors.primary : colors.surfaceSecondary,
              borderRadius: radius.full,
              width: 40,
              height: 40,
              marginLeft: spacing.sm,
            },
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() && !isLoading ? colors.textInverse : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    borderRadius: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
