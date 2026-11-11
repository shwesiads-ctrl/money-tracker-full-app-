import type { SQLiteDatabase } from 'expo-sqlite';
import { assertTransaction, id, parseBackup, toMinor } from './core';
import type { AppPrefs, BackupV2, Budget, Category, Currency, Snapshot, Transaction, TransactionInput, Wallet } from './types';

export const initialWallets: Wallet[] = [
  ['Cash','Cash'],['KBZPay','KBZPay'],['WavePay','WavePay'],['AYAPay','AYA Pay'],['CBPay','CB Pay'],['BankCard','Bank / Card'],
].map(([code,name],sort_order)=>({code,name,sort_order,active:1 as const,opening_mmk_minor:0,opening_usd_minor:0}));
export const initialCategories: Category[] = [
  ['Food','Food & Drinks','အစားအသောက်','expense'],
  ['Transport','Transport','လမ်းစရိတ်','expense'],
  ['Bills','Bills & Top-up','ဘေလ်/ဖုန်းဘေလ်','expense'],
  ['Shopping','Shopping','ဈေးဝယ်','expense'],
  ['Salary','Salary / Income','လစာ/ဝင်ငွေ','income'],
  ['Other','Other','အခြား','both'],
].map(([code,name_en,name_my,kind],sort_order)=>({code,name_en,name_my,kind:kind as Category['kind'],sort_order,active:1 as const}));

const schema = `
CREATE TABLE IF NOT EXISTS wallets (
  code TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 999, opening_mmk_minor INTEGER NOT NULL DEFAULT 0 CHECK(opening_mmk_minor>=0),
  opening_usd_minor INTEGER NOT NULL DEFAULT 0 CHECK(opening_usd_minor>=0)
);
CREATE TABLE IF NOT EXISTS categories (
  code TEXT PRIMARY KEY NOT NULL, name_en TEXT NOT NULL, name_my TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('income','expense','both')),
  active INTEGER NOT NULL CHECK(active IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 999
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
  currency TEXT NOT NULL CHECK(currency IN ('MMK','USD')), amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  description TEXT NOT NULL, wallet_code TEXT NOT NULL REFERENCES wallets(code) ON DELETE RESTRICT,
  to_wallet_code TEXT REFERENCES wallets(code) ON DELETE RESTRICT,
  category_code TEXT REFERENCES categories(code) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  CHECK ((type = 'transfer' AND category_code IS NULL AND to_wallet_code IS NOT NULL AND to_wallet_code <> wallet_code)
    OR (type <> 'transfer' AND category_code IS NOT NULL AND to_wallet_code IS NULL))
);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(currency,date);
CREATE INDEX IF NOT EXISTS transactions_wallet_idx ON transactions(wallet_code);
CREATE TABLE IF NOT EXISTS budgets (
  currency TEXT PRIMARY KEY CHECK(currency IN ('MMK','USD')), amount_minor INTEGER NOT NULL CHECK(amount_minor>=0)
);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`;
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await db.execAsync(schema);
  const wcount = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) AS count FROM wallets');
  const ccount = await db.getFirstAsync<{count: number}>('SELECT COUNT(*) AS count FROM categories');
  if ((wcount?.count || 0) === 0) for (const w of initialWallets) await insertWallet(db,w);
  if ((ccount?.count || 0) === 0) for (const c of initialCategories) await insertCategory(db,c);
  await db.runAsync("INSERT OR IGNORE INTO budgets(currency,amount_minor) VALUES ('MMK',300000),('USD',30000)");
  for (const [key,value] of Object.entries({language:'my',currency:'MMK',dark_mode:'false',show_wallets:'true'})) {
    await db.runAsync('INSERT OR IGNORE INTO app_settings(key,value) VALUES (?,?)',key,value);
  }
  await db.execAsync('PRAGMA user_version = 1;');
}
const insertWallet = (db: SQLiteDatabase, w: Wallet) => db.runAsync(
  'INSERT INTO wallets(code,name,active,sort_order,opening_mmk_minor,opening_usd_minor) VALUES (?,?,?,?,?,?)',
  w.code,w.name,w.active,w.sort_order,w.opening_mmk_minor,w.opening_usd_minor);
const insertCategory = (db: SQLiteDatabase, c: Category) => db.runAsync(
  'INSERT INTO categories(code,name_en,name_my,kind,active,sort_order) VALUES (?,?,?,?,?,?)',
  c.code,c.name_en,c.name_my,c.kind,c.active,c.sort_order);
const insertTx = (db: SQLiteDatabase, t: Transaction) => db.runAsync(
  'INSERT INTO transactions(id,date,type,currency,amount_minor,description,wallet_code,to_wallet_code,category_code,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
  t.id,t.date,t.type,t.currency,t.amount_minor,t.description,t.wallet_code,t.to_wallet_code,t.category_code,t.created_at);

export async function readSnapshot(db: SQLiteDatabase): Promise<Snapshot> {
  const [wallets,categories,transactions,budgets,rows] = await Promise.all([
    db.getAllAsync<Wallet>('SELECT * FROM wallets ORDER BY sort_order,name'),
    db.getAllAsync<Category>('SELECT * FROM categories ORDER BY sort_order,name_en'),
    db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC,created_at DESC,id DESC'),
    db.getAllAsync<Budget>('SELECT * FROM budgets'),
    db.getAllAsync<{key:string,value:string}>('SELECT key,value FROM app_settings'),
  ]);
  const settings=Object.fromEntries(rows.map(x=>[x.key,x.value]));
  const currency: Currency=settings.currency==='USD'?'USD':'MMK';
  const prefs: AppPrefs={language:settings.language==='en'?'en':'my',currency,dark_mode:settings.dark_mode==='true',show_wallets:settings.show_wallets!=='false'};
  return {wallets,categories,transactions,budgets,settings:prefs};
}

