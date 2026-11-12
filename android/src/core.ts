import type { AppPrefs, BackupV2, Budget, Category, Currency, Snapshot, Transaction, TransactionInput, Wallet } from './types';

const MAX_MINOR = 100_000_000_000_000;
export const CURRENCIES: Currency[] = ['MMK', 'USD'];
export const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
export const digits = (currency: Currency) => (currency === 'MMK' ? 0 : 2);
export const dateToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export const monthToday = () => dateToday().slice(0, 7);
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d || y < 1970 || y > 2100) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
export function toMinor(raw: string | number, currency: Currency, allowZero = false): number {
  const value = String(raw).trim();
  if (value === '' || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new Error('Invalid amount');
  const [whole, fractional = ''] = value.split('.');
  if (currency === 'MMK' && fractional && Number(fractional) !== 0) throw new Error('MMK uses whole Kyat only');
  const minor = Number(whole) * (currency === 'USD' ? 100 : 1) + (currency === 'USD' ? Number(fractional.padEnd(2, '0')) : 0);
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR || (allowZero ? minor < 0 : minor <= 0)) throw new Error('Amount out of range');
  return minor;
}
export const fromMinor = (minor: number, currency: Currency) => currency === 'MMK' ? String(minor) : (minor / 100).toFixed(2);
export function formatMoney(minor: number, currency: Currency) {
  const absolute = Math.abs(minor);
  const n = (currency === 'USD' ? absolute / 100 : absolute).toLocaleString('en-US', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0, maximumFractionDigits: currency === 'USD' ? 2 : 0,
  });
  return currency === 'MMK' ? `${n} Ks` : `$${n}`;
}
export function walletBalance(snapshot: Snapshot, walletCode: string, currency: Currency): number {
  const wallet = snapshot.wallets.find(w => w.code === walletCode);
  if (!wallet) return 0;
  let amount = currency === 'MMK' ? wallet.opening_mmk_minor : wallet.opening_usd_minor;
  snapshot.transactions.forEach(t => {
    if (t.currency !== currency) return;
    if (t.type === 'transfer') {
      if (t.wallet_code === walletCode) amount -= t.amount_minor;
      if (t.to_wallet_code === walletCode) amount += t.amount_minor;
    } else if (t.wallet_code === walletCode) {
      amount += t.type === 'income' ? t.amount_minor : -t.amount_minor;
    }
  });
  return amount;
}
export function totals(items: Transaction[]) {
  let income = 0, expense = 0;
  for (const t of items) { if (t.type === 'income') income += t.amount_minor; else if (t.type === 'expense') expense += t.amount_minor; }
  return { income, expense, net: income - expense };
}
export function filterTransactions(items: Transaction[], args: {currency: Currency; from?: string; to?: string; type?: string; wallet?: string; search?: string}) {
  return items.filter(t => t.currency === args.currency && (!args.from || t.date >= args.from) && (!args.to || t.date <= args.to)
    && (!args.type || args.type === 'ALL' || t.type === args.type)
    && (!args.wallet || args.wallet === 'ALL' || t.wallet_code === args.wallet || (t.type === 'transfer' && t.to_wallet_code === args.wallet))
    && (!args.search || t.description.toLocaleLowerCase().includes(args.search.trim().toLocaleLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}
/** Summarize the last N calendar months, excluding wallet transfers.
 * Caller should pass transactions already filtered to the active currency.
 */
export function monthlyComparison(items: Transaction[], endMonth: string, count = 6) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth) || count < 1 || count > 24) throw new Error('Invalid chart range');
  const year = Number(endMonth.slice(0, 4));
  const month = Number(endMonth.slice(5, 7));
  const months = Array.from({length: count}, (_, i) => {
    const d = new Date(Date.UTC(year, month - count + i, 1));
    return {month: `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2, '0')}`, income: 0, expense: 0};
  });
  const lookup = new Map(months.map(x => [x.month, x]));
  for (const tx of items) {
    const slot = lookup.get(tx.date.slice(0, 7));
    if (!slot) continue;
    if (tx.type === 'income') slot.income += tx.amount_minor;
    if (tx.type === 'expense') slot.expense += tx.amount_minor;
  }
  return months;
}

