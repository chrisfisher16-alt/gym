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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useCoachStore } from '../../src/stores/coach-store';
import { ChatBubble } from '../../src/components/coach/ChatBubble';
import { TypingIndicator } from '../../src/components/coach/TypingIndicator';
import { SuggestedPrompts } from '../../src/components/coach/SuggestedPrompts';
import { CoachAvatar } from '../../src/components/coach/CoachAvatar';
import type { CoachMessage } from '../../src/stores/coach-store';

export default function CoachTab() {
  const { colors, spacing, typography, radius } = useTheme();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

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
  } = useCoachStore();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Handle prefilled message from other tabs
  useEffect(() => {
    if (prefilledMessage && isInitialized) {
      setInputText(prefilledMessage);
      clearPrefilledContext();
    }
  }, [prefilledMessage, isInitialized, clearPrefilledContext]);

  const currentMessages = activeConversation
    ? messages.filter((m) => m.conversation_id === activeConversation.id)
    : [];

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setInputText('');
    sendMessage(text, prefilledContext ?? undefined);
  }, [inputText, isLoading, sendMessage, prefilledContext]);

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

  const renderMessage = useCallback(
    ({ item }: { item: CoachMessage }) => <ChatBubble message={item} />,
    [],
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
        <TouchableOpacity onPress={handleNewConversation} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
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
        <TouchableOpacity
          style={[styles.errorBanner, { backgroundColor: colors.errorLight, padding: spacing.sm }]}
          onPress={clearError}
        >
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, marginLeft: spacing.xs, flex: 1 }]}>
            {error}
          </Text>
          <Ionicons name="close" size={16} color={colors.error} />
        </TouchableOpacity>
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
