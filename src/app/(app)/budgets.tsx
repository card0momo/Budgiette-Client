import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { api, BudgetStatus } from '@/lib/api';
import { money, shortDate } from '@/lib/format';

export default function BudgetsScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const rows = await api.listBudgetStatus();
        if (mounted) setItems(rows);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load budgets');
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
    <ScreenShell title="Budgets" subtitle="Weekly, monthly, and yearly budget compliance.">
      {loading ? <ActivityIndicator color={theme.text} /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {items.map((budget) => (
        <Panel key={budget.id} title={budget.name} caption={`Period: ${budget.period}`}>
          <RowItem label="Limit" value={money(budget.limit_amount)} />
          <RowItem label="Spent" value={money(budget.spent)} />
          <RowItem label="Remaining" value={money(budget.remaining)} danger={budget.is_over_limit} />
          <RowItem label="Starts" value={shortDate(budget.starts_on)} />
        </Panel>
      ))}

      {!loading && items.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No active budgets yet. Create one in the backend first, then this screen will show status.
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
