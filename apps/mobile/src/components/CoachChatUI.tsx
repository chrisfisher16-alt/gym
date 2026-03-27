import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { invalidateConfigCache } from '../lib/ai-provider';
import { crossPlatformAlert } from '../lib/cross-platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme';
import { useToast } from './Toast';
import { useCoachStore } from '../stores/coach-store';
import { ChatBubble } from './coach/ChatBubble';
import { TypingIndicator } from './coach/TypingIndicator';
import { SuggestedPrompts } from './coach/SuggestedPrompts';
import { CoachAvatar } from './coach/CoachAvatar';
import { useEntitlement } from '../hooks/useEntitlement';
import { usePaywall } from '../hooks/usePaywall';
import { checkAIMessageLimit, incrementUsage, type UsageCheck } from '../lib/usage-limits';
import type { CoachMessage } from '../stores/coach-store';
import type { CoachContext } from '@health-coach/shared';

export interface CoachChatUIProps {
  /** Optional header component rendered above the message list */
  headerComponent?: React.ReactNode;
  /** Whether to show the header bar with avatar, settings, new conversation (for tab use) */
  showHeader?: boolean;
  /** Style override for the container */
  style?: StyleProp<ViewStyle>;
  /** Keyboard vertical offset (different for tab vs sheet) */
  keyboardVerticalOffset?: number;
  /** When true, hides the empty state (avatar + description + suggested prompts) — used by CoachSheet compact mode */
  compactMode?: boolean;
  /** Called after a message is successfully sent (for parent to react, e.g. expand sheet) */
  onMessageSent?: () => void;
}

