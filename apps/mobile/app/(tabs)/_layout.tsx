import { Tabs, useSegments } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { CoachFAB } from '../../src/components/CoachFAB';
import type { CoachContext } from '@health-coach/shared';

const TAB_CONTEXT: Record<string, CoachContext> = {
  index: 'general',
  workout: 'workout',
  nutrition: 'nutrition',
  compete: 'general',
  progress: 'progress',
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const segments = useSegments();
  // segments for tabs: ['(tabs)', 'workout'] — last segment is the tab name
  const activeTab = segments[segments.length - 1] ?? 'index';
  const coachContext = TAB_CONTEXT[activeTab] ?? 'general';

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.borderLight,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        animation: 'fade',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarAccessibilityLabel: 'Today tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarAccessibilityLabel: 'Workout tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarAccessibilityLabel: 'Nutrition tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="nutrition-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="compete"
        options={{
          title: 'Compete',
          tabBarAccessibilityLabel: 'Compete tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarAccessibilityLabel: 'Progress tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          href: null,
          title: 'Coach',
        }}
      />
    </Tabs>
    <CoachFAB context={coachContext} />
    </View>
  );
}
