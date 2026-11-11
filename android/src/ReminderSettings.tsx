import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Switch,Text,TextInput,TouchableOpacity,View} from 'react-native';
import type {SQLiteDatabase} from 'expo-sqlite';
import {createOneOff,deleteOneOff,getReminderData,reconcileSchedules,saveRecurring,sendTestNotification} from './notifications';
import {DEFAULT_REMINDER_PREFS} from './reminderPolicy';
import type {ReminderPrefs,SavedReminder} from './reminderPolicy';

type Colors={panel:string;surface:string;border:string;text:string;muted:string;accent:string;red:string};
type Props={db:SQLiteDatabase;lang:'my'|'en';c:Colors};
export default function ReminderSettings({db,lang,c}:Props){
  const my=lang==='my';
  const [prefs,setPrefs]=useState<ReminderPrefs>(DEFAULT_REMINDER_PREFS);
  const [items,setItems]=useState<SavedReminder[]>([]);
  const [title,setTitle]=useState('');
  const [date,setDate]=useState('');
  const [time,setTime]=useState('18:00');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const reload=useCallback(async()=>{const data=await getReminderData(db);setPrefs(data.prefs);setItems(data.reminders);},[db]);
  useEffect(()=>{let live=true;void reconcileSchedules(db).then(()=>{if(live)return reload();}).catch(e=>{if(live)setError(String(e));});return()=>{live=false;};},[db,reload]);
  const action=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await fn();await reload();}catch(e){const msg=e instanceof Error?e.message:String(e);setError(msg);Alert.alert('Reminder',msg);}finally{setBusy(false);}};
  const copy=(myText:string,enText:string)=>my?myText:enText;
  const field=(value:string,set:(v:string)=>void,placeholder:string,maxLength:number)=>
    <TextInput value={value} onChangeText={set} placeholder={placeholder} placeholderTextColor={c.muted} maxLength={maxLength} autoCorrect={false} style={{color:c.text,backgroundColor:c.surface,borderColor:c.border,borderWidth:1,borderRadius:11,minHeight:48,paddingHorizontal:13,marginTop:6,fontSize:14}}/>;
  const button=(label:string,press:()=>void,danger=false)=>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={press} style={{backgroundColor:danger?c.surface:c.accent,borderRadius:12,padding:12,minHeight:47,justifyContent:'center',alignItems:'center',marginTop:10,opacity:busy?.5:1}}><Text style={{color:danger?c.red:'#042013',fontWeight:'800',fontSize:13}}>{label}</Text></TouchableOpacity>;
  const toggle=(kind:'daily'|'monthly',enabled:boolean)=>void action(()=>saveRecurring(db,kind,enabled,kind==='daily'?prefs.dailyTime:prefs.monthlyTime));
  return <View style={{backgroundColor:c.panel,borderColor:c.border,borderWidth:1,borderRadius:22,padding:16,marginBottom:14}}>
    <Text style={{color:c.text,fontWeight:'800',fontSize:16,lineHeight:31}}>{copy('🔔 အကြောင်းကြားချက်နှင့် သတိပေးချက်','🔔 Notifications & Reminders')}</Text>
    <Text style={{color:c.muted,fontSize:12,lineHeight:22,marginBottom:8}}>{copy('ဖုန်းအတွင်း အင်တာနက်မလိုသော သတိပေးချက်များ။ ခွင့်ပြုချက်ကို ဖွင့်ချိန်မှ တောင်းခံပါမည်။','On-device reminders; no internet required. Permission is requested only when you enable a reminder.')}</Text>
    {(['daily','monthly'] as const).map(kind=>{
      const enabled=kind==='daily'?prefs.dailyEnabled:prefs.monthlyEnabled;
      const value=kind==='daily'?prefs.dailyTime:prefs.monthlyTime;
      const text=kind==='daily'?copy('နေ့စဉ် ငွေစာရင်းမှတ်ရန်','Daily transaction reminder'):copy('လစဉ် Report စစ်ဆေးရန် (လစ ၁ ရက်)','Monthly report review (1st day)');
      return <View key={kind} style={{paddingVertical:12,borderBottomWidth:1,borderColor:c.border}}>
        <View style={{flexDirection:'row',gap:12,alignItems:'center',justifyContent:'space-between'}}><Text style={{color:c.text,flex:1,fontWeight:'700',fontSize:13,lineHeight:24}}>{text}</Text><Switch value={enabled} disabled={busy} trackColor={{false:c.border,true:c.accent}} onValueChange={v=>toggle(kind,v)}/></View>
        <Text style={{color:c.muted,fontSize:11,marginTop:3}}>{copy('သတိပေးမည့်အချိန် (24h / HH:mm)','Reminder time (24h / HH:mm)')}</Text>
        {field(value,v=>setPrefs(p=>kind==='daily'?{...p,dailyTime:v}:{...p,monthlyTime:v}),'20:00',5)}
        {button(copy('အချိန်သိမ်းမည်','Save Time'),()=>void action(()=>saveRecurring(db,kind,enabled,value)))}
      </View>;
    })}
    <Text style={{color:c.text,fontSize:14,fontWeight:'800',marginTop:18,lineHeight:27}}>{copy('ကိုယ်ပိုင် Reminder ထည့်ရန်','Add Custom Reminder')}</Text>
    {field(title,setTitle,copy('ဥပမာ - အိမ်လခပေးရန်','e.g. Pay monthly rent'),100)}
    <View style={{flexDirection:'row',gap:8,marginTop:4}}><View style={{flex:1}}><Text style={{color:c.muted,fontSize:11}}>{copy('ရက်စွဲ','Date')}</Text>{field(date,setDate,'YYYY-MM-DD',10)}</View><View style={{width:100}}><Text style={{color:c.muted,fontSize:11}}>{copy('အချိန်','Time')}</Text>{field(time,setTime,'HH:mm',5)}</View></View>
    {button(copy('+ သတိပေးချက် ထည့်ရန်','+ Schedule Reminder'),()=>void action(async()=>{await createOneOff(db,title,date,time);setTitle('');setDate('');}))}
    {button(copy('🔔 စမ်းသပ် Notification ပို့မည်','🔔 Send Test Notification'),()=>void action(async()=>{await sendTestNotification();Alert.alert('Money Tracker',copy('၁၀ စက္ကန့်ခန့်အတွင်း အကြောင်းကြားချက် ပြပါမည်။','You should receive a notification in about 10 seconds.'));}))}
    <Text style={{color:c.text,fontWeight:'800',fontSize:13,lineHeight:27,marginTop:16}}>{copy('သတ်မှတ်ထားသော Reminder များ','Scheduled Reminders')} ({items.length})</Text>
    {items.length===0&&<Text style={{color:c.muted,fontSize:12,lineHeight:23}}>{copy('Reminder မရှိသေးပါ။','No custom reminders yet.')}</Text>}
    {items.map(item=><View key={item.id} style={{borderTopWidth:1,borderColor:c.border,paddingVertical:10,flexDirection:'row',gap:10,alignItems:'center'}}><View style={{flex:1}}><Text style={{color:c.text,fontSize:13,fontWeight:'700',lineHeight:24}}>{item.title}</Text><Text style={{color:c.muted,fontSize:11}}>{item.dueLocal.replace('T',' · ')}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} onPress={()=>Alert.alert(copy('Reminder ဖျက်မလား','Remove reminder?'),item.title,[{text:copy('မဖျက်ပါ','Cancel'),style:'cancel'},{text:copy('ဖျက်မည်','Remove'),style:'destructive',onPress:()=>void action(()=>deleteOneOff(db,item.id))}])} style={{padding:8}}><Text style={{color:c.red,fontSize:12,fontWeight:'700'}}>{copy('ဖျက်','Delete')}</Text></TouchableOpacity></View>)}
    {!!error&&<Text selectable style={{color:c.red,fontSize:12,marginTop:10}}>{error}</Text>}
    {busy&&<ActivityIndicator color={c.accent} style={{marginTop:10}}/>}
    <Text style={{fontSize:11,color:c.muted,lineHeight:20,marginTop:10}}>{copy('သတိ: ဖုန်း Battery Optimization နှင့် Notification Settings ကြောင့် သတိပေးချိန် နောက်ကျနိုင်ပါသည်။ Lock Screen ပေါ်တွင် ငွေပမာဏ/မှတ်ချက် မပြပါ။','Delivery can be delayed by Android battery optimization. Amounts and transaction notes never appear in lock-screen notices.')}</Text>
  </View>;
}
