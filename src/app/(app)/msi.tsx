import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons } from 'react-native-paper';

import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { AppModal } from '@/components/finance/app-modal';
import { DateField, MenuField, Panel, RowItem } from '@/components/finance/cards';
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
type MSITab = 'progress' | 'completed' | 'cards';
const EMPTY_PAYMENT_FILTERS: PaymentFilters = { search: '', cardId: 'all', from: '', to: '' };

const NETWORK_COLORS: Record<string, string> = {
  visa: '#3C87F7',
  mastercard: '#8A05FF',
  amex: '#2E2E33',
  discover: '#E8720C',
};

function networkColor(network: string, fallback: string): string {
  return NETWORK_COLORS[network.trim().toLowerCase()] ?? fallback;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPlanComplete(plan: MSIPlanRead): boolean {
  return plan.payments_done >= plan.months_total;
}

function computeMonthlyPayment(totalAmount: string, monthsTotal: string): number | null {
  const total = Number(totalAmount);
  const months = Number(monthsTotal);
  if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(months) || months <= 0) return null;
  return total / months;
}

export default function MSIScreen() {
  const isWide = useIsWideScreen();
  const [plans, setPlans] = useState<MSIPlanRead[]>([]);
  const [cards, setCards] = useState<CardRead[]>([]);
  const [payments, setPayments] = useState<MSIPaymentRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<MSITab>('progress');
  const [selectedPlan, setSelectedPlan] = useState<MSIPlanRead | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardRead | null>(null);
  const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);

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

  const inProgressPlans = plans.filter((plan) => !isPlanComplete(plan));
  const completedPlans = plans.filter(isPlanComplete);

  const monthlyTotal = inProgressPlans.reduce((sum, plan) => sum + Number(plan.monthly_payment), 0);
  const totalDebt = inProgressPlans.reduce((sum, plan) => sum + Number(plan.total_amount), 0);
  const totalRemaining = inProgressPlans.reduce((sum, plan) => sum + Number(plan.remaining_balance), 0);

  const depositByCard = new Map<number, number>();
  inProgressPlans.forEach((plan) => {
    if (plan.card_id == null) return;
    depositByCard.set(plan.card_id, (depositByCard.get(plan.card_id) ?? 0) + Number(plan.monthly_payment));
  });

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
    <ScreenShell
      title="MSI Plans"
      singleColumn
      header={
        <>
          <MSIHero
            monthlyTotal={monthlyTotal}
            activeCount={inProgressPlans.length}
            totalDebt={totalDebt}
            totalRemaining={totalRemaining}
          />
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as MSITab)}
            buttons={[
              { value: 'progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cards', label: 'Cards' },
            ]}
          />
        </>
      }>
      {loading ? <ActivityIndicator /> : null}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {activeTab === 'progress' ? (
        <Panel title="In Progress" caption={`${inProgressPlans.length} plan(s)`}>
          <Pressable onPress={() => setAddPurchaseOpen(true)} style={styles.addLink}>
            <ThemedText type="link" themeColor="tint">
              + Add purchase
            </ThemedText>
          </Pressable>

          <View style={isWide ? styles.planGrid : styles.planList}>
            {inProgressPlans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                card={plan.card_id != null ? cardById.get(plan.card_id) : undefined}
                onPress={() => setSelectedPlan(plan)}
                wide={isWide}
              />
            ))}
          </View>

          {!loading && inProgressPlans.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              No MSI plans in progress. Add a purchase to start tracking it.
            </ThemedText>
          ) : null}
        </Panel>
      ) : null}

      {activeTab === 'progress' ? (
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
      ) : null}

      {activeTab === 'completed' ? (
        <Panel title="Completed" caption={`${completedPlans.length} plan(s)`}>
          <View style={isWide ? styles.planGrid : styles.planList}>
            {completedPlans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                card={plan.card_id != null ? cardById.get(plan.card_id) : undefined}
                onPress={() => setSelectedPlan(plan)}
                wide={isWide}
              />
            ))}
          </View>
          {!loading && completedPlans.length === 0 ? (
            <ThemedText themeColor="textSecondary">No completed plans yet.</ThemedText>
          ) : null}
        </Panel>
      ) : null}

      {activeTab === 'cards' ? (
        <Panel title="Cards" caption={`${cards.length} card(s)`}>
          <Pressable onPress={() => setAddCardOpen(true)} style={styles.addLink}>
            <ThemedText type="link" themeColor="tint">
              + Add card
            </ThemedText>
          </Pressable>

          <View style={isWide ? styles.cardGrid : styles.cardList}>
            {cards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                deposit={depositByCard.get(card.id) ?? 0}
                onPress={() => setSelectedCard(card)}
                wide={isWide}
              />
            ))}
          </View>

          {!loading && cards.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              No cards yet. Add one to start tracking MSI plans against it.
            </ThemedText>
          ) : null}
        </Panel>
      ) : null}

      {addPurchaseOpen ? (
        <AddPurchaseModal
          cardOptions={cardOptions}
          onClose={() => setAddPurchaseOpen(false)}
          onCreated={() => {
            loadAll();
            setAddPurchaseOpen(false);
          }}
        />
      ) : null}

      {addCardOpen ? (
        <AddCardModal
          onClose={() => setAddCardOpen(false)}
          onCreated={() => {
            loadAll();
            setAddCardOpen(false);
          }}
        />
      ) : null}

      {selectedCard ? (
        <CardDetailModal
          card={selectedCard}
          deposit={depositByCard.get(selectedCard.id) ?? 0}
          onClose={() => setSelectedCard(null)}
          onChanged={() => {
            loadAll();
            setSelectedCard(null);
          }}
        />
      ) : null}

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

