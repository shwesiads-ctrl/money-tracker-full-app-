import React,{useEffect,useMemo,useRef,useState} from 'react';
import {onAuthStateChanged,type User} from 'firebase/auth';
import {QRCodeSVG} from 'qrcode.react';
import {LayoutDashboard,ArrowLeftRight,Wallet,ChartNoAxesCombined,Settings2,ShieldCheck,RefreshCw,LogOut,Smartphone,Cloud,PlusCircle,AlertCircle,CheckCircle2,ArrowUpRight,ArrowDownRight,ScanLine} from 'lucide-react';
import {auth,firebaseConfigured} from './firebase';
import {startPair,checkPair,completePair,pairQr,subscribeCloud,addCloudTransaction,logOut,type PairSession} from './cloud';
import {computeDashboard,minorMoney,type CloudEnvelope,type Currency,type FinancePayload,type TransactionType} from './domain';

type Tab='dashboard'|'transactions'|'wallets'|'reports'|'settings';
const pad=(n:number)=>String(n).padStart(2,'0');
const monthNow=()=>new Date().getFullYear()+'-'+pad(new Date().getMonth()+1);
const dateNow=()=>new Date().getFullYear()+'-'+pad(new Date().getMonth()+1)+'-'+pad(new Date().getDate());
const fmt=(v:number,c:Currency)=>minorMoney(v,c);
const iconProps={size:18,strokeWidth:2};
const tabs:{id:Tab;name:string;my:string;icon:React.ReactNode}[]=[
 {id:'dashboard',name:'Dashboard',my:'ပင်မ',icon:<LayoutDashboard {...iconProps}/>},
 {id:'transactions',name:'Transactions',my:'စာရင်းများ',icon:<ArrowLeftRight {...iconProps}/>},
 {id:'wallets',name:'Wallets',my:'ပိုက်ဆံအိတ်',icon:<Wallet {...iconProps}/>},
 {id:'reports',name:'Reports',my:'အစီရင်ခံစာ',icon:<ChartNoAxesCombined {...iconProps}/>},
 {id:'settings',name:'Settings',my:'ဆက်တင်',icon:<Settings2 {...iconProps}/>}
];
function LoginView(){
 const [session,setSession]=useState<PairSession|null>(null),[msg,setMsg]=useState('Click Generate QR to authorize this computer.'),[loading,setLoading]=useState(false);
 const [seconds,setSeconds]=useState(0);const completing=useRef(false);
 const generate=async()=>{setLoading(true);completing.current=false;setSession(null);setMsg('Creating a secure pairing session…');try{const s=await startPair();setSession(s);setMsg('Scan this code using the Money Tracker Android app.');}catch(e){setMsg(String(e));}finally{setLoading(false);}};
 useEffect(()=>{if(!firebaseConfigured)return;void generate();},[]);
 useEffect(()=>{if(!session)return;let closed=false;const timer=setInterval(()=>{
  const remaining=Math.max(0,Math.ceil((session.expiresAt-Date.now())/1000));setSeconds(remaining);
  if(remaining<=0){setMsg('Pairing code expired. Generate another one.');return;}
  if(closed||completing.current)return;
  void (async()=>{try{const status=await checkPair(session);
   if(status==='approved'&&!completing.current){completing.current=true;setMsg('Approved — signing in securely…');await completePair(session);}
   else if(status==='expired'||status==='used')setMsg('Pairing code expired or used. Generate a new one.');
  }catch(e){if(!closed){completing.current=false;setMsg('Cannot verify pairing: '+String(e));}}})();
 },2500);return()=>{closed=true;clearInterval(timer);};},[session]);
 return <div className="login-center"><div className="login-card"><div className="brandmark">▥</div><h1>Money Tracker</h1><p className="my-title">Windows အက်ပ် — QR Login</p>
  {!firebaseConfigured?<div className="notice warn"><AlertCircle size={17}/> Firebase Project မချိတ်ဆက်ရသေးပါ။ Windows <code>.env</code> မှာ Firebase Web Configuration ထည့်ပြီး App ပြန် Build လုပ်ပါ။</div>:<>
   <div className="qr-wrap">{session&&seconds>0?<QRCodeSVG value={pairQr(session)} size={220} marginSize={1} bgColor="#ffffff" fgColor="#051525"/>:<ScanLine size={100} color="#417b76"/>}</div>
   <div className="pair-code">{session&&seconds>0?session.code:'------'}</div><div className="muted">Verification code • Expires in {seconds}s</div>
   <p className="helper">{msg}</p><button className="primary" disabled={loading} onClick={()=>void generate()}><RefreshCw size={16}/> {loading?'Loading…':'Generate New QR'}</button>
   <p className="muted tiny">Android: Cloud Sync → Scan Windows QR → Verify code → Approve.<br/>QR does not contain a password or authentication token.</p>
  </>}</div></div>;
}
function BalanceCard({label,value,kind}:{label:string;value:string;kind:'balance'|'income'|'expense'}){return <div className={`stat ${kind}`}><div className="stat-label">{label}</div><strong>{value}</strong><span className="stat-hint">{kind==='balance'?'Across all wallets':kind==='income'?'This month':'This month'}</span></div>;}
function App(){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[tab,setTab]=useState<Tab>('dashboard');
 const [currency,setCurrency]=useState<Currency>('MMK'),[cloud,setCloud]=useState<CloudEnvelope|null>(null);
 const [syncError,setSyncError]=useState(''),[showAdd,setShowAdd]=useState(false);
 const [draft,setDraft]=useState<{date:string;type:TransactionType;currency:Currency;amount:string;description:string;wallet:string;toWallet:string;category:string}>({date:dateNow(),type:'expense',currency:'MMK',amount:'',description:'',wallet:'Cash',toWallet:'KBZPay',category:'Food'});
 const [busy,setBusy]=useState(false);const data:FinancePayload|undefined=cloud?.payload;
 useEffect(()=>{if(!auth){setReady(true);return;}return onAuthStateChanged(auth,u=>{setUser(u);setReady(true);if(!u)setCloud(null);});},[]);
 useEffect(()=>{if(!user){setCloud(null);return;}return subscribeCloud(user.uid,r=>{setCloud(r);setSyncError('');},e=>setSyncError(e.message));},[user?.uid]);
 const sum=useMemo(()=>data?computeDashboard(data,currency,monthNow()):null,[data,currency]);
 const recent=useMemo(()=>data?[...data.transactions].filter(x=>x.currency===currency).sort((a,b)=>b.date.localeCompare(a.date)||b.created_at.localeCompare(a.created_at)).slice(0,50):[],[data,currency]);
 async function saveTx(){if(!user||!data)return;setBusy(true);try{
  const value=Number(draft.amount);if(!Number.isFinite(value)||value<=0)throw Error('Amount must be positive');
  const minor=draft.currency==='MMK'?Math.round(value):Math.round(value*100);
  await addCloudTransaction(user.uid,{date:draft.date,currency:draft.currency,type:draft.type,amount_minor:minor,description:draft.description,wallet_code:draft.wallet,category_code:draft.type==='transfer'?null:draft.category,to_wallet_code:draft.type==='transfer'?draft.toWallet:null});
  setShowAdd(false);setDraft(s=>({...s,amount:'',description:''}));
 }catch(e){setSyncError(String(e));}finally{setBusy(false);}}
 if(!ready)return <div className="loading">Money Tracker…</div>;
 if(!user)return <LoginView/>;
 return <div className="layout"><aside className="sidebar"><div className="logo"><div className="logo-badge">▥</div><div><b>Money Tracker</b><small>WINDOWS DESKTOP</small></div></div>
  <div className="side-label">MENU</div><nav>{tabs.map(x=><button key={x.id} className={'nav-btn '+(tab===x.id?'active':'')} onClick={()=>setTab(x.id)}>{x.icon}<span>{x.name}<small>{x.my}</small></span></button>)}</nav>
  <div className="side-bottom"><div className="online"><span className="online-dot"/> Firebase connected</div><div className="muted tiny">Secure QR sign-in • Sync v1</div><button className="logout" onClick={()=>void logOut()}><LogOut size={16}/> Sign out</button></div>
 </aside><main className="main"><header className="header"><div><div className="eyebrow">Money Tracker • မိမိငွေကြေးကို စီမံခန့်ခွဲပါ</div><h1>{tabs.find(x=>x.id===tab)?.name}</h1></div><div className="header-right"><span className="verified"><Cloud size={16}/> Firebase</span><button className="currency" onClick={()=>setCurrency(c=>c==='MMK'?'USD':'MMK')}>{currency} ⇄</button><button className="avatar" title={user.email||'Cloud user'}>{user.email?.[0]?.toUpperCase()||'U'}</button></div></header>
  {syncError&&<div className="notice warn"><AlertCircle size={17}/> {syncError}<button className="close" onClick={()=>setSyncError('')}>×</button></div>}
  {!data?<div className="empty-state"><Cloud size={44}/><h2>No cloud financial data yet</h2><p>Open Money Tracker on Android → Cloud Sync → <b>Upload local data</b> to link the existing SQLite ledger. This Windows app does not create demo finances.</p><p className="muted">Firebase UID: {user.uid.slice(0,8)}…</p></div>:<>
  {tab==='dashboard'&&<><div className="stats"><BalanceCard kind="balance" label="Total Balance / လက်ကျန်" value={fmt(sum!.balance,currency)}/><BalanceCard kind="income" label="Income / ဝင်ငွေ" value={fmt(sum!.income,currency)}/><BalanceCard kind="expense" label="Expense / ထွက်ငွေ" value={fmt(sum!.expense,currency)}/></div><div className="two-cols"><section className="panel"><div className="panel-head"><h2>Wallet balances</h2><Wallet size={20}/></div><div className="wallet-grid">{sum!.walletRows.map(w=><div className="wallet-box" key={w.code}><small>{w.name}</small><strong>{fmt(w.balance,currency)}</strong></div>)}</div></section><section className="panel"><div className="panel-head"><h2>This month</h2><ChartNoAxesCombined size={20}/></div><div className="month-total"><div><span>Income</span><strong className="green">{fmt(sum!.income,currency)}</strong></div><div><span>Expense</span><strong className="pink">{fmt(sum!.expense,currency)}</strong></div></div><div className="ratio"><div className="ratio-green" style={{width:`${sum!.income+sum!.expense?100*sum!.income/(sum!.income+sum!.expense):0}%`}}/></div><div className="muted tiny">Transfers are excluded from income and expense.</div></section></div><section className="panel"><div className="panel-head"><h2>Recent transactions</h2><button className="textbutton" onClick={()=>setTab('transactions')}>View all →</button></div><TransactionTable rows={recent.slice(0,7)} currency={currency}/></section></>}
  {tab==='transactions'&&<section className="panel"><div className="panel-head"><div><h2>Transactions</h2><div className="muted">{recent.length} transactions • {currency}</div></div><button className="primary" onClick={()=>{setDraft(s=>({...s,currency,wallet:data.wallets[0]?.code||'Cash',category:data.categories.find(c=>c.kind==='expense'||c.kind==='both')?.code||'Other'}));setShowAdd(true);}}><PlusCircle size={17}/> Add transaction</button></div><TransactionTable rows={recent} currency={currency}/></section>}
  {tab==='wallets'&&<section className="panel"><div className="panel-head"><h2>Wallets</h2><Wallet size={20}/></div><div className="wallet-grid large">{sum!.walletRows.map(w=><div className="wallet-box" key={w.code}><small>{w.name}</small><strong>{fmt(w.balance,currency)}</strong><span className="muted tiny">{w.active?'Active':'Inactive'}</span></div>)}</div></section>}
  {tab==='reports'&&<div className="two-cols"><section className="panel"><h2>Monthly report</h2><div className="month-total vertical"><div><span>Income</span><strong className="green">{fmt(sum!.income,currency)}</strong></div><div><span>Expense</span><strong className="pink">{fmt(sum!.expense,currency)}</strong></div><div><span>Net cash flow</span><strong>{fmt(sum!.income-sum!.expense,currency)}</strong></div></div></section><section className="panel"><h2>Financial tools</h2><div className="feature-stats">{[['Recurring',data.recurring.length],['Category budgets',data.categoryBudgets.length],['Debts',data.debts.length],['Savings goals',data.goals.length]].map(([title,num])=><div className="feature-row" key={title}><span>{title}</span><b>{num}</b></div>)}</div><p className="muted tiny">These Android financial modules are included in the cloud snapshot. Editing them on Windows is not yet available.</p></section></div>}
  {tab==='settings'&&<section className="panel"><h2>Cloud account & sync</h2><div className="feature-row"><span>Firebase Account</span><strong>{user.email||user.uid}</strong></div><div className="feature-row"><span>Cloud Revision</span><strong>{cloud?.revision}</strong></div><div className="feature-row"><span>Last writer</span><strong>{cloud?.deviceId}</strong></div><div className="feature-row"><span>Sync</span><strong className="green">Live view via Firestore</strong></div><div className="notice"><ShieldCheck size={18}/> Cloud Firestore Rules restrict data to the authenticated Firebase UID. This version does not provide end-to-end encryption.</div><div className="notice warn"><AlertCircle size={18}/> Android upload/download must be configured and enabled separately. Receipt photos, local passwords, biometrics and recovery keys are not uploaded by this foundation.</div></section>}
  </>}
  <footer>Money Tracker Windows v0.1.0 • Developer Myominaung (Myanmar) • Offline-first Android / Firebase Desktop</footer>
  </main>
  {showAdd&&data&&<div className="modal-backdrop" onClick={()=>setShowAdd(false)}><div className="dialog" onClick={e=>e.stopPropagation()}><h2>New Transaction</h2><p className="muted">Cloud transaction — updates Android after its next pull.</p><div className="form-grid"><label>Type<select value={draft.type} onChange={e=>setDraft(s=>({...s,type:e.target.value as TransactionType,category:data.categories.find(c=>c.kind===e.target.value||c.kind==='both')?.code||''}))}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select></label><label>Currency<select value={draft.currency} onChange={e=>setDraft(s=>({...s,currency:e.target.value as Currency}))}><option>MMK</option><option>USD</option></select></label><label>Date<input type="date" value={draft.date} onChange={e=>setDraft(s=>({...s,date:e.target.value}))}/></label><label>Amount<input type="number" min="0.01" step="any" value={draft.amount} onChange={e=>setDraft(s=>({...s,amount:e.target.value}))}/></label><label className="wide">Description<input maxLength={250} value={draft.description} onChange={e=>setDraft(s=>({...s,description:e.target.value}))}/></label><label>Wallet<select value={draft.wallet} onChange={e=>setDraft(s=>({...s,wallet:e.target.value}))}>{data.wallets.filter(w=>w.active).map(w=><option key={w.code} value={w.code}>{w.name}</option>)}</select></label>{draft.type==='transfer'?<label>To wallet<select value={draft.toWallet} onChange={e=>setDraft(s=>({...s,toWallet:e.target.value}))}>{data.wallets.filter(w=>w.active&&w.code!==draft.wallet).map(w=><option key={w.code} value={w.code}>{w.name}</option>)}</select></label>:<label>Category<select value={draft.category} onChange={e=>setDraft(s=>({...s,category:e.target.value}))}>{data.categories.filter(c=>c.active&&(c.kind===draft.type||c.kind==='both')).map(c=><option key={c.code} value={c.code}>{c.name_my||c.name_en}</option>)}</select></label>}</div><div className="dialog-actions"><button onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary" disabled={busy} onClick={()=>void saveTx()}>{busy?'Saving…':'Save Transaction'}</button></div></div></div>}
 </div>;
}
function TransactionTable({rows,currency}:{rows:FinancePayload['transactions'];currency:Currency}){return rows.length?<div className="tablewrap"><table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Wallet</th><th>Amount</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td>{t.date}</td><td>{t.description}</td><td><span className={`tag ${t.type}`}>{t.type==='income'?<ArrowUpRight size={14}/>:t.type==='expense'?<ArrowDownRight size={14}/>:<ArrowLeftRight size={14}/>} {t.type}</span></td><td>{t.wallet_code}</td><td className={t.type==='income'?'green':t.type==='expense'?'pink':''}>{t.type==='expense'?'-':t.type==='income'?'+':''}{fmt(t.amount_minor,currency)}</td></tr>)}</tbody></table></div>:<div className="muted empty-list">No records to display.</div>}
export default App;
