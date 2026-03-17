import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme, Platform, View, ActivityIndicator } from 'react-native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On web, skip all native initialization and just render
    if (Platform.OS === 'web') {
      setReady(true);
      return;
    }

    // On native, do store initialization
    async function init() {
      try {
        const { useAuthStore } = require('../src/stores/auth-store');
        await useAuthStore.getState().initialize();
      } catch (e) {
        console.warn('Init failed:', e);
      } finally {
        setReady(true);
        try {
          const SplashScreen = require('expo-splash-screen');
          SplashScreen.hideAsync();
        } catch {}
      }
    }
    
    try {
      const SplashScreen = require('expo-splash-screen');
      SplashScreen.preventAutoHideAsync();
    } catch {}
    
    init();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="nutrition" />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings', presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications', presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="health-connect" options={{ headerShown: true, title: 'Connect Health', presentation: 'modal' }} />
        <Stack.Screen name="health-settings" options={{ headerShown: true, title: 'Health Integrations', presentation: 'modal' }} />
        <Stack.Screen name="privacy" options={{ headerShown: true, title: 'Privacy Policy', presentation: 'modal' }} />
        <Stack.Screen name="terms" options={{ headerShown: true, title: 'Terms of Service', presentation: 'modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </QueryClientProvider>
  );
}
