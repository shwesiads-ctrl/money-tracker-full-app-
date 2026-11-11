import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, RefreshControl, SafeAreaView, ScrollView, Image, StatusBar as RNStatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { addCategory, addWallet, clearTransactions, deleteTransaction, readSnapshot, restoreBackup, setBudget, setCategoryActive, setPrefs, setWalletActive, setWalletOpening, upsertTransaction } from './database';
import { categoryTotals, dailyTotals, dateToday, filterTransactions, formatMoney, monthlyComparison, fromMinor, isValidDate, monthToday, toMinor, totals, walletBalance } from './core';
import { exportBackup, exportCsv, selectBackup } from './export';
import { tr } from './i18n';
import type { AppPrefs, Category, CategoryKind, Currency, Snapshot, Transaction, TransactionInput, TransactionType } from './types';
import type {Account} from './account';
import ProfileSettings from './ProfileSettings';
import ReminderSettings from './ReminderSettings';
import AboutPanel from './AboutPanel';
import { mainBackAction } from './backPolicy';
import { confirmExit } from './exitDialog';

const light = { bg:'#f5f7fb',panel:'#ffffff',surface:'#f1f5f9',text:'#0f172a',muted:'#64748b',border:'#e2e8f0',accent:'#059669',accentSoft:'#ecfdf5',softText:'#475569',input:'#f8fafc',red:'#e11d48',green:'#059669' };
const dark = { bg:'#0b1421',panel:'#111e2d',surface:'#1b2d40',text:'#f4f7fb',muted:'#9baec4',border:'#294156',accent:'#22c55e',accentSoft:'#163b33',softText:'#bfd0e1',input:'#152536',red:'#fb7185',green:'#4ade80' };
type Palette = typeof light;
type Page = 'home'|'add'|'history'|'reports'|'settings';
type Mode = TransactionType;
type LabelProps = {children?:ReactNode; c:Palette; size?:number; weight?:'400'|'500'|'600'|'700'|'800'; color?:string; style?:object; lines?:number};
function Label({children,c,size=13,weight='400',color,style,lines}:LabelProps){return <Text numberOfLines={lines} style={[{fontSize:size,color:color||c.text,fontWeight:weight,lineHeight:Math.ceil(size*1.85)},style]}>{children}</Text>;}
function Panel({children,c,style}: {children:ReactNode;c:Palette;style?:object}){return <View style={[{backgroundColor:c.panel,borderColor:c.border,borderWidth:1,borderRadius:22,padding:16,marginBottom:14},style]}>{children}</View>;}
function Action({label,onPress,c,tone='normal',disabled=false,small=false}: {label:string;onPress:()=>void;c:Palette;tone?:'normal'|'primary'|'danger'|'soft';disabled?:boolean;small?:boolean}){
  const bg=tone==='primary'?c.accent:tone==='danger'?c.red:tone==='soft'?c.accentSoft:c.surface;
  const fg=(tone==='primary'||tone==='danger')?'#ffffff':tone==='soft'?c.accent:c.text;
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={{opacity:disabled?.55:1,backgroundColor:bg,paddingHorizontal:small?12:17,paddingVertical:small?7:11,borderRadius:13,alignItems:'center',justifyContent:'center'}}><Label c={c} size={small?11:13} weight="700" color={fg}>{label}</Label></TouchableOpacity>;
}
function Chips({options,value,onChange,c}: {options:{label:string;value:string}[];value:string;onChange:(v:string)=>void;c:Palette}){
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:3}}>{options.map(o=><TouchableOpacity key={o.value} accessibilityRole="button" onPress={()=>onChange(o.value)} style={{borderRadius:12,paddingHorizontal:13,paddingVertical:8,backgroundColor:value===o.value?c.accent:c.surface,borderColor:value===o.value?c.accent:c.border,borderWidth:1}}><Label c={c} size={12} weight="600" color={value===o.value?'#ffffff':c.softText}>{o.label}</Label></TouchableOpacity>)}</ScrollView>;
}
function Field({label,value,onChange,c,placeholder,keyboard='default',maxLength=180}: {label:string;value:string;onChange:(s:string)=>void;c:Palette;placeholder?:string;keyboard?:'default'|'numeric'|'decimal-pad';maxLength?:number}){
  return <View style={{marginBottom:13}}><Label c={c} size={12} color={c.muted} weight="600" style={{marginBottom:5}}>{label}</Label><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.muted} keyboardType={keyboard} maxLength={maxLength} autoCapitalize="sentences" selectionColor={c.accent} style={{color:c.text,backgroundColor:c.input,borderColor:c.border,borderWidth:1,borderRadius:14,paddingHorizontal:14,paddingVertical:11,fontSize:15,minHeight:48,textAlignVertical:'center'}}/></View>;
}
function SectionHeader({children,c}: {children:ReactNode;c:Palette}) {return <Label c={c} weight="800" size={15} style={{marginBottom:12}}>{children}</Label>;}

