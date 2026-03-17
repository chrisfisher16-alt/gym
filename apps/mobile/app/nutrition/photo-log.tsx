import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, Card, ScreenContainer } from '../../src/components/ui';

export default function PhotoLogScreen() {
  const router = useRouter();
  const { mealType = 'lunch' } = useLocalSearchParams<{ mealType: string }>();
  const { colors, spacing, radius, typography } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePickImage = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll access to use this feature.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera access to use this feature.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const handleAnalyze = () => {
    if (!imageUri) return;
    router.push(`/nutrition/photo-review?imageUri=${encodeURIComponent(imageUri)}&mealType=${mealType}` as any);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Photo Log
        </Text>
      </View>

      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        Take a photo of your meal or choose from your gallery. We&apos;ll estimate the nutrition.
      </Text>

      {/* Image Preview */}
      {imageUri ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Image
            source={{ uri: imageUri }}
            style={[styles.preview, { borderRadius: radius.lg }]}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={[styles.changePhoto, { backgroundColor: colors.surface, borderRadius: radius.full }]}
            onPress={() => setImageUri(null)}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.captureArea, { marginBottom: spacing.lg }]}>
          <TouchableOpacity
            style={[
              styles.captureButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.xl,
                marginBottom: spacing.md,
              },
            ]}
            onPress={handleTakePhoto}
            activeOpacity={0.7}
          >
            <Ionicons name="camera" size={48} color={colors.primary} />
            <Text style={[typography.label, { color: colors.text, marginTop: spacing.md }]}>
              Take Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.galleryButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.lg,
              },
            ]}
            onPress={handlePickImage}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={24} color={colors.primary} />
            <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
              Choose from Gallery
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {imageUri && (
        <Button
          title="Analyze Photo"
          onPress={handleAnalyze}
          loading={loading}
          icon={<Ionicons name="sparkles-outline" size={20} color={colors.textInverse} />}
        />
      )}

      <View style={[styles.disclaimer, { marginTop: spacing.xl }]}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
        <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: spacing.xs, flex: 1 }]}>
          Photo analysis provides estimates only. You&apos;ll be able to review and edit all values before saving.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: 250,
  },
  changePhoto: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureArea: {
    alignItems: 'center',
  },
  captureButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
