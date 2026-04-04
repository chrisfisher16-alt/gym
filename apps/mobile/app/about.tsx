import { View, Text, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { ScreenContainer, Card, Divider } from '../src/components/ui';
import Constants from 'expo-constants';

export default function AboutScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScreenContainer edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: spacing['2xl'], paddingBottom: spacing['3xl'], alignItems: 'center' }}>
          {/* Logo / Brand */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.base,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={[typography.displayLarge, { fontSize: 36, fontWeight: '800', color: colors.primary }]}>F</Text>
          </View>

          <Text style={[typography.h1, { color: colors.text, marginBottom: 4 }]}>FormIQ</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginBottom: 2 }]}>Smart Workout Tracker</Text>
          <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>Version {appVersion}</Text>

          {/* Medical Disclaimer */}
          <Card
            style={{
              marginTop: spacing.xl,
              backgroundColor: colors.warningLight,
              borderColor: colors.warning,
              borderWidth: 1,
              width: '100%',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Ionicons name="medical-outline" size={20} color={colors.warning} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.label, { color: colors.text, marginBottom: 4 }]}>Medical Disclaimer</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, lineHeight: 20 }]}>
                  FormIQ is not a medical device. It does not diagnose, treat, cure, or prevent any disease or condition. Consult a healthcare professional before starting any exercise or nutrition program.
                </Text>
              </View>
            </View>
          </Card>

          {/* Links */}
          <Card style={{ marginTop: spacing.base, width: '100%' }}>
            <LinkRow
              icon="document-text-outline"
              label="Privacy Policy"
              colors={colors}
              typography={typography}
              spacing={spacing}
              onPress={() => Linking.openURL('https://formiq.app/privacy')}
            />
            <Divider />
            <LinkRow
              icon="reader-outline"
              label="Terms of Service"
              colors={colors}
              typography={typography}
              spacing={spacing}
              onPress={() => Linking.openURL('https://formiq.app/terms')}
            />
            <Divider />
            <LinkRow
              icon="mail-outline"
              label="Contact Support"
              value="support@formiq.app"
              colors={colors}
              typography={typography}
              spacing={spacing}
              onPress={() => Linking.openURL('mailto:support@formiq.app')}
            />
            <Divider />
            <LinkRow
              icon="logo-github"
              label="Report an Issue"
              colors={colors}
              typography={typography}
              spacing={spacing}
              onPress={() => Linking.openURL('https://github.com/formiq/mobile/issues')}
            />
          </Card>

          {/* Acknowledgments */}
          <Card style={{ marginTop: spacing.base, width: '100%' }}>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
              Acknowledgments
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, lineHeight: 20 }]}>
              Built with Expo, React Native, Supabase, and the open-source community.
              Exercise data sourced from public fitness databases.
            </Text>
          </Card>

          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xl, textAlign: 'center' }]}>
            Made with focus and intent.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function LinkRow({
  icon,
  label,
  value,
  colors,
  typography: typo,
  spacing: sp,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  colors: ReturnType<typeof import('../src/theme').useTheme>['colors'];
  typography: ReturnType<typeof import('../src/theme').useTheme>['typography'];
  spacing: ReturnType<typeof import('../src/theme').useTheme>['spacing'];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: sp.md }}
    >
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={[typo.body, { color: colors.text, marginLeft: sp.md, flex: 1 }]}>{label}</Text>
      {value && <Text style={[typo.bodySmall, { color: colors.textTertiary, marginRight: sp.sm }]}>{value}</Text>}
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}