function MoneyTag({value,currency,color,c,size=18}: {value:number;currency:Currency;color?:string;c:Palette;size?:number}){
  return <Label c={c} size={size} weight="800" color={color||c.text} lines={1}>{value<0?'-':''}{formatMoney(value,currency)}</Label>;
}
function Bar({pct,c,color}: {pct:number;c:Palette;color:string}){
  return <View style={{height:8,borderRadius:8,backgroundColor:c.surface,overflow:'hidden'}}><View style={{height:'100%',width:`${Math.max(0,Math.min(100,pct))}%`,backgroundColor:color,borderRadius:8}}/></View>;
}
type MonthStat = ReturnType<typeof monthlyComparison>[number];
function FinancialChart({data,c,lang,currency}: {data:MonthStat[];c:Palette;lang:'my'|'en';currency:Currency}) {
  const [selected,setSelected]=useState<string|null>(null);
  const current = data[data.length - 1];
  const chosen = data.find(m=>m.month===selected) || current;
  const maxValue = Math.max(1, ...data.flatMap(x=>[x.income,x.expense]));
  const both = (current?.income || 0) + (current?.expense || 0);
  const incomePct = both > 0 ? Math.round((current?.income || 0) * 100 / both) : 0;
  const caption = lang==='my' ? 'ဝင်ငွေ / ထွက်ငွေ နှိုင်းယှဉ်ချက်' : 'Income vs Expenses';
  const trendTitle = lang==='my' ? 'နောက်ဆုံး ၆ လစာ အခြေအနေ' : 'Last 6 Months';
  const currentText = lang==='my' ? 'ယခုလ' : 'This month';
  return <Panel c={c}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}>
      <SectionHeader c={c}>{caption}</SectionHeader>
      <Label c={c} size={10} color={c.muted} weight="700">{currency}</Label>
    </View>
    <View style={{flexDirection:'row',justifyContent:'space-between',gap:10,marginBottom:8}}>
      <View style={{flex:1}}><Label c={c} color={c.muted} size={11}>{lang==='my'?'ဝင်ငွေ':'Income'}</Label><MoneyTag c={c} currency={currency} value={current?.income || 0} color={c.green} size={15}/></View>
      <View style={{flex:1,alignItems:'flex-end'}}><Label c={c} color={c.muted} size={11}>{lang==='my'?'ထွက်ငွေ':'Expense'}</Label><MoneyTag c={c} currency={currency} value={current?.expense || 0} color={c.red} size={15}/></View>
    </View>
    <View style={{height:12,borderRadius:10,overflow:'hidden',backgroundColor:c.surface,flexDirection:'row',marginBottom:5}}>
      {both>0&&<><View style={{width:`${incomePct}%`,backgroundColor:c.green}}/><View style={{flex:1,backgroundColor:c.red}}/></>}
    </View>
    <Label c={c} size={10} color={c.muted} style={{marginBottom:14}}>{both>0?`${incomePct}% ${lang==='my'?'ဝင်ငွေ':'income'}  ·  ${100-incomePct}% ${lang==='my'?'ထွက်ငွေ':'expense'}`:(lang==='my'?'ယခုလ စာရင်းမရှိသေးပါ':'No records this month')}</Label>
    <View style={{height:1,backgroundColor:c.border,marginBottom:12}}/>
    <Label c={c} color={c.softText} weight="700" size={12}>{trendTitle}</Label>
    <View style={{flexDirection:'row',justifyContent:'space-between',gap:5,marginTop:11}}>
      {data.map((entry,i)=>{
        const active=chosen?.month===entry.month;
        const monthLabel=entry.month.slice(5);
        const incomeHeight=entry.income?Math.max(6,Math.round(entry.income*93/maxValue)):0;
        const expenseHeight=entry.expense?Math.max(6,Math.round(entry.expense*93/maxValue)):0;
        return <TouchableOpacity key={entry.month} accessibilityRole="button" accessibilityLabel={`${entry.month} ${lang==='my'?'ဝင်ငွေ':'income'} ${formatMoney(entry.income,currency)}, ${lang==='my'?'ထွက်ငွေ':'expense'} ${formatMoney(entry.expense,currency)}`} accessibilityState={{selected:active}} onPress={()=>setSelected(entry.month)} activeOpacity={0.7} style={{flex:1,minWidth:0,paddingHorizontal:2,paddingVertical:5,alignItems:'center',borderRadius:9,backgroundColor:active?c.accentSoft:'transparent'}}>
          <View style={{height:99,flexDirection:'row',alignItems:'flex-end',justifyContent:'center',gap:3}}>
            <View style={{height:incomeHeight,width:11,borderTopLeftRadius:4,borderTopRightRadius:4,backgroundColor:c.green,opacity:active?1:.85}}/>
            <View style={{height:expenseHeight,width:11,borderTopLeftRadius:4,borderTopRightRadius:4,backgroundColor:c.red,opacity:active?1:.85}}/>
          </View>
          <Label c={c} size={10} color={active?c.accent:c.muted} weight={active?'800':'500'}>{monthLabel}</Label>
        </TouchableOpacity>;
      })}
    </View>
    <View style={{flexDirection:'row',gap:14,justifyContent:'center',marginTop:4,marginBottom:12}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:5}}><View style={{width:9,height:9,borderRadius:3,backgroundColor:c.green}}/><Label c={c} color={c.muted} size={11}>{lang==='my'?'ဝင်ငွေ':'Income'}</Label></View>
      <View style={{flexDirection:'row',alignItems:'center',gap:5}}><View style={{width:9,height:9,borderRadius:3,backgroundColor:c.red}}/><Label c={c} color={c.muted} size={11}>{lang==='my'?'ထွက်ငွေ':'Expense'}</Label></View>
    </View>
    {chosen&&<View style={{padding:10,backgroundColor:c.surface,borderRadius:12}}>
      <Label c={c} size={11} color={c.softText} weight="700">{chosen.month===current?.month?`${currentText} · `:''}${chosen.month}</Label>
      <View style={{flexDirection:'row',gap:6,justifyContent:'space-between',marginTop:3}}>
        <Label c={c} size={11} color={c.green} weight="700">+ {formatMoney(chosen.income,currency)}</Label>
        <Label c={c} size={11} color={c.red} weight="700">− {formatMoney(chosen.expense,currency)}</Label>
      </View>
    </View>}
  </Panel>;
}

