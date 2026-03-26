import React from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, type ViewStyle, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  keyboardAvoiding?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function ScreenContainer({
  children,
  scrollable = true,
  padded = true,
  style,
  contentStyle,
  edges = ['top'],
  keyboardAvoiding,
  refreshControl,
}: ScreenContainerProps) {
  const { colors, spacing } = useTheme();

  const content = (
    <View style={[{ flex: scrollable ? undefined : 1 }, padded && { paddingHorizontal: spacing.base }, contentStyle]}>
      {children}
    </View>
  );

  const inner = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={styles.scroll}>{content}</View>
  );

  const wrapped = keyboardAvoiding && Platform.OS === 'ios'
    ? <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>{inner}</KeyboardAvoidingView>
    : inner;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor: colors.background }, style]}
    >
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
