import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { MenuField, Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useIsWideScreen } from '@/hooks/use-is-wide-screen';
import { useTheme } from '@/hooks/use-theme';
import { api, CardRead, MSIPaymentRead, MSIPlanRead } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { getMerchantEmoji } from '@/lib/merchant-icons';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RECENT_PAYMENTS_COUNT = 3;

type CardOption = { value: number | null; label: string };
type PaymentFilters = { search: string; cardId: number | 'all'; from: string; to: string };
const EMPTY_PAYMENT_FILTERS: PaymentFilters = { search: '', cardId: 'all', from: '', to: '' };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MSIScreen() {
  const theme = useTheme();
  const isWide = useIsWideScreen();
  const [plans, setPlans] = useState<MSIPlanRead[]>([]);
  const [cards, setCards] = useState<CardRead[]>([]);
  const [payments, setPayments] = useState<MSIPaymentRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<MSIPlanRead | null>(null);

  const [paymentFilters, setPaymentFilters] = useState<PaymentFilters>(EMPTY_PAYMENT_FILTERS);
  const [paymentsExpanded, setPaymentsExpanded] = useState(false);
  const [allPaymentsOpen, setAllPaymentsOpen] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);

  async function loadAll() {
    try {
      const [planRows, cardRows, paymentRows] = await Promise.all([
        api.listMSIPlans(),
        api.listCards(),
        api.listAllMSIPayments(),
      ]);
      setPlans(planRows);
      setCards(cardRows);
      setPayments(paymentRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MSI plans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const cardOptions: CardOption[] = [
    { value: null, label: 'No card' },
    ...cards.map((card) => ({ value: card.id, label: `${card.nickname} ·${card.last4}` })),
  ];
  const filterCardOptions: { value: number | 'all'; label: string }[] = [
    { value: 'all', label: 'All cards' },
    ...cards.map((card) => ({ value: card.id, label: `${card.nickname} ·${card.last4}` })),
  ];

  const hasActiveFilters =
    paymentFilters.search.trim() !== '' ||
    paymentFilters.cardId !== 'all' ||
    paymentFilters.from !== '' ||
    paymentFilters.to !== '';

  const filteredPayments = payments.filter((payment) => {
    const plan = planById.get(payment.msi_plan_id);
    if (paymentFilters.search.trim()) {
      const query = paymentFilters.search.trim().toLowerCase();
      if (!plan || !plan.purchase_name.toLowerCase().includes(query)) return false;
    }
    if (paymentFilters.cardId !== 'all' && plan?.card_id !== paymentFilters.cardId) return false;
    if (paymentFilters.from && payment.paid_on < paymentFilters.from) return false;
    if (paymentFilters.to && payment.paid_on > paymentFilters.to) return false;
    return true;
  });
  const visiblePayments =
    isWide && paymentsExpanded ? filteredPayments : filteredPayments.slice(0, RECENT_PAYMENTS_COUNT);

  function handleExpandPress() {
    if (isWide) {
      setPaymentsExpanded((value) => !value);
    } else {
      setAllPaymentsOpen(true);
    }
  }

  function handleApplyFilters(next: PaymentFilters) {
    setPaymentFilters(next);
    if (isWide) setPaymentsExpanded(true);
    setFiltersModalOpen(false);
  }

  function handleClearFilters() {
    setPaymentFilters(EMPTY_PAYMENT_FILTERS);
    setFiltersModalOpen(false);
  }

  function cardForPayment(payment: MSIPaymentRead): CardRead | undefined {
    const plan = planById.get(payment.msi_plan_id);
    return plan?.card_id != null ? cardById.get(plan.card_id) : undefined;
  }

  return (
    <ScreenShell title="MSI Plans" subtitle="Meses sin intereses tracker with remaining balance and progress.">
      <Panel title="Cards" caption="Cards you pay MSI plans with" collapsible defaultOpen={false}>
        <CardForm onCreated={loadAll} />
      </Panel>

      {cards.map((card) => (
        <CardCard key={card.id} card={card} onChanged={loadAll} />
      ))}

      <Panel title="Add MSI plan" caption="Set up a new payment plan" collapsible defaultOpen={false}>
        <PlanForm cardOptions={cardOptions} onCreated={loadAll} />
      </Panel>

      {loading ? <ActivityIndicator color={theme.text} /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Panel title="Plans" caption={`${plans.length} plan(s)`}>
        {plans.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            card={plan.card_id != null ? cardById.get(plan.card_id) : undefined}
            onPress={() => setSelectedPlan(plan)}
          />
        ))}

        {!loading && plans.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No MSI plans yet. Add plans from your purchases and payments to monitor debt commitments.
          </ThemedText>
        ) : null}
      </Panel>

      <Panel title="Payments Done" caption={`${payments.length} payment(s) recorded`}>
        <View style={styles.paymentsHeader}>
          <Pressable onPress={handleExpandPress}>
            <ThemedText type="link" themeColor="tint">
              {isWide && paymentsExpanded ? 'Show recent' : 'Expand all'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setFiltersModalOpen(true)}>
            <ThemedText type="link" themeColor={hasActiveFilters ? 'tint' : 'textSecondary'}>
              {hasActiveFilters ? 'Filters ●' : 'Filters'}
            </ThemedText>
          </Pressable>
        </View>

        {visiblePayments.map((payment) => (
          <PaymentRow
            key={payment.id}
            payment={payment}
            plan={planById.get(payment.msi_plan_id)}
            card={cardForPayment(payment)}
          />
        ))}

        {payments.length === 0 ? (
          <ThemedText themeColor="textSecondary">No payments registered yet.</ThemedText>
        ) : filteredPayments.length === 0 ? (
          <ThemedText themeColor="textSecondary">No payments match these filters.</ThemedText>
        ) : null}
      </Panel>

      {allPaymentsOpen ? (
        <AllPaymentsModal
          payments={filteredPayments}
          planById={planById}
          cardById={cardById}
          hasActiveFilters={hasActiveFilters}
          onOpenFilters={() => setFiltersModalOpen(true)}
          onClose={() => setAllPaymentsOpen(false)}
        />
      ) : null}

      {filtersModalOpen ? (
        <PaymentsFilterModal
          filters={paymentFilters}
          cardOptions={filterCardOptions}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          onClose={() => setFiltersModalOpen(false)}
        />
      ) : null}

      {selectedPlan ? (
        <PlanDetailModal
          plan={selectedPlan}
          card={selectedPlan.card_id != null ? cardById.get(selectedPlan.card_id) : undefined}
          cardOptions={cardOptions}
          onClose={() => setSelectedPlan(null)}
          onChanged={() => {
            loadAll();
            setSelectedPlan(null);
          }}
        />
      ) : null}
    </ScreenShell>
  );
}

