import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons } from 'react-native-paper';

import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { MenuField, Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { api, BudgetPeriod, BudgetRead, BudgetStatus, CategoryRead } from '@/lib/api';
import { money, shortDate } from '@/lib/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PERIOD_OPTIONS: { value: BudgetPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

type CategoryOption = { value: number | null; label: string };

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<BudgetRead[]>([]);
  const [statusRows, setStatusRows] = useState<BudgetStatus[]>([]);
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [budgetRows, statusList, categoryRows] = await Promise.all([
        api.listBudgets(),
        api.listBudgetStatus(),
        api.listCategories(),
      ]);
      setBudgets(budgetRows);
      setStatusRows(statusList);
      setCategories(categoryRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const statusById = new Map(statusRows.map((item) => [item.id, item]));
  const categoryOptions: CategoryOption[] = [
    { value: null, label: 'No category' },
    ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
  ];

  return (
    <ScreenShell title="Budgets">
      <Panel title="Add budget" caption="Set a spending limit for a period" collapsible defaultOpen={false}>
        <BudgetForm categoryOptions={categoryOptions} onCreated={loadAll} />
      </Panel>

      {loading ? <ActivityIndicator /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {budgets.map((budget) => (
        <BudgetCard
          key={budget.id}
          budget={budget}
          status={statusById.get(budget.id)}
          categoryOptions={categoryOptions}
          onChanged={loadAll}
        />
      ))}

      {!loading && budgets.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No budgets yet. Add one above to start tracking spend against a limit.
        </ThemedText>
      ) : null}
    </ScreenShell>
  );
}

function PeriodPicker({ value, onChange }: { value: BudgetPeriod; onChange: (value: BudgetPeriod) => void }) {
  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        Period
      </ThemedText>
      <SegmentedButtons value={value} onValueChange={(next) => onChange(next as BudgetPeriod)} buttons={PERIOD_OPTIONS} />
    </>
  );
}

function BudgetForm({
  categoryOptions,
  onCreated,
}: {
  categoryOptions: CategoryOption[];
  onCreated: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [period, setPeriod] = useState<BudgetPeriod>('month');
  const [limitAmount, setLimitAmount] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return 'Enter a budget name.';
    const amount = Number(limitAmount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid limit amount.';
    if (!DATE_RE.test(startsOn)) return 'Enter the start date as YYYY-MM-DD.';
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
      await api.createBudget({
        name: name.trim(),
        category_id: categoryId,
        period,
        limit_amount: limitAmount,
        starts_on: startsOn,
      });
      setName('');
      setCategoryId(null);
      setPeriod('month');
      setLimitAmount('');
      setStartsOn('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create budget.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Groceries" />

      <MenuField
        label="Category"
        valueLabel={categoryOptions.find((opt) => opt.value === categoryId)?.label ?? 'No category'}
        selectedValue={categoryId}
        onSelect={setCategoryId}
        options={categoryOptions}
      />

      <PeriodPicker value={period} onChange={setPeriod} />

      <TextField
        label="Limit amount"
        value={limitAmount}
        onChangeText={setLimitAmount}
        keyboardType="decimal-pad"
        placeholder="e.g. 500"
      />
      <TextField
        label="Start date"
        value={startsOn}
        onChangeText={setStartsOn}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <PrimaryButton label="Add budget" loading={submitting} onPress={handleSubmit} />
    </View>
  );
}

function BudgetCard({
  budget,
  status,
  categoryOptions,
  onChanged,
}: {
  budget: BudgetRead;
  status?: BudgetStatus;
  categoryOptions: CategoryOption[];
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(budget.name);
  const [categoryId, setCategoryId] = useState<number | null>(budget.category_id);
  const [period, setPeriod] = useState<BudgetPeriod>(budget.period);
  const [limitAmount, setLimitAmount] = useState(budget.limit_amount);
  const [startsOn, setStartsOn] = useState(budget.starts_on);
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return 'Enter a budget name.';
    const amount = Number(limitAmount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid limit amount.';
    if (!DATE_RE.test(startsOn)) return 'Enter the start date as YYYY-MM-DD.';
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.updateBudget(budget.id, {
        name: name.trim(),
        category_id: categoryId,
        period,
        limit_amount: limitAmount,
        starts_on: startsOn,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budget.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setTogglingActive(true);
    setError(null);
    try {
      await api.updateBudget(budget.id, { is_active: !budget.is_active });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update budget.');
    } finally {
      setTogglingActive(false);
    }
  }

  async function handleDelete() {
    setRemoving(true);
    setError(null);
    try {
      await api.deleteBudget(budget.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete budget.');
      setRemoving(false);
    }
  }

  return (
    <Panel title={budget.name} caption={budget.is_active ? `${budget.period} budget` : `${budget.period} budget · Paused`}>
      {status ? (
        <>
          <RowItem label="Spent" value={money(status.spent)} />
          <RowItem label="Remaining" value={money(status.remaining)} danger={status.is_over_limit} />
        </>
      ) : null}
      <RowItem label="Starts" value={shortDate(budget.starts_on)} />

      <TextField label="Name" value={name} onChangeText={setName} />

      <MenuField
        label="Category"
        valueLabel={categoryOptions.find((opt) => opt.value === categoryId)?.label ?? 'No category'}
        selectedValue={categoryId}
        onSelect={setCategoryId}
        options={categoryOptions}
      />

      <PeriodPicker value={period} onChange={setPeriod} />

      <TextField label="Limit amount" value={limitAmount} onChangeText={setLimitAmount} keyboardType="decimal-pad" />
      <TextField
        label="Start date"
        value={startsOn}
        onChangeText={setStartsOn}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}

      <PrimaryButton label="Save changes" loading={saving} onPress={handleSave} />
      <PrimaryButton
        label={budget.is_active ? 'Pause budget' : 'Resume budget'}
        variant="secondary"
        loading={togglingActive}
        onPress={toggleActive}
      />
      <PrimaryButton label="Delete budget" variant="secondary" loading={removing} onPress={handleDelete} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#C2433B',
  },
  form: {
    gap: 10,
  },
});
