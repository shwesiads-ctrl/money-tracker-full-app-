import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue,Timestamp} from 'firebase-admin/firestore';
import {createHash,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
initializeApp();
const db=getFirestore();
const REGION='asia-southeast1';
const MAX_AGE_MS=120_000;
const SESSION=/^[A-Za-z0-9_-]{25,72}$/;
const SECRET=/^[0-9a-f]{64}$/;
const HASH=/^[0-9a-f]{64}$/;
const CODE=/^\d{6}$/;
const bad=(message:string):never=>{throw new HttpsError('invalid-argument',message);};
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const equalHex=(a:string,b:string)=>{
 if(!HASH.test(a)||!HASH.test(b))return false;
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
};
const opt={region:REGION,maxInstances:10,memory:'256MiB' as const};
const strings=(d:unknown)=>typeof d==='object'&&d!==null?d as Record<string,unknown>:{};
function sessionSecret(data:unknown){
 const d=strings(data);const sessionId=d.sessionId,secret=d.secret;
 if(typeof sessionId!=='string'||!SESSION.test(sessionId)||typeof secret!=='string'||!SECRET.test(secret))bad('Invalid pairing credentials');
 return {sessionId:sessionId as string,secret:secret as string};
}
const checkExpire=(x:{expiresAt?:Timestamp})=>{
 if(!x.expiresAt||x.expiresAt.toMillis()<Date.now())throw new HttpsError('deadline-exceeded','Pairing expired. Request another QR.');
};

/** Anonymous endpoint: rate limit by IP and short TTL. Avoid issuing auth tokens here. */
export const startPair=onCall(opt,async req=>{
 const input=strings(req.data),hash=input.secretHash,deviceName=input.deviceName;
 if(typeof hash!=='string'||!HASH.test(hash))bad('Invalid secret hash');
 if(typeof deviceName!=='string'||deviceName.length>60||deviceName.length<3)bad('Invalid device name');
 const ip=String(req.rawRequest.ip||'unknown');
 const rateId=digest(ip).slice(0,40);
 const rateRef=db.collection('pairRate').doc(rateId);
 await db.runTransaction(async t=>{
  const s=await t.get(rateRef);const now=Date.now();const current=s.data();
  const reset=!current||typeof current.resetAt!=='number'||current.resetAt<now;
  const count=reset?1:(Number(current?.count)||0)+1;
  if(count>12)throw new HttpsError('resource-exhausted','Too many QR requests. Try again later.');
  t.set(rateRef,{count,resetAt:reset?now+60_000:current?.resetAt,expireAt:Timestamp.fromMillis(now+120_000)});
 });
 const sessionId=randomBytes(24).toString('base64url');
 const code=String(randomInt(0,1_000_000)).padStart(6,'0');
 const expiresAt=Date.now()+MAX_AGE_MS;
 await db.collection('pairSessions').doc(sessionId).create({secretHash:hash,code,status:'pending',approvedUid:null,used:false,deviceName,expiresAt:Timestamp.fromMillis(expiresAt),createdAt:FieldValue.serverTimestamp()});
 return {sessionId,code,expiresAt};
});

/** Polling reveals only pending/approved/expired/used, never UID or token. */
export const pollPair=onCall(opt,async req=>{
 const {sessionId,secret}=sessionSecret(req.data);
 const snap=await db.collection('pairSessions').doc(sessionId).get();
 if(!snap.exists)throw new HttpsError('not-found','Session missing');
 const data=snap.data()!;
 if(!equalHex(String(data.secretHash),digest(secret)))throw new HttpsError('permission-denied','Invalid pairing secret');
 if(data.expiresAt.toMillis()<Date.now())return {status:'expired'};
 return {status:data.status==='approved'?'approved':data.used?'used':'pending'};
});

/** On phone: require account authentication, verified email and explicit user approval. */
export const approvePair=onCall(opt,async req=>{
 if(!req.auth?.uid||req.auth.token.email_verified!==true)throw new HttpsError('unauthenticated','Sign in with a verified email before approving QR login.');
 const data=strings(req.data),sessionId=data.sessionId,code=data.code;
 if(typeof sessionId!=='string'||!SESSION.test(sessionId)||typeof code!=='string'||!CODE.test(code))bad('Invalid QR code');
 const ref=db.collection('pairSessions').doc(sessionId as string);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError('not-found','Session not found');
  const row=snap.data()!;checkExpire(row);
  if(row.status!=='pending'||row.used)throw new HttpsError('failed-precondition','QR session no longer pending');
  if(row.code!==code)throw new HttpsError('permission-denied','Verification code does not match');
  tx.update(ref,{approvedUid:req.auth!.uid,status:'approved',approvedAt:FieldValue.serverTimestamp()});
 });
 return {approved:true};
});

/** Only the Windows caller knowing the device-held secret can consume pairing. */
export const completePair=onCall(opt,async req=>{
 const {sessionId,secret}=sessionSecret(req.data);
 const ref=db.collection('pairSessions').doc(sessionId);
 let uid='';
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError('not-found','Session not found');
  const row=snap.data()!;checkExpire(row);
  if(!equalHex(String(row.secretHash),digest(secret)))throw new HttpsError('permission-denied','Invalid desktop secret');
  if(row.used||row.status!=='approved'||typeof row.approvedUid!=='string')throw new HttpsError('failed-precondition','Not approved or already used');
  uid=row.approvedUid;
  tx.update(ref,{used:true,status:'used',consumedAt:FieldValue.serverTimestamp()});
 });
 // Only the caller who committed this one-time transaction receives the Firebase token.
 return {customToken:await getAuth().createCustomToken(uid,{desktopPair:true})};
});
