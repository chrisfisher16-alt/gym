import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, Card, ScreenContainer, EmptyState } from '../../src/components/ui';

export default function WorkoutTab() {
  const { colors, spacing, typography } = useTheme();

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <Text style={[typography.h1, { color: colors.text }]}>Workout</Text>
      </View>

      {/* Quick Start */}
      <Card style={{ marginBottom: spacing.base }}>
        <View style={styles.cardHeader}>
          <Ionicons name="flash-outline" size={20} color={colors.primary} />
          <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm }]}>
            Quick Start
          </Text>
        </View>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          Start an empty workout and add exercises as you go.
        </Text>
        <Button
          title="Start Empty Workout"
          variant="secondary"
          size="md"
          onPress={() => {}}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      {/* Programs */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Your Programs
        </Text>
        <EmptyState
          icon="barbell-outline"
          title="No Programs Yet"
          description="Your AI coach can create a personalized program based on your goals."
          actionLabel="Create Program"
          onAction={() => {}}
        />
      </View>

      {/* History */}
      <View style={{ marginBottom: spacing['2xl'] }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Recent Workouts
        </Text>
        <EmptyState
          icon="time-outline"
          title="No Workout History"
          description="Your completed workouts will appear here."
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
