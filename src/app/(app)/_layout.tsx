import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

export default function AppGroupLayout() {
  const { status } = useAuth();
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  if (status === 'signedOut') {
    return <Redirect href="/login" />;
  }

  return <AppTabs />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
