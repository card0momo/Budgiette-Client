import { APP_ENV } from '@/lib/config';

export type TransactionDirection = 'income' | 'expense';
export type BudgetPeriod = 'week' | 'month' | 'year';
export type NotificationType = 'budget_exceeded' | 'spending_spike' | 'msi_due' | 'msi_late';

export type HealthRead = {
  status: string;
  app: string;
  version: string;
};

export type CategoryRead = {
  id: number;
  user_id: number;
  name: string;
  is_income: boolean;
};

export type CategoryCreate = {
  name: string;
  is_income: boolean;
};

export type TransactionRead = {
  id: number;
  user_id: number;
  category_id: number | null;
  merchant_name: string;
  description: string;
  direction: TransactionDirection;
  amount: string;
  occurred_at: string;
  source: string;
};

export type BudgetRead = {
  id: number;
  user_id: number;
  category_id: number | null;
  name: string;
  period: BudgetPeriod;
  limit_amount: string;
  starts_on: string;
  is_active: boolean;
};

export type BudgetStatus = BudgetRead & {
  spent: string;
  remaining: string;
  is_over_limit: boolean;
};

export type MSIPlanRead = {
  id: number;
  user_id: number;
  purchase_name: string;
  start_date: string;
  total_amount: string;
  months_total: number;
  monthly_payment: string;
  payments_done: number;
  remaining_balance: string;
};

export type MSIPaymentRead = {
  id: number;
  msi_plan_id: number;
  user_id: number;
  paid_on: string;
  amount: string;
  payment_source: string;
};

export type NotificationRead = {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type MailboxRead = {
  id: number;
  user_id: number;
  email_address: string;
  host: string;
  port: number;
  use_ssl: boolean;
  is_active: boolean;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${APP_ENV.apiBaseUrl}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': APP_ENV.userId,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text || response.statusText}`);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthRead>('/health'),
  listCategories: () => request<CategoryRead[]>('/categories'),
  createCategory: (payload: CategoryCreate) => request<CategoryRead>('/categories', { method: 'POST', body: payload }),
  listTransactions: () => request<TransactionRead[]>('/transactions'),
  listBudgets: () => request<BudgetRead[]>('/budgets'),
  listBudgetStatus: () => request<BudgetStatus[]>('/budgets/status'),
  listMSIPlans: () => request<MSIPlanRead[]>('/msi/plans'),
  listMSIPayments: (planId: number) => request<MSIPaymentRead[]>(`/msi/plans/${planId}/payments`),
  listNotifications: () => request<NotificationRead[]>('/notifications'),
  listMailboxes: () => request<MailboxRead[]>('/ingestion/mailboxes'),
};
