import {signOut} from 'firebase/auth';
import {doc,onSnapshot,runTransaction,serverTimestamp,Timestamp,setDoc,getDoc,deleteDoc,type Unsubscribe} from 'firebase/firestore';
import {auth,db} from './firebase';
import type {CloudEnvelope,FinancePayload,Currency,TransactionType} from './domain';
import {isFinancePayload} from './domain';

function assertOnline(){if(!auth||!db)throw Error('Firebase configuration missing. Set VITE_FIREBASE_* and rebuild Windows app.');return {auth,db};}
const bytesHex=(input:Uint8Array)=>Array.from(input,b=>b.toString(16).padStart(2,'0')).join('');
export type PairSession={sessionId:string;code:string;expiresAt:number;uid:string};
/** Spark plan: Firebase password sign-in happens BEFORE QR. QR only confirms the same-UID device. */
export async function startPair():Promise<PairSession>{
 const {auth,db}=assertOnline();const user=auth.currentUser;
 if(!user||!user.emailVerified)throw Error('Sign in and verify your Firebase email before pairing.');
 const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);
 const sessionId=bytesHex(bytes),code=String(100000+Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]!/4294967296*900000));
 const expiresAt=Date.now()+120000;
 await setDoc(doc(db,'users',user.uid,'pairs',sessionId),{
  schema:1,status:'pending',code,deviceName:'Money Tracker Windows',createdAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(expiresAt),
 });
 return {sessionId,code,expiresAt,uid:user.uid};
}
export function pairQr(session:PairSession){
 return `moneytracker://pair?uid=${encodeURIComponent(session.uid)}&session=${encodeURIComponent(session.sessionId)}&code=${encodeURIComponent(session.code)}`;
}
export async function checkPair(session:PairSession):Promise<'pending'|'approved'|'expired'|'used'>{
 const {auth,db}=assertOnline();if(auth.currentUser?.uid!==session.uid)throw Error('Pair session account mismatch');
 if(Date.now()>session.expiresAt)return 'expired';
 const snap=await getDoc(doc(db,'users',session.uid,'pairs',session.sessionId));
 if(!snap.exists())return 'used';
 const info=snap.data();
 if(info.code!==session.code||info.schema!==1)throw Error('Pair verification mismatch');
 if(info.expiresAt?.toMillis?.()<Date.now())return 'expired';
 return info.status==='approved'?'approved':'pending';
}
/** This authorizes the Windows UI only. Firebase authentication was already completed with email/password. */
export async function completePair(session:PairSession){
 const {auth,db}=assertOnline();if(auth.currentUser?.uid!==session.uid)throw Error('Pairing identity changed');
 const status=await checkPair(session);if(status!=='approved')throw Error('Android approval missing');
 // Best-effort cleanup. Expired entries can also be deleted by the signed-in owner.
 try{await deleteDoc(doc(db,'users',session.uid,'pairs',session.sessionId));}catch{}
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
