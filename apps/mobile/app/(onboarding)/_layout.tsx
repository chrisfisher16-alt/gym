import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        gestureEnabled: true,
        animationMatchesGesture: true,
      }}
    >
      {/* V1 screens */}
      <Stack.Screen name="welcome" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="body" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="mode" />
      <Stack.Screen name="coach-tone" />
      <Stack.Screen name="complete" />
      {/* V2 screens */}
      <Stack.Screen name="health-sync" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="gym-type" />
      <Stack.Screen name="gym-search" />
      <Stack.Screen name="equipment" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="attribution" />
      <Stack.Screen name="generating" />
    </Stack>
  );
}
