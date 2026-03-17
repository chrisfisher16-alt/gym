import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, Card, ScreenContainer, MacroBar, ProgressBar, EmptyState } from '../../src/components/ui';

export default function NutritionTab() {
  const { colors, spacing, typography } = useTheme();

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <Text style={[typography.h1, { color: colors.text }]}>Nutrition</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {/* Daily Summary */}
      <Card style={{ marginBottom: spacing.base }}>
        <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
          Daily Summary
        </Text>
        <View style={styles.calorieRow}>
          <Text style={[typography.displayMedium, { color: colors.text }]}>0</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}> / 2,200 cal</Text>
        </View>
        <ProgressBar
          progress={0}
          color={colors.calories}
          height={10}
          style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        />
        <View style={{ gap: spacing.md }}>
          <MacroBar label="Protein" current={0} target={150} color={colors.protein} />
          <MacroBar label="Carbs" current={0} target={250} color={colors.carbs} />
          <MacroBar label="Fat" current={0} target={70} color={colors.fat} />
          <MacroBar label="Fiber" current={0} target={30} color={colors.fiber} />
        </View>
      </Card>

      {/* Meals */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Today&apos;s Meals
        </Text>

        {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((meal) => (
          <Card key={meal} style={{ marginBottom: spacing.sm }}>
            <View style={styles.mealRow}>
              <View style={styles.mealInfo}>
                <Ionicons name="restaurant-outline" size={18} color={colors.textSecondary} />
                <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                  {meal}
                </Text>
              </View>
              <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>0 cal</Text>
            </View>
          </Card>
        ))}
      </View>

      {/* Log Meal Button */}
      <Button
        title="Log Meal"
        onPress={() => {}}
        icon={<Ionicons name="add-circle-outline" size={20} color="white" />}
        style={{ marginBottom: spacing['2xl'] }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
