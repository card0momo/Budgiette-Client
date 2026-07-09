import { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useIsNarrowScreen } from '@/hooks/use-is-narrow-screen';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function ScreenShell({ title, subtitle, children }: Props) {
  const theme = useTheme();
  const isNarrow = useIsNarrowScreen();
  const isWeb = Platform.OS === 'web';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            // The web tab bar floats over the content (see app-tabs.web.tsx): it sits
            // at the top on wide screens and at the bottom on narrow ones, so screens
            // need clearance on the matching side to avoid it covering content.
            isWeb && (isNarrow ? styles.contentNarrowWeb : styles.contentWideWeb),
          ]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{title}</ThemedText>
            <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  contentWideWeb: {
    paddingTop: 84,
  },
  contentNarrowWeb: {
    paddingBottom: 96,
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
});
