import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme, Platform, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { ToastProvider } from '../src/components/Toast';
import { NetworkBanner } from '../src/components/NetworkBanner';
import { CommandPaletteProvider, useCommandPalette } from '../src/providers/CommandPaletteProvider';
import { CommandPalette } from '../src/components/ui/CommandPalette';
import { CoachPeekProvider } from '../src/providers/CoachPeekProvider';
import { QuickInputProvider } from '../src/providers/QuickInputProvider';
import { migrateAIConfig } from '../src/lib/ai-provider';
import { bootstrapNotifications } from '../src/lib/notification-bootstrap';
import { useThemeStore } from '../src/stores/theme-store';
import { initializeStoreBridge } from '../src/lib/store-bridge';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

/** Renders CommandPalette using context — avoids require cycle between component & provider */
function CommandPaletteSheet() {
  const { isOpen, close } = useCommandPalette();
  return <CommandPalette visible={isOpen} onClose={close} />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const resolvedScheme = useThemeStore((s) => s.resolvedScheme);
  const [ready, setReady] = useState(false);

  // Set up cross-store reactive subscriptions
  useEffect(() => {
    const cleanup = initializeStoreBridge();
    return cleanup;
  }, []);

  useEffect(() => {
    // Hide the floating dev menu button in development
    if (__DEV__) {
      try {
        const { requireOptionalNativeModule } = require('expo-modules-core');
        const devMenuPrefs = requireOptionalNativeModule('DevMenuPreferences');
        devMenuPrefs?.setPreferencesAsync?.({ showFloatingActionButton: false });
      } catch {}
    }

    // Migrate AI config on all platforms (clears stale cached API key)
    migrateAIConfig().catch(() => {});

    // Initialize theme store (loads persisted color mode)
    useThemeStore.getState().initialize();

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
        // Bootstrap notification categories, re-sync reminders, and set up response listener
        await bootstrapNotifications();
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
    // Use system color scheme for the loading screen to avoid a flash
    const isDark = colorScheme === 'dark';
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0D0D0D' : '#FAFAFA' }}>
        <ActivityIndicator size="large" color="#C4A265" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <QueryClientProvider client={queryClient}>
    <CommandPaletteProvider>
    <CommandPaletteSheet />
    <CoachPeekProvider>
    <QuickInputProvider>
    <ToastProvider>
      <ErrorBoundary>
      <NetworkBanner />
      <Stack screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        gestureEnabled: true,
        animationMatchesGesture: true,
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="nutrition" />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="progress" options={{ headerShown: false }} />
        <Stack.Screen name="health-connect" options={{ headerShown: true, title: 'Connect Health', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="health-settings" options={{ headerShown: true, title: 'Health Integrations', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ai-settings" options={{ headerShown: true, title: 'AI Settings', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="privacy" options={{ headerShown: true, title: 'Privacy Policy', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="terms" options={{ headerShown: true, title: 'Terms of Service', presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      </ErrorBoundary>
    </ToastProvider>
    </QuickInputProvider>
    </CoachPeekProvider>
    </CommandPaletteProvider>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
