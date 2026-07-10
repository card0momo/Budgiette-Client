import { APP_ENV } from '@/lib/config';
import { getSession, notifyUnauthorized } from '@/lib/session';

export type TransactionDirection = 'income' | 'expense';
export type BudgetPeriod = 'week' | 'month' | 'year';
export type NotificationType = 'budget_exceeded' | 'spending_spike' | 'msi_due' | 'msi_late';

export type HealthRead = {
  status: string;
  app: string;
  version: string;
};

export type UserCreate = {
  username: string;
  password: string;
  email?: string | null;
  full_name?: string;
};

export type UserLogin = {
  username: string;
  password: string;
};

export type UserRead = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
};

export type TokenRead = {
  access_token: string;
  token_type: string;
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
  account_id: number | null;
  merchant_name: string;
  description: string;
  direction: TransactionDirection;
  amount: string;
  occurred_at: string;
  source: string;
};

export type TransactionCreate = {
  category_id?: number | null;
  merchant_name: string;
  description?: string;
  direction: TransactionDirection;
  amount: number | string;
  occurred_at: string;
  source?: string;
};

export type TransactionUpdate = {
  category_id?: number | null;
  merchant_name?: string;
  description?: string;
  direction?: TransactionDirection;
  amount?: number | string;
  occurred_at?: string;
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

export type BudgetCreate = {
  category_id?: number | null;
  name: string;
  period: BudgetPeriod;
  limit_amount: number | string;
  starts_on: string;
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

export type MSIPlanCreate = {
  purchase_name: string;
  start_date: string;
  total_amount: number | string;
  months_total: number;
  monthly_payment: number | string;
};

export type MSIPaymentRead = {
  id: number;
  msi_plan_id: number;
  user_id: number;
  paid_on: string;
  amount: string;
  payment_source: string;
};

export type MSIPaymentCreate = {
  paid_on: string;
  amount: number | string;
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

export type NotificationCreate = {
  type: NotificationType;
  title: string;
  message: string;
};

export type MailboxRead = {
  id: number;
  user_id: number;
  email_address: string;
  host: string;
  port: number;
  use_ssl: boolean;
  is_active: boolean;
  enabled_banks: string[];
  sync_start_date: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

export type MailboxCreate = {
  email_address: string;
  host: string;
  port?: number;
  use_ssl?: boolean;
  password: string;
  sync_start_date: string;
  enabled_banks?: string[];
};

export type MailboxUpdate = {
  password?: string;
  is_active?: boolean;
  enabled_banks?: string[];
};

export type MailboxSummary = Record<string, string>;

export type BankInfo = {
  key: string;
  display_name: string;
};

export type SyncResult = {
  fetched: number;
  created: number;
};

export type AccountRead = {
  id: number;
  user_id: number;
  display_name: string;
  provider: string;
  nickname: string | null;
  account_number: string | null;
};

export type AccountUpdate = {
  nickname?: string | null;
  account_number?: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuth?: boolean;
};

async function extractErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return response.statusText || `Request failed with status ${response.status}`;
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data?.detail)) {
      const messages = data.detail.map((item: { msg?: string }) => item.msg).filter(Boolean);
      if (messages.length) return messages.join(' ');
    }
    if (typeof data?.detail === 'string') return data.detail;
  } catch {
    // Response body was not JSON; fall through to raw text.
  }
  return text;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!options.skipAuth) {
    const session = getSession();
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
    if (session.userId != null) headers['X-User-Id'] = String(session.userId);
  }

  const response = await fetch(`${APP_ENV.apiBaseUrl}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401 && !options.skipAuth) notifyUnauthorized();
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthRead>('/health'),
  register: (payload: UserCreate) => request<TokenRead>('/auth/register', { method: 'POST', body: payload, skipAuth: true }),
  login: (payload: UserLogin) => request<TokenRead>('/auth/login', { method: 'POST', body: payload, skipAuth: true }),
  me: () => request<UserRead>('/auth/me'),
  listCategories: () => request<CategoryRead[]>('/categories'),
  createCategory: (payload: CategoryCreate) => request<CategoryRead>('/categories', { method: 'POST', body: payload }),
  listTransactions: () => request<TransactionRead[]>('/transactions'),
  createTransaction: (payload: TransactionCreate) =>
    request<TransactionRead>('/transactions', { method: 'POST', body: payload }),
  updateTransaction: (transactionId: number, payload: TransactionUpdate) =>
    request<TransactionRead>(`/transactions/${transactionId}`, { method: 'PATCH', body: payload }),
  listBudgets: () => request<BudgetRead[]>('/budgets'),
  createBudget: (payload: BudgetCreate) => request<BudgetRead>('/budgets', { method: 'POST', body: payload }),
  listBudgetStatus: () => request<BudgetStatus[]>('/budgets/status'),
  listMSIPlans: () => request<MSIPlanRead[]>('/msi/plans'),
  createMSIPlan: (payload: MSIPlanCreate) => request<MSIPlanRead>('/msi/plans', { method: 'POST', body: payload }),
  listMSIPayments: (planId: number) => request<MSIPaymentRead[]>(`/msi/plans/${planId}/payments`),
  registerMSIPayment: (planId: number, payload: MSIPaymentCreate) =>
    request<MSIPaymentRead>(`/msi/plans/${planId}/payments`, { method: 'POST', body: payload }),
  listNotifications: () => request<NotificationRead[]>('/notifications'),
  createNotification: (payload: NotificationCreate) =>
    request<NotificationRead>('/notifications', { method: 'POST', body: payload }),
  listBanks: () => request<BankInfo[]>('/ingestion/banks'),
  listMailboxes: () => request<MailboxRead[]>('/ingestion/mailboxes'),
  createMailbox: (payload: MailboxCreate) =>
    request<MailboxRead>('/ingestion/mailboxes', { method: 'POST', body: payload }),
  updateMailbox: (mailboxId: number, payload: MailboxUpdate) =>
    request<MailboxRead>(`/ingestion/mailboxes/${mailboxId}`, { method: 'PATCH', body: payload }),
  deleteMailbox: (mailboxId: number) =>
    request<void>(`/ingestion/mailboxes/${mailboxId}`, { method: 'DELETE' }),
  getMailboxSummary: (mailboxId: number) =>
    request<MailboxSummary>(`/ingestion/mailboxes/${mailboxId}/summary`),
  syncMailbox: (mailboxId: number) =>
    request<SyncResult>(`/ingestion/mailboxes/${mailboxId}/sync`, { method: 'POST' }),
  listAccounts: () => request<AccountRead[]>('/accounts'),
  updateAccount: (accountId: number, payload: AccountUpdate) =>
    request<AccountRead>(`/accounts/${accountId}`, { method: 'PATCH', body: payload }),
};
