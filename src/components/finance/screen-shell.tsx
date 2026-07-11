import { Children, ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { WideColumnWidthFraction } from '@/constants/theme';
import { useIsNarrowScreen } from '@/hooks/use-is-narrow-screen';
import { useIsWideScreen } from '@/hooks/use-is-wide-screen';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function ScreenShell({ title, subtitle, children }: Props) {
  const theme = useTheme();
  const isNarrow = useIsNarrowScreen();
  const isWide = useIsWideScreen();
  const isWeb = Platform.OS === 'web';
  const showColumns = isWeb && isWide;

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
          <View style={showColumns ? styles.wideWrap : undefined}>
            <View style={styles.header}>
              <ThemedText type="subtitle">{title}</ThemedText>
              <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
            </View>
            {showColumns ? <TwoColumnLayout>{children}</TwoColumnLayout> : children}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TwoColumnLayout({ children }: { children: ReactNode }) {
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];
  Children.toArray(children).forEach((child, index) => {
    (index % 2 === 0 ? left : right).push(child);
  });

  return (
    <View style={styles.columnsRow}>
      <View style={styles.column}>{left}</View>
      <View style={styles.column}>{right}</View>
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
  wideWrap: {
    width: WideColumnWidthFraction,
    alignSelf: 'center',
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  column: {
    flex: 1,
    gap: 14,
  },
});
