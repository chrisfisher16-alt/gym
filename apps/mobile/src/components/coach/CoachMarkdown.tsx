import React from 'react';
import { Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../theme';

interface CoachMarkdownProps {
  content: string;
}

export const CoachMarkdown = React.memo(function CoachMarkdown({
  content,
}: CoachMarkdownProps) {
  const { colors, typography } = useTheme();

  const monoFamily = Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  });

  const markdownStyles = {
    body: {
      color: colors.text,
      fontSize: typography.body.fontSize,
      lineHeight: typography.body.fontSize * 1.5,
      fontFamily: typography.body.fontFamily,
    },
    heading1: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700' as const,
      marginTop: 12,
      marginBottom: 6,
    },
    heading2: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600' as const,
      marginTop: 10,
      marginBottom: 4,
    },
    heading3: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600' as const,
      marginTop: 8,
      marginBottom: 4,
    },
    strong: {
      fontWeight: '700' as const,
      color: colors.text,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    bullet_list: {
      marginLeft: 8,
    },
    ordered_list: {
      marginLeft: 8,
    },
    list_item: {
      marginBottom: 4,
    },
    bullet_list_icon: {
      color: colors.primary,
      fontSize: 8,
      marginTop: 6,
    },
    code_inline: {
      backgroundColor: colors.surfaceSecondary,
      color: colors.primary,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
      fontSize: 13,
      fontFamily: monoFamily,
    },
    code_block: {
      backgroundColor: colors.surfaceSecondary,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      fontFamily: monoFamily,
    },
    fence: {
      backgroundColor: colors.surfaceSecondary,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      color: colors.text,
      fontSize: 13,
      fontFamily: monoFamily,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingLeft: 12,
      marginLeft: 0,
      opacity: 0.85,
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 12,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline' as const,
    },
  };

  return <Markdown style={markdownStyles}>{content}</Markdown>;
});
