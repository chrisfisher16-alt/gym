import { Stack } from 'expo-router';

export default function CompeteLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right' }}>
      <Stack.Screen name="create-challenge" />
      <Stack.Screen name="[challengeId]" />
    </Stack>
  );
}
