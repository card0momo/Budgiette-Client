import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { PrimaryButton } from '@/components/auth/primary-button';
import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { api, MailboxRead } from '@/lib/api';
import { APP_ENV } from '@/lib/config';
import { shortDate } from '@/lib/format';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const [mailboxes, setMailboxes] = useState<MailboxRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const rows = await api.listMailboxes();
        if (mounted) setMailboxes(rows);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load mailbox settings');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <ScreenShell title="Settings" subtitle="Account and runtime configuration.">
      <Panel title="Account" caption="Signed in with Budgiette">
        <RowItem label="Username" value={user?.username ?? '—'} />
        <RowItem label="Email" value={user?.email || '—'} />
        <RowItem label="Full name" value={user?.full_name || '—'} />
        {user ? <RowItem label="Member since" value={shortDate(user.created_at)} /> : null}
        <PrimaryButton label="Log out" variant="secondary" loading={loggingOut} onPress={handleLogout} />
      </Panel>

      <Panel title="Connection defaults" caption="Edit in env vars when moving between environments">
        <RowItem label="EXPO_PUBLIC_API_URL" value={APP_ENV.apiBaseUrl} />
      </Panel>

      <Panel title="Ingestion mailboxes" caption="Configured IMAP sources for bank alert parsing">
        {loading ? <ActivityIndicator color={theme.text} /> : null}
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        {!loading && mailboxes.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No mailboxes configured yet. Add one via backend endpoint /api/v1/ingestion/mailboxes.
          </ThemedText>
        ) : null}

        {mailboxes.map((mailbox) => (
          <Panel key={mailbox.id} title={mailbox.email_address} caption={`${mailbox.use_ssl ? 'IMAPS' : 'IMAP'} host`}>
            <RowItem label="Host" value={`${mailbox.host}:${mailbox.port}`} />
            <RowItem label="Active" value={mailbox.is_active ? 'Yes' : 'No'} />
          </Panel>
        ))}
      </Panel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#C2433B',
  },
});
