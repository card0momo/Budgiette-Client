import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { MenuField, Panel, RowItem } from '@/components/finance/cards';
import { ScreenShell } from '@/components/finance/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { api, CardRead, MSIPlanRead } from '@/lib/api';
import { money, shortDate } from '@/lib/format';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type CardOption = { value: number | null; label: string };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MSIScreen() {
  const theme = useTheme();
  const [plans, setPlans] = useState<MSIPlanRead[]>([]);
  const [cards, setCards] = useState<CardRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [planRows, cardRows] = await Promise.all([api.listMSIPlans(), api.listCards()]);
      setPlans(planRows);
      setCards(cardRows);
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
  const cardOptions: CardOption[] = [
    { value: null, label: 'No card' },
    ...cards.map((card) => ({ value: card.id, label: `${card.nickname} ·${card.last4}` })),
  ];

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

      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          card={plan.card_id != null ? cardById.get(plan.card_id) : undefined}
          cardOptions={cardOptions}
          onChanged={loadAll}
        />
      ))}

      {!loading && plans.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No MSI plans yet. Add plans from your purchases and payments to monitor debt commitments.
        </ThemedText>
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

function PlanCard({
  plan,
  card,
  cardOptions,
  onChanged,
}: {
  plan: MSIPlanRead;
  card?: CardRead;
  cardOptions: CardOption[];
  onChanged: () => void;
}) {
  const theme = useTheme();
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
      setPaymentSource('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register payment.');
    } finally {
      setRegisteringPayment(false);
    }
  }

  return (
    <Panel title={plan.purchase_name} caption={`Started ${shortDate(plan.start_date)}${card ? ` · ${card.nickname}` : ''}`}>
      <RowItem label="Total" value={money(plan.total_amount)} />
      <RowItem label="Monthly" value={money(plan.monthly_payment)} />
      <RowItem label="Months" value={`${plan.payments_done}/${plan.months_total}`} />
      <RowItem label="Left to pay" value={money(plan.remaining_balance)} danger={Number(plan.remaining_balance) > 0 && isComplete} />

      <TextField label="Purchase" value={purchaseName} onChangeText={setPurchaseName} />

      <MenuField
        label="Card"
        valueLabel={cardOptions.find((opt) => opt.value === cardId)?.label ?? 'No card'}
        selectedValue={cardId}
        onSelect={setCardId}
        options={cardOptions}
      />

      <TextField label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <TextField label="Total amount" value={totalAmount} onChangeText={setTotalAmount} keyboardType="decimal-pad" />
      <TextField label="Months" value={monthsTotal} onChangeText={setMonthsTotal} keyboardType="number-pad" />
      <TextField label="Monthly payment" value={monthlyPayment} onChangeText={setMonthlyPayment} keyboardType="decimal-pad" />

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}

      <PrimaryButton label="Save changes" loading={saving} onPress={handleSave} />
      <PrimaryButton label="Delete plan" variant="secondary" loading={removing} onPress={handleDelete} />

      {!isComplete ? (
        <View style={[styles.paymentForm, { borderTopColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Register a payment
          </ThemedText>
          <TextField label="Amount" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" />
          <TextField label="Paid on" value={paymentDate} onChangeText={setPaymentDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
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
  paymentForm: {
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
