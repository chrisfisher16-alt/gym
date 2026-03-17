import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/auth-store';
import { setupNotificationCategories, getRouteForNotificationType } from '../src/lib/notifications';
import { useNotificationStore } from '../src/stores/notification-store';
import type { NotificationData } from '../src/types/notifications';
import { useSubscriptionStore } from '../src/stores/subscription-store';
import { useHealthStore } from '../src/stores/health-store';

SplashScreen.preventAutoHideAsync();

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
  const initialize = useAuthStore((s) => s.initialize);
  const setSession = useAuthStore((s) => s.setSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initSubscription = useSubscriptionStore((s) => s.initialize);
  const initHealth = useHealthStore((s) => s.initialize);
  const checkPermission = useNotificationStore((s) => s.checkPermission);
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const notificationReceivedListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    initialize().then(() => {
      SplashScreen.hideAsync();
      initSubscription();
      initHealth();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [initialize, setSession, initSubscription, initHealth]);

  // Notification setup
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Setup notification categories (action buttons)
    setupNotificationCategories();

    // Check current permission status on mount
    checkPermission();

    // Handle notification received while app is in foreground
    notificationReceivedListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notification received in foreground — could track analytics here
      },
    );

    // Handle notification tap (app opened from notification)
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationData | undefined;
        if (!data?.type) return;

        const route = data.route ?? getRouteForNotificationType(data.type);

        // Small delay to ensure navigation is ready
        setTimeout(() => {
          try {
            router.push(route as Parameters<typeof router.push>[0]);
          } catch {
            // Navigation not ready, silently fail
          }
        }, 500);
      },
    );

    return () => {
      if (notificationReceivedListener.current) {
        Notifications.removeNotificationSubscription(notificationReceivedListener.current);
      }
      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(notificationResponseListener.current);
      }
    };
  }, [checkPermission]);

  if (isLoading) {
    return null;
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
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Settings',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: true,
            title: 'Notifications',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="health-connect"
          options={{
            headerShown: true,
            title: 'Connect Health',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="health-settings"
          options={{
            headerShown: true,
            title: 'Health Integrations',
            presentation: 'modal',
          }}
        />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </QueryClientProvider>
  );
}
