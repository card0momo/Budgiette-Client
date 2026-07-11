import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Switch } from 'react-native-paper';

import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { AccountRead, api, BankInfo, MailboxRead, NotificationPreferenceRead } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { PushRegistrationResult, registerForPushNotificationsAsync } from '@/lib/push-notifications';
import { registerForWebPushAsync, WebPushRegistrationResult } from '@/lib/web-push';

type RegistrationResult = PushRegistrationResult | WebPushRegistrationResult;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [mailboxes, setMailboxes] = useState<MailboxRead[]>([]);
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [accounts, setAccounts] = useState<AccountRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountRead | null>(null);
  const [addMailboxOpen, setAddMailboxOpen] = useState(false);
  const [selectedMailboxId, setSelectedMailboxId] = useState<number | null>(null);

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

  const selectedMailbox = mailboxes.find((mailbox) => mailbox.id === selectedMailboxId) ?? null;

  return (
    <ScreenShell title="Settings">
      <Panel title="Account" caption="Signed in with Budgiette">
        <RowItem label="Username" value={user?.username ?? '—'} />
        <RowItem label="Email" value={user?.email || '—'} />
        <RowItem label="Full name" value={user?.full_name || '—'} />
        {user ? <RowItem label="Member since" value={shortDate(user.created_at)} /> : null}
        <PrimaryButton label="Log out" variant="secondary" loading={loggingOut} onPress={handleLogout} />
      </Panel>

      <Panel
        title="Email server"
        caption="Connect a mailbox so bank alert emails become transactions automatically">
        {loading ? <ActivityIndicator /> : null}
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        {!loading && mailboxes.length === 0 ? (
          <Pressable onPress={() => setAddMailboxOpen(true)} style={styles.addLink}>
            <ThemedText type="link" themeColor="tint">
              + Add email server
            </ThemedText>
          </Pressable>
        ) : null}

        {mailboxes.map((mailbox) => (
          <MailboxRow key={mailbox.id} mailbox={mailbox} onPress={() => setSelectedMailboxId(mailbox.id)} />
        ))}
      </Panel>

      <Panel title="Bank accounts" caption="Give each auto-created account a nickname or account number">
        {!loading && accounts.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No bank accounts yet — one is created automatically once you enable a bank above.
          </ThemedText>
        ) : null}
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} onPress={() => setSelectedAccount(account)} />
        ))}
      </Panel>

      <NotificationsPanel />

      {addMailboxOpen ? (
        <AddMailboxModal
          banks={banks}
          onClose={() => setAddMailboxOpen(false)}
          onCreated={() => {
            loadAll();
            setAddMailboxOpen(false);
          }}
        />
      ) : null}

      {selectedMailbox ? (
        <MailboxDetailModal
          mailbox={selectedMailbox}
          banks={banks}
          onClose={() => setSelectedMailboxId(null)}
          onChanged={loadAll}
          onRemoved={() => {
            loadAll();
            setSelectedMailboxId(null);
          }}
        />
      ) : null}

      {selectedAccount ? (
        <AccountDetailModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onChanged={() => {
            loadAll();
            setSelectedAccount(null);
          }}
        />
      ) : null}
    </ScreenShell>
  );
}