export async function upsertTransaction(db: SQLiteDatabase, input: TransactionInput): Promise<void> {
  const s=await readSnapshot(db);
  assertTransaction(input,s.wallets,s.categories);
  if (input.id) {
    const old=s.transactions.find(x=>x.id===input.id);
    if (!old) throw new Error('Transaction not found');
    await db.runAsync('UPDATE transactions SET date=?,type=?,currency=?,amount_minor=?,description=?,wallet_code=?,to_wallet_code=?,category_code=? WHERE id=?',
      input.date,input.type,input.currency,input.amount_minor,input.description.trim(),input.wallet_code,input.to_wallet_code,input.category_code,input.id);
  } else {
    const wallet=s.wallets.find(w=>w.code===input.wallet_code);
    if (!wallet?.active) throw new Error('Wallet is inactive');
    const date=new Date().toISOString();
    await insertTx(db,{...input,id:id('tx'),description:input.description.trim(),created_at:date});
  }
}
export async function deleteTransaction(db: SQLiteDatabase, txId: string) {
  const done=await db.runAsync('DELETE FROM transactions WHERE id=?',txId);
  if (done.changes===0) throw new Error('Transaction not found');
}
export async function clearTransactions(db: SQLiteDatabase) {await db.runAsync('DELETE FROM transactions');}
export async function setPrefs(db: SQLiteDatabase, patch: Partial<AppPrefs>) {
  for(const [key,value] of Object.entries(patch)){
    if (!['language','currency','dark_mode','show_wallets'].includes(key)) continue;
    await db.runAsync('INSERT INTO app_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key,String(value));
  }
}
export async function setBudget(db: SQLiteDatabase, currency: Currency, minor: number) {
  if(!Number.isSafeInteger(minor)||minor<0)throw new Error('Invalid budget');
  await db.runAsync('INSERT INTO budgets(currency,amount_minor) VALUES (?,?) ON CONFLICT(currency) DO UPDATE SET amount_minor=excluded.amount_minor',currency,minor);
}
export async function setWalletOpening(db: SQLiteDatabase, code: string, currency: Currency, minor: number) {
  if(!Number.isSafeInteger(minor)||minor<0)throw new Error('Invalid opening balance');
  const field=currency==='MMK'?'opening_mmk_minor':'opening_usd_minor';
  const r=await db.runAsync(`UPDATE wallets SET ${field}=? WHERE code=?`,minor,code);
  if(r.changes===0)throw new Error('Wallet not found');
}
export async function setWalletActive(db: SQLiteDatabase, code: string, active: boolean) {
  await db.runAsync('UPDATE wallets SET active=? WHERE code=?',active?1:0,code);
}
export async function addWallet(db: SQLiteDatabase, name: string) {
  if(!name.trim()||name.trim().length>60)throw new Error('Wallet name required (max 60)');
  const count=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) n FROM wallets');
  if((count?.n||0)>=50)throw new Error('Maximum 50 wallets');
  await insertWallet(db,{code:id('w'),name:name.trim(),active:1,sort_order:999,opening_mmk_minor:0,opening_usd_minor:0});
}
export async function addCategory(db: SQLiteDatabase, name_en: string, name_my: string, kind: Category['kind']) {
  if(!name_en.trim()||name_en.trim().length>60||!name_my.trim()||name_my.trim().length>60)throw new Error('Both category names required (max 60)');
  if(!['income','expense','both'].includes(kind))throw new Error('Invalid category type');
  const count=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) n FROM categories');
  if((count?.n||0)>=100)throw new Error('Maximum 100 categories');
  await insertCategory(db,{code:id('c'),name_en:name_en.trim(),name_my:name_my.trim(),kind,active:1,sort_order:999});
}
export async function setCategoryActive(db: SQLiteDatabase, code: string, active: boolean) {
  await db.runAsync('UPDATE categories SET active=? WHERE code=?',active?1:0,code);
}

export async function restoreBackup(db: SQLiteDatabase, raw: unknown): Promise<BackupV2> {
  const backup=parseBackup(raw); // validate all rows and foreign refs BEFORE touching existing data
  await db.withTransactionAsync(async()=> {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM wallets');
    await db.runAsync('DELETE FROM categories');
    await db.runAsync('DELETE FROM budgets');
    await db.runAsync('DELETE FROM app_settings');
    for(const w of backup.wallets) await insertWallet(db,w);
    for(const c of backup.categories) await insertCategory(db,c);
    for(const t of backup.transactions) await insertTx(db,t);
    for(const b of backup.budgets) await db.runAsync('INSERT INTO budgets(currency,amount_minor) VALUES (?,?)',b.currency,b.amount_minor);
    await db.runAsync("INSERT OR IGNORE INTO budgets(currency,amount_minor) VALUES ('MMK',300000),('USD',30000)");
    await setPrefs(db,backup.settings);
  });
  return backup;
}
