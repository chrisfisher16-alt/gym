import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  Animated,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { useFeedbackStore, type FeedbackCategory } from '../stores/feedback-store';
import { lightImpact, selectionFeedback, successNotification } from '../lib/haptics';
import { crossPlatformAlert } from '../lib/cross-platform-alert';

// ── Category config ────────────────────────────────────────────────────

const CATEGORIES: { key: FeedbackCategory; label: string; icon: string; placeholder: string }[] = [
  {
    key: 'bug',
    label: 'Bug Report',
    icon: 'bug-outline',
    placeholder: 'What happened? What did you expect to happen?',
  },
  {
    key: 'feature_request',
    label: 'Feature Request',
    icon: 'bulb-outline',
    placeholder: 'What would you like FormIQ to do?',
  },
  {
    key: 'general',
    label: 'General',
    icon: 'chatbox-outline',
    placeholder: "Tell us what's on your mind",
  },
  {
    key: 'ai_accuracy',
    label: 'AI Issue',
    icon: 'sparkles-outline',
    placeholder: 'What was wrong with the detection?',
  },
];

// ── Props ──────────────────────────────────────────────────────────────

export interface FeedbackSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-selected category when opened from a contextual entry point */
  initialCategory?: FeedbackCategory;
  /** Auto-filled screen context (e.g., "Active Workout — Bench Press, Set 3") */
  screenContext?: string;
  /** Whether user is mid-workout */
  sessionActive?: boolean;
  /** Pre-filled first line of description */
  contextPreFill?: string;
}

// ── Component ──────────────────────────────────────────────────────────