function MSIHero({
  monthlyTotal,
  activeCount,
  totalDebt,
  totalRemaining,
}: {
  monthlyTotal: number;
  activeCount: number;
  totalDebt: number;
  totalRemaining: number;
}) {
  const theme = useTheme();
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <LinearGradient
      colors={[theme.tint, theme.heroDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}>
      <ThemedText type="small" style={styles.heroCaption}>
        Monthly deposit for {monthLabel}
      </ThemedText>
      <ThemedText style={styles.heroAmount}>{money(monthlyTotal)}</ThemedText>

      <View style={styles.heroStats}>
        <HeroStat label="Active plans" value={String(activeCount)} />
        <HeroStat label="Total debt" value={money(totalDebt)} />
        <HeroStat label="Remaining" value={money(totalRemaining)} />
      </View>
    </LinearGradient>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <ThemedText style={styles.heroStatValue} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={styles.heroStatLabel}>
        {label}
      </ThemedText>
    </View>
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

function AddCardModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  return (
    <AppModal visible onDismiss={onClose}>
      <View style={styles.modalHeader}>
        <ThemedText type="subtitle">Add card</ThemedText>
        <Pressable onPress={onClose}>
          <ThemedText type="link" themeColor="tint">
            Close
          </ThemedText>
        </Pressable>
      </View>
      <CardForm onCreated={onCreated} />
    </AppModal>
  );
}

function CardDetailModal({
  card,
  deposit,
  onClose,
  onChanged,
}: {
  card: CardRead;
  deposit: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(card.nickname);
  const [network, setNetwork] = useState(card.network);
  const [last4, setLast4] = useState(card.last4);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStartEditing() {
    setNickname(card.nickname);
    setNetwork(card.network);
    setLast4(card.last4);
    setError(null);
    setEditing(true);
  }

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
    <AppModal visible onDismiss={onClose}>
      <View style={styles.modalHeader}>
        <ThemedText type="subtitle">{card.nickname}</ThemedText>
        <Pressable onPress={onClose}>
          <ThemedText type="link" themeColor="tint">
            Close
          </ThemedText>
        </Pressable>
      </View>

      {!editing ? (
        <>
          <RowItem label="Network" value={card.network} />
          <RowItem label="Last 4 digits" value={`•••• ${card.last4}`} />
          <RowItem label="To deposit this month" value={money(deposit)} />

          {error ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          ) : null}

          <PrimaryButton label="Edit" variant="secondary" onPress={handleStartEditing} />
        </>
      ) : (
        <>
          <TextField label="Nickname" value={nickname} onChangeText={setNickname} />
          <TextField label="Network" value={network} onChangeText={setNetwork} />
          <TextField label="Last 4 digits" value={last4} onChangeText={setLast4} keyboardType="number-pad" maxLength={4} />

          {error ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          ) : null}

          <PrimaryButton label="Save changes" loading={saving} onPress={handleSave} />
          <PrimaryButton label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
          <PrimaryButton label="Delete card" variant="secondary" loading={removing} onPress={handleDelete} />
        </>
      )}
    </AppModal>
  );
}

function CardTile({
  card,
  deposit,
  onPress,
  wide = false,
}: {
  card: CardRead;
  deposit: number;
  onPress: () => void;
  wide?: boolean;
}) {
  const theme = useTheme();
  const color = networkColor(card.network, theme.tint);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardTile,
        wide && styles.cardTileWide,
        { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.cardChip, { backgroundColor: color }]}>
        <ThemedText style={styles.cardChipText} numberOfLines={1}>
          {card.network.toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.rowMain}>
        <ThemedText numberOfLines={1}>{card.nickname}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          •••• {card.last4}
        </ThemedText>
      </View>
      <View style={styles.cardTileDeposit}>
        <ThemedText numberOfLines={1}>{money(deposit)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          to deposit
        </ThemedText>
      </View>
    </Pressable>
  );
}

