import { ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.tint : theme.backgroundElement,
          borderColor: selected ? theme.tint : theme.backgroundSelected,
        },
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.tintText : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function MenuField<T,>({
  label,
  valueLabel,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  valueLabel: string;
  options: { value: T; label: string }[];
  selectedValue: T;
  onSelect: (value: T) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.menuField}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.menuTrigger, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
        <ThemedText numberOfLines={1} style={styles.menuTriggerLabel}>
          {valueLabel}
        </ThemedText>
        <ThemedText themeColor="textSecondary">▾</ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menuCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
            <ScrollView>
              {options.map((option, index) => {
                const isSelected = option.value === selectedValue;
                return (
                  <Pressable
                    key={index}
                    onPress={() => {
                      onSelect(option.value);
                      setOpen(false);
                    }}
                    style={[styles.menuOption, isSelected && { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText style={isSelected ? { color: theme.tint } : undefined}>{option.label}</ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  menuField: {
    gap: 4,
  },
  menuTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuTriggerLabel: {
    flex: 1,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
