import {Platform} from 'react-native';
import MoneyWidget from './MoneyWidget';
import MoneyWidgetSmall from './MoneyWidgetSmall';
import type {Snapshot,Currency} from './types';
import {widgetDisplayModel} from './widgetModel';
export function updateMoneyWidget(snapshot:Snapshot,currency:Currency){
 if(Platform.OS!=='android')return;
 const data=widgetDisplayModel(snapshot,currency);
 try{MoneyWidget.updateSnapshot(data);}catch(e){if(__DEV__)console.warn('Medium widget update failed',e);}
 try{MoneyWidgetSmall.updateSnapshot({amount:data.amount,currency:data.currency,isPrivate:data.isPrivate});}catch(e){if(__DEV__)console.warn('Compact widget update failed',e);}
}
