import * as Notifications from 'expo-notifications';
import type {SQLiteDatabase} from 'expo-sqlite';
import type {Currency} from './types';
import {categoryBudgetAlerts} from './featureDb';
const rank=(s:string)=>({ok:0,watch:1,warning:2,limit:3}[s]||0);
export async function setBudgetAlertOptIn(db:SQLiteDatabase,enabled:boolean){
 if(enabled){const current=await Notifications.getPermissionsAsync();const p=current.granted?current:await Notifications.requestPermissionsAsync();if(!p.granted)throw new Error('Allow notifications in Android Settings first');}
 await db.runAsync('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','category_alerts',String(enabled));
}
export async function checkCategoryBudgetThresholds(db:SQLiteDatabase,currency:Currency,month:string){
 const opt=await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='category_alerts'");
 const rows=await categoryBudgetAlerts(db,currency,month);
 for(const r of rows){
  if(rank(r.level)<=rank(r.alert_level)){
   if(rank(r.level)<rank(r.alert_level))await db.runAsync('UPDATE category_budgets SET alert_level=? WHERE currency=? AND category_code=? AND month=?',r.level,currency,r.category_code,month);
   continue;
  }
  await db.runAsync('UPDATE category_budgets SET alert_level=? WHERE currency=? AND category_code=? AND month=?',r.level,currency,r.category_code,month);
  if(opt?.value==='true' && (await Notifications.getPermissionsAsync()).granted){
   const value=r.level==='limit'?'100%':r.level==='warning'?'90%':'75%';
   await Notifications.scheduleNotificationAsync({content:{title:'Money Tracker Budget',body:`A category budget passed ${value}. Open the app to review.`,sound:false},trigger:null});
  }
 }
}
