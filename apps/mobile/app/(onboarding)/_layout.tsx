import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="body" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="mode" />
      <Stack.Screen name="coach-tone" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
