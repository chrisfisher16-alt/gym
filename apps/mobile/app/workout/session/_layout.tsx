import { Stack } from 'expo-router';

export default function SessionLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: 'ios_from_right',
      gestureEnabled: true,
      animationMatchesGesture: true,
    }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
