export type Currency='MMK'|'USD';
export type TransactionType='income'|'expense'|'transfer';
export interface Wallet {code:string;name:string;active:number;sort_order:number;opening_mmk_minor:number;opening_usd_minor:number}
export interface Category {code:string;name_en:string;name_my:string;kind:string;active:number;sort_order:number}
export interface Transaction {id:string;date:string;type:TransactionType;currency:Currency;amount_minor:number;description:string;wallet_code:string;to_wallet_code:string|null;category_code:string|null;created_at:string}
export interface FinancePayload {
 wallets:Wallet[];categories:Category[];transactions:Transaction[];
 budgets:{currency:Currency;amount_minor:number}[];
 settings:{language:'my'|'en';currency:Currency;dark_mode:boolean;show_wallets:boolean;widget_show_balance?:boolean};
 recurring:unknown[];categoryBudgets:unknown[];debts:unknown[];debtPayments:unknown[];
 goals:unknown[];goalContributions:unknown[];recurringOccurrences:unknown[];
}
export interface CloudEnvelope {schema:1;revision:number;deviceId:string;payload:FinancePayload;updatedAt?:unknown}
export function minorMoney(amount:number,currency:Currency):string {return currency==='MMK'?`${new Intl.NumberFormat('en-US').format(amount)} Ks`:`$${(amount/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
export function walletBalance(data:FinancePayload,code:string,currency:Currency):number {
 const wallet=data.wallets.find(w=>w.code===code);if(!wallet)return 0;
 let value=currency==='MMK'?wallet.opening_mmk_minor:wallet.opening_usd_minor;
 for(const t of data.transactions){if(t.currency!==currency)continue;if(t.wallet_code===code){value+=t.type==='income'?t.amount_minor:-t.amount_minor;}if(t.type==='transfer'&&t.to_wallet_code===code)value+=t.amount_minor;}
 return value;
}
export function computeDashboard(data:FinancePayload,currency:Currency,month:string){
 const monthTx=data.transactions.filter(t=>t.currency===currency&&t.date.startsWith(month));
 const income=monthTx.filter(x=>x.type==='income').reduce((a,t)=>a+t.amount_minor,0);
 const expense=monthTx.filter(x=>x.type==='expense').reduce((a,t)=>a+t.amount_minor,0);
 const walletRows=data.wallets.map(wallet=>({...wallet,balance:walletBalance(data,wallet.code,currency)}));
 const balance=walletRows.reduce((a,w)=>a+w.balance,0);
 return {balance,income,expense,walletRows,count:data.transactions.length};
}
export function isFinancePayload(v:unknown):v is FinancePayload {
 if(!v||typeof v!=='object')return false;const x=v as Record<string,unknown>;
 const keys=['wallets','categories','transactions','budgets','recurring','categoryBudgets','debts','debtPayments','goals','goalContributions','recurringOccurrences'];
 return keys.every(k=>Array.isArray(x[k]))&&typeof x.settings==='object'&&x.settings!==null;
}
