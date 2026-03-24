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
} from 'react-native';
import { useRouter } from 'expo-router';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/theme';
import { useCoachStore } from '../../src/stores/coach-store';
import { ChatBubble } from '../../src/components/coach/ChatBubble';
import { TypingIndicator } from '../../src/components/coach/TypingIndicator';
import { SuggestedPrompts } from '../../src/components/coach/SuggestedPrompts';
import { CoachAvatar } from '../../src/components/coach/CoachAvatar';
import { ExpandableCard, SmartHeader } from '../../src/components/ui';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { usePaywall } from '../../src/hooks/usePaywall';
import { checkAIMessageLimit, checkWorkoutLogLimit, checkMealLogLimit, incrementUsage, type UsageCheck } from '../../src/lib/usage-limits';
import type { CoachMessage } from '../../src/stores/coach-store';
import type { CoachContext } from '@health-coach/shared';

export default function CoachTab() {
  const router = useRouter();
  const { colors, spacing, typography, radius } = useTheme();
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
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
    streamingContent,
    isStreaming,
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

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if ((!text && !attachedImage) || isLoading) return;

    // Use the ref-captured context (survives store clear) then reset it.
    const contextToSend = pendingContextRef.current ?? prefilledContext ?? undefined;
    pendingContextRef.current = null;
    const imageToSend = attachedImage;

    // Check AI message limit for free users
    if (!canAccess('unlimited_ai') && tier === 'free') {
      checkAIMessageLimit().then((usage) => {
        setAIUsage(usage);
        if (usage.allowed) {
          incrementUsage('ai_messages');
          setInputText('');
          setAttachedImage(null);
          sendMessage(text || 'What is this?', contextToSend, imageToSend ?? undefined);
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
      });
      return;
    }

    setInputText('');
    setAttachedImage(null);
    sendMessage(text || 'What is this?', contextToSend, imageToSend ?? undefined);
  }, [inputText, attachedImage, isLoading, sendMessage, prefilledContext, canAccess, tier, showPaywall]);

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

  // Scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    if (currentMessages.length > 0 || streamingContent) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
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
            <SmartHeader tab="coach" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {tier === 'free' && aiUsage && (
            <UsageCounterExpandable
              aiUsage={aiUsage}
              onUpgrade={() => showPaywall({ feature: 'unlimited_ai', source: 'coach_tab' })}
            />
          )}
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
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
        <TouchableOpacity
          onPress={handleSend}
          disabled={(!inputText.trim() && !attachedImage) || isLoading}
          style={[
            styles.sendButton,
            {
              backgroundColor: (inputText.trim() || attachedImage) && !isLoading ? colors.primary : colors.surfaceSecondary,
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
            color={(inputText.trim() || attachedImage) && !isLoading ? colors.textInverse : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Usage Counter Expandable ──────────────────────────────────────────

function UsageCounterExpandable({
  aiUsage,
  onUpgrade,
}: {
  aiUsage: UsageCheck;
  onUpgrade: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const [workoutUsage, setWorkoutUsage] = useState<UsageCheck | null>(null);
  const [mealUsage, setMealUsage] = useState<UsageCheck | null>(null);

  useEffect(() => {
    Promise.all([checkWorkoutLogLimit(), checkMealLogLimit()]).then(
      ([wk, ml]) => {
        setWorkoutUsage(wk);
        setMealUsage(ml);
      },
    );
  }, []);

  const formatResetDate = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffHours <= 24) return `${diffHours}h`;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays}d`;
  };

  return (
    <ExpandableCard
      style={{ borderRadius: 12 }}
      expandedContent={
        <View style={{ gap: spacing.md }}>
          {/* AI Messages */}
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Daily Limits
            </Text>
            <UsageRow
              icon="chatbubble-outline"
              label="AI Messages"
              used={aiUsage.used}
              limit={aiUsage.limit}
              resets={formatResetDate(aiUsage.resetDate)}
            />
            {mealUsage && (
              <UsageRow
                icon="restaurant-outline"
                label="Meal Logs"
                used={mealUsage.used}
                limit={mealUsage.limit}
                resets={formatResetDate(mealUsage.resetDate)}
              />
            )}
          </View>

          {/* Monthly Limits */}
          {workoutUsage && (
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                Monthly Limits
              </Text>
              <UsageRow
                icon="barbell-outline"
                label="Workout Logs"
                used={workoutUsage.used}
                limit={workoutUsage.limit}
                resets={formatResetDate(workoutUsage.resetDate)}
              />
            </View>
          )}

          {/* Tips */}
          <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Tip: Be specific with your questions to get the most out of each message.
            </Text>
          </View>

          {/* Upgrade CTA */}
          <TouchableOpacity
            onPress={onUpgrade}
            activeOpacity={0.7}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.label, { color: colors.textInverse }]}>
              Upgrade for Unlimited
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      {/* Collapsed: usage badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Text
          style={[
            typography.caption,
            {
              color: aiUsage.remaining <= 1 ? colors.warning : colors.textSecondary,
              fontWeight: '600',
            },
          ]}
        >
          {aiUsage.remaining}/{aiUsage.limit} left
        </Text>
        <Ionicons
          name="chevron-down-outline"
          size={10}
          color={aiUsage.remaining <= 1 ? colors.warning : colors.textTertiary}
        />
      </View>
    </ExpandableCard>
  );
}

// ── Usage Row ─────────────────────────────────────────────────────────

function UsageRow({
  icon,
  label,
  used,
  limit,
  resets,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  used: number;
  limit: number;
  resets: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const ratio = limit > 0 ? used / limit : 0;
  const barColor = ratio >= 0.8 ? colors.warning : colors.primary;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name={icon} size={14} color={colors.textSecondary} />
          <Text style={[typography.bodySmall, { color: colors.text }]}>{label}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>
          {used}/{limit} · resets in {resets}
        </Text>
      </View>
      <View style={{ height: 4, backgroundColor: colors.surfaceSecondary, borderRadius: radius.full, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            width: `${Math.min(ratio * 100, 100)}%`,
            backgroundColor: barColor,
            borderRadius: radius.full,
          }}
        />
      </View>
    </View>
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
  },
  input: {
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