function TransactionRow({tx,s,c,lang,onEdit,onDelete}: {tx:Transaction;s:Snapshot;c:Palette;lang:'my'|'en';onEdit:(t:Transaction)=>void;onDelete:(t:Transaction)=>void}){
  const moneycolor=tx.type==='income'?c.green:tx.type==='expense'?c.red:c.muted;
  const cat=s.categories.find(x=>x.code===tx.category_code);
  const wallet=s.wallets.find(w=>w.code===tx.wallet_code)?.name||tx.wallet_code;
  const toWallet=s.wallets.find(w=>w.code===tx.to_wallet_code)?.name||'';
  const info=tx.type==='transfer'?`${wallet} → ${toWallet}`:`${wallet} · ${cat?(lang==='my'?cat.name_my:cat.name_en):''}`;
  const sign=tx.type==='income'?'+':tx.type==='expense'?'-':'⇄ ';
  return <View style={{paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:c.border,flexDirection:'row',justifyContent:'space-between',gap:8,alignItems:'center'}}>
    <View style={{flex:1}}><Label c={c} size={13} weight="700" lines={2}>{tx.description}</Label><Label c={c} size={10} color={c.muted} lines={2}>{tx.date} · {info}</Label></View>
    <View style={{alignItems:'flex-end',gap:4,maxWidth:'43%'}}><Label c={c} size={13} weight="800" color={moneycolor} lines={1}>{sign}{formatMoney(tx.amount_minor,tx.currency)}</Label><View style={{flexDirection:'row',gap:10}}>
      <TouchableOpacity onPress={()=>onEdit(tx)}><Label c={c} color={c.accent} size={11} weight="600">✎</Label></TouchableOpacity>
      <TouchableOpacity onPress={()=>onDelete(tx)}><Label c={c} color={c.red} size={11} weight="700">✕</Label></TouchableOpacity>
    </View></View>
  </View>;
}

