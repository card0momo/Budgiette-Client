import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { APP_ENV } from '@/lib/config';
import { api, BudgetStatus, NotificationRead, TransactionRead } from '@/lib/api';
import { money } from '@/lib/format';

export default function DashboardScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState('unknown');
  const [transactions, setTransactions] = useState<TransactionRead[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [notifications, setNotifications] = useState<NotificationRead[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [health, txRows, budgetRows, notificationRows] = await Promise.all([
          api.health(),
          api.listTransactions(),
          api.listBudgetStatus(),
          api.listNotifications(),
        ]);
        if (!mounted) return;
        setHealthStatus(health.status);
        setTransactions(txRows);
        setBudgets(budgetRows);
        setNotifications(notificationRows);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
          setHealthStatus('offline');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        const amount = Number(tx.amount);
        if (tx.direction === 'income') acc.income += amount;
        else acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const budgetOverruns = budgets.filter((b) => b.is_over_limit).length;

  return (
    <ScreenShell
      title="Budgiette"
      subtitle="Personal finance cockpit for transactions, budgets, MSI and alerts.">
      <Panel title="Connection" caption="Backend and user context">
        <RowItem label="API" value={APP_ENV.apiBaseUrl} />
        <RowItem label="Signed in as" value={user?.username ?? '—'} />
        <RowItem label="Health" value={healthStatus} danger={healthStatus !== 'ok'} />
      </Panel>

      <Panel title="Overview" caption="Live totals from your current transaction feed">
        <RowItem label="Income" value={money(totals.income)} />
        <RowItem label="Expenses" value={money(totals.expense)} danger={totals.expense > totals.income} />
        <RowItem label="Net" value={money(totals.income - totals.expense)} danger={totals.expense > totals.income} />
      </Panel>

      <Panel title="Signals" caption="Behavior flags from budget and notification modules">
        <RowItem label="Over-limit budgets" value={String(budgetOverruns)} danger={budgetOverruns > 0} />
        <RowItem label="Unread alerts" value={String(notifications.filter((n) => !n.is_read).length)} />
      </Panel>

      {loading ? <ActivityIndicator color={theme.text} /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {healthStatus !== 'ok' ? (
        <View style={styles.tipBox}>
          <ThemedText themeColor="textSecondary">
            API is not reachable yet. Once your backend is deployed at budgietteapi.cardomomo.icu,
            these cards populate automatically.
          </ThemedText>
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#C2433B',
  },
  tipBox: {
    paddingBottom: 22,
  },
});
