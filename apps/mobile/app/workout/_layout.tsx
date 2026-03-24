import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: 'ios_from_right',
      gestureEnabled: true,
      animationMatchesGesture: true,
    }}>
      <Stack.Screen name="exercises" />
      <Stack.Screen name="[exerciseId]" />
      <Stack.Screen name="create-exercise" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="ai-generate" />
      <Stack.Screen name="active" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="history" />
      <Stack.Screen name="programs" />
      <Stack.Screen name="session" />
    </Stack>
  );
}
