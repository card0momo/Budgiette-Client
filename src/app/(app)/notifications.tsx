import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { api, NotificationRead } from '@/lib/api';
import { shortDate } from '@/lib/format';

export default function NotificationsScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<NotificationRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const rows = await api.listNotifications();
        if (mounted) setItems(rows);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load notifications');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScreenShell title="Alerts" subtitle="Spend warnings and MSI due reminders.">
      {loading ? <ActivityIndicator color={theme.text} /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {items.map((notification) => (
        <Panel key={notification.id} title={notification.title} caption={notification.type}>
          <ThemedText>{notification.message}</ThemedText>
          <RowItem label="Created" value={shortDate(notification.created_at)} />
          <RowItem label="Status" value={notification.is_read ? 'Read' : 'Unread'} />
        </Panel>
      ))}

      {!loading && items.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No alerts right now. Once budget checks and MSI reminders run, warnings will appear here.
        </ThemedText>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#C2433B',
  },
});