function PlanForm({ cardOptions, onCreated }: { cardOptions: CardOption[]; onCreated: () => void }) {
  const theme = useTheme();
  const [purchaseName, setPurchaseName] = useState('');
  const [cardId, setCardId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [monthsTotal, setMonthsTotal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthlyPayment = computeMonthlyPayment(totalAmount, monthsTotal);

  function validate(): string | null {
    if (!purchaseName.trim()) return 'Enter what you bought.';
    if (!DATE_RE.test(startDate)) return 'Pick a start date.';
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) return 'Enter a valid total amount.';
    const months = Number(monthsTotal);
    if (!Number.isInteger(months) || months <= 0) return 'Enter a valid number of months.';
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
        monthly_payment: monthlyPayment!.toFixed(2),
      });
      setPurchaseName('');
      setCardId(null);
      setStartDate('');
      setTotalAmount('');
      setMonthsTotal('');
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

      <DateField label="Start date" value={startDate} onChange={setStartDate} />
      <TextField label="Total amount" value={totalAmount} onChangeText={setTotalAmount} keyboardType="decimal-pad" placeholder="e.g. 12000" />
      <TextField label="Months" value={monthsTotal} onChangeText={setMonthsTotal} keyboardType="number-pad" placeholder="e.g. 12" />
      <RowItem label="Monthly payment" value={monthlyPayment != null ? money(monthlyPayment) : '—'} />

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <PrimaryButton label="Add plan" loading={submitting} onPress={handleSubmit} />
    </View>
  );
}

function AddPurchaseModal({
  cardOptions,
  onClose,
  onCreated,
}: {
  cardOptions: CardOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <AppModal visible onDismiss={onClose}>
      <View style={styles.modalHeader}>
        <ThemedText type="subtitle">Add purchase</ThemedText>
        <Pressable onPress={onClose}>
          <ThemedText type="link" themeColor="tint">
            Close
          </ThemedText>
        </Pressable>
      </View>
      <PlanForm cardOptions={cardOptions} onCreated={onCreated} />
    </AppModal>
  );
}

function PlanRow({
  plan,
  card,
  onPress,
  wide = false,
}: {
  plan: MSIPlanRead;
  card?: CardRead;
  onPress: () => void;
  wide?: boolean;
}) {
  const theme = useTheme();
  const emoji = getMerchantEmoji(plan.purchase_name);
  const done = isPlanComplete(plan);

  if (wide) {
    const progress = plan.months_total > 0 ? Math.min(1, plan.payments_done / plan.months_total) : 0;
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.planCard,
          { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
        ]}>
        <View style={styles.planCardTop}>
          <ThemedText style={styles.rowEmoji}>{emoji}</ThemedText>
          <View style={styles.rowMain}>
            <ThemedText numberOfLines={1}>{plan.purchase_name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {plan.payments_done}/{plan.months_total} months{card ? ` · ${card.nickname}` : ''}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.tint, width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.planCardFoot}>
          <ThemedText style={done ? { color: theme.tint } : undefined}>
            {done ? 'Paid off' : money(plan.remaining_balance)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {money(plan.monthly_payment)}/mo
          </ThemedText>
        </View>
      </Pressable>
    );
  }

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
      <ThemedText>{done ? 'Paid off' : money(plan.remaining_balance)}</ThemedText>
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
  return (
    <AppModal visible onDismiss={onClose} tall>
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
    </AppModal>
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
    <AppModal visible onDismiss={onClose}>
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
    </AppModal>
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
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentAmount, setPaymentAmount] = useState(plan.monthly_payment);
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentSource, setPaymentSource] = useState('');
  const [registeringPayment, setRegisteringPayment] = useState(false);

  const isComplete = isPlanComplete(plan);
  const monthlyPayment = computeMonthlyPayment(totalAmount, monthsTotal);

  function handleStartEditing() {
    setPurchaseName(plan.purchase_name);
    setCardId(plan.card_id);
    setStartDate(plan.start_date);
    setTotalAmount(plan.total_amount);
    setMonthsTotal(String(plan.months_total));
    setError(null);
    setEditing(true);
  }

  function validate(): string | null {
    if (!purchaseName.trim()) return 'Enter what you bought.';
    if (!DATE_RE.test(startDate)) return 'Pick a start date.';
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) return 'Enter a valid total amount.';
    const months = Number(monthsTotal);
    if (!Number.isInteger(months) || months <= 0) return 'Enter a valid number of months.';
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
        monthly_payment: monthlyPayment!.toFixed(2),
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
    <AppModal visible onDismiss={onClose}>
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

          <DateField label="Start date" value={startDate} onChange={setStartDate} />
          <TextField label="Total amount" value={totalAmount} onChangeText={setTotalAmount} keyboardType="decimal-pad" />
          <TextField label="Months" value={monthsTotal} onChangeText={setMonthsTotal} keyboardType="number-pad" />
          <RowItem label="Monthly payment" value={monthlyPayment != null ? money(monthlyPayment) : '—'} />

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
          <DateField label="Paid on" value={paymentDate} onChange={setPaymentDate} />
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
    </AppModal>
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  hero: {
    borderRadius: 20,
    padding: 20,
    gap: 4,
  },
  heroCaption: {
    color: 'rgba(255,255,255,0.85)',
  },
  heroAmount: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 14,
  },
  heroStat: {
    minWidth: 90,
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.75)',
  },
  addLink: {
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  planList: {
    gap: 0,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  planCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planCardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressTrack: {
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  cardList: {
    gap: 10,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  cardTileWide: {
    width: '31.5%',
  },
  cardChip: {
    width: 44,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardChipText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardTileDeposit: {
    alignItems: 'flex-end',
  },
});
