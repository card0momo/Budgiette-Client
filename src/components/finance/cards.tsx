import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type PanelProps = {
  title: string;
  caption?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export function Panel({ title, caption, children, collapsible = false, defaultOpen = true }: PanelProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const showContent = !collapsible || open;

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <ThemedText type="default" style={styles.title}>{title}</ThemedText>
        {caption ? <ThemedText themeColor="textSecondary" style={styles.caption}>{caption}</ThemedText> : null}
      </View>
      {collapsible ? (
        <ThemedText themeColor="textSecondary">{open ? '▾' : '▸'}</ThemedText>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}>
          {header}
        </Pressable>
      ) : (
        header
      )}
      {showContent ? children : null}
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 2,
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
