import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="exercises" />
      <Stack.Screen name="[exerciseId]" />
      <Stack.Screen name="create-exercise" options={{ presentation: 'modal' }} />
      <Stack.Screen name="active" options={{ gestureEnabled: false }} />
      <Stack.Screen name="history" />
      <Stack.Screen name="programs" />
      <Stack.Screen name="session" />
    </Stack>
  );
}
