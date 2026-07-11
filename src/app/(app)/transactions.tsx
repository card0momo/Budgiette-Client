import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { Chip, MenuField, Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useIsWideScreen } from '@/hooks/use-is-wide-screen';
import { useTheme } from '@/hooks/use-theme';
import { api, CategoryRead, TransactionDirection, TransactionRead } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { getMerchantEmoji } from '@/lib/merchant-icons';

type CategoryFilter = 'all' | 'uncategorized' | number;
type DateFilter = 'all' | 'month' | '30d';

const PAGE_SIZE = 25;

export default function TransactionsScreen() {
  const theme = useTheme();
  const isWide = useIsWideScreen();
  const showGrid = Platform.OS === 'web' && isWide;
  const [items, setItems] = useState<TransactionRead[]>([]);
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [directionFilter, setDirectionFilter] = useState<'all' | TransactionDirection>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TransactionRead | null>(null);
  const [page, setPage] = useState(1);

  async function loadAll() {
    try {
      const [txRows, catRows] = await Promise.all([api.listTransactions(), api.listCategories()]);
      setItems(txRows);
      setCategories(catRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);

  const categoryFilterLabel = useMemo(() => {
    if (categoryFilter === 'all') return 'All';
    if (categoryFilter === 'uncategorized') return 'Uncategorized';
    return categoryById.get(categoryFilter)?.name ?? 'All';
  }, [categoryFilter, categoryById]);

  const filtered = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const query = search.trim().toLowerCase();

    return items.filter((tx) => {
      if (directionFilter !== 'all' && tx.direction !== directionFilter) return false;
      if (categoryFilter === 'uncategorized' && tx.category_id != null) return false;
      if (typeof categoryFilter === 'number' && tx.category_id !== categoryFilter) return false;
      if (dateFilter === 'month' && new Date(tx.occurred_at).getTime() < monthStart.getTime()) return false;
      if (dateFilter === '30d' && new Date(tx.occurred_at).getTime() < thirtyDaysAgoMs) return false;
      if (query && !`${tx.merchant_name} ${tx.description}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [items, directionFilter, categoryFilter, dateFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [directionFilter, categoryFilter, dateFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, tx) => {
        const amount = Number(tx.amount);
        if (tx.direction === 'income') acc.income += amount;
        else acc.expenses += amount;
        return acc;
      },
      { income: 0, expenses: 0 }
    );
  }, [filtered]);

  function handleSaved(updated: TransactionRead) {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelected(null);
  }

  function handleCategoryCreated(category: CategoryRead) {
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
  }

  return (
    <ScreenShell title="Transactions" subtitle="Income and expense feed parsed from your banking alerts.">
      <Panel title="Totals" caption="Matches the filters below" collapsible defaultOpen={false}>
        <RowItem label="Income" value={money(totals.income)} />
        <RowItem label="Expenses" value={money(totals.expenses)} />
      </Panel>

      <Panel title="Filters" caption="Narrow down the feed" collapsible defaultOpen={false}>
        <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Merchant or description" />

        <ThemedText type="small" themeColor="textSecondary">
          Type
        </ThemedText>
        <View style={styles.chipRow}>
          <Chip label="All" selected={directionFilter === 'all'} onPress={() => setDirectionFilter('all')} />
          <Chip label="Income" selected={directionFilter === 'income'} onPress={() => setDirectionFilter('income')} />
          <Chip label="Expense" selected={directionFilter === 'expense'} onPress={() => setDirectionFilter('expense')} />
        </View>

        <MenuField
          label="Category"
          valueLabel={categoryFilterLabel}
          selectedValue={categoryFilter}
          onSelect={setCategoryFilter}
          options={[
            { value: 'all' as CategoryFilter, label: 'All' },
            { value: 'uncategorized' as CategoryFilter, label: 'Uncategorized' },
            ...categories.map((cat) => ({ value: cat.id as CategoryFilter, label: cat.name })),
          ]}
        />

        <ThemedText type="small" themeColor="textSecondary">
          When
        </ThemedText>
        <View style={styles.chipRow}>
          <Chip label="All time" selected={dateFilter === 'all'} onPress={() => setDateFilter('all')} />
          <Chip label="This month" selected={dateFilter === 'month'} onPress={() => setDateFilter('month')} />
          <Chip label="Last 30 days" selected={dateFilter === '30d'} onPress={() => setDateFilter('30d')} />
        </View>
      </Panel>

      {loading ? <ActivityIndicator color={theme.text} /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Panel title="Transactions" caption={`${filtered.length} of ${items.length}`}>
        <View style={showGrid ? styles.transactionGrid : undefined}>
          {pagedItems.map((tx) => (
            <View key={tx.id} style={showGrid ? styles.transactionGridItem : undefined}>
              <TransactionRow
                transaction={tx}
                category={tx.category_id != null ? categoryById.get(tx.category_id) : undefined}
                onPress={() => setSelected(tx)}
                grid={showGrid}
              />
            </View>
          ))}
        </View>
        {!loading && filtered.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            {items.length === 0
              ? 'No transactions yet. Once IMAP parsing starts, this feed will auto-populate.'
              : 'No transactions match these filters.'}
          </ThemedText>
        ) : null}
        {pageCount > 1 ? (
          <View style={styles.pagerRow}>
            <PrimaryButton
              label="Previous"
              variant="secondary"
              disabled={currentPage <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            />
            <ThemedText type="small" themeColor="textSecondary">
              Page {currentPage} of {pageCount}
            </ThemedText>
            <PrimaryButton
              label="Next"
              variant="secondary"
              disabled={currentPage >= pageCount}
              onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
            />
          </View>
        ) : null}
      </Panel>

      {selected ? (
        <TransactionDetailModal
          transaction={selected}
          categories={categories}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onCategoryCreated={handleCategoryCreated}
        />
      ) : null}
    </ScreenShell>
  );
}

function TransactionRow({
  transaction,
  category,
  onPress,
  grid = false,
}: {
  transaction: TransactionRead;
  category?: CategoryRead;
  onPress: () => void;
  grid?: boolean;
}) {
  const theme = useTheme();
  const emoji = getMerchantEmoji(transaction.merchant_name, transaction.description);
  const isExpense = transaction.direction === 'expense';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        grid ? styles.rowGrid : styles.row,
        { borderColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText style={styles.rowEmoji}>{emoji}</ThemedText>
      <View style={styles.rowMain}>
        <ThemedText numberOfLines={1}>{transaction.merchant_name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {shortDate(transaction.occurred_at)}
          {category ? ` · ${category.name}` : ''}
        </ThemedText>
      </View>
      <ThemedText style={{ color: isExpense ? theme.danger : theme.text }}>
        {isExpense ? '-' : '+'}
        {money(transaction.amount)}
      </ThemedText>
    </Pressable>
  );
}

function TransactionDetailModal({
  transaction,
  categories,
  onClose,
  onSaved,
  onCategoryCreated,
}: {
  transaction: TransactionRead;
  categories: CategoryRead[];
  onClose: () => void;
  onSaved: (updated: TransactionRead) => void;
  onCategoryCreated: (category: CategoryRead) => void;
}) {
  const theme = useTheme();
  const [merchantName, setMerchantName] = useState(transaction.merchant_name);
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(transaction.amount);
  const [direction, setDirection] = useState<TransactionDirection>(transaction.direction);
  const [occurredAt, setOccurredAt] = useState(transaction.occurred_at.slice(0, 16));
  const [categoryId, setCategoryId] = useState<number | null>(transaction.category_id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    setError(null);
    try {
      const category = await api.createCategory({
        name: newCategoryName.trim(),
        is_income: direction === 'income',
      });
      onCategoryCreated(category);
      setCategoryId(category.id);
      setNewCategoryName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category.');
    } finally {
      setAddingCategory(false);
    }
  }

  function validate(): string | null {
    if (!merchantName.trim()) return 'Enter a merchant name.';
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return 'Enter a valid amount.';
    if (Number.isNaN(new Date(occurredAt).getTime())) return 'Enter a valid date and time.';
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
      const updated = await api.updateTransaction(transaction.id, {
        merchant_name: merchantName.trim(),
        description: description.trim(),
        amount,
        direction,
        occurred_at: occurredAt,
        category_id: categoryId,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save transaction.');
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
              <ThemedText type="subtitle">
                {getMerchantEmoji(merchantName, description)} Transaction
              </ThemedText>
              <Pressable onPress={onClose}>
                <ThemedText type="link" themeColor="tint">
                  Close
                </ThemedText>
              </Pressable>
            </View>

            <RowItem label="Source" value={transaction.source} />

            <TextField label="Merchant" value={merchantName} onChangeText={setMerchantName} />
            <TextField label="Description" value={description} onChangeText={setDescription} />
            <TextField label="Amount" value={String(amount)} onChangeText={setAmount} keyboardType="decimal-pad" />
            <TextField
              label="Date & time"
              value={occurredAt}
              onChangeText={setOccurredAt}
              placeholder="YYYY-MM-DDTHH:MM"
              autoCapitalize="none"
            />

            <ThemedText type="small" themeColor="textSecondary">
              Type
            </ThemedText>
            <View style={styles.chipRow}>
              <Chip label="Expense" selected={direction === 'expense'} onPress={() => setDirection('expense')} />
              <Chip label="Income" selected={direction === 'income'} onPress={() => setDirection('income')} />
            </View>

            <MenuField
              label="Category"
              valueLabel={categoryId == null ? 'Uncategorized' : categories.find((cat) => cat.id === categoryId)?.name ?? 'Uncategorized'}
              selectedValue={categoryId}
              onSelect={setCategoryId}
              options={[
                { value: null as number | null, label: 'Uncategorized' },
                ...categories.map((cat) => ({ value: cat.id as number | null, label: cat.name })),
              ]}
            />

            <View style={styles.newCategoryRow}>
              <View style={styles.newCategoryInput}>
                <TextField
                  label="New category"
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="e.g. Food"
                />
              </View>
              <PrimaryButton label="Add" variant="secondary" loading={addingCategory} onPress={handleAddCategory} />
            </View>

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}

            <PrimaryButton label="Save changes" loading={saving} onPress={handleSave} />
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
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  transactionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transactionGridItem: {
    width: '50%',
  },
  rowEmoji: {
    fontSize: 20,
  },
  rowMain: {
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
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  newCategoryInput: {
    flex: 1,
  },
});
