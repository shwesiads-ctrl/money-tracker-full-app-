import React from 'react';
import {Alert,Image,Linking,Text,TouchableOpacity,View} from 'react-native';

type Colors={panel:string;surface:string;border:string;text:string;muted:string;accent:string};
const VERSION='2.5.2';
const PHONE='+959256060722';
const TELEGRAM='https://t.me/kominit';
const EMAIL='linkstar2012@gmail.com';
async function open(url:string){try{await Linking.openURL(url);}catch{Alert.alert('Money Tracker','Unable to open this link on your device.');}}
export default function AboutPanel({lang,c}:{lang:'my'|'en';c:Colors}){
  const my=lang==='my';
  const txt=(mm:string,en:string)=>my?mm:en;
  const row=(label:string,value:string,link?:string)=> <View style={{flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:c.border,paddingVertical:10,gap:8}}><Text style={{color:c.muted,fontSize:12,width:92,lineHeight:22}}>{label}</Text>{link?<TouchableOpacity accessibilityRole="link" onPress={()=>void open(link)} style={{flex:1}}><Text selectable style={{color:c.accent,fontSize:13,fontWeight:'700',lineHeight:24}}>{value}</Text></TouchableOpacity>:<Text selectable style={{color:c.text,fontSize:13,flex:1,fontWeight:'700',lineHeight:24}}>{value}</Text>}</View>;
  return <View style={{backgroundColor:c.panel,borderColor:c.border,borderWidth:1,borderRadius:22,padding:16,marginBottom:16}}>
    <Text style={{fontWeight:'800',color:c.text,fontSize:16,lineHeight:31}}>{txt('အက်ပ်အကြောင်း','About Software')}</Text>
    <View style={{flexDirection:'row',alignItems:'center',gap:13,marginVertical:8}}><Image source={require('../assets/icon.png')} style={{width:56,height:56,borderRadius:13}}/><View><Text style={{color:c.text,fontWeight:'800',fontSize:18,lineHeight:30}}>Money Tracker</Text><Text style={{color:c.accent,fontSize:12}}>v{VERSION} · Android · TypeScript</Text></View></View>
    <Text style={{color:c.muted,lineHeight:24,fontSize:12,marginBottom:8}}>{txt('ငွေဝင်၊ ငွေထွက်၊ Wallet၊ Budget၊ Reports နှင့် Reminder များကို ဖုန်းထဲတွင် ကိုယ်ပိုင်စီမံနိုင်သော Offline Money Tracker ဖြစ်ပါသည်။','A local-first personal finance app for tracking income, expenses, wallets, budgets, reports and reminders. All financial records stay on this device unless you explicitly export them.')}</Text>
    {row(txt('Developer','Developer'),'Myominaung (Myanmar)')}
    {row(txt('ဖုန်း','Phone'),PHONE,`tel:${PHONE}`)}
    {row('Telegram','@kominit',TELEGRAM)}
    {row('Email',EMAIL,`mailto:${EMAIL}`)}
    {row(txt('ဗားရှင်း','Version'),VERSION)}
    <Text style={{fontSize:11,lineHeight:21,marginTop:14,color:c.muted}}>{txt('React Native / Expo / SQLite ဖြင့် တည်ဆောက်ထားသည်။ Local Login သည် SQLite Database ဖိုင်ကို မိမိအလိုအလျောက် Encrypt မလုပ်ပါ။','Built with React Native, Expo, and SQLite. Local sign-in does not encrypt the underlying SQLite database.')}</Text>
  </View>;
}
