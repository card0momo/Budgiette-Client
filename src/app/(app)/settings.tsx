import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { AccountRead, api, BankInfo, MailboxRead } from '@/lib/api';
import { APP_ENV } from '@/lib/config';
import { shortDate } from '@/lib/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const [mailboxes, setMailboxes] = useState<MailboxRead[]>([]);
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [accounts, setAccounts] = useState<AccountRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function loadAll() {
    try {
      const [mailboxRows, bankRows, accountRows] = await Promise.all([
        api.listMailboxes(),
        api.listBanks(),
        api.listAccounts(),
      ]);
      setMailboxes(mailboxRows);
      setBanks(bankRows);
      setAccounts(accountRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingestion settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
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

      <Panel
        title="Email server"
        caption="Connect a mailbox so bank alert emails become transactions automatically">
        {loading ? <ActivityIndicator color={theme.text} /> : null}
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        {!loading && mailboxes.length === 0 ? <MailboxForm banks={banks} onCreated={loadAll} /> : null}

        {mailboxes.map((mailbox) => (
          <MailboxCard key={mailbox.id} mailbox={mailbox} banks={banks} onChanged={loadAll} />
        ))}
      </Panel>

      <Panel title="Bank accounts" caption="Give each auto-created account a nickname or account number">
        {!loading && accounts.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No bank accounts yet — one is created automatically once you enable a bank above.
          </ThemedText>
        ) : null}
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} onChanged={loadAll} />
        ))}
      </Panel>
    </ScreenShell>
  );
}

function BankToggleRow({
  bank,
  selected,
  onPress,
  disabled = false,
}: {
  bank: BankInfo;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.bankRow,
        {
          backgroundColor: selected ? theme.tint : theme.backgroundElement,
          borderColor: selected ? theme.tint : theme.backgroundSelected,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      <ThemedText style={{ color: selected ? theme.tintText : theme.text }}>{bank.display_name}</ThemedText>
    </Pressable>
  );
}

function MailboxForm({ banks, onCreated }: { banks: BankInfo[]; onCreated: () => void }) {
  const theme = useTheme();
  const [emailAddress, setEmailAddress] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('993');
  const [useSsl, setUseSsl] = useState(true);
  const [password, setPassword] = useState('');
  const [syncStartDate, setSyncStartDate] = useState('');
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleBank(key: string) {
    setSelectedBanks((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }

  function validate(): string | null {
    if (!emailAddress.trim() || !emailAddress.includes('@')) return 'Enter a valid email address.';
    if (!host.trim()) return 'Enter the IMAP host.';
    const portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber <= 0) return 'Enter a valid port number.';
    if (!password) return 'Enter the mailbox password (an app password if your provider requires one).';
    if (!DATE_RE.test(syncStartDate)) return 'Enter the backfill start date as YYYY-MM-DD.';
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.createMailbox({
        email_address: emailAddress.trim(),
        host: host.trim(),
        port: Number(port),
        use_ssl: useSsl,
        password,
        sync_start_date: syncStartDate,
        enabled_banks: selectedBanks,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the email server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Add your email server" caption="IMAP credentials are encrypted at rest">
      <TextField
        label="Email address"
        value={emailAddress}
        onChangeText={setEmailAddress}
        placeholder="finanzas@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <TextField
        label="IMAP host"
        value={host}
        onChangeText={setHost}
        placeholder="imap.example.com"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField label="Port" value={port} onChangeText={setPort} keyboardType="number-pad" />
      <View style={styles.switchRow}>
        <ThemedText themeColor="textSecondary">Use SSL (IMAPS)</ThemedText>
        <Switch value={useSsl} onValueChange={setUseSsl} />
      </View>
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="App password"
        secureTextEntry
        autoCapitalize="none"
      />
      <TextField
        label="Backfill start date"
        value={syncStartDate}
        onChangeText={setSyncStartDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />

      <ThemedText type="small" themeColor="textSecondary">
        Banks to watch
      </ThemedText>
      {banks.map((bank) => (
        <BankToggleRow
          key={bank.key}
          bank={bank}
          selected={selectedBanks.includes(bank.key)}
          onPress={() => toggleBank(bank.key)}
        />
      ))}

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <PrimaryButton label="Save email server" loading={submitting} onPress={handleSubmit} />
    </Panel>
  );
}

function MailboxCard({
  mailbox,
  banks,
  onChanged,
}: {
  mailbox: MailboxRead;
  banks: BankInfo[];
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [syncing, setSyncing] = useState(false);
  const [busyBankKey, setBusyBankKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleBank(key: string) {
    const nextBanks = mailbox.enabled_banks.includes(key)
      ? mailbox.enabled_banks.filter((item) => item !== key)
      : [...mailbox.enabled_banks, key];
    setBusyBankKey(key);
    setError(null);
    try {
      await api.updateMailbox(mailbox.id, { enabled_banks: nextBanks });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update banks.');
    } finally {
      setBusyBankKey(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await api.syncMailbox(mailbox.id);
      setSyncMessage(`Fetched ${result.fetched} email(s), created ${result.created} transaction(s).`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function toggleActive() {
    setError(null);
    try {
      await api.updateMailbox(mailbox.id, { is_active: !mailbox.is_active });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update mailbox.');
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      await api.deleteMailbox(mailbox.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove mailbox.');
      setRemoving(false);
    }
  }

  return (
    <Panel title={mailbox.email_address} caption={`${mailbox.use_ssl ? 'IMAPS' : 'IMAP'} · ${mailbox.host}:${mailbox.port}`}>
      <RowItem label="Active" value={mailbox.is_active ? 'Yes' : 'No'} />
      <RowItem label="Backfill start" value={mailbox.sync_start_date} />
      <RowItem label="Last synced" value={mailbox.last_synced_at ? shortDate(mailbox.last_synced_at) : 'Never'} />
      {mailbox.last_sync_error ? <RowItem label="Last error" value={mailbox.last_sync_error} danger /> : null}

      <ThemedText type="small" themeColor="textSecondary">
        Banks to watch
      </ThemedText>
      {banks.map((bank) => (
        <BankToggleRow
          key={bank.key}
          bank={bank}
          selected={mailbox.enabled_banks.includes(bank.key)}
          onPress={() => toggleBank(bank.key)}
          disabled={busyBankKey === bank.key}
        />
      ))}

      {syncMessage ? (
        <ThemedText type="small" themeColor="textSecondary">
          {syncMessage}
        </ThemedText>
      ) : null}
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}

      <PrimaryButton label="Sync now" loading={syncing} onPress={handleSync} />
      <PrimaryButton
        label={mailbox.is_active ? 'Pause syncing' : 'Resume syncing'}
        variant="secondary"
        onPress={toggleActive}
      />
      <PrimaryButton label="Remove mailbox" variant="secondary" loading={removing} onPress={handleRemove} />
    </Panel>
  );
}

function AccountCard({ account, onChanged }: { account: AccountRead; onChanged: () => void }) {
  const theme = useTheme();
  const [nickname, setNickname] = useState(account.nickname ?? '');
  const [accountNumber, setAccountNumber] = useState(account.account_number ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.updateAccount(account.id, {
        nickname: nickname.trim() || null,
        account_number: accountNumber.trim() || null,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={account.nickname || account.display_name} caption={account.display_name}>
      <TextField label="Nickname" value={nickname} onChangeText={setNickname} placeholder={account.display_name} />
      <TextField
        label="Account number"
        value={accountNumber}
        onChangeText={setAccountNumber}
        placeholder="Last 4 digits"
      />
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <PrimaryButton label="Save" loading={saving} onPress={handleSave} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#C2433B',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
});
