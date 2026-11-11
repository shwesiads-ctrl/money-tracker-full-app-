/** Native, opt-in, on-device reminders. No network, no push token, no financial data in lock-screen notices. */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type {SQLiteDatabase} from 'expo-sqlite';
import { id } from './core';
import {DEFAULT_REMINDER_PREFS, localDueAt, validateReminderTitle, validateTime} from './reminderPolicy';
import type {ReminderPrefs, SavedReminder} from './reminderPolicy';

const CHANNEL='money-tracker-reminders';
const DAILY_ID='money-tracker-daily';
const MONTHLY_ID='money-tracker-monthly';
const customId=(id:string)=>`money-tracker-custom-${id}`;

Notifications.setNotificationHandler({handleNotification:async()=>({
  shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false,
})});

export async function initReminders(db: SQLiteDatabase) {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS money_reminders (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    due_local TEXT NOT NULL,
    created_at TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS reminder_due_idx ON money_reminders(due_local);`);
  for (const [key,value] of Object.entries({
    notify_daily:'false',notify_daily_time:'20:00',notify_monthly:'false',notify_monthly_time:'09:00',
  })) await db.runAsync('INSERT OR IGNORE INTO app_settings(key,value) VALUES (?,?)',key,value);
}
export async function getReminderData(db:SQLiteDatabase):Promise<{prefs:ReminderPrefs;reminders:SavedReminder[]}> {
  await initReminders(db);
  const [rows,reminders] = await Promise.all([
    db.getAllAsync<{key:string;value:string}>("SELECT key,value FROM app_settings WHERE key LIKE 'notify_%'"),
    db.getAllAsync<{id:string;title:string;due_local:string;created_at:string}>(
      'SELECT id,title,due_local,created_at FROM money_reminders ORDER BY due_local ASC LIMIT 200'),
  ]);
  const map=Object.fromEntries(rows.map(r=>[r.key,r.value]));
  const prefs:ReminderPrefs={
    dailyEnabled:map.notify_daily==='true',
    dailyTime:map.notify_daily_time||DEFAULT_REMINDER_PREFS.dailyTime,
    monthlyEnabled:map.notify_monthly==='true',
    monthlyTime:map.notify_monthly_time||DEFAULT_REMINDER_PREFS.monthlyTime,
  };
  return {prefs,reminders:reminders.map(r=>({id:r.id,title:r.title,dueLocal:r.due_local,createdAt:r.created_at}))};
}
async function setupChannel(){
  if(Platform.OS==='android') await Notifications.setNotificationChannelAsync(CHANNEL,{
    name:'Money Tracker Reminders',importance:Notifications.AndroidImportance.DEFAULT,
    enableVibrate:false,sound:null,
  });
}
async function allowed(prompt:boolean):Promise<boolean>{
  await setupChannel();
  let p=await Notifications.getPermissionsAsync();
  if (!p.granted && prompt) p=await Notifications.requestPermissionsAsync();
  return p.granted;
}
function content(kind:string){
  // No amount, account identifier, description or user-entered title on a locked screen.
  return {title:'Money Tracker',body:kind==='daily'?'Remember to record today’s transactions.':
    kind==='monthly'?'Review your monthly money report.':'You have a scheduled reminder. Open Money Tracker to view it.',
    data:{source:'money-tracker-local-reminder',kind},sound:false as const};
}
async function scheduleDaily(time:string,monthly:boolean){
  const {hour,minute}=validateTime(time);
  const identifier=monthly?MONTHLY_ID:DAILY_ID;
  await Notifications.cancelScheduledNotificationAsync(identifier);
  await Notifications.scheduleNotificationAsync({identifier,content:content(monthly?'monthly':'daily'),trigger:monthly?
    {type:Notifications.SchedulableTriggerInputTypes.MONTHLY,day:1,hour,minute,channelId:CHANNEL}:
    {type:Notifications.SchedulableTriggerInputTypes.DAILY,hour,minute,channelId:CHANNEL}});
}
export async function saveRecurring(db:SQLiteDatabase,kind:'daily'|'monthly',enabled:boolean,time:string){
  validateTime(time);
  await initReminders(db);
  if (enabled && !await allowed(true)) throw new Error('Notification permission is required. Enable it in Android Settings.');
  const notificationId=kind==='daily'?DAILY_ID:MONTHLY_ID;
  if(enabled)await scheduleDaily(time,kind==='monthly');
  else await Notifications.cancelScheduledNotificationAsync(notificationId);
  const flag=kind==='daily'?'notify_daily':'notify_monthly';
  const field=kind==='daily'?'notify_daily_time':'notify_monthly_time';
  await db.withTransactionAsync(async()=>{
    await db.runAsync('UPDATE app_settings SET value=? WHERE key=?',enabled?'true':'false',flag);
    await db.runAsync('UPDATE app_settings SET value=? WHERE key=?',time,field);
  });
}
export async function createOneOff(db:SQLiteDatabase,title:string,date:string,time:string){
  const safeTitle=validateReminderTitle(title);
  const due=localDueAt(date,time);
  await initReminders(db);
  const count=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) AS n FROM money_reminders');
  if((count?.n||0)>=200)throw new Error('Maximum 200 reminders. Remove expired reminders first.');
  if(!await allowed(true))throw new Error('Notification permission is required.');
  const reminderId=id('r');
  const notificationId=customId(reminderId);
  await Notifications.scheduleNotificationAsync({identifier:notificationId,content:content('custom'),trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:due,channelId:CHANNEL}});
  try {
    await db.runAsync('INSERT INTO money_reminders(id,title,due_local,created_at) VALUES (?,?,?,?)',
      reminderId,safeTitle,`${date}T${time}`,new Date().toISOString());
  } catch(e) {await Notifications.cancelScheduledNotificationAsync(notificationId);throw e;}
}
export async function deleteOneOff(db:SQLiteDatabase,reminderId:string){
  await Notifications.cancelScheduledNotificationAsync(customId(reminderId));
  await db.runAsync('DELETE FROM money_reminders WHERE id=?',reminderId);
}
/** Repair missing pending OS schedules on settings visit; never prompt for permission automatically. */
export async function reconcileSchedules(db:SQLiteDatabase){
  const {prefs,reminders}=await getReminderData(db);
  if(!await allowed(false))return;
  const scheduled=new Set((await Notifications.getAllScheduledNotificationsAsync()).map(x=>x.identifier));
  // Remove orphaned notifications (e.g. an old recurring reminder after backup restore).
  if(!prefs.dailyEnabled && scheduled.has(DAILY_ID)) await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  if(!prefs.monthlyEnabled && scheduled.has(MONTHLY_ID)) await Notifications.cancelScheduledNotificationAsync(MONTHLY_ID);
  const validCustomIds=new Set(reminders.map(r=>customId(r.id)));
  for(const key of scheduled) if(key.startsWith('money-tracker-custom-')&&!validCustomIds.has(key)) await Notifications.cancelScheduledNotificationAsync(key);
  if(prefs.dailyEnabled&&!scheduled.has(DAILY_ID))await scheduleDaily(prefs.dailyTime,false);
  if(prefs.monthlyEnabled&&!scheduled.has(MONTHLY_ID))await scheduleDaily(prefs.monthlyTime,true);
  const now=Date.now();
  for (const item of reminders){
    if(scheduled.has(customId(item.id)))continue;
    const [date,time]=item.dueLocal.split('T');
    if(!date||!time)continue;
    let due:Date;
    try {due=localDueAt(date,time,new Date(now-60*1000));}catch{continue;}
    if(due.getTime()<=now)continue;
    await Notifications.scheduleNotificationAsync({identifier:customId(item.id),content:content('custom'),trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:due,channelId:CHANNEL}});
  }
}

/** A harmless device-only test notification, delivered in about 10 seconds. */
export async function sendTestNotification(){
  if(!await allowed(true))throw new Error('Allow notifications in Android Settings to receive a test.');
  await Notifications.scheduleNotificationAsync({
    content:{title:'Money Tracker',body:'Notifications are working on this device.',sound:false},
    trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:10,channelId:CHANNEL},
  });
}