const formDefault = () => ({type:'expense' as Mode, amount:'', description:'', date:dateToday(), wallet:'Cash', toWallet:'KBZPay', category:'Food'});
type AuthProps={account:Account;onLock:()=>void;onUpdateProfile:(name:string,photo:boolean)=>Promise<void>;onChangePassword:(oldPassword:string,newPassword:string)=>Promise<void>;onRegenerateRecovery:(password:string)=>Promise<string>;onBiometric:(enabled:boolean)=>Promise<void>};
export default function Tracker({account,onLock,onUpdateProfile,onChangePassword,onRegenerateRecovery,onBiometric}:AuthProps){
  const db=useSQLiteContext();
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [page,setPage]=useState<Page>('home');
  const [busy,setBusy]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [form,setForm]=useState(formDefault);
  const [search,setSearch]=useState('');
  const [historyType,setHistoryType]=useState('ALL');
  const [historyWallet,setHistoryWallet]=useState('ALL');
  const [historyFrom,setHistoryFrom]=useState('');
  const [historyTo,setHistoryTo]=useState('');
  const [reportFrom,setReportFrom]=useState(`${monthToday()}-01`);
  const [reportTo,setReportTo]=useState(dateToday());
  const [budgetText,setBudgetText]=useState('');
  const [openingEdit,setOpeningEdit]=useState<string|null>(null);
  const [openingText,setOpeningText]=useState('');
  const [walletName,setWalletName]=useState('');
  const [categoryEN,setCategoryEN]=useState('');
  const [categoryMY,setCategoryMY]=useState('');
  const [categoryKind,setCategoryKind]=useState<CategoryKind>('expense');

  const refresh=useCallback(async()=>{setSnapshot(await readSnapshot(db));},[db]);
  useEffect(()=>{void refresh().catch(e=>Alert.alert('Database error',String(e)));},[refresh]);
  // Re-read the local SQLite snapshot when the user swipes down at the top.
  const onPullToRefresh=useCallback(async()=>{
    if(refreshing||busy)return;
    setRefreshing(true);
    try { await refresh(); }
    catch(e){Alert.alert('Database error',e instanceof Error?e.message:String(e));}
    finally {setRefreshing(false);}
  },[refresh,refreshing,busy]);
  const prefs:AppPrefs=snapshot?.settings||{language:'my',currency:'MMK',dark_mode:false,show_wallets:true};
  const c=prefs.dark_mode?dark:light;
  const t=tr(prefs.language);
  const currency=prefs.currency;
  const wallets=snapshot?.wallets||[];
  const categories=snapshot?.categories||[];
  const activeWallets=wallets.filter(w=>w.active===1);
  const possibleCategories=categories.filter(x=>x.active===1&&(x.kind==='both'||x.kind===form.type));
  const currentMonth=monthToday();
  const currencyTx=useMemo(()=>snapshot?filterTransactions(snapshot.transactions,{currency}):[],[snapshot,currency]);
  const monthTx=useMemo(()=>currencyTx.filter(x=>x.date.slice(0,7)===currentMonth),[currencyTx,currentMonth]);
  const monthTotal=totals(monthTx);
  const chartData=useMemo(()=>monthlyComparison(currencyTx,currentMonth,6),[currencyTx,currentMonth]);
  const overallTotal=totals(currencyTx);
  const balance=snapshot?wallets.reduce((n,w)=>n+walletBalance(snapshot,w.code,currency),0):0;
  const budget=snapshot?.budgets.find(b=>b.currency===currency)?.amount_minor||0;
  const budgetPercent=budget>0?Math.round(monthTotal.expense*100/budget):0;
  const historyItems=useMemo(()=>filterTransactions(currencyTx,{currency,search,type:historyType,wallet:historyWallet,from:historyFrom,to:historyTo}),[currencyTx,currency,search,historyType,historyWallet,historyFrom,historyTo]);
  const reportItems=useMemo(()=>filterTransactions(currencyTx,{currency,from:reportFrom,to:reportTo}),[currencyTx,currency,reportFrom,reportTo]);
  const reportTotals=totals(reportItems);
  const categoryReport=categoryTotals(reportItems);
  const dailyReport=dailyTotals(reportItems);

  const act=async(job:()=>Promise<unknown>,success=false)=>{
    if(busy)return;
    setBusy(true);
    try {await job();await refresh();if(success)Alert.alert('✓',t.saved);}catch(e){Alert.alert('Error',e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };
  const changePrefs=(patch:Partial<AppPrefs>)=>{void act(()=>setPrefs(db,patch));};
  const selectCurrency=(cur:Currency)=>{if(cur!==currency){changePrefs({currency:cur});setOpeningEdit(null);setEditingId(null);}};
  const goToAdd=()=>{const w=activeWallets[0]?.code||'Cash';const tw=activeWallets.find(x=>x.code!==w)?.code||w;
    const cat=categories.find(x=>x.active===1&&(x.kind==='expense'||x.kind==='both'))?.code||'Food';
    setEditingId(null);setForm({type:'expense',amount:'',description:'',date:dateToday(),wallet:w,toWallet:tw,category:cat});setPage('add');
  };
  const editTx=(tx:Transaction)=>{
    setEditingId(tx.id);
    setForm({type:tx.type,amount:fromMinor(tx.amount_minor,tx.currency),description:tx.description,date:tx.date,wallet:tx.wallet_code,toWallet:tx.to_wallet_code||activeWallets.find(w=>w.code!==tx.wallet_code)?.code||'',category:tx.category_code||'Other'});
    setPage('add');
  };
  const askDelete=(tx:Transaction)=>Alert.alert(t.delete,tx.description,[{text:t.cancel,style:'cancel'},{text:t.delete,style:'destructive',onPress:()=>void act(()=>deleteTransaction(db,tx.id))}]);
  const saveTx=()=>void act(async()=>{
    const kind=form.type;
    const categoryCode=categories.find(x=>x.code===form.category&&(x.kind===kind||x.kind==='both'))?.code
      ||categories.find(x=>x.active===1&&(x.kind===kind||x.kind==='both'))?.code||null;
    const otherWallet=form.toWallet!==form.wallet?form.toWallet:activeWallets.find(x=>x.code!==form.wallet)?.code||'';
    const input:TransactionInput={id:editingId||undefined,type:kind,currency,date:form.date,amount_minor:toMinor(form.amount,currency),description:form.description.trim()|| (kind==='transfer'?(prefs.language==='my'?'ငွေလွှဲ':'Transfer'):'') ,wallet_code:form.wallet,to_wallet_code:kind==='transfer'?otherWallet:null,category_code:kind==='transfer'?null:categoryCode};
    await upsertTransaction(db,input);
    setEditingId(null);setPage('home');setForm(formDefault());
  },true);
  const updateType=(next:Mode)=>{setForm(f=>({...f,type:next,category:categories.find(x=>x.active===1&&(x.kind===next||x.kind==='both'))?.code||'Other'}));};
  useEffect(()=>{
    if(Platform.OS!=='android')return;
    const listener=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(mainBackAction(page)==='goHome')setPage('home');
      else confirmExit(prefs.language);
      return true;
    });
    return ()=>listener.remove();
  },[page,prefs.language]);
  const selectedOpening=wallets.find(w=>w.code===openingEdit);
  const openBalance=(code:string)=>{const w=wallets.find(x=>x.code===code);if(!w)return;setOpeningEdit(code);setOpeningText(fromMinor(currency==='MMK'?w.opening_mmk_minor:w.opening_usd_minor,currency));};

  const header=<View style={{paddingHorizontal:15,paddingTop:11,paddingBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderColor:c.border,borderBottomWidth:1,backgroundColor:c.panel}}>
    <TouchableOpacity accessibilityLabel="Open Profile" onPress={()=>setPage('settings')}><Image source={account.avatarUri?{uri:account.avatarUri}:require('../assets/icon.png')} style={{width:42,height:42,borderRadius:21,marginRight:10}}/></TouchableOpacity>
    <View style={{flex:1,minWidth:0}}><Label c={c} size={10} lines={1} weight="700" color={c.accent}>{t.welcome}</Label><Label c={c} size={19} weight="800">{t.title}</Label></View>
    <View style={{gap:5,alignItems:'flex-end'}}><TouchableOpacity onPress={()=>changePrefs({language:prefs.language==='en'?'my':'en'})}><Label c={c} color={c.accent} weight="800" size={12}>{prefs.language==='my'?'မြန်မာ ▾':'EN ▾'}</Label></TouchableOpacity>
    <TouchableOpacity onPress={()=>selectCurrency(currency==='MMK'?'USD':'MMK')}><Label c={c} size={12} weight="800" color={c.muted}>{currency==='MMK'?'Ks ⇄ USD':'USD ⇄ Ks'}</Label></TouchableOpacity></View>
  </View>;
  const txRows=(items:Transaction[])=>snapshot?items.map(tx=><TransactionRow key={tx.id} tx={tx} s={snapshot} c={c} lang={prefs.language} onEdit={editTx} onDelete={askDelete}/>):null;

  const home=<>
    <View style={{backgroundColor:'#0e192a',padding:20,borderRadius:24,marginBottom:15}}>
      <Label c={c} color="#a7b7cc" size={12}>{t.totalBalance}</Label>
      <Label c={c} color="#ffffff" size={29} weight="800">{balance<0?'-':''}{formatMoney(balance,currency)}</Label>
      <View style={{height:1,backgroundColor:'#293749',marginVertical:16}}/>
      <View style={{flexDirection:'row',gap:10}}>
        <View style={{flex:1,backgroundColor:'#1b2b3d',borderRadius:15,padding:11}}><Label c={c} color="#9bb0c4" size={11}>{t.monthlyIncome}</Label><MoneyTag c={c} value={monthTotal.income} currency={currency} color="#4ade80" size={15}/></View>
        <View style={{flex:1,backgroundColor:'#1b2b3d',borderRadius:15,padding:11}}><Label c={c} color="#9bb0c4" size={11}>{t.monthlyExpense}</Label><MoneyTag c={c} value={monthTotal.expense} currency={currency} color="#fb7185" size={15}/></View>
      </View>
      <View style={{marginTop:16}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
        <Label c={c} color="#b5c6d6" size={11}>{t.budget}</Label><Label c={c} color={budgetPercent>=100?'#fb7185':'#4ade80'} size={11} weight="700">{budget>0?`${budgetPercent}%`:'—'} · {formatMoney(budget,currency)}</Label></View>
        <Bar c={c} pct={budgetPercent} color={budgetPercent>=100?'#f43f5e':budgetPercent>=75?'#fbbf24':'#10b981'}/>
      </View>
    </View>
    <FinancialChart c={c} currency={currency} data={chartData} lang={prefs.language}/>
    {prefs.show_wallets&&<Panel c={c}><SectionHeader c={c}>{t.wallets}</SectionHeader><View style={{flexDirection:'row',flexWrap:'wrap',gap:9}}>{wallets.map(w=>
      <View key={w.code} style={{width:'47%',flexGrow:1,padding:12,backgroundColor:c.surface,borderRadius:15}}><Label c={c} color={c.muted} size={11}>{w.name}</Label><MoneyTag value={walletBalance(snapshot!,w.code,currency)} currency={currency} c={c} color={walletBalance(snapshot!,w.code,currency)<0?c.red:c.green} size={14}/></View>
    )}</View></Panel>}
    <Panel c={c}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><SectionHeader c={c}>{t.recent}</SectionHeader><TouchableOpacity onPress={()=>setPage('history')}><Label c={c} size={12} color={c.accent} weight="700">{t.seeAll} ›</Label></TouchableOpacity></View>
      {currencyTx.length?txRows(currencyTx.slice(0,7)):<View style={{paddingVertical:20,alignItems:'center'}}><Label c={c} color={c.muted}>{t.empty}</Label><Label c={c} size={11} color={c.muted}>{t.addPrompt}</Label></View>}
    </Panel>
  </>;

  const add=<Panel c={c}>
    <SectionHeader c={c}>{editingId?`${t.edit} · ${t.title}`:t.save}</SectionHeader>
    <Chips c={c} value={form.type} onChange={v=>updateType(v as Mode)} options={[{value:'expense',label:`− ${t.expense}`},{value:'income',label:`+ ${t.income}`},{value:'transfer',label:`⇄ ${t.transfer}`}]}/>
    <View style={{height:14}}/>
    <Field c={c} label={`${t.amount} (${currency})`} value={form.amount} onChange={v=>setForm(f=>({...f,amount:v}))} keyboard="decimal-pad" placeholder={currency==='MMK'?'5000':'12.50'} maxLength={16}/>
    <Field c={c} label={t.description} value={form.description} onChange={v=>setForm(f=>({...f,description:v}))} placeholder={t.description}/>
    <Field c={c} label={t.date} value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} placeholder="2026-11-11" maxLength={10}/>
    <Label c={c} size={12} color={c.muted} weight="600">{t.wallet}</Label>
    <Chips c={c} value={form.wallet} onChange={v=>setForm(f=>({...f,wallet:v}))} options={(editingId?wallets:activeWallets).map(w=>({value:w.code,label:w.name}))}/>
    <View style={{height:14}}/>
    {form.type==='transfer'?<><Label c={c} color={c.muted} size={12} weight="600">{t.toWallet}</Label><Chips c={c} value={form.toWallet} onChange={v=>setForm(f=>({...f,toWallet:v}))} options={activeWallets.filter(w=>w.code!==form.wallet).map(w=>({value:w.code,label:w.name}))}/></>:
      <><Label c={c} color={c.muted} size={12} weight="600">{t.category}</Label><Chips c={c} value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} options={possibleCategories.map(x=>({value:x.code,label:prefs.language==='my'?x.name_my:x.name_en}))}/></>}
    <View style={{height:20}}/>
    <Action c={c} tone="primary" disabled={busy} label={busy?'…':editingId?`${t.save} ✓`:t.save} onPress={saveTx}/>
    {editingId&&<View style={{marginTop:8}}><Action c={c} label={t.cancel} onPress={goToAdd}/></View>}
  </Panel>;

  const history=<>
    <Panel c={c}><SectionHeader c={c}>{t.history}</SectionHeader>
      <Field c={c} label={t.search} value={search} onChange={setSearch} placeholder={`🔍 ${t.search}`}/>
      <Label c={c} color={c.muted} size={11} weight="700">{t.type}</Label>
      <Chips c={c} value={historyType} onChange={setHistoryType} options={[{value:'ALL',label:t.all},{value:'expense',label:t.expense},{value:'income',label:t.income},{value:'transfer',label:t.transfer}]}/>
      <View style={{height:8}}/><Label c={c} color={c.muted} size={11} weight="700">{t.wallet}</Label>
      <Chips c={c} value={historyWallet} onChange={setHistoryWallet} options={[{value:'ALL',label:t.all},...wallets.map(w=>({value:w.code,label:w.name}))]}/>
      <View style={{height:9}}/><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Field c={c} label={t.from} value={historyFrom} onChange={setHistoryFrom} maxLength={10}/></View><View style={{flex:1}}><Field c={c} label={t.to} value={historyTo} onChange={setHistoryTo} maxLength={10}/></View></View>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Label c={c} weight="700" color={c.muted}>{historyItems.length} {t.history}</Label><Action c={c} small tone="soft" label={t.exportCsv} onPress={()=>void act(()=>exportCsv(snapshot!,historyItems,currency))}/></View>
    </Panel>
    <Panel c={c}><View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}><View><Label c={c} color={c.muted} size={11}>{t.income}</Label><MoneyTag c={c} value={totals(historyItems).income} currency={currency} color={c.green} size={14}/></View><View><Label c={c} color={c.muted} size={11}>{t.expense}</Label><MoneyTag c={c} value={totals(historyItems).expense} currency={currency} color={c.red} size={14}/></View></View>
      {historyItems.length?txRows(historyItems.slice(0,200)):<Label c={c} color={c.muted}>{t.empty}</Label>}
      {historyItems.length>200&&<Label c={c} size={11} color={c.muted}>Showing first 200 records. Use filters or CSV export for more.</Label>}
    </Panel>
  </>;

  const reports=<>
    <Panel c={c}><SectionHeader c={c}>{t.reports} · {currency}</SectionHeader><Label c={c} color={c.muted} size={12}>{t.reportRange}</Label>
      <View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Field c={c} label={t.from} value={reportFrom} onChange={setReportFrom} maxLength={10}/></View><View style={{flex:1}}><Field c={c} label={t.to} value={reportTo} onChange={setReportTo} maxLength={10}/></View></View>
      <Action c={c} tone="soft" label={t.exportCsv} onPress={()=>void act(()=>exportCsv(snapshot!,reportItems,currency))}/>
      <View style={{flexDirection:'row',gap:7,marginTop:12}}>{[
        [t.income,reportTotals.income,c.green],[t.expense,reportTotals.expense,c.red],[t.net,reportTotals.net,c.text],
      ].map(([label,money,color])=><View key={label as string} style={{flex:1,padding:9,borderRadius:12,backgroundColor:c.surface}}><Label c={c} color={c.muted} size={10}>{label}</Label><MoneyTag value={money as number} currency={currency} c={c} size={13} color={color as string}/></View>)}</View>
    </Panel>
    <Panel c={c}><SectionHeader c={c}>{t.categories}</SectionHeader>{categoryReport.length?categoryReport.map(x=>{
      const cat=categories.find(z=>z.code===x.category);
      const share=reportTotals.expense>0?x.amount_minor*100/reportTotals.expense:0;
      return <View key={x.category} style={{marginBottom:14}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:5}}><Label c={c} size={12} weight="600">{cat?(prefs.language==='my'?cat.name_my:cat.name_en):x.category} · {Math.round(share)}%</Label><MoneyTag value={x.amount_minor} currency={currency} c={c} size={12} color={c.red}/></View><Bar c={c} pct={share} color={c.red}/></View>;
    }):<Label c={c} color={c.muted}>{t.empty}</Label>}</Panel>
    <Panel c={c}><SectionHeader c={c}>{t.daily}</SectionHeader>{dailyReport.slice(-20).map(x=>{
      const highest=Math.max(1,...dailyReport.map(y=>y.amount_minor));
      return <View key={x.date} style={{marginBottom:11}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Label c={c} color={c.muted} size={11}>{x.date}</Label><MoneyTag c={c} value={x.amount_minor} currency={currency} size={11} color={c.red}/></View><Bar pct={x.amount_minor*100/highest} c={c} color={c.accent}/></View>;
    })}{dailyReport.length===0&&<Label c={c} color={c.muted}>{t.empty}</Label>}</Panel>
    <Panel c={c}><SectionHeader c={c}>{t.wallets}</SectionHeader>{wallets.map(w=><View key={w.code} style={{flexDirection:'row',justifyContent:'space-between',marginBottom:9}}><Label c={c}>{w.name}</Label><MoneyTag value={walletBalance(snapshot!,w.code,currency)} currency={currency} c={c} size={13}/></View>)}</Panel>
  </>;

  const settings=<>
    <ReminderSettings db={db} lang={prefs.language} c={c}/>
    <ProfileSettings account={account} language={prefs.language} onLock={onLock} onUpdateProfile={onUpdateProfile} onChangePassword={onChangePassword} onRegenerateRecovery={onRegenerateRecovery} onBiometric={onBiometric}/>
    <Panel c={c}><SectionHeader c={c}>{t.settings}</SectionHeader>
      <Label c={c} color={c.muted} size={12} style={{marginBottom:7}}>{t.language}</Label><Chips c={c} value={prefs.language} onChange={v=>changePrefs({language:v as 'en'|'my'})} options={[{value:'my',label:'မြန်မာ'},{value:'en',label:'English'}]}/>
      <View style={{height:13}}/><Label c={c} color={c.muted} size={12}>{t.currency}</Label><Chips c={c} value={currency} onChange={v=>selectCurrency(v as Currency)} options={[{value:'MMK',label:'Myanmar Kyat (Ks)'},{value:'USD',label:'US Dollar ($)'}]}/>
      <Label c={c} size={11} color={c.muted} style={{marginTop:10,marginBottom:10}}>{t.independent}</Label>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><Label c={c} weight="600">{t.dark}</Label><Switch value={prefs.dark_mode} trackColor={{true:c.accent,false:c.border}} onValueChange={v=>changePrefs({dark_mode:v})}/></View>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Label c={c} weight="600">{t.showWallets}</Label><Switch value={prefs.show_wallets} trackColor={{true:c.accent,false:c.border}} onValueChange={v=>changePrefs({show_wallets:v})}/></View>
    </Panel>
    <Panel c={c}><SectionHeader c={c}>{t.budget} · {currency}</SectionHeader>
      <Label c={c} weight="800" color={c.accent} size={19}>{formatMoney(budget,currency)}</Label>
      <Field c={c} label={t.amount} value={budgetText} onChange={setBudgetText} placeholder={fromMinor(budget,currency)} keyboard="decimal-pad" maxLength={16}/>
      <Action c={c} tone="primary" label={t.saveBudget} onPress={()=>void act(async()=>{await setBudget(db,currency,toMinor(budgetText||fromMinor(budget,currency),currency,true));setBudgetText('');},true)}/>
    </Panel>
    <Panel c={c}><SectionHeader c={c}>{t.wallets}</SectionHeader>
      {wallets.map(w=><View key={w.code} style={{borderBottomWidth:StyleSheet.hairlineWidth,borderColor:c.border,paddingVertical:8}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <View style={{flex:1}}><Label c={c} weight="700">{w.name}</Label><Label c={c} color={c.muted} size={11}>{t.opening}: {formatMoney(currency==='MMK'?w.opening_mmk_minor:w.opening_usd_minor,currency)}</Label></View>
        <Action c={c} small label={openingEdit===w.code?t.cancel:t.change} onPress={()=>openingEdit===w.code?setOpeningEdit(null):openBalance(w.code)}/>
        <Switch value={Boolean(w.active)} trackColor={{true:c.accent,false:c.border}} onValueChange={v=>void act(()=>setWalletActive(db,w.code,v))}/>
      </View>
      {openingEdit===w.code&&<View style={{marginTop:8}}><Field c={c} label={`${t.opening} ${currency}`} value={openingText} onChange={setOpeningText} keyboard="decimal-pad" maxLength={16}/><Action c={c} tone="primary" label={t.confirm} onPress={()=>void act(async()=>{await setWalletOpening(db,w.code,currency,toMinor(openingText,currency,true));setOpeningEdit(null);},true)}/></View>}
      </View>)}
      <View style={{height:13}}/><Field c={c} label={t.newWallet} value={walletName} onChange={setWalletName} maxLength={60}/><Action c={c} label={t.addWallet} onPress={()=>void act(async()=>{await addWallet(db,walletName);setWalletName('');},true)}/>
    </Panel>
    <Panel c={c}><SectionHeader c={c}>{t.category}</SectionHeader>
      {categories.map(cat=><View key={cat.code} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:7}}><View style={{flex:1}}><Label c={c} weight="600" size={12}>{prefs.language==='my'?cat.name_my:cat.name_en}</Label><Label c={c} color={c.muted} size={10}>{cat.kind}</Label></View><Switch value={Boolean(cat.active)} trackColor={{true:c.accent,false:c.border}} onValueChange={v=>void act(()=>setCategoryActive(db,cat.code,v))}/></View>)}
      <View style={{height:10}}/><Field c={c} label={t.newCategoryEN} value={categoryEN} onChange={setCategoryEN} maxLength={60}/><Field c={c} label={t.newCategoryMY} value={categoryMY} onChange={setCategoryMY} maxLength={60}/>
      <Chips c={c} value={categoryKind} onChange={v=>setCategoryKind(v as CategoryKind)} options={[{value:'expense',label:t.expense},{value:'income',label:t.income},{value:'both',label:t.all}]}/><View style={{height:13}}/>
      <Action c={c} label={t.addCategory} onPress={()=>void act(async()=>{await addCategory(db,categoryEN,categoryMY,categoryKind);setCategoryEN('');setCategoryMY('');},true)}/>
    </Panel>
    <Panel c={c}><SectionHeader c={c}>Backup & Restore</SectionHeader><Label c={c} color={c.muted} style={{marginBottom:14}} size={12}>{t.backupWarning}</Label>
      <Action c={c} tone="primary" label={t.exportBackup} onPress={()=>void act(()=>exportBackup(snapshot!))}/><View style={{height:9}}/>
      <Action c={c} label={t.restoreBackup} onPress={()=>void act(async()=>{
        const raw=await selectBackup();if(raw===null)return;
        Alert.alert('Backup Restore',t.restore,[{text:t.cancel,style:'cancel'},{text:t.confirm,style:'destructive',onPress:()=>void act(async()=>{await restoreBackup(db,raw);setPage('home');Alert.alert('✓',t.restoreSuccess);})}]);
      })}/><View style={{height:11}}/>
      <Action c={c} tone="danger" label={t.clear} onPress={()=>Alert.alert(t.clear,t.clearWarn,[{text:t.cancel,style:'cancel'},{text:t.delete,style:'destructive',onPress:()=>void act(()=>clearTransactions(db),true)}])}/>
    </Panel>
    <AboutPanel lang={prefs.language} c={c}/>
    <Label c={c} color={c.muted} size={11} style={{textAlign:'center',marginBottom:10}}>Money Tracker v2.3 · TypeScript · Expo SQLite · Offline</Label>
  </>;

  if(!snapshot)return <SafeAreaView style={{flex:1,backgroundColor:c.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={c.accent}/></SafeAreaView>;
  const screen=page==='home'?home:page==='add'?add:page==='history'?history:page==='reports'?reports:settings;
  // Short labels prevent clipped/overlapping Myanmar glyphs on small Android screens.
  const nav:{id:Page;label:string;fullLabel:string;icon:string}[]=[
    {id:'home',label:prefs.language==='my'?'ပင်မ':'Home',fullLabel:t.home,icon:'⌂'},
    {id:'history',label:prefs.language==='my'?'စာရင်း':'History',fullLabel:t.history,icon:'☷'},
    {id:'add',label:prefs.language==='my'?'ထည့်':'Add',fullLabel:t.add,icon:'+'},
    {id:'reports',label:prefs.language==='my'?'အစီရင်ခံ':'Reports',fullLabel:t.reports,icon:'▥'},
    {id:'settings',label:prefs.language==='my'?'ဆက်တင်':'Settings',fullLabel:t.settings,icon:'⚙'},
  ];
  return <SafeAreaView style={{flex:1,backgroundColor:c.bg,paddingTop:Platform.OS==='android'?RNStatusBar.currentHeight||0:0}}>
    <StatusBar style={prefs.dark_mode?'light':'dark'}/>
    {header}
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView key={page} keyboardShouldPersistTaps="handled" style={{flex:1}}
        refreshControl={page==='add'?undefined:<RefreshControl refreshing={refreshing} onRefresh={()=>void onPullToRefresh()} colors={[c.accent]} tintColor={c.accent} progressBackgroundColor={c.panel} />}
        contentContainerStyle={{paddingHorizontal:15,paddingTop:16,paddingBottom:34}}>{screen}</ScrollView>
    </KeyboardAvoidingView>
    <View style={{backgroundColor:c.panel,borderTopWidth:1,borderColor:c.border,paddingTop:7,paddingBottom:Platform.OS==='android'?28:12,paddingHorizontal:4}}>
      <View style={{flexDirection:'row',alignItems:'flex-start',height:82}}>
        {nav.map(n=>{
          const active=page===n.id;
          const addButton=n.id==='add';
          return <TouchableOpacity key={n.id} accessibilityRole="tab" accessibilityLabel={n.fullLabel} accessibilityState={{selected:active}} activeOpacity={0.8} onPress={()=>addButton?goToAdd():setPage(n.id)} style={{flex:1,minWidth:0,height:80,alignItems:'center',justifyContent:'flex-start',paddingTop:5,borderRadius:14,backgroundColor:active&&!addButton?c.accentSoft:'transparent'}}>
            <View style={{height:38,alignItems:'center',justifyContent:'center'}}>
              <View style={{width:addButton?42:34,height:addButton?42:34,borderRadius:addButton?21:10,backgroundColor:addButton?c.accent:'transparent',alignItems:'center',justifyContent:'center'}}>
                <Text allowFontScaling={false} style={{fontSize:addButton?27:25,lineHeight:addButton?33:31,fontWeight:'800',color:addButton?'#ffffff':active?c.accent:c.muted,textAlign:'center',textAlignVertical:'center'}}>{n.icon}</Text>
              </View>
            </View>
            <Text allowFontScaling={false} adjustsFontSizeToFit numberOfLines={1} ellipsizeMode="tail" style={{width:'100%',height:29,paddingHorizontal:1,paddingTop:4,textAlign:'center',textAlignVertical:'center',includeFontPadding:true,fontSize:10.5,lineHeight:23,color:active?c.accent:c.muted,fontWeight:active?'800':'600'}}>{n.label}</Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>
    {busy&&<View pointerEvents="none" style={{position:'absolute',right:16,top:Platform.OS==='android'?RNStatusBar.currentHeight||0:0}}><ActivityIndicator color={c.accent}/></View>}
  </SafeAreaView>;
}