export function categoryTotals(items: Transaction[]) {
  const map = new Map<string, number>();
  for (const t of items) if (t.type === 'expense') map.set(t.category_code || 'Other', (map.get(t.category_code || 'Other') || 0) + t.amount_minor);
  return Array.from(map.entries()).map(([category, amount_minor]) => ({ category, amount_minor })).sort((a, b) => b.amount_minor - a.amount_minor);
}
export function dailyTotals(items: Transaction[]) {
  const map = new Map<string, number>();
  for (const t of items) if (t.type === 'expense') map.set(t.date, (map.get(t.date) || 0) + t.amount_minor);
  return Array.from(map.entries()).map(([date, amount_minor]) => ({date, amount_minor})).sort((a, b) => a.date.localeCompare(b.date));
}
export function assertTransaction(input: TransactionInput, wallets: Wallet[], categories: Category[]): void {
  if (!isValidDate(input.date)) throw new Error('Date must be YYYY-MM-DD');
  if (!CURRENCIES.includes(input.currency)) throw new Error('Unsupported currency');
  if (!['expense','income','transfer'].includes(input.type)) throw new Error('Invalid transaction type');
  if (!Number.isSafeInteger(input.amount_minor) || input.amount_minor <= 0 || input.amount_minor > MAX_MINOR) throw new Error('Invalid amount');
  if (!input.description.trim() || input.description.length > 180) throw new Error('Description required (up to 180 characters)');
  if (!wallets.some(w => w.code === input.wallet_code)) throw new Error('Wallet not found');
  if (input.type === 'transfer') {
    if (!input.to_wallet_code || input.wallet_code === input.to_wallet_code || !wallets.some(w => w.code === input.to_wallet_code)) throw new Error('Select a different destination wallet');
    if (input.category_code !== null) throw new Error('Transfers cannot have a category');
  } else {
    if (input.to_wallet_code !== null) throw new Error('Only transfers can use destination wallet');
    const c = categories.find(c => c.code === input.category_code);
    if (!c || (c.kind !== 'both' && c.kind !== input.type)) throw new Error('Invalid category for transaction type');
  }
}
const csvCell = (v: string | number): string => {
  const s = String(v);
  // Block formulas even if a cell starts with white space before the formula marker.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};
export function makeCsv(items: Transaction[], snapshot: Snapshot, currency: Currency) {
  const lines = [['Date','Type','Description','Category','Wallet','To Wallet','Amount','Currency']];
  for (const t of items.filter(t => t.currency === currency)) {
    lines.push([t.date,t.type,t.description,snapshot.categories.find(c=>c.code===t.category_code)?.name_en||'',snapshot.wallets.find(w=>w.code===t.wallet_code)?.name||'',snapshot.wallets.find(w=>w.code===t.to_wallet_code)?.name||'', fromMinor(t.amount_minor,currency),currency]);
  }
  return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const backupBool = (value: unknown, fallback = false): boolean => {
  if (value === undefined || value === null) return fallback;
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  throw new Error('Invalid boolean in backup');
};
const requireText = (v: unknown, key: string, max = 180): string => {
  if (typeof v !== 'string' || v.trim().length < 1 || v.length > max) throw new Error(`Invalid ${key}`);
  return v.trim();
};
const requireInt = (v: unknown, key: string, allowZero = true): number => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v > MAX_MINOR || (allowZero ? v < 0 : v <= 0)) throw new Error(`Invalid ${key}`);
  return v;
};
const codeCheck = (v: unknown, key: string): string => {
  const s=requireText(v,key,60);
  if (!/^[a-zA-Z0-9_\-]{1,60}$/.test(s)) throw new Error(`Invalid ${key}`);
  return s;
};
const arr = (v: unknown, key: string, max: number): unknown[] => {
  if (!Array.isArray(v) || v.length > max) throw new Error(`Invalid ${key}`);
  return v;
};
function ensureCurrency(raw: unknown): Currency {
  if (raw !== 'MMK' && raw !== 'USD') throw new Error('Invalid currency');
  return raw;
}
function ensurePrefs(raw: unknown): AppPrefs {
  if (!isObject(raw) || !['my', 'en'].includes(String(raw.language)) || !CURRENCIES.includes(raw.currency as Currency)) throw new Error('Invalid settings');
  return { language: raw.language as 'my' | 'en', currency: raw.currency as Currency, dark_mode: backupBool(raw.dark_mode), show_wallets: backupBool(raw.show_wallets, true), widget_show_balance: backupBool(raw.widget_show_balance, false) };
}
function normalizedSnapshot(data: Snapshot): Snapshot {
  if (data.wallets.length === 0 || data.categories.length === 0) throw new Error('Missing wallets/categories');
  const ws = new Set<string>(), cs = new Set<string>(), ts = new Set<string>();
  data.wallets.forEach(w => {
    w.code=codeCheck(w.code,'wallet code'); w.name=requireText(w.name,'wallet name',60);
    requireInt(w.opening_mmk_minor,'opening MMK'); requireInt(w.opening_usd_minor,'opening USD');
    if (![0,1].includes(w.active) || !Number.isSafeInteger(w.sort_order) || ws.has(w.code)) throw new Error('Invalid/duplicate wallet'); ws.add(w.code);
  });
  data.categories.forEach(c => {
    c.code=codeCheck(c.code,'category code'); c.name_en=requireText(c.name_en,'category en',60); c.name_my=requireText(c.name_my,'category my',60);
    if (!['income','expense','both'].includes(c.kind) || ![0,1].includes(c.active) || !Number.isSafeInteger(c.sort_order) || cs.has(c.code)) throw new Error('Invalid/duplicate category'); cs.add(c.code);
  });
  data.transactions.forEach(t => {
    t.id=codeCheck(t.id,'transaction id'); if (ts.has(t.id)) throw new Error('Duplicate transaction ID'); ts.add(t.id);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(t.created_at)) throw new Error('Invalid created_at');
    assertTransaction(t,data.wallets,data.categories);
  });
  const bs=new Set<Currency>();
  data.budgets.forEach(b => {ensureCurrency(b.currency);requireInt(b.amount_minor,'budget');if(bs.has(b.currency))throw new Error('Duplicate budget');bs.add(b.currency);});
  data.settings=ensurePrefs(data.settings);
  return data;
}
export function parseBackup(value: unknown): BackupV2 {
  if (!isObject(value)) throw new Error('Invalid JSON backup');
  if (value.format === 'money-tracker-ts-backup' && value.version === 2) {
    const wallets=arr(value.wallets,'wallets',50).map(w => {
      if (!isObject(w)) throw new Error('Invalid wallet');
      return { code:w.code, name:w.name, active:w.active, sort_order:w.sort_order, opening_mmk_minor:w.opening_mmk_minor, opening_usd_minor:w.opening_usd_minor } as Wallet;
    });
    const categories=arr(value.categories,'categories',100).map(c => {
      if(!isObject(c)) throw new Error('Invalid category');
      return {code:c.code,name_en:c.name_en,name_my:c.name_my,kind:c.kind,active:c.active,sort_order:c.sort_order} as Category;
    });
    const transactions=arr(value.transactions,'transactions',20000).map(t => {
      if(!isObject(t)) throw new Error('Invalid transaction');
      return {id:t.id,date:t.date,type:t.type,currency:t.currency,amount_minor:t.amount_minor,description:t.description,wallet_code:t.wallet_code,to_wallet_code:t.to_wallet_code,category_code:t.category_code,created_at:t.created_at} as Transaction;
    });
    const budgets=arr(value.budgets,'budgets',2).map(b=> {if(!isObject(b))throw new Error('Invalid budget'); return {currency:b.currency,amount_minor:b.amount_minor} as Budget;});
    return {...normalizedSnapshot({wallets,categories,transactions,budgets,settings:value.settings as AppPrefs}),format:'money-tracker-ts-backup',version:2,exported_at:new Date().toISOString()};
  }
  // Import original PHP/MariaDB Money Tracker v1 JSON backup WITHOUT a running server.
  if (value.format === 'money-tracker-backup' && value.version === 1) {
    const wallets=arr(value.wallets,'wallets',50).map((w,i)=> {
      if(!isObject(w))throw new Error('Invalid legacy wallet');
      return {code:w.code,name:w.name,active:Number(w.active)===0?0:1,sort_order:Number(w.sort_order??i),opening_mmk_minor:toMinor(String(w.opening_mmk??'0'),'MMK',true),opening_usd_minor:toMinor(String(w.opening_usd??'0'),'USD',true)} as Wallet;
    });
    const categories=arr(value.categories,'categories',100).map((c,i)=> {
      if(!isObject(c))throw new Error('Invalid legacy category');
      return {code:c.code,name_en:c.name_en,name_my:c.name_my,kind:c.kind,active:Number(c.active)===0?0:1,sort_order:Number(c.sort_order??i)} as Category;
    });
    const transactions=arr(value.transactions,'transactions',20000).map((t,i)=> {
      if(!isObject(t))throw new Error('Invalid legacy transaction');
      const currency=ensureCurrency(t.currency);
      return {id:`legacy_${i+1}`,date:t.date,type:t.type,currency,amount_minor:toMinor(String(t.amount),currency),description:t.description,wallet_code:t.wallet_code,to_wallet_code:t.type==='transfer'?t.to_wallet_code:null,category_code:t.type==='transfer'?null:t.category_code,created_at:new Date(Date.UTC(2020,0,1,0,0,i)).toISOString()} as Transaction;
    });
    const budgets=arr(value.budgets,'budgets',2).map(b => {
      if (!isObject(b)) throw new Error('Invalid legacy budget');
      const currency=ensureCurrency(b.currency);
      return {currency,amount_minor:toMinor(String(b.amount),currency,true)};
    });
    return {...normalizedSnapshot({wallets,categories,transactions,budgets,settings:ensurePrefs(value.settings)}),format:'money-tracker-ts-backup',version:2,exported_at:new Date().toISOString()};
  }
  throw new Error('Unsupported backup version');
}
export function makeBackup(snapshot: Snapshot): BackupV2 { return {...normalizedSnapshot(structuredCopy(snapshot)),format:'money-tracker-ts-backup',version:2,exported_at:new Date().toISOString()}; }
function structuredCopy(s: Snapshot): Snapshot {return JSON.parse(JSON.stringify(s)) as Snapshot;}
