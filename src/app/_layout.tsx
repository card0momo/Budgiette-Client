import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/hooks/use-auth';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Head>
        <title>Budgiette</title>
      </Head>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
