import { Stack } from 'expo-router';

export default function SocialLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: 'ios_from_right',
      gestureEnabled: true,
      animationMatchesGesture: true,
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="feed" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="leaderboard" />
    </Stack>
  );
}