function CardForm({ onCreated }: { onCreated: () => void }) {
  const theme = useTheme();
  const [nickname, setNickname] = useState('');
  const [network, setNetwork] = useState('');
  const [last4, setLast4] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!nickname.trim()) return 'Enter a card nickname.';
    if (!network.trim()) return 'Enter the card network (Visa, Mastercard, Amex...).';
    if (!/^\d{4}$/.test(last4)) return 'Enter the last 4 digits.';
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
      await api.createCard({ nickname: nickname.trim(), network: network.trim(), last4 });
      setNickname('');
      setNetwork('');
      setLast4('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create card.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField label="Nickname" value={nickname} onChangeText={setNickname} placeholder="e.g. BBVA Azul" />
      <TextField label="Network" value={network} onChangeText={setNetwork} placeholder="Visa, Mastercard, Amex..." />
      <TextField
        label="Last 4 digits"
        value={last4}
        onChangeText={setLast4}
        placeholder="1234"
        keyboardType="number-pad"
        maxLength={4}
      />

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <PrimaryButton label="Add card" loading={submitting} onPress={handleSubmit} />
    </View>
  );
}

function CardCard({ card, onChanged }: { card: CardRead; onChanged: () => void }) {
  const theme = useTheme();
  const [nickname, setNickname] = useState(card.nickname);
  const [network, setNetwork] = useState(card.network);
  const [last4, setLast4] = useState(card.last4);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!nickname.trim() || !network.trim() || !/^\d{4}$/.test(last4)) {
      setError('Fill in nickname, network, and 4-digit last4.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.updateCard(card.id, { nickname: nickname.trim(), network: network.trim(), last4 });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save card.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setRemoving(true);
    setError(null);
    try {
      await api.deleteCard(card.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete card.');
      setRemoving(false);
    }
  }

  return (
    <Panel title={card.nickname} caption={`${card.network} ·${card.last4}`}>
      <TextField label="Nickname" value={nickname} onChangeText={setNickname} />
      <TextField label="Network" value={network} onChangeText={setNetwork} />
      <TextField label="Last 4 digits" value={last4} onChangeText={setLast4} keyboardType="number-pad" maxLength={4} />

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}

      <PrimaryButton label="Save changes" loading={saving} onPress={handleSave} />
      <PrimaryButton label="Delete card" variant="secondary" loading={removing} onPress={handleDelete} />
    </Panel>
  );
}

