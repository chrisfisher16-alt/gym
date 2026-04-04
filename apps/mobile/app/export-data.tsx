import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { crossPlatformAlert } from '../src/lib/cross-platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { ScreenContainer, Card, Button } from '../src/components/ui';
import { exportUserData, type ExportFormat } from '../src/lib/data-export';
import { lightImpact, successNotification } from '../src/lib/haptics';

export default function ExportDataScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const [format, setFormat] = useState<ExportFormat>('json');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    lightImpact();
    setExporting(true);
    try {
      const result = await exportUserData(format);
      if (result.success) {
        successNotification();
      } else {
        crossPlatformAlert('Export Failed', result.error ?? 'An unknown error occurred. Please try again.');
      }
    } catch {
      crossPlatformAlert('Export Failed', 'An unexpected error occurred. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const formats: { value: ExportFormat; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      value: 'json',
      label: 'JSON',
      description: 'Full structured data, ideal for backup or migration',
      icon: 'code-outline',
    },
    {
      value: 'csv',
      label: 'CSV',
      description: 'Spreadsheet-compatible, opens in Excel or Google Sheets',
      icon: 'grid-outline',
    },
  ];

  return (
    <ScreenContainer edges={[]}>
      <View style={{ paddingTop: spacing.base, paddingBottom: spacing['3xl'], flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.sm }]}>
            Export My Data
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 22 }]}>
            Download all your FormIQ data including workouts, nutrition logs, personal records, body measurements, and achievements.
          </Text>

          <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }]}>
            Export Format
          </Text>

          {formats.map((f) => (
            <TouchableOpacity
              key={f.value}
              activeOpacity={0.7}
              onPress={() => { lightImpact(); setFormat(f.value); }}
            >
              <Card
                style={[
                  { marginBottom: spacing.sm },
                  format === f.value && {
                    borderWidth: 2,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={styles.formatRow}>
                  <View style={[styles.formatIcon, { backgroundColor: format === f.value ? colors.primaryMuted : colors.surfaceSecondary, borderRadius: radius.md }]}>
                    <Ionicons name={f.icon} size={24} color={format === f.value ? colors.primary : colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[typography.label, { color: colors.text }]}>{f.label}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{f.description}</Text>
                  </View>
                  {format === f.value && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))}

          <Card style={{ marginTop: spacing.base, backgroundColor: colors.infoLight }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.info} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typography.label, { color: colors.text }]}>Your data, your right</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4, lineHeight: 20 }]}>
                  In compliance with GDPR and CCPA, you can export all your data at any time. The export includes every record associated with your account.
                </Text>
              </View>
            </View>
          </Card>

          <Text style={[typography.labelSmall, { color: colors.textTertiary, marginTop: spacing.xl, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }]}>
            What&apos;s Included
          </Text>
          <Card>
            {[
              'Profile and preferences',
              'All workout sessions and set logs',
              'Personal records',
              'Nutrition day logs and meal entries',
              'Hydration logs',
              'Body measurements',
              'Achievements and streaks',
            ].map((item, i) => (
              <View key={item} style={[styles.includeRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
                <Ionicons name="checkmark" size={16} color={colors.success} />
                <Text style={[typography.body, { color: colors.text, marginLeft: spacing.sm }]}>{item}</Text>
              </View>
            ))}
          </Card>
        </View>

        <View style={{ paddingTop: spacing.xl }}>
          <Button
            title={exporting ? 'Preparing Export...' : `Export as ${format.toUpperCase()}`}
            onPress={handleExport}
            loading={exporting}
            disabled={exporting}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formatIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
});
