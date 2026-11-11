export type Currency = 'MMK' | 'USD';
export type Language = 'my' | 'en';
export type TransactionType = 'expense' | 'income' | 'transfer';
export type CategoryKind = 'income' | 'expense' | 'both';

export interface Wallet {
  code: string;
  name: string;
  active: 0 | 1;
  sort_order: number;
  opening_mmk_minor: number;
  opening_usd_minor: number;
}
export interface Category {
  code: string;
  name_en: string;
  name_my: string;
  kind: CategoryKind;
  active: 0 | 1;
  sort_order: number;
}
export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  currency: Currency;
  amount_minor: number;
  description: string;
  wallet_code: string;
  to_wallet_code: string | null;
  category_code: string | null;
  created_at: string;
}
export interface Budget { currency: Currency; amount_minor: number; }
export interface AppPrefs { language: Language; currency: Currency; dark_mode: boolean; show_wallets: boolean; }
export interface Snapshot { wallets: Wallet[]; categories: Category[]; transactions: Transaction[]; budgets: Budget[]; settings: AppPrefs; }
export interface BackupV2 extends Snapshot { format: 'money-tracker-ts-backup'; version: 2; exported_at: string; }
export interface TransactionInput { id?: string; type: TransactionType; date: string; currency: Currency; amount_minor: number; description: string; wallet_code: string; to_wallet_code: string | null; category_code: string | null; }