function PlanForm({ cardOptions, onCreated }: { cardOptions: CardOption[]; onCreated: () => void }) {
  const theme = useTheme();
  const [purchaseName, setPurchaseName] = useState('');
  const [cardId, setCardId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [monthsTotal, setMonthsTotal] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!purchaseName.trim()) return 'Enter what you bought.';
    if (!DATE_RE.test(startDate)) return 'Enter the start date as YYYY-MM-DD.';
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) return 'Enter a valid total amount.';
    const months = Number(monthsTotal);
    if (!Number.isInteger(months) || months <= 0) return 'Enter a valid number of months.';
    const monthly = Number(monthlyPayment);
    if (!Number.isFinite(monthly) || monthly <= 0) return 'Enter a valid monthly payment.';
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
      await api.createMSIPlan({
        purchase_name: purchaseName.trim(),
        card_id: cardId,
        start_date: startDate,
        total_amount: totalAmount,
        months_total: Number(monthsTotal),
        monthly_payment: monthlyPayment,
      });
      setPurchaseName('');
      setCardId(null);
      setStartDate('');
      setTotalAmount('');
      setMonthsTotal('');
      setMonthlyPayment('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create MSI plan.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField label="Purchase" value={purchaseName} onChangeText={setPurchaseName} placeholder="e.g. New laptop" />

      <MenuField
        label="Card"
        valueLabel={cardOptions.find((opt) => opt.value === cardId)?.label ?? 'No card'}
        selectedValue={cardId}
        onSelect={setCardId}
        options={cardOptions}
      />

      <TextField label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <TextField label="Total amount" value={totalAmount} onChangeText={setTotalAmount} keyboardType="decimal-pad" placeholder="e.g. 12000" />
      <TextField label="Months" value={monthsTotal} onChangeText={setMonthsTotal} keyboardType="number-pad" placeholder="e.g. 12" />
      <TextField
        label="Monthly payment"
        value={monthlyPayment}
        onChangeText={setMonthlyPayment}
        keyboardType="decimal-pad"
        placeholder="e.g. 1000"
      />

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <PrimaryButton label="Add plan" loading={submitting} onPress={handleSubmit} />
    </View>
  );
}

function PlanRow({
  plan,
  card,
  onPress,
}: {
  plan: MSIPlanRead;
  card?: CardRead;
  onPress: () => void;
}) {
  const theme = useTheme();
  const emoji = getMerchantEmoji(plan.purchase_name);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
      <ThemedText style={styles.rowEmoji}>{emoji}</ThemedText>
      <View style={styles.rowMain}>
        <ThemedText numberOfLines={1}>{plan.purchase_name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {plan.payments_done}/{plan.months_total} months{card ? ` · ${card.nickname}` : ''}
        </ThemedText>
      </View>
      <ThemedText>{money(plan.remaining_balance)}</ThemedText>
    </Pressable>
  );
}

function PaymentRow({ payment, plan, card }: { payment: MSIPaymentRead; plan?: MSIPlanRead; card?: CardRead }) {
  const emoji = getMerchantEmoji(plan?.purchase_name ?? payment.payment_source);

  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowEmoji}>{emoji}</ThemedText>
      <View style={styles.rowMain}>
        <ThemedText numberOfLines={1}>{plan?.purchase_name ?? payment.payment_source}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {card ? `${card.nickname} · ` : ''}
          {shortDate(payment.paid_on)}
        </ThemedText>
      </View>
      <ThemedText>{money(payment.amount)}</ThemedText>
    </View>
  );
}

