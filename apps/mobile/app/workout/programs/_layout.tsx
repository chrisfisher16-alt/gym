import { Stack } from 'expo-router';

export default function ProgramsLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: 'ios_from_right',
      gestureEnabled: true,
      animationMatchesGesture: true,
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
