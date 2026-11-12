import type {SQLiteDatabase} from 'expo-sqlite';
import {id,assertTransaction} from './core';
import type {Currency,TransactionInput} from './types';
import {assertAmount,assertDue,assertName,assertRecurring,budgetLevel,nextDue,remainingDebt} from './featurePolicy';
import type {Frequency,DebtDirection} from './featurePolicy';


export type Recurring={id:string;description:string;type:'income'|'expense';currency:Currency;amount_minor:number;wallet_code:string;category_code:string;frequency:Frequency;next_due:string;enabled:number};
export type CategoryBudget={currency:Currency;category_code:string;month:string;limit_minor:number;alert_level:string};
export type Debt={id:string;title:string;direction:DebtDirection;currency:Currency;principal_minor:number;due_date:string;created_at:string};
export type DebtPayment={id:string;debt_id:string;amount_minor:number;date:string};
export type Goal={id:string;title:string;currency:Currency;target_minor:number;created_at:string};
export type GoalContribution={id:string;goal_id:string;amount_minor:number;date:string};
export type Receipt={transaction_id:string;file_uri:string;file_mime:string};
export type FeatureSnapshot={recurring:Recurring[];categoryBudgets:CategoryBudget[];debts:Debt[];debtPayments:DebtPayment[];goals:Goal[];goalContributions:GoalContribution[];receipts:Receipt[]};

