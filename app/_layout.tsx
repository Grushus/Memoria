import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function useProtectedRoute(session: Session | null) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments]);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loaded && authReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, authReady]);

  if (!loaded || !authReady) {
    return null;
  }

  return <RootLayoutNav session={session} />;
}

function RootLayoutNav({ session }: { session: Session | null }) {
  const colorScheme = useColorScheme();
  useProtectedRoute(session);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="result" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="entry/[id]" options={{ title: 'Entry', headerBackTitle: 'Back' }} />
        <Stack.Screen name="badges/[badge]" options={{ title: 'Badge', headerBackTitle: 'Profile' }} />
      </Stack>
    </ThemeProvider>
  );
}
