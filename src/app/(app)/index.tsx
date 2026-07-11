import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { api, BudgetStatus, NotificationRead, TransactionRead } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { getMerchantEmoji } from '@/lib/merchant-icons';

// Fixed chart hues — validated with the dataviz palette checker against both the
// light (#F8F4EE) and dark (#101A24) app surfaces, so the pair stays mode-invariant
// rather than switching to the UI's dark-mode tint/danger (tuned for text contrast,
// not chart-fill lightness bands).
const CHART_COLORS = { income: '#3C87F7', expense: '#C2433B' } as const;
const CHART_MONTHS = 6;
const BAR_MAX_HEIGHT = 90;

type MonthBucket = { key: string; label: string; income: number; expense: number };

export default function DashboardScreen() {
  const theme = useTheme();
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

  const monthlyTotals = useMemo(() => buildMonthlyTotals(transactions), [transactions]);

  // The backend already returns transactions ordered by occurred_at desc.
  const latestTransaction = transactions[0] ?? null;

  const budgetOverruns = budgets.filter((b) => b.is_over_limit).length;

  return (
    <ScreenShell
      title="Budgiette"
      subtitle="Personal finance cockpit for transactions, budgets, MSI and alerts.">
      <Panel title="Overview" caption="Live totals from your current transaction feed">
        <RowItem label="Income" value={money(totals.income)} />
        <RowItem label="Expenses" value={money(totals.expense)} danger={totals.expense > totals.income} />
        <RowItem label="Net" value={money(totals.income - totals.expense)} danger={totals.expense > totals.income} />
      </Panel>

      <Panel title="Monthly income vs expense" caption={`Last ${CHART_MONTHS} months`}>
        <MonthlyChart months={monthlyTotals} />
      </Panel>

      {latestTransaction ? (
        <Panel title="Latest transaction" caption={shortDate(latestTransaction.occurred_at)}>
          <View style={styles.latestRow}>
            <ThemedText style={styles.latestEmoji}>
              {getMerchantEmoji(latestTransaction.merchant_name, latestTransaction.description)}
            </ThemedText>
            <View style={styles.latestMain}>
              <ThemedText numberOfLines={1}>{latestTransaction.merchant_name}</ThemedText>
              {latestTransaction.description ? (
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {latestTransaction.description}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText style={{ color: latestTransaction.direction === 'expense' ? theme.danger : theme.text }}>
              {latestTransaction.direction === 'expense' ? '-' : '+'}
              {money(latestTransaction.amount)}
            </ThemedText>
          </View>
        </Panel>
      ) : null}

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

function buildMonthlyTotals(transactions: TransactionRead[]): MonthBucket[] {
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = CHART_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      income: 0,
      expense: 0,
    });
  }

  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const tx of transactions) {
    const occurred = new Date(tx.occurred_at);
    const bucket = byKey.get(`${occurred.getFullYear()}-${occurred.getMonth()}`);
    if (!bucket) continue;
    const amount = Number(tx.amount);
    if (tx.direction === 'income') bucket.income += amount;
    else bucket.expense += amount;
  }

  return months;
}

function MonthlyChart({ months }: { months: MonthBucket[] }) {
  const theme = useTheme();
  const maxValue = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const latestIndex = months.length - 1;

  return (
    <View>
      <View style={styles.legendRow}>
        <LegendSwatch color={CHART_COLORS.income} label="Income" />
        <LegendSwatch color={CHART_COLORS.expense} label="Expense" />
      </View>

      <View style={[styles.chartRow, { borderBottomColor: theme.backgroundSelected }]}>
        {months.map((month, index) => (
          <View key={month.key} style={styles.chartGroup}>
            <View style={styles.barPair}>
              <ChartBar
                height={(month.income / maxValue) * BAR_MAX_HEIGHT}
                color={CHART_COLORS.income}
                label={index === latestIndex ? money(month.income) : undefined}
              />
              <ChartBar
                height={(month.expense / maxValue) * BAR_MAX_HEIGHT}
                color={CHART_COLORS.expense}
                label={index === latestIndex ? money(month.expense) : undefined}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {month.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function ChartBar({ height, color, label }: { height: number; color: string; label?: string }) {
  return (
    <View style={styles.barWrap}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel} numberOfLines={1}>
          {label}
        </ThemedText>
      ) : null}
      <View style={[styles.bar, { height: Math.max(height, 2), backgroundColor: color }]} />
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#C2433B',
  },
  tipBox: {
    paddingBottom: 22,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingTop: 8,
    paddingBottom: 6,
  },
  chartGroup: {
    alignItems: 'center',
    gap: 4,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barWrap: {
    alignItems: 'center',
  },
  bar: {
    width: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontSize: 9,
    marginBottom: 2,
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  latestEmoji: {
    fontSize: 22,
  },
  latestMain: {
    flex: 1,
    gap: 2,
  },
});
