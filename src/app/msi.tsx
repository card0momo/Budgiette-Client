import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { api, MSIPlanRead } from '@/lib/api';
import { money, shortDate } from '@/lib/format';

export default function MSIScreen() {
  const theme = useTheme();
  const [plans, setPlans] = useState<MSIPlanRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const rows = await api.listMSIPlans();
        if (mounted) setPlans(rows);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load MSI plans');
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
    <ScreenShell title="MSI Plans" subtitle="Meses sin intereses tracker with remaining balance and progress.">
      {loading ? <ActivityIndicator color={theme.text} /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {plans.map((plan) => (
        <Panel key={plan.id} title={plan.purchase_name} caption={`Started ${shortDate(plan.start_date)}`}>
          <RowItem label="Total" value={money(plan.total_amount)} />
          <RowItem label="Monthly" value={money(plan.monthly_payment)} />
          <RowItem label="Months" value={`${plan.payments_done}/${plan.months_total}`} />
          <RowItem label="Left to pay" value={money(plan.remaining_balance)} />
        </Panel>
      ))}

      {!loading && plans.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No MSI plans yet. Add plans from your purchases and payments to monitor debt commitments.
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
