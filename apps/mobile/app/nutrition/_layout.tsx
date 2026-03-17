import { Stack } from 'expo-router';

export default function NutritionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="log-meal" />
      <Stack.Screen name="text-log" />
      <Stack.Screen name="quick-add" options={{ presentation: 'modal' }} />
      <Stack.Screen name="photo-log" />
      <Stack.Screen name="photo-review" />
      <Stack.Screen name="saved-meals" />
      <Stack.Screen name="meal-detail" />
      <Stack.Screen name="supplements" />
      <Stack.Screen name="recipes" />
      <Stack.Screen name="targets" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
