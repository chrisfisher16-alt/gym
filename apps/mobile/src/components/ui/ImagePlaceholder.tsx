import React, { useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface ImagePlaceholderProps {
  source: ImageSourcePropType | { uri: string };
  style?: StyleProp<ViewStyle>;
  width: number;
  height: number;
  borderRadius?: number;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}

export const ImagePlaceholder = React.memo(function ImagePlaceholder({
  source,
  style,
  width,
  height,
  borderRadius = 8,
  fallbackIcon = 'image-outline',
}: ImagePlaceholderProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <View
        style={[
          styles.placeholder,
          { width, height, borderRadius, backgroundColor: colors.surfaceSecondary },
          style,
        ]}
      >
        <Ionicons name={fallbackIcon} size={Math.min(width, height) * 0.4} color={colors.textTertiary} />
      </View>
    );
  }

  return (
    <View style={[{ width, height, borderRadius, overflow: 'hidden' }, style]}>
      {loading && (
        <View
          style={[
            styles.placeholder,
            { width, height, backgroundColor: colors.surfaceSecondary, position: 'absolute', zIndex: 1 },
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
      <Image
        source={source}
        style={{ width, height }}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        resizeMode="cover"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