export function CoachChatUI({
  headerComponent,
  showHeader = false,
  style,
  keyboardVerticalOffset = 90,
  compactMode = false,
  onMessageSent,
}: CoachChatUIProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [lastFailedContext, setLastFailedContext] = useState<CoachContext | undefined>(undefined);
  const [lastFailedImage, setLastFailedImage] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pendingContextRef = useRef<CoachContext | null>(null);

  const isSending = useRef(false);

  const {
    messages,
    activeConversation,
    isLoading,
    error,
    isInitialized,
    prefilledMessage,
    prefilledContext,
    streamingContent,
    isStreaming,
    initialize,
    sendMessage,
    abortCurrentRequest,
    startConversation,
    clearError,
    clearDemoWarning,
    clearPrefilledContext,
    executeAction,
    lastMessageWasDemo,
  } = useCoachStore();

  const truncationWarning = useCoachStore((s) => s.truncationWarning);
  const clearTruncationWarning = useCoachStore((s) => s.clearTruncationWarning);
  const { showToast } = useToast();

  useEffect(() => {
    invalidateConfigCache();
  }, []);

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

  // Show toast when truncation warning is set
  useEffect(() => {
    if (truncationWarning) {
      showToast(truncationWarning, 'warning', 5000);
      clearTruncationWarning();
    }
  }, [truncationWarning, showToast, clearTruncationWarning]);

  const { tier, canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();
  const [aiUsage, setAIUsage] = useState<UsageCheck | null>(null);

  // Check AI message limits for free users
  useEffect(() => {
    if (tier === 'free') {
      checkAIMessageLimit().then(setAIUsage);
    }
  }, [tier, messages.length]);

  const currentMessages = activeConversation
    ? messages.filter((m) => m.conversation_id === activeConversation.id)
    : [];

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAttachedImage(result.assets[0].uri);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (isSending.current) return;
    const text = inputText.trim();
    if ((!text && !attachedImage) || isLoading) return;

    isSending.current = true;
    try {
      // Use the ref-captured context (survives store clear) then reset it.
      const contextToSend = pendingContextRef.current ?? prefilledContext ?? undefined;
      pendingContextRef.current = null;
      const imageToSend = attachedImage;

      // Check AI message limit for free users
      if (!canAccess('unlimited_ai') && tier === 'free') {
        const usage = await checkAIMessageLimit();
        setAIUsage(usage);
        if (usage.allowed) {
          setInputText('');
          setAttachedImage(null);
          setLastFailedContext(contextToSend);
          setLastFailedImage(imageToSend);
          try {
            await sendMessage(text || 'What is this?', contextToSend, imageToSend ?? undefined);
            incrementUsage('ai_messages');
            setLastFailedContext(undefined);
            setLastFailedImage(null);
            onMessageSent?.();
          } catch {
            // Store sets error state; UI already shows error banner
          }
        } else {
          crossPlatformAlert(
            'Daily Message Limit Reached',
            'You\'ve used all 5 free AI messages today. Upgrade for unlimited coaching.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => showPaywall({ feature: 'unlimited_ai', source: 'coach_tab' }) },
            ],
          );
        }
        return;
      }

      setInputText('');
      setAttachedImage(null);
      setLastFailedContext(contextToSend);
      setLastFailedImage(imageToSend);
      try {
        await sendMessage(text || 'What is this?', contextToSend, imageToSend ?? undefined);
        setLastFailedContext(undefined);
        setLastFailedImage(null);
        onMessageSent?.();
      } catch {
        // Store sets error state; UI already shows error banner
      }
    } finally {
      isSending.current = false;
    }
  }, [inputText, attachedImage, isLoading, sendMessage, prefilledContext, canAccess, tier, showPaywall, onMessageSent]);

  const handlePromptSelect = useCallback(
    async (prompt: string) => {
      if (isLoading) return;

      // Check AI message limit for free users
      if (!canAccess('unlimited_ai') && tier === 'free') {
        const usage = await checkAIMessageLimit();
        setAIUsage(usage);
        if (usage.allowed) {
          try {
            await sendMessage(prompt);
            incrementUsage('ai_messages');
            onMessageSent?.();
          } catch {
            // Store sets error state; UI already shows error banner
          }
        } else {
          crossPlatformAlert(
            'Daily Message Limit Reached',
            'You\'ve used all 5 free AI messages today. Upgrade for unlimited coaching.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => showPaywall({ feature: 'unlimited_ai', source: 'coach_tab' }) },
            ],
          );
        }
        return;
      }

      await sendMessage(prompt);
      onMessageSent?.();
    },
    [isLoading, sendMessage, tier, canAccess, showPaywall, onMessageSent],
  );

  const handleNewConversation = useCallback(async () => {
    await startConversation();
  }, [startConversation]);

  // Scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    if (currentMessages.length > 0 || streamingContent) {
      const tid = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(tid);
    }
  }, [currentMessages.length, isLoading, streamingContent]);

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
      style={[styles.container, { backgroundColor: colors.background }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {/* Optional header component (e.g. UsageCounterExpandable passed via headerComponent) */}
      {headerComponent}

      {/* Messages */}
      {currentMessages.length === 0 && !isLoading && !compactMode ? (
        renderEmptyState()
      ) : currentMessages.length === 0 && !isLoading && compactMode ? (
        <View style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isStreaming && streamingContent ? (
              <ChatBubble
                message={{
                  id: 'streaming',
                  conversation_id: activeConversation?.id ?? '',
                  role: 'assistant',
                  content: streamingContent,
                  created_at: new Date().toISOString(),
                }}
                isStreaming={true}
              />
            ) : isLoading ? (
              <TypingIndicator />
            ) : null
          }
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
              if (lastUserMsg) sendMessage(lastUserMsg.content, lastFailedContext, lastFailedImage ?? undefined);
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

      {/* Demo fallback warning */}
      {lastMessageWasDemo && !error && (
        <View
          style={[styles.errorBanner, { backgroundColor: colors.warningLight, padding: spacing.sm }]}
        >
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Text style={[typography.bodySmall, { color: colors.warning, marginLeft: spacing.xs, flex: 1 }]} numberOfLines={2}>
            AI provider unavailable — showing demo response
          </Text>
          <TouchableOpacity
            onPress={clearDemoWarning}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.warning} />
          </TouchableOpacity>
        </View>
      )}

      {/* Suggested prompts inline (when there are messages but user might want suggestions) */}
      {currentMessages.length > 0 && currentMessages.length < 4 && !isLoading && (
        <SuggestedPrompts onSelect={handlePromptSelect} />
      )}

      {/* Image preview */}
      {attachedImage && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            borderTopWidth: 1,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Image
            source={{ uri: attachedImage }}
            style={{
              width: 60,
              height: 60,
              borderRadius: radius.md,
            }}
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={() => setAttachedImage(null)}
            style={{
              marginLeft: spacing.sm,
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.full,
              width: 24,
              height: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
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
            borderTopWidth: attachedImage ? 0 : 1,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handlePickImage}
          disabled={isLoading}
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.xs,
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="camera-outline"
            size={24}
            color={isLoading ? colors.textTertiary : colors.textSecondary}
          />
        </TouchableOpacity>
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
        {isLoading ? (
          <TouchableOpacity
            onPress={abortCurrentRequest}
            style={[
              styles.sendButton,
              {
                backgroundColor: colors.error,
                borderRadius: radius.full,
                width: 40,
                height: 40,
                marginLeft: spacing.sm,
              },
            ]}
          >
            <Ionicons name="stop" size={18} color={colors.textInverse} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() && !attachedImage}
            style={[
              styles.sendButton,
              {
                backgroundColor: (inputText.trim() || attachedImage) ? colors.primary : colors.surfaceSecondary,
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
              color={(inputText.trim() || attachedImage) ? colors.textInverse : colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  input: {
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
