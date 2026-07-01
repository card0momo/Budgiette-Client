import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type PanelProps = {
  title: string;
  caption?: string;
  children: ReactNode;
};

export function Panel({ title, caption, children }: PanelProps) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <ThemedText type="default" style={styles.title}>{title}</ThemedText>
      {caption ? <ThemedText themeColor="textSecondary" style={styles.caption}>{caption}</ThemedText> : null}
      {children}
    </View>
  );
}

export function RowItem({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={{ color: danger ? '#C2433B' : theme.text }}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  title: {
    fontWeight: '700',
  },
  caption: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});
