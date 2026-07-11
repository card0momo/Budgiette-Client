import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, IconButton, Menu, Text as PaperText, TextInput as PaperTextInput, useTheme as usePaperTheme } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoToLocalDate(iso: string): Date | undefined {
  if (!DATE_RE.test(iso)) return undefined;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function localDateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type PanelProps = {
  title: string;
  caption?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export function Panel({ title, caption, children, collapsible = false, defaultOpen = true }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const showContent = !collapsible || open;

  const titleBlock = (
    <Card.Title
      title={title}
      subtitle={caption}
      right={collapsible ? () => <IconButton icon={open ? 'chevron-up' : 'chevron-down'} /> : undefined}
    />
  );

  return (
    <Card mode="outlined">
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}>
          {titleBlock}
        </Pressable>
      ) : (
        titleBlock
      )}
      {showContent ? <Card.Content style={styles.content}>{children}</Card.Content> : null}
    </Card>
  );
}

export function RowItem({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  const paperTheme = usePaperTheme();

  return (
    <View style={styles.row}>
      <PaperText variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
        {label}
      </PaperText>
      <PaperText variant="bodyMedium" style={{ color: danger ? paperTheme.colors.error : paperTheme.colors.onSurface }}>
        {value}
      </PaperText>
    </View>
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
  const [open, setOpen] = useState(false);

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
          <PaperTextInput
            label={label}
            value={valueLabel}
            mode="outlined"
            editable={false}
            pointerEvents="none"
            right={<PaperTextInput.Icon icon="menu-down" onPress={() => setOpen(true)} />}
          />
        </Pressable>
      }>
      {options.map((option, index) => (
        <Menu.Item
          key={index}
          title={option.label}
          onPress={() => {
            onSelect(option.value);
            setOpen(false);
          }}
        />
      ))}
    </Menu>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <PaperTextInput
          label={label}
          value={value}
          mode="outlined"
          editable={false}
          pointerEvents="none"
          placeholder="YYYY-MM-DD"
          right={<PaperTextInput.Icon icon="calendar" onPress={() => setOpen(true)} />}
        />
      </Pressable>
      <DatePickerModal
        locale="en"
        mode="single"
        visible={open}
        date={isoToLocalDate(value)}
        onDismiss={() => setOpen(false)}
        onConfirm={({ date }) => {
          setOpen(false);
          if (date) onChange(localDateToIso(date));
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});
