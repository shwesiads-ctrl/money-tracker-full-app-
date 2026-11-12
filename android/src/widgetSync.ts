import {Platform} from 'react-native';
import MoneyWidget from './MoneyWidget';
import type {Snapshot,Currency} from './types';
import {formatMoney,walletBalance} from './core';
/** On-device widget. No credentials or transaction notes are ever exposed. */
export function updateMoneyWidget(snapshot:Snapshot,currency:Currency){
 if(Platform.OS!=='android')return;
 const show=snapshot.settings.widget_show_balance===true;
 const balance=snapshot.wallets.reduce((sum,w)=>sum+walletBalance(snapshot,w.code,currency),0);
 try {MoneyWidget.updateSnapshot({headline:show?formatMoney(balance,currency):'Your money stays private',summary:show?`${currency} balance · tap for details`:'Open app to view dashboard'});}catch{}
}