export function FeedbackSheet({
  visible,
  onClose,
  initialCategory,
  screenContext,
  sessionActive,
  contextPreFill,
}: FeedbackSheetProps) {
  const { colors, spacing, radius, typography, dark } = useTheme();
  const { isSubmitting, lastCategory, submitFeedback } = useFeedbackStore();

  // ── State ──────────────────────────────────────────────────────────
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasQueued, setWasQueued] = useState(false);

  // Animation refs
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset state when sheet opens / cleanup on close ──────────────
  useEffect(() => {
    if (visible) {
      const defaultCategory = initialCategory ?? lastCategory ?? null;
      setCategory(defaultCategory);
      setDescription(contextPreFill ?? '');
      setScreenshotUri(null);
      setShowSuccess(false);
      setWasQueued(false);
      checkScale.setValue(0);
      checkOpacity.setValue(0);
    }
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [visible]);

  // ── Handlers ───────────────────────────────────────────────────────

  const handleCategorySelect = useCallback((cat: FeedbackCategory) => {
    selectionFeedback();
    setCategory(cat);
  }, []);

  const handleAttachScreenshot = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        crossPlatformAlert('Permission Needed', 'Allow photo access to attach a screenshot.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setScreenshotUri(result.assets[0].uri);
        lightImpact();
      }
    } catch (err) {
      console.error('Image picker error:', err);
    }
  }, []);

  const handleRemoveScreenshot = useCallback(() => {
    setScreenshotUri(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!category || description.trim().length === 0) return;

    lightImpact();
    const result = await submitFeedback({
      category,
      description: description.trim(),
      screenshotUri: screenshotUri ?? undefined,
      screenContext,
      sessionActive,
    });

    if (result.success) {
      setWasQueued(result.queued ?? false);
      setShowSuccess(true);
      successNotification();

      // Animate checkmark
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 2s
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      crossPlatformAlert('Something went wrong', 'Please try again later.');
    }
  }, [category, description, screenshotUri, screenContext, sessionActive, submitFeedback, onClose]);

  // ── Derived state ──────────────────────────────────────────────────
  const selectedConfig = CATEGORIES.find((c) => c.key === category);
  const charCount = description.trim().length;
  const canSubmit = category !== null && charCount > 0 && !isSubmitting;

  // ── Render ─────────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.9}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {showSuccess ? (
          // ── Success state ──────────────────────────────────────
          <View style={styles.successContainer}>
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  backgroundColor: colors.success,
                  transform: [{ scale: checkScale }],
                  opacity: checkOpacity,
                },
              ]}
            >
              <Ionicons name="checkmark" size={40} color={colors.textInverse} />
            </Animated.View>
            <Text style={[typography.h2, { color: colors.text, marginTop: spacing.lg }]}>
              Thanks!
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
              {wasQueued
                ? "We'll send this when you're back online."
                : 'We read every single piece of feedback.'}
            </Text>
          </View>
        ) : (
          // ── Form state ─────────────────────────────────────────
          <>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close feedback"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[typography.h3, { color: colors.text, flex: 1, textAlign: 'center' }]}>
                Send Feedback
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Context badge */}
              {screenContext && (
                <View style={[styles.contextBadge, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
                  <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                  <Text
                    style={[typography.caption, { color: colors.textTertiary, marginLeft: 4, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {screenContext}
                  </Text>
                </View>
              )}

              {/* Category pills */}
              <Text style={[typography.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm }]}>
                What's this about?
              </Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => handleCategorySelect(cat.key)}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityLabel={cat.label}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={16}
                        color={isSelected ? colors.textInverse : colors.textSecondary}
                      />
                      <Text
                        style={[
                          typography.labelSmall,
                          {
                            color: isSelected ? colors.textInverse : colors.text,
                            marginLeft: 6,
                          },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Description */}
              <Text style={[typography.labelLarge, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                Details
              </Text>
              <View
                style={[
                  styles.textInputContainer,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[
                    typography.body,
                    styles.textInput,
                    { color: colors.text },
                  ]}
                  placeholder={selectedConfig?.placeholder ?? 'Describe your feedback...'}
                  placeholderTextColor={colors.textTertiary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                  accessibilityLabel="Feedback description"
                />
              </View>

              {/* Character hint */}
              <View style={[styles.charRow, { marginTop: spacing.xs }]}>
                {charCount > 0 && charCount < 20 && (
                  <Text style={[typography.caption, { color: colors.warning, flex: 1 }]}>
                    A bit more detail helps us fix this faster
                  </Text>
                )}
                <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: 'auto' }]}>
                  {charCount}/2000
                </Text>
              </View>

              {/* Screenshot */}
              <View style={{ marginTop: spacing.lg }}>
                {screenshotUri ? (
                  <View style={styles.screenshotPreview}>
                    <Image
                      source={{ uri: screenshotUri }}
                      style={[styles.thumbnail, { borderRadius: radius.md, borderColor: colors.border }]}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={handleRemoveScreenshot}
                      style={[styles.removeBtn, { backgroundColor: colors.error, borderRadius: radius.full }]}
                      accessibilityRole="button"
                      accessibilityLabel="Remove screenshot"
                    >
                      <Ionicons name="close" size={14} color={colors.textInverse} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleAttachScreenshot}
                    style={[
                      styles.attachButton,
                      {
                        borderColor: colors.border,
                        borderRadius: radius.lg,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Attach screenshot"
                  >
                    <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                    <Text style={[typography.label, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                      Attach Screenshot
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {/* Submit button */}
            <View style={[styles.footer, { borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md }]}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: canSubmit ? colors.primary : colors.disabled,
                    borderRadius: radius.lg,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send feedback"
                accessibilityState={{ disabled: !canSubmit }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color={canSubmit ? colors.textInverse : colors.disabledText} />
                    <Text
                      style={[
                        typography.labelLarge,
                        {
                          color: canSubmit ? colors.textInverse : colors.disabledText,
                          marginLeft: spacing.sm,
                        },
                      ]}
                    >
                      Send to the FormIQ Team
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  textInputContainer: {
    minHeight: 140,
  },
  textInput: {
    padding: 14,
    minHeight: 140,
  },
  charRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenshotPreview: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderWidth: 1,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    minHeight: 52,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