function AllPaymentsModal({
  payments,
  planById,
  cardById,
  hasActiveFilters,
  onOpenFilters,
  onClose,
}: {
  payments: MSIPaymentRead[];
  planById: Map<number, MSIPlanRead>;
  cardById: Map<number, CardRead>;
  hasActiveFilters: boolean;
  onOpenFilters: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            styles.fullModalCard,
            { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
          ]}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">All Payments</ThemedText>
              <Pressable onPress={onClose}>
                <ThemedText type="link" themeColor="tint">
                  Close
                </ThemedText>
              </Pressable>
            </View>

            <Pressable onPress={onOpenFilters}>
              <ThemedText type="link" themeColor={hasActiveFilters ? 'tint' : 'textSecondary'}>
                {hasActiveFilters ? 'Filters ●' : 'Filters'}
              </ThemedText>
            </Pressable>

            {payments.map((payment) => {
              const plan = planById.get(payment.msi_plan_id);
              const card = plan?.card_id != null ? cardById.get(plan.card_id) : undefined;
              return <PaymentRow key={payment.id} payment={payment} plan={plan} card={card} />;
            })}

            {payments.length === 0 ? (
              <ThemedText themeColor="textSecondary">No payments match these filters.</ThemedText>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PaymentsFilterModal({
  filters,
  cardOptions,
  onApply,
  onClear,
  onClose,
}: {
  filters: PaymentFilters;
  cardOptions: { value: number | 'all'; label: string }[];
  onApply: (next: PaymentFilters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState(filters.search);
  const [cardId, setCardId] = useState<number | 'all'>(filters.cardId);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      setError('Enter dates as YYYY-MM-DD.');
      return;
    }
    setError(null);
    onApply({ search, cardId, from, to });
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Filter payments</ThemedText>
              <Pressable onPress={onClose}>
                <ThemedText type="link" themeColor="tint">
                  Close
                </ThemedText>
              </Pressable>
            </View>

            <TextField label="Search purchase" value={search} onChangeText={setSearch} placeholder="e.g. iPhone" />

            <MenuField
              label="Card"
              valueLabel={cardOptions.find((opt) => opt.value === cardId)?.label ?? 'All cards'}
              selectedValue={cardId}
              onSelect={setCardId}
              options={cardOptions}
            />

            <View style={styles.filterDateRow}>
              <View style={styles.filterDateField}>
                <TextField label="From date" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" autoCapitalize="none" />
              </View>
              <View style={styles.filterDateField}>
                <TextField label="To date" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" autoCapitalize="none" />
              </View>
            </View>

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}

            <PrimaryButton label="Apply filters" onPress={handleApply} />
            <PrimaryButton label="Clear filters" variant="secondary" onPress={onClear} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PlanDetailModal({
  plan,
  card,
  cardOptions,
  onClose,
  onChanged,
}: {
  plan: MSIPlanRead;
  card?: CardRead;
  cardOptions: CardOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const emoji = getMerchantEmoji(plan.purchase_name);
  const [editing, setEditing] = useState(false);

  const [purchaseName, setPurchaseName] = useState(plan.purchase_name);
  const [cardId, setCardId] = useState<number | null>(plan.card_id);
  const [startDate, setStartDate] = useState(plan.start_date);
  const [totalAmount, setTotalAmount] = useState(plan.total_amount);
  const [monthsTotal, setMonthsTotal] = useState(String(plan.months_total));
  const [monthlyPayment, setMonthlyPayment] = useState(plan.monthly_payment);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentAmount, setPaymentAmount] = useState(plan.monthly_payment);
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentSource, setPaymentSource] = useState('');
  const [registeringPayment, setRegisteringPayment] = useState(false);

  const isComplete = plan.payments_done >= plan.months_total;

  function handleStartEditing() {
    setPurchaseName(plan.purchase_name);
    setCardId(plan.card_id);
    setStartDate(plan.start_date);
    setTotalAmount(plan.total_amount);
    setMonthsTotal(String(plan.months_total));
    setMonthlyPayment(plan.monthly_payment);
    setError(null);
    setEditing(true);
  }

  function validate(): string | null {
    if (!purchaseName.trim()) return 'Enter what you bought.';
    if (!DATE_RE.test(startDate)) return 'Enter the start date as YYYY-MM-DD.';
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) return 'Enter a valid total amount.';
    const months = Number(monthsTotal);
    if (!Number.isInteger(months) || months <= 0) return 'Enter a valid number of months.';
    const monthly = Number(monthlyPayment);
    if (!Number.isFinite(monthly) || monthly <= 0) return 'Enter a valid monthly payment.';
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
      await api.updateMSIPlan(plan.id, {
        purchase_name: purchaseName.trim(),
        card_id: cardId,
        start_date: startDate,
        total_amount: totalAmount,
        months_total: Number(monthsTotal),
        monthly_payment: monthlyPayment,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save plan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setRemoving(true);
    setError(null);
    try {
      await api.deleteMSIPlan(plan.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete plan.');
      setRemoving(false);
    }
  }

  async function handleRegisterPayment() {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }
    if (!DATE_RE.test(paymentDate)) {
      setError('Enter the payment date as YYYY-MM-DD.');
      return;
    }
    if (!paymentSource.trim()) {
      setError('Enter where the payment came from (e.g. autopay, manual).');
      return;
    }
    setError(null);
    setRegisteringPayment(true);
    try {
      await api.registerMSIPayment(plan.id, {
        paid_on: paymentDate,
        amount: paymentAmount,
        payment_source: paymentSource.trim(),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register payment.');
    } finally {
      setRegisteringPayment(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">
                {emoji} {plan.purchase_name}
              </ThemedText>
              <Pressable onPress={onClose}>
                <ThemedText type="link" themeColor="tint">
                  Close
                </ThemedText>
              </Pressable>
            </View>

            {!editing ? (
              <>
                <RowItem label="Total" value={money(plan.total_amount)} />
                <RowItem label="Monthly" value={money(plan.monthly_payment)} />
                <RowItem label="Months" value={`${plan.payments_done}/${plan.months_total}`} />
                <RowItem
                  label="Left to pay"
                  value={money(plan.remaining_balance)}
                  danger={Number(plan.remaining_balance) > 0 && isComplete}
                />
                <RowItem label="Started" value={shortDate(plan.start_date)} />
                <RowItem label="Card" value={card ? card.nickname : 'No card'} />

                {error ? (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {error}
                  </ThemedText>
                ) : null}

                <PrimaryButton label="Edit" variant="secondary" onPress={handleStartEditing} />
              </>
            ) : (
              <>
                <TextField label="Purchase" value={purchaseName} onChangeText={setPurchaseName} />

                <MenuField
                  label="Card"
                  valueLabel={cardOptions.find((opt) => opt.value === cardId)?.label ?? 'No card'}
                  selectedValue={cardId}
                  onSelect={setCardId}
                  options={cardOptions}
                />

                <TextField
                  label="Start date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
                <TextField label="Total amount" value={totalAmount} onChangeText={setTotalAmount} keyboardType="decimal-pad" />
                <TextField label="Months" value={monthsTotal} onChangeText={setMonthsTotal} keyboardType="number-pad" />
                <TextField
                  label="Monthly payment"
                  value={monthlyPayment}
                  onChangeText={setMonthlyPayment}
                  keyboardType="decimal-pad"
                />

                {error ? (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {error}
                  </ThemedText>
                ) : null}

                <PrimaryButton label="Save changes" loading={saving} onPress={handleSave} />
                <PrimaryButton label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
                <PrimaryButton label="Delete plan" variant="secondary" loading={removing} onPress={handleDelete} />
              </>
            )}

            {!isComplete ? (
              <View style={[styles.paymentForm, { borderTopColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Register a payment
                </ThemedText>
                <TextField label="Amount" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" />
                <TextField
                  label="Paid on"
                  value={paymentDate}
                  onChangeText={setPaymentDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
                <TextField
                  label="Source"
                  value={paymentSource}
                  onChangeText={setPaymentSource}
                  placeholder="e.g. Card autopay"
                />
                <PrimaryButton
                  label="Register payment"
                  variant="secondary"
                  loading={registeringPayment}
                  onPress={handleRegisterPayment}
                />
              </View>
            ) : null}
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
  paymentForm: {
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  fullModalCard: {
    maxHeight: '94%',
  },
  paymentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  filterDateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterDateField: {
    flex: 1,
  },
});
