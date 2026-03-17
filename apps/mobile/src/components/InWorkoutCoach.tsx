import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { sendWorkoutQuickMessage } from '../lib/coach-api';

interface InWorkoutCoachProps {
  visible: boolean;
  onClose: () => void;
  exerciseName?: string;
}

export function InWorkoutCoach({ visible, onClose, exerciseName }: InWorkoutCoachProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [customInput, setCustomInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return;
      setIsLoading(true);
      setResponse('');
      setCustomInput('');
      try {
        const result = await sendWorkoutQuickMessage(message, exerciseName);
        setResponse(result.content);
      } catch {
        setResponse('Sorry, I could not get a response right now. Try again in a moment.');
      } finally {
        setIsLoading(false);
      }
    },
    [exerciseName, isLoading],
  );

  const quickPrompts = [
    exerciseName
      ? `Suggest a replacement for ${exerciseName}`
      : 'Suggest an alternative exercise',
    'Mix up remaining exercises',
    exerciseName ? `Form tips for ${exerciseName}` : 'General form tips',
  ];

  const handleClose = () => {
    setResponse('');
    setCustomInput('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        {/* Sheet */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: Platform.OS === 'ios' ? 34 : spacing.base,
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
            <Ionicons name="fitness" size={20} color={colors.primary} />
            <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
              Workout Coach
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {exerciseName && (
            <Text
              style={[
                typography.bodySmall,
                {
                  color: colors.textSecondary,
                  paddingHorizontal: spacing.base,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              Currently doing: {exerciseName}
            </Text>
          )}

          {/* Quick prompts */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.base,
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            {quickPrompts.map((prompt) => (
              <TouchableOpacity
                key={prompt}
                onPress={() => handleSend(prompt)}
                disabled={isLoading}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.xl,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    opacity: isLoading ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: colors.primary }]}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Response area */}
          {(isLoading || response) && (
            <ScrollView
              style={[
                styles.responseArea,
                {
                  backgroundColor: colors.background,
                  borderRadius: radius.lg,
                  marginHorizontal: spacing.base,
                  marginBottom: spacing.md,
                  padding: spacing.md,
                  maxHeight: 200,
                },
              ]}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                    Thinking...
                  </Text>
                </View>
              ) : (
                <Text style={[typography.bodySmall, { color: colors.text, lineHeight: 20 }]}>
                  {response}
                </Text>
              )}
            </ScrollView>
          )}

          {/* Custom input */}
          <View style={[styles.inputRow, { paddingHorizontal: spacing.base }]}>
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
                },
              ]}
              placeholder="Ask about this exercise..."
              placeholderTextColor={colors.textTertiary}
              value={customInput}
              onChangeText={setCustomInput}
              returnKeyType="send"
              onSubmitEditing={() => handleSend(customInput)}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => handleSend(customInput)}
              disabled={!customInput.trim() || isLoading}
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    customInput.trim() && !isLoading ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.full,
                  marginLeft: spacing.sm,
                },
              ]}
            >
              <Ionicons
                name="send"
                size={16}
                color={customInput.trim() && !isLoading ? colors.textInverse : colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    paddingTop: 8,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chip: {},
  responseArea: {},
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
  },
  sendBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