// Additive-only migration: never DROP existing v2.4 tables and never rewrite financial transactions.
export async function initFeatures(db:SQLiteDatabase){
 await db.execAsync(`
 CREATE TABLE IF NOT EXISTS recurring_templates(
 id TEXT PRIMARY KEY,description TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN('income','expense')),
 currency TEXT NOT NULL CHECK(currency IN('MMK','USD')),amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 wallet_code TEXT NOT NULL REFERENCES wallets(code),category_code TEXT NOT NULL REFERENCES categories(code),
 frequency TEXT NOT NULL CHECK(frequency IN('weekly','monthly')), next_due TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)));
 CREATE TABLE IF NOT EXISTS recurring_occurrences(
 template_id TEXT NOT NULL REFERENCES recurring_templates(id) ON DELETE CASCADE,
 due_date TEXT NOT NULL,transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
 PRIMARY KEY(template_id,due_date));
 CREATE TABLE IF NOT EXISTS category_budgets(
 currency TEXT NOT NULL CHECK(currency IN('MMK','USD')),
 category_code TEXT NOT NULL REFERENCES categories(code),month TEXT NOT NULL,
 limit_minor INTEGER NOT NULL CHECK(limit_minor>0),alert_level TEXT NOT NULL DEFAULT 'ok',
 PRIMARY KEY(currency,category_code,month));
 CREATE TABLE IF NOT EXISTS debts(
 id TEXT PRIMARY KEY,title TEXT NOT NULL,direction TEXT NOT NULL CHECK(direction IN('borrowed','lent')),
 currency TEXT NOT NULL CHECK(currency IN('MMK','USD')),principal_minor INTEGER NOT NULL CHECK(principal_minor>0),
 due_date TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS debt_payments(
 id TEXT PRIMARY KEY,debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
 amount_minor INTEGER NOT NULL CHECK(amount_minor>0),date TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS savings_goals(
 id TEXT PRIMARY KEY,title TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency IN('MMK','USD')),
 target_minor INTEGER NOT NULL CHECK(target_minor>0),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS goal_contributions(
 id TEXT PRIMARY KEY,goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
 amount_minor INTEGER NOT NULL CHECK(amount_minor>0),date TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS receipt_photos(
 transaction_id TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
 file_uri TEXT NOT NULL,file_mime TEXT NOT NULL CHECK(file_mime IN('image/jpeg','image/png')));
 CREATE INDEX IF NOT EXISTS recurring_due_idx ON recurring_templates(next_due);
 CREATE INDEX IF NOT EXISTS debts_due_idx ON debts(due_date);
 `);
}
export async function readFeatures(db:SQLiteDatabase):Promise<FeatureSnapshot>{
 const [recurring,categoryBudgets,debts,debtPayments,goals,goalContributions,receipts]=await Promise.all([
 db.getAllAsync<Recurring>('SELECT * FROM recurring_templates ORDER BY next_due'),
 db.getAllAsync<CategoryBudget>('SELECT * FROM category_budgets ORDER BY month DESC,category_code'),
 db.getAllAsync<Debt>('SELECT * FROM debts ORDER BY due_date'),
 db.getAllAsync<DebtPayment>('SELECT * FROM debt_payments ORDER BY date'),
 db.getAllAsync<Goal>('SELECT * FROM savings_goals ORDER BY created_at DESC'),
 db.getAllAsync<GoalContribution>('SELECT * FROM goal_contributions ORDER BY date'),
 db.getAllAsync<Receipt>('SELECT * FROM receipt_photos')]);
 return {recurring,categoryBudgets,debts,debtPayments,goals,goalContributions,receipts};
}
export async function addRecurring(db:SQLiteDatabase,entry:Omit<Recurring,'id'|'enabled'>){
 const base={...entry,date:entry.next_due,to_wallet_code:null};assertRecurring(base);
 const wallets=await db.getAllAsync<import('./types').Wallet>('SELECT * FROM wallets');
 const categories=await db.getAllAsync<import('./types').Category>('SELECT * FROM categories');
 assertTransaction({...base,description:entry.description,amount_minor:entry.amount_minor,type:entry.type} as TransactionInput,wallets,categories);
 await db.runAsync('INSERT INTO recurring_templates(id,description,type,currency,amount_minor,wallet_code,category_code,frequency,next_due,enabled) VALUES(?,?,?,?,?,?,?,?,?,1)',id('rec'),entry.description.trim(),entry.type,entry.currency,entry.amount_minor,entry.wallet_code,entry.category_code,entry.frequency,entry.next_due);
}
/** One due date creates exactly one ledger row. User intentionally confirms posting; no surprise debits. */
export async function postRecurring(db:SQLiteDatabase,recId:string,today:string){
 assertDue(today);
 await db.withExclusiveTransactionAsync(async(tx)=>{
  const row=await tx.getFirstAsync<Recurring>('SELECT * FROM recurring_templates WHERE id=?',recId);
  if(!row||!row.enabled)throw new Error('Recurring template unavailable');
  if(row.next_due>today)throw new Error('Not due yet');
  const found=await tx.getFirstAsync('SELECT 1 FROM recurring_occurrences WHERE template_id=? AND due_date=?',recId,row.next_due);
  if(found)throw new Error('Already posted for this due date');
  const transactionId=id('tx'),now=new Date().toISOString();
  await tx.runAsync('INSERT INTO transactions(id,date,type,currency,amount_minor,description,wallet_code,to_wallet_code,category_code,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',transactionId,row.next_due,row.type,row.currency,row.amount_minor,row.description,row.wallet_code,null,row.category_code,now);
  await tx.runAsync('INSERT INTO recurring_occurrences(template_id,due_date,transaction_id) VALUES(?,?,?)',recId,row.next_due,transactionId);
  await tx.runAsync('UPDATE recurring_templates SET next_due=? WHERE id=?',nextDue(row.next_due,row.frequency),recId);
 });
}
export async function setRecurringEnabled(db:SQLiteDatabase,id:string,enabled:boolean){await db.runAsync('UPDATE recurring_templates SET enabled=? WHERE id=?',enabled?1:0,id);}
export async function deleteRecurring(db:SQLiteDatabase,id:string){
 // Posted ledger rows remain; history is never lost because a template is deleted.
 await db.runAsync('DELETE FROM recurring_occurrences WHERE template_id=?',id);
 await db.runAsync('DELETE FROM recurring_templates WHERE id=?',id);
}
export async function setCategoryBudget(db:SQLiteDatabase,currency:Currency,category:string,month:string,limit:number){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Invalid budget month');assertAmount(limit);
 const cat=await db.getFirstAsync<{kind:string}>('SELECT kind FROM categories WHERE code=?',category);
 if(!cat||cat.kind==='income')throw new Error('Select an expense category');
 await db.runAsync('INSERT INTO category_budgets(currency,category_code,month,limit_minor,alert_level) VALUES(?,?,?,?,\'ok\') ON CONFLICT(currency,category_code,month) DO UPDATE SET limit_minor=excluded.limit_minor,alert_level=\'ok\'',currency,category,month,limit);
}
export async function removeCategoryBudget(db:SQLiteDatabase,currency:Currency,category:string,month:string){await db.runAsync('DELETE FROM category_budgets WHERE currency=? AND category_code=? AND month=?',currency,category,month);}
export async function categoryBudgetAlerts(db:SQLiteDatabase,currency:Currency,month:string){
 const limits=await db.getAllAsync<CategoryBudget>('SELECT * FROM category_budgets WHERE currency=? AND month=?',currency,month);
 const totals=await db.getAllAsync<{category_code:string;spent:number}>('SELECT category_code,SUM(amount_minor) AS spent FROM transactions WHERE currency=? AND type=\'expense\' AND substr(date,1,7)=? GROUP BY category_code',currency,month);
 const spent=new Map(totals.map(x=>[x.category_code,x.spent]));
 return limits.map(l=>({...l,spent:spent.get(l.category_code)||0,level:budgetLevel(spent.get(l.category_code)||0,l.limit_minor)}));
}
export async function addDebt(db:SQLiteDatabase,title:string,direction:DebtDirection,currency:Currency,principal:number,due:string){
 assertName(title);assertAmount(principal);assertDue(due);
 if(!['borrowed','lent'].includes(direction))throw new Error('Invalid debt direction');
 await db.runAsync('INSERT INTO debts VALUES(?,?,?,?,?,?,?)',id('debt'),title.trim(),direction,currency,principal,due,new Date().toISOString());
}
export async function addDebtPayment(db:SQLiteDatabase,debtId:string,amount:number,date:string){
 assertAmount(amount);assertDue(date);
 await db.withExclusiveTransactionAsync(async tx=>{
 const debt=await tx.getFirstAsync<Debt>('SELECT * FROM debts WHERE id=?',debtId);if(!debt)throw new Error('Debt missing');
 const prior=await tx.getFirstAsync<{total:number}>('SELECT COALESCE(SUM(amount_minor),0) AS total FROM debt_payments WHERE debt_id=?',debtId);
 remainingDebt(debt.principal_minor,[(prior?.total||0),amount]);
 await tx.runAsync('INSERT INTO debt_payments VALUES(?,?,?,?)',id('pay'),debtId,amount,date);
 });
}
export async function addGoal(db:SQLiteDatabase,title:string,currency:Currency,target:number){assertName(title);assertAmount(target);await db.runAsync('INSERT INTO savings_goals VALUES(?,?,?,?,?)',id('goal'),title.trim(),currency,target,new Date().toISOString());}
export async function addContribution(db:SQLiteDatabase,goalId:string,amount:number,date:string){assertAmount(amount);assertDue(date);await db.runAsync('INSERT INTO goal_contributions VALUES(?,?,?,?)',id('save'),goalId,amount,date);}
export async function deleteGoal(db:SQLiteDatabase,id:string){await db.runAsync('DELETE FROM savings_goals WHERE id=?',id);}
export async function putReceipt(db:SQLiteDatabase,txId:string,uri:string,mime:'image/jpeg'|'image/png'){
 if(!uri.startsWith('file://'))throw new Error('Only local receipt images are supported');
 const tx=await db.getFirstAsync('SELECT 1 FROM transactions WHERE id=?',txId);if(!tx)throw new Error('Transaction not found');
 await db.runAsync('INSERT INTO receipt_photos(transaction_id,file_uri,file_mime) VALUES(?,?,?) ON CONFLICT(transaction_id) DO UPDATE SET file_uri=excluded.file_uri,file_mime=excluded.file_mime',txId,uri,mime);
}
export async function removeReceipt(db:SQLiteDatabase,id:string){await db.runAsync('DELETE FROM receipt_photos WHERE transaction_id=?',id);}