function NotificationsPanel() {
  const [prefs, setPrefs] = useState<NotificationPreferenceRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<RegistrationResult | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .getNotificationPreferences()
      .then((rows) => {
        if (mounted) setPrefs(rows);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load notification preferences');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleToggle(field: keyof NotificationPreferenceRead, value: boolean) {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [field]: value });
    setError(null);
    try {
      const updated = await api.updateNotificationPreferences({ [field]: value });
      setPrefs(updated);
    } catch (err) {
      setPrefs(previous);
      setError(err instanceof Error ? err.message : 'Could not save preference.');
    }
  }

  async function handleEnableDevice() {
    setRegistering(true);
    setError(null);
    try {
      if (Platform.OS === 'web') {
        const result = await registerForWebPushAsync();
        setRegistration(result);
      } else {
        const result = await registerForPushNotificationsAsync();
        setRegistration(result);
        if ('token' in result) {
          await api.registerPushToken({ token: result.token, platform: result.platform });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register this device.');
    } finally {
      setRegistering(false);
    }
  }

  return (
    <Panel title="Notifications" caption="Choose which alerts you want to receive" collapsible defaultOpen={false}>
      {loading ? <ActivityIndicator /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {prefs ? (
        <>
          <NotificationToggleRow
            label="All push notifications"
            value={prefs.push_enabled}
            onValueChange={(value) => handleToggle('push_enabled', value)}
          />
          <NotificationToggleRow
            label="Budget & spending alerts"
            value={prefs.budget_alerts_enabled}
            onValueChange={(value) => handleToggle('budget_alerts_enabled', value)}
          />
          <NotificationToggleRow
            label="MSI payment reminders"
            value={prefs.msi_reminders_enabled}
            onValueChange={(value) => handleToggle('msi_reminders_enabled', value)}
          />
          <NotificationToggleRow
            label="New transaction alerts"
            value={prefs.ingestion_alerts_enabled}
            onValueChange={(value) => handleToggle('ingestion_alerts_enabled', value)}
          />
          <NotificationToggleRow
            label="Mailbox sync failure alerts"
            value={prefs.sync_failure_alerts_enabled}
            onValueChange={(value) => handleToggle('sync_failure_alerts_enabled', value)}
          />
        </>
      ) : null}

      {registration && 'error' in registration ? (
        <ThemedText type="small" themeColor="textSecondary">
          This device isn&apos;t registered for push yet: {registration.error}
        </ThemedText>
      ) : null}
      <PrimaryButton
        label="Enable notifications on this device"
        variant="secondary"
        loading={registering}
        onPress={handleEnableDevice}
      />
    </Panel>
  );
}

function NotificationToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
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
    <View style={styles.form}>
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
    </View>
  );
}

function AddMailboxModal({
  banks,
  onClose,
  onCreated,
}: {
  banks: BankInfo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Add email server</ThemedText>
              <Pressable onPress={onClose}>
                <ThemedText type="link" themeColor="tint">
                  Close
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              IMAP credentials are encrypted at rest
            </ThemedText>
            <MailboxForm banks={banks} onCreated={onCreated} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MailboxRow({ mailbox, onPress }: { mailbox: MailboxRead; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.accountRow, { borderColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.accountMain}>
        <ThemedText numberOfLines={1}>{mailbox.email_address}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {mailbox.host}:{mailbox.port} · {mailbox.is_active ? 'Active' : 'Paused'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function MailboxDetailModal({
  mailbox,
  banks,
  onClose,
  onChanged,
  onRemoved,
}: {
  mailbox: MailboxRead;
  banks: BankInfo[];
  onClose: () => void;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [busyBankKey, setBusyBankKey] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabledBankNames = banks
    .filter((bank) => mailbox.enabled_banks.includes(bank.key))
    .map((bank) => bank.display_name)
    .join(', ');

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
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove mailbox.');
      setRemoving(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">{mailbox.email_address}</ThemedText>
              <Pressable onPress={onClose}>
                <ThemedText type="link" themeColor="tint">
                  Close
                </ThemedText>
              </Pressable>
            </View>

            <RowItem label="Active" value={mailbox.is_active ? 'Yes' : 'No'} />
            <RowItem label="Host" value={`${mailbox.use_ssl ? 'IMAPS' : 'IMAP'} · ${mailbox.host}:${mailbox.port}`} />
            <RowItem label="Backfill start" value={mailbox.sync_start_date} />
            <RowItem label="Last synced" value={mailbox.last_synced_at ? shortDate(mailbox.last_synced_at) : 'Never'} />
            {mailbox.last_sync_error ? <RowItem label="Last error" value={mailbox.last_sync_error} danger /> : null}
            <RowItem label="Banks" value={enabledBankNames || 'None selected'} />

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

            <PrimaryButton label="Sync now" variant="secondary" loading={syncing} onPress={handleSync} />

            {!editing ? (
              <PrimaryButton label="Edit" variant="secondary" onPress={() => setEditing(true)} />
            ) : (
              <>
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

                <PrimaryButton
                  label={mailbox.is_active ? 'Pause syncing' : 'Resume syncing'}
                  variant="secondary"
                  onPress={toggleActive}
                />
                <PrimaryButton label="Remove mailbox" variant="secondary" loading={removing} onPress={handleRemove} />
                <PrimaryButton label="Done" variant="secondary" onPress={() => setEditing(false)} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AccountRow({ account, onPress }: { account: AccountRead; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.accountRow, { borderColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.accountMain}>
        <ThemedText numberOfLines={1}>{account.nickname || account.display_name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {account.display_name}
          {account.account_number ? ` · ${account.account_number}` : ''}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function AccountDetailModal({
  account,
  onClose,
  onChanged,
}: {
  account: AccountRead;
  onClose: () => void;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(account.nickname ?? '');
  const [accountNumber, setAccountNumber] = useState(account.account_number ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStartEditing() {
    setNickname(account.nickname ?? '');
    setAccountNumber(account.account_number ?? '');
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
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
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">{account.nickname || account.display_name}</ThemedText>
              <Pressable onPress={onClose}>
                <ThemedText type="link" themeColor="tint">
                  Close
                </ThemedText>
              </Pressable>
            </View>

            {!editing ? (
              <>
                <RowItem label="Bank" value={account.display_name} />
                <RowItem label="Nickname" value={account.nickname || '—'} />
                <RowItem label="Account number" value={account.account_number || '—'} />

                {error ? (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {error}
                  </ThemedText>
                ) : null}

                <PrimaryButton label="Edit" variant="secondary" onPress={handleStartEditing} />
              </>
            ) : (
              <>
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

                <PrimaryButton label="Save changes" loading={saving} onPress={handleSave} />
                <PrimaryButton label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#C2433B',
  },
  form: {
    gap: 10,
  },
  addLink: {
    alignSelf: 'flex-start',
    marginBottom: 2,
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
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accountMain: {
    flex: 1,
    gap: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '85%',
  },
  modalContent: {
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
});
