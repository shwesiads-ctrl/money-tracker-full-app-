import {signInWithCustomToken,signOut} from 'firebase/auth';
import {doc,onSnapshot,runTransaction,serverTimestamp,type Unsubscribe} from 'firebase/firestore';
import {httpsCallable} from 'firebase/functions';
import {auth,db,functions} from './firebase';
import type {CloudEnvelope,FinancePayload,Currency,TransactionType} from './domain';
import {isFinancePayload} from './domain';

function assertOnline(){if(!auth||!db||!functions)throw Error('Firebase configuration missing. Set VITE_FIREBASE_* and rebuild Windows app.');return {auth,db,functions};}
const bytesHex=(input:Uint8Array)=>Array.from(input,b=>b.toString(16).padStart(2,'0')).join('');
export async function newSecret(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const secret=bytesHex(bytes);return {secret,secretHash:bytesHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))))};}
export type PairSession={sessionId:string;code:string;expiresAt:number;secret:string};
export async function startPair():Promise<PairSession>{
 const {functions}=assertOnline();const {secret,secretHash}=await newSecret();
 const callable=httpsCallable<{secretHash:string;deviceName:string},{sessionId:string;code:string;expiresAt:number}>(functions,'startPair');
 const response=await callable({secretHash,deviceName:'Money Tracker Windows'});
 if(!/^[A-Za-z0-9_-]{24,80}$/.test(response.data.sessionId))throw Error('Invalid pairing session from server');
 return {...response.data,secret};
}
export function pairQr(session:PairSession){return `moneytracker://pair?session=${encodeURIComponent(session.sessionId)}&code=${encodeURIComponent(session.code)}`;}
export async function checkPair(session:PairSession):Promise<'pending'|'approved'|'expired'|'used'>{
 const {functions}=assertOnline();const fn=httpsCallable<{sessionId:string;secret:string},{status:'pending'|'approved'|'expired'|'used'}>(functions,'pollPair');
 const r=await fn({sessionId:session.sessionId,secret:session.secret});return r.data.status;
}
export async function completePair(session:PairSession){
 const {functions,auth}=assertOnline();
 const fn=httpsCallable<{sessionId:string;secret:string},{customToken:string}>(functions,'completePair');
 const token=(await fn({sessionId:session.sessionId,secret:session.secret})).data.customToken;
 await signInWithCustomToken(auth,token);
}
export async function logOut(){if(auth)await signOut(auth);}
export function subscribeCloud(uid:string,onChange:(data:CloudEnvelope|null)=>void,onError:(error:Error)=>void):Unsubscribe{
 const {db}=assertOnline();
 return onSnapshot(doc(db,'users',uid,'sync','main'),snap=>{
  if(!snap.exists()){onChange(null);return;}
  const raw=snap.data() as CloudEnvelope;
  if(raw.schema!==1||!Number.isSafeInteger(raw.revision)||!isFinancePayload(raw.payload)){onError(Error('Unsupported or invalid cloud sync schema'));return;}
  onChange(raw);
 },e=>onError(e));
}
export async function addCloudTransaction(uid:string,entry:{date:string;currency:Currency;type:TransactionType;wallet_code:string;category_code:string|null;to_wallet_code:string|null;amount_minor:number;description:string}){
 const {db}=assertOnline();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isSafeInteger(entry.amount_minor)||entry.amount_minor<=0||entry.amount_minor>1e12)throw Error('Invalid date or amount');
 if(!entry.description.trim()||entry.description.length>250)throw Error('Description required (max 250)');
 const target=doc(db,'users',uid,'sync','main');
 await runTransaction(db,async tx=>{
  const existing=await tx.get(target);
  if(!existing.exists())throw Error('Sync from Android first');
  const record=existing.data() as CloudEnvelope;
  if(!isFinancePayload(record.payload)||!Number.isSafeInteger(record.revision))throw Error('Cloud record invalid');
  const wallet=record.payload.wallets.find(w=>w.code===entry.wallet_code&&w.active);
  if(!wallet)throw Error('Choose an active wallet');
  if(entry.type==='transfer'){
   if(!entry.to_wallet_code||entry.to_wallet_code===entry.wallet_code||!record.payload.wallets.some(w=>w.code===entry.to_wallet_code&&w.active))throw Error('Select a different destination wallet');
  } else if(!entry.category_code||!record.payload.categories.some(c=>c.code===entry.category_code&&c.active&&(c.kind===entry.type||c.kind==='both')))throw Error('Select an eligible category');
  const txEntry={...entry,id:`win_${crypto.randomUUID()}`,description:entry.description.trim(),created_at:new Date().toISOString(),to_wallet_code:entry.type==='transfer'?entry.to_wallet_code:null,category_code:entry.type==='transfer'?null:entry.category_code};
  const payload:FinancePayload={...record.payload,transactions:[txEntry,...record.payload.transactions]};
  if(JSON.stringify(payload).length>760000)throw Error('Cloud snapshot is too large. Needs paged sync migration.');
  tx.update(target,{schema:1,revision:record.revision+1,deviceId:'windows',payload,updatedAt:serverTimestamp()});
 });
}
