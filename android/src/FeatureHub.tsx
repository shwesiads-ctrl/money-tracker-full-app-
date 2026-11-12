import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Alert,ActivityIndicator,Switch,Text,TextInput,TouchableOpacity,View} from 'react-native';
import type {SQLiteDatabase} from 'expo-sqlite';
import type {Currency,Snapshot,Category} from './types';
import {dateToday,monthToday,toMinor,fromMinor,formatMoney} from './core';
import {addRecurring,postRecurring,setRecurringEnabled,deleteRecurring,setCategoryBudget,removeCategoryBudget,categoryBudgetAlerts,addDebt,addDebtPayment,addGoal,addContribution,deleteGoal,readFeatures} from './featureDb';
import type {FeatureSnapshot} from './featureDb';
import {goalPercent,remainingDebt} from './featurePolicy';
import type {Frequency,DebtDirection} from './featurePolicy';
import {setBudgetAlertOptIn} from './budgetNotify';

type Colors={panel:string;surface:string;border:string;text:string;muted:string;accent:string;red:string;green:string};
type Props={db:SQLiteDatabase;snapshot:Snapshot;lang:'my'|'en';c:Colors;onChanged:()=>Promise<void>;onBack:()=>void};
const empty:FeatureSnapshot={recurring:[],categoryBudgets:[],debts:[],debtPayments:[],goals:[],goalContributions:[],receipts:[]};
export default function FeatureHub({db,snapshot,lang,c,onChanged,onBack}:Props){
 const currency=snapshot.settings.currency, my=lang==='my';
 const word=(a:string,b:string)=>my?a:b;
 const [tab,setTab]=useState<'recurring'|'budgets'|'debts'|'goals'>('recurring');
 const [data,setData]=useState<FeatureSnapshot>(empty);
 const [busy,setBusy]=useState(false);
 const [amount,setAmount]=useState('');
 const [name,setName]=useState('');
 const [due,setDue]=useState(dateToday());
 const [freq,setFreq]=useState<Frequency>('monthly');
 const [kind,setKind]=useState<'income'|'expense'>('expense');
 const [direction,setDirection]=useState<DebtDirection>('lent');
 const [category,setCategory]=useState('Food');
 const [wallet,setWallet]=useState('Cash');
 const [budgetAlerts,setBudgetAlerts]=useState(false);
 const expenseCats=snapshot.categories.filter(x=>x.active===1&&(x.kind==='expense'||x.kind==='both'));
 const availableCats=snapshot.categories.filter(x=>x.active===1&&(x.kind===kind||x.kind==='both'));
 const money=(x:number)=>formatMoney(x,currency);
 const reload=useCallback(async()=>{
  const r=await readFeatures(db);setData(r);
  const pref=await db.getFirstAsync<{value:string}>("SELECT value FROM app_settings WHERE key='category_alerts'");setBudgetAlerts(pref?.value==='true');
 },[db]);
 useEffect(()=>{void reload().catch(e=>Alert.alert('Money Tracker',String(e)));},[reload]);
 const run=async(fn:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);
  try{await fn();await reload();await onChanged();setAmount('');setName('');}
  catch(e){Alert.alert('Money Tracker',e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const title=(text:string)=><Text style={{color:c.text,fontSize:16,fontWeight:'800',lineHeight:30,marginBottom:10}}>{text}</Text>;
 const note=(text:string)=><Text style={{color:c.muted,fontSize:12,lineHeight:22,marginBottom:10}}>{text}</Text>;
 const field=(label:string,value:string,set:(value:string)=>void,keyboard:'default'|'decimal-pad'='default')=><View style={{marginBottom:11}}><Text style={{color:c.muted,fontSize:12,marginBottom:5,lineHeight:22}}>{label}</Text><TextInput value={value} onChangeText={set} keyboardType={keyboard} placeholderTextColor={c.muted} style={{borderRadius:12,borderWidth:1,borderColor:c.border,color:c.text,backgroundColor:c.surface,fontSize:14,minHeight:49,paddingHorizontal:13}}/></View>;
 const action=(text:string,press:()=>void,danger=false)=><TouchableOpacity disabled={busy} accessibilityRole="button" onPress={press} style={{borderRadius:12,backgroundColor:danger?c.surface:c.accent,padding:12,minHeight:45,alignItems:'center',justifyContent:'center',marginVertical:4,opacity:busy?.6:1}}><Text style={{color:danger?c.red:'#ffffff',fontSize:13,fontWeight:'800',lineHeight:24}}>{text}</Text></TouchableOpacity>;
 const options=(items:{value:string;label:string}[],value:string,set:(next:string)=>void)=><View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:12}}>{items.map(o=><TouchableOpacity key={o.value} accessibilityRole="button" onPress={()=>set(o.value)} style={{backgroundColor:value===o.value?c.accent:c.surface,borderRadius:10,paddingHorizontal:10,paddingVertical:9,borderWidth:1,borderColor:c.border}}><Text style={{color:value===o.value?'#ffffff':c.text,fontSize:12,lineHeight:22,fontWeight:'700'}}>{o.label}</Text></TouchableOpacity>)}</View>;
 const panel=(children:React.ReactNode)=><View style={{backgroundColor:c.panel,borderColor:c.border,borderWidth:1,borderRadius:18,padding:14,marginBottom:13}}>{children}</View>;
 const prompt=(heading:string,message:string,fn:()=>void)=>Alert.alert(heading,message,[{text:word('မလုပ်တော့ပါ','Cancel'),style:'cancel'},{text:word('အတည်ပြု','Confirm'),onPress:fn}]);
 const recurring=data.recurring.filter(x=>x.currency===currency);
 const catSpending=useMemo(()=>{
  const values=new Map<string,number>();for(const t of snapshot.transactions)if(t.currency===currency&&t.type==='expense'&&t.date.startsWith(monthToday()))values.set(t.category_code||'',(values.get(t.category_code||'')||0)+t.amount_minor);
  return values;
 },[snapshot,currency]);
 const budgetRows=data.categoryBudgets.filter(x=>x.currency===currency&&x.month===monthToday());
 const categoryLabel=(code:string)=>{const item=snapshot.categories.find(x=>x.code===code);return item?(my?item.name_my:item.name_en):code;};
 const formAmount=()=>toMinor(amount,currency);
 const commonFields=<>{field(word('အမည်/မှတ်ချက်','Title or description'),name,setName)}{field(word('ငွေပမာဏ','Amount')+` (${currency})`,amount,setAmount,'decimal-pad')}</>;
 return <View>
  {panel(<><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>{title(word('ငွေကြေး စီမံခန့်ခွဲမှု','Financial Tools'))}<TouchableOpacity onPress={onBack} accessibilityRole="button" style={{padding:8}}><Text style={{color:c.accent,fontWeight:'800'}}>✕</Text></TouchableOpacity></View>{note(word('အသစ်ထည့်သော စာရင်းများကို ဖုန်းအတွင်း SQLite မှာသိမ်းပါသည်။','New entries are stored in your on-device SQLite database.'))}{options([{value:'recurring',label:'↻ '+word('ပုံမှန်စာရင်း','Recurring')},{value:'budgets',label:'▤ '+word('ဘတ်ဂျက်','Budgets')},{value:'debts',label:'⇄ '+word('အကြွေး','Debts')},{value:'goals',label:'◎ '+word('ငွေစု','Goals')}],tab,v=>setTab(v as typeof tab))}</>)}
  {tab==='recurring'&&<>
   {panel(<>{title(word('ပုံမှန် ဝင်/ထွက်ငွေ','Recurring Transactions'))}{note(word('သတ်မှတ်ရက်ရောက်မှ Confirm နှိပ်၍ စာရင်းထည့်မယ်။ Auto-charge မလုပ်ပါ။','Due transactions are posted only after you confirm; there is no automatic charge.'))}
   {commonFields}
   {options([{value:'expense',label:word('ထွက်ငွေ','Expense')},{value:'income',label:word('ဝင်ငွေ','Income')}],kind,v=>{setKind(v as typeof kind);setCategory(v==='income'?'Salary':'Food');})}
   {field(word('နောက်တစ်ကြိမ် နေ့စွဲ YYYY-MM-DD','Next due YYYY-MM-DD'),due,setDue)}
   {options([{value:'weekly',label:word('အပတ်စဉ်','Weekly')},{value:'monthly',label:word('လစဉ်','Monthly')}],freq,v=>setFreq(v as Frequency))}
   {options(snapshot.wallets.filter(w=>w.active===1).map(w=>({value:w.code,label:w.name})),wallet,setWallet)}
   {options(availableCats.map(cat=>({value:cat.code,label:my?cat.name_my:cat.name_en})),category,setCategory)}
   {action(word('+ ပုံမှန်စာရင်း သိမ်းမည်','+ Save Recurring Template'),()=>void run(()=>addRecurring(db,{description:name,type:kind,currency,amount_minor:formAmount(),wallet_code:wallet,category_code:category,frequency:freq,next_due:due})))}</>)}
   {recurring.map(r=>panel(<View key={r.id}><Text style={{fontSize:14,fontWeight:'700',color:c.text,lineHeight:27}}>{r.description}</Text>{note(`${money(r.amount_minor)} · ${r.frequency} · ${r.next_due}`)}
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:12,color:c.muted}}>{word('ဖွင့်ထား','Enabled')}</Text><Switch value={!!r.enabled} onValueChange={v=>void run(()=>setRecurringEnabled(db,r.id,v))}/></View>
    {r.enabled===1&&action(word('✓ ရောက်ရှိပြီးစာရင်း Confirm','✓ Confirm & Post Due Entry'),()=>prompt('Recurring Transaction',`${r.description} · ${money(r.amount_minor)} · ${r.next_due}`,()=>void run(()=>postRecurring(db,r.id,dateToday()))))}
    {action(word('ဖျက်မည်','Delete template'),()=>prompt('Remove template?',r.description,()=>void run(()=>deleteRecurring(db,r.id))),true)}
   </View>))}
  </>}
  {tab==='budgets'&&<>
   {panel(<>{title(word('ကဏ္ဍအလိုက် လစဉ်ဘတ်ဂျက်','Category Monthly Budgets'))}
    {note(word('ယခုလအတွက် Category Limit ထည့်ပါ။ 75%, 90%, 100% ရောက်လျှင် သတိပေးပါမည်။','Set limits for this month. Alerts appear at 75%, 90%, and 100%.'))}
    {options(expenseCats.map(cat=>({value:cat.code,label:my?cat.name_my:cat.name_en})),category,setCategory)}
    {field(word('ဘတ်ဂျက် ကန့်သတ်ချက်','Budget limit'),amount,setAmount,'decimal-pad')}
    {action(word('သိမ်းမည်','Save Category Limit'),()=>void run(()=>setCategoryBudget(db,currency,category,monthToday(),formAmount())))}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:12}}><Text style={{color:c.text,fontSize:12,flex:1}}>{word('ဖုန်း Notification သတိပေးချက်','Phone notifications for thresholds')}</Text><Switch value={budgetAlerts} onValueChange={v=>void run(()=>setBudgetAlertOptIn(db,v))}/></View>
    {note(word('သတိပေးချက်တွင် ငွေပမာဏနှင့် ကဏ္ဍအမည် မဖော်ပြပါ။','Notification text does not show amounts or category names.'))}
   </>)}
   {budgetRows.map(b=>{const spent=catSpending.get(b.category_code)||0,pct=Math.round(spent*100/b.limit_minor);return panel(<View key={b.category_code}><Text style={{color:c.text,fontWeight:'800',fontSize:14,lineHeight:25}}>{categoryLabel(b.category_code)} · {pct}%</Text>
    {note(`${money(spent)} / ${money(b.limit_minor)}`)}
    <View style={{height:9,backgroundColor:c.surface,borderRadius:5,overflow:'hidden'}}><View style={{width:`${Math.min(pct,100)}%`,height:'100%',backgroundColor:pct>=100?c.red:pct>=75?'#eab308':c.green}}/></View>
    {pct>=75&&<Text style={{fontSize:12,color:pct>=100?c.red:'#b8860b',marginTop:8}}>{pct>=100?'⚠ Limit reached':'⚠ Approaching limit'}</Text>}
    {action(word('Limit ဖယ်ရှား','Remove budget'),()=>void run(()=>removeCategoryBudget(db,currency,b.category_code,b.month)),true)}</View>);})}
  </>}
  {tab==='debts'&&<>
   {panel(<>{title(word('အကြွေးနှင့် ချေးငွေ','Debt & Loan Tracker'))}{note(word('ငွေချေးခြင်းကို မှတ်တမ်းသာထားပါတယ်။ Wallet မှာ အလိုအလျောက် မပေါင်း/မနုတ်ပါ။','Tracks obligations only; does not automatically change wallet balances.'))}
    {commonFields}
    {options([{value:'lent',label:word('သူများကိုချေးပေး','Money lent')},{value:'borrowed',label:word('ချေးယူထား','Money borrowed')}],direction,v=>setDirection(v as DebtDirection))}
    {field(word('ပြန်ဆပ်ရက် YYYY-MM-DD','Due date YYYY-MM-DD'),due,setDue)}
    {action(word('+ အကြွေးစာရင်း ထည့်မည်','+ Add Debt / Loan'),()=>void run(()=>addDebt(db,name,direction,currency,formAmount(),due)))}
   </>)}
   {data.debts.filter(d=>d.currency===currency).map(debt=>{
    const paid=data.debtPayments.filter(p=>p.debt_id===debt.id).reduce((s,p)=>s+p.amount_minor,0);
    const remain=debt.principal_minor-paid;
    return panel(<View key={debt.id}><Text style={{color:c.text,fontSize:14,fontWeight:'800',lineHeight:26}}>{debt.title}</Text>
      {note(`${debt.direction} · ${word('ပြန်ဆပ်ရက်','Due')}: ${debt.due_date}`)}
      <Text style={{color:remain>0?c.red:c.green,fontWeight:'800',fontSize:16}}>{word('ကျန်ငွေ','Remaining')}: {money(remain)}</Text>
      {paid>0&&note(`${word('ပြန်ဆပ်ပြီး','Paid')}: ${money(paid)}`)}
      {remain>0&&action(word('ပြန်ဆပ်ငွေ ထည့်မည်','Record Repayment'),()=>{
       if(!amount){Alert.alert('Repayment',word('အပေါ်က Amount မှာ ပြန်ဆပ်ငွေဖြည့်ပါ','Enter repayment amount in the amount field above.'));return;}
       const value=formAmount();prompt('Confirm repayment',`${money(value)} · ${debt.title}`,()=>void run(()=>addDebtPayment(db,debt.id,value,dateToday())));
      })}
    </View>);})}
  </>}
  {tab==='goals'&&<>
   {panel(<>{title(word('ငွေစုရန် ရည်မှန်းချက်များ','Savings Goals'))}{note(word('ငွေစု Goal ပမာဏသည် Wallet Transfer မဟုတ်ပါ။ Wallet တကယ်ပြောင်းပါက Transactions မှာ ထပ်မှတ်ပါ။','Goal contributions are tracking entries, not wallet transfers. Use Transactions for actual money movement.'))}
    {commonFields}{action(word('+ ငွေစု Goal ထည့်မည်','+ Create Savings Goal'),()=>void run(()=>addGoal(db,name,currency,formAmount())))}
   </>)}
   {data.goals.filter(g=>g.currency===currency).map(g=>{
    const saved=data.goalContributions.filter(x=>x.goal_id===g.id).reduce((a,x)=>a+x.amount_minor,0);
    const pct=goalPercent(saved,g.target_minor);
    return panel(<View key={g.id}><Text style={{color:c.text,fontSize:14,fontWeight:'800',lineHeight:26}}>{g.title}</Text>{note(`${money(saved)} / ${money(g.target_minor)} (${pct}%)`)}
     <View style={{height:10,backgroundColor:c.surface,borderRadius:5,overflow:'hidden',marginBottom:10}}><View style={{height:'100%',width:`${pct}%`,backgroundColor:c.green}}/></View>
     {action(word('+ ငွေစုမှတ်တမ်း ထည့်မည်','+ Record Contribution'),()=>{
      if(!amount){Alert.alert('Savings',word('အပေါ်က Amount ဖြည့်ပါ','Enter contribution amount in the amount field above.'));return;}
      const value=formAmount();prompt('Confirm contribution',`${money(value)} · ${g.title}`,()=>void run(()=>addContribution(db,g.id,value,dateToday())));
     })}
     {action(word('Goal ဖျက်မည်','Delete goal'),()=>prompt('Delete goal?',g.title,()=>void run(()=>deleteGoal(db,g.id))),true)}
    </View>);})}
  </>}
  {busy&&<ActivityIndicator color={c.accent} style={{marginVertical:8}}/>}
 </View>;
}