export async function clearFeatures(db:SQLiteDatabase){
 for(const table of ['receipt_photos','recurring_occurrences','recurring_templates','category_budgets','debt_payments','debts','goal_contributions','savings_goals'])await db.runAsync(`DELETE FROM ${table}`);
}
/** Encrypted-archive restore only. All references are checked before a backup replaces the ledger. */
export function validateFeatureBackup(raw:unknown,base:import('./types').Snapshot):FeatureSnapshot{
 if(!raw||typeof raw!=='object')throw new Error('Missing feature backup');
 const record=raw as Record<string,unknown>;
 const keys=['recurring','categoryBudgets','debts','debtPayments','goals','goalContributions','receipts'] as const;
 for(const k of keys)if(!Array.isArray(record[k])||(record[k] as unknown[]).length>30000)throw new Error('Invalid feature list: '+k);
 const data=raw as FeatureSnapshot;
 const ids=(things:{id:string}[])=>new Set(things.map(x=>x.id));
 const wallet=new Set(base.wallets.map(x=>x.code)),category=new Set(base.categories.map(x=>x.code)),tx=new Set(base.transactions.map(x=>x.id));
 const recurringIds=ids(data.recurring), debtIds=ids(data.debts),goalIds=ids(data.goals);
 const unique=(arr:string[],label:string)=>{if(new Set(arr).size!==arr.length)throw new Error('Duplicate '+label);};
 unique(data.recurring.map(x=>x.id),'recurring');unique(data.debts.map(x=>x.id),'debt');unique(data.goals.map(x=>x.id),'goal');unique(data.receipts.map(x=>x.transaction_id),'receipt');
 for(const r of data.recurring){assertRecurring({...r,date:r.next_due,to_wallet_code:null});if(!wallet.has(r.wallet_code)||!category.has(r.category_code))throw new Error('Invalid recurring references');if(r.enabled!==0&&r.enabled!==1)throw new Error('Invalid recurring state');}
 for(const b of data.categoryBudgets){assertAmount(b.limit_minor);if(!category.has(b.category_code)||!['MMK','USD'].includes(b.currency)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month))throw new Error('Invalid category budget');}
 for(const d of data.debts){assertName(d.title);assertAmount(d.principal_minor);assertDue(d.due_date);if(!['borrowed','lent'].includes(d.direction)||!['MMK','USD'].includes(d.currency))throw new Error('Invalid debt');}
 for(const p of data.debtPayments){assertAmount(p.amount_minor);assertDue(p.date);if(!debtIds.has(p.debt_id))throw new Error('Broken debt payment');}
 for(const d of data.debts){remainingDebt(d.principal_minor,data.debtPayments.filter(p=>p.debt_id===d.id).map(p=>p.amount_minor));}
 for(const g of data.goals){assertName(g.title);assertAmount(g.target_minor);if(!['MMK','USD'].includes(g.currency))throw new Error('Invalid goal');}
 for(const p of data.goalContributions){assertAmount(p.amount_minor);assertDue(p.date);if(!goalIds.has(p.goal_id))throw new Error('Broken goal contribution');}
 for(const r of data.receipts){if(!tx.has(r.transaction_id)||!['image/jpeg','image/png'].includes(r.file_mime)||typeof r.file_uri!=='string'||!r.file_uri.startsWith('file://'))throw new Error('Invalid receipt');}
 return data;
}
export async function restoreFeatures(db:SQLiteDatabase,raw:FeatureSnapshot){
 for(const x of raw.recurring)await db.runAsync('INSERT INTO recurring_templates VALUES(?,?,?,?,?,?,?,?,?,?)',x.id,x.description,x.type,x.currency,x.amount_minor,x.wallet_code,x.category_code,x.frequency,x.next_due,x.enabled);
 for(const x of raw.categoryBudgets)await db.runAsync('INSERT INTO category_budgets VALUES(?,?,?,?,?)',x.currency,x.category_code,x.month,x.limit_minor,x.alert_level||'ok');
 for(const x of raw.debts)await db.runAsync('INSERT INTO debts VALUES(?,?,?,?,?,?,?)',x.id,x.title,x.direction,x.currency,x.principal_minor,x.due_date,x.created_at);
 for(const x of raw.debtPayments)await db.runAsync('INSERT INTO debt_payments VALUES(?,?,?,?)',x.id,x.debt_id,x.amount_minor,x.date);
 for(const x of raw.goals)await db.runAsync('INSERT INTO savings_goals VALUES(?,?,?,?,?)',x.id,x.title,x.currency,x.target_minor,x.created_at);
 for(const x of raw.goalContributions)await db.runAsync('INSERT INTO goal_contributions VALUES(?,?,?,?)',x.id,x.goal_id,x.amount_minor,x.date);
 for(const x of raw.receipts)await db.runAsync('INSERT INTO receipt_photos VALUES(?,?,?)',x.transaction_id,x.file_uri,x.file_mime);
}
