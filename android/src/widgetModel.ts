import type {Currency,Snapshot} from './types';
import {formatMoney,monthToday,totals,walletBalance} from './core';
export function widgetDisplayModel(snapshot:Snapshot,currency:Currency,month=monthToday()){
 const isPrivate=snapshot.settings.widget_show_balance!==true;
 const balance=snapshot.wallets.reduce((sum,w)=>sum+walletBalance(snapshot,w.code,currency),0);
 const period=snapshot.transactions.filter(t=>t.currency===currency&&t.date.slice(0,7)===month);
 const {income,expense}=totals(period);
 if(isPrivate)return {amount:'',income:'',expense:'',currency,isPrivate};
 return {amount:(balance<0?'-':'')+formatMoney(balance,currency),income:formatMoney(income,currency),expense:formatMoney(expense,currency),currency,isPrivate};
}
