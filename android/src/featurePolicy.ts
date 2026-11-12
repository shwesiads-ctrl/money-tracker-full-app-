import type {Currency, TransactionType} from './types';
import {isValidDate} from './core';
export type Frequency='weekly'|'monthly';
export type DebtDirection='borrowed'|'lent';
export type BudgetLevel='ok'|'watch'|'warning'|'limit';
const MAX=100_000_000_000_000;
export function assertAmount(value:number, allowZero=false){
 if(!Number.isSafeInteger(value)||(allowZero?value<0:value<=0)||value>MAX)throw new Error('Invalid amount');
}
export function nextDue(date:string,frequency:Frequency):string{
 if(!isValidDate(date))throw new Error('Invalid due date');
 if(frequency!=='weekly'&&frequency!=='monthly')throw new Error('Invalid repeat frequency');
 const [y,m,d]=date.split('-').map(Number);
 const day=new Date(Date.UTC(y,m-1,d));
 if(frequency==='weekly')day.setUTCDate(day.getUTCDate()+7);
 else {const monthFirst=new Date(Date.UTC(y,m,1));const last=new Date(Date.UTC(monthFirst.getUTCFullYear(),monthFirst.getUTCMonth()+1,0)).getUTCDate();day.setTime(Date.UTC(monthFirst.getUTCFullYear(),monthFirst.getUTCMonth(),Math.min(d,last)));}
 return day.toISOString().slice(0,10);
}
export function budgetLevel(spent:number,cap:number):BudgetLevel{
 assertAmount(spent,true); assertAmount(cap);
 return spent>=cap?'limit':spent*100>=cap*90?'warning':spent*100>=cap*75?'watch':'ok';
}
export function remainingDebt(principal:number, repayments:number[]):number{
 assertAmount(principal);let paid=0;for(const x of repayments){assertAmount(x);paid+=x;}
 if(paid>principal)throw new Error('Repayment exceeds principal');return principal-paid;
}
export function goalPercent(saved:number,target:number):number{
 assertAmount(saved,true);assertAmount(target);return Math.round(Math.min(100,saved/target*100));
}
export function assertRecurring(t:{date:string;type:TransactionType;currency:Currency;amount_minor:number;wallet_code:string;to_wallet_code:string|null;category_code:string|null;description:string;frequency:Frequency}) {
 if(!isValidDate(t.date)||!['weekly','monthly'].includes(t.frequency)||!['MMK','USD'].includes(t.currency)||!['income','expense'].includes(t.type))throw new Error('Invalid recurring transaction');
 assertAmount(t.amount_minor);
 if(!t.description.trim()||t.description.length>180||!t.wallet_code||!t.category_code||t.to_wallet_code!==null)throw new Error('Invalid recurring details');
}
export function assertDue(date:string){if(!isValidDate(date))throw new Error('Use YYYY-MM-DD');}
export function assertName(name:string,max=100){if(!name.trim()||name.length>max)throw new Error(`Name required (max ${max})`);}
