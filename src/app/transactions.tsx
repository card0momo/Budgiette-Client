import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { api, TransactionRead } from '@/lib/api';
import { money, shortDate } from '@/lib/format';

export default function TransactionsScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<TransactionRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const rows = await api.listTransactions();
        if (mounted) setItems(rows);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load transactions');
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
    return items.reduce(
      (acc, tx) => {
        const amount = Number(tx.amount);
        if (tx.direction === 'income') acc.income += amount;
        else acc.expenses += amount;
        return acc;
      },
      { income: 0, expenses: 0 }
    );
  }, [items]);

  return (
    <ScreenShell title="Transactions" subtitle="Income and expense feed parsed from your banking alerts.">
      <Panel title="Totals" caption="Current loaded dataset">
        <RowItem label="Income" value={money(totals.income)} />
        <RowItem label="Expenses" value={money(totals.expenses)} />
      </Panel>

      {loading ? <ActivityIndicator color={theme.text} /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {items.map((tx) => (
        <Panel key={tx.id} title={tx.merchant_name} caption={tx.description || 'No description'}>
          <RowItem label="Amount" value={money(tx.amount)} danger={tx.direction === 'expense'} />
          <RowItem label="Direction" value={tx.direction} />
          <RowItem label="Date" value={shortDate(tx.occurred_at)} />
          <RowItem label="Source" value={tx.source} />
        </Panel>
      ))}

      {!loading && items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ThemedText themeColor="textSecondary">
            No transactions yet. Once IMAP parsing starts, this feed will auto-populate.
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
  emptyWrap: {
    paddingVertical: 20,
  },
});
