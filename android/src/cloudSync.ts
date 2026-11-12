import type {SQLiteDatabase} from 'expo-sqlite';
import {doc,getDoc,runTransaction,serverTimestamp} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import {cloudDb} from './cloudClient';
import {readSnapshot,restoreBackup} from './database';
import {readFeatures} from './featureDb';
import type {FeatureSnapshot} from './featureDb';
import type {Snapshot} from './types';

export type CloudPayload=Snapshot & Omit<FeatureSnapshot,'receipts'> & {recurringOccurrences:{template_id:string;due_date:string;transaction_id:string}[]};
export type RemoteDoc={schema:1;revision:number;deviceId:string;payload:CloudPayload};
type State={owner_uid:string;revision:number;local_hash:string};

export async function initCloudMetadata(db:SQLiteDatabase){
 await db.execAsync('CREATE TABLE IF NOT EXISTS cloud_sync_meta (id INTEGER PRIMARY KEY NOT NULL CHECK(id=1), owner_uid TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, local_hash TEXT NOT NULL DEFAULT \'\');');
}
async function pinnedOwner(db:SQLiteDatabase,uid:string):Promise<State>{
 await initCloudMetadata(db);
 const current=await db.getFirstAsync<State>('SELECT owner_uid,revision,local_hash FROM cloud_sync_meta WHERE id=1');
 if(current&&current.owner_uid!==uid)throw Error('This local ledger belongs to another Firebase UID. Export a backup before switching accounts.');
 if(!current)await db.runAsync('INSERT INTO cloud_sync_meta(id,owner_uid,revision,local_hash) VALUES (1,?,0,\'\')',uid);
 return current||{owner_uid:uid,revision:0,local_hash:''};
}
async function markState(db:SQLiteDatabase,uid:string,revision:number,hash:string){
 await db.runAsync('UPDATE cloud_sync_meta SET revision=?,local_hash=? WHERE id=1 AND owner_uid=?',revision,hash,uid);
}
function validatePayload(data:unknown):asserts data is CloudPayload{
 if(!data||typeof data!=='object')throw Error('Invalid cloud payload');
 const v=data as Record<string,unknown>;
 for(const k of ['wallets','categories','transactions','budgets','recurring','categoryBudgets','debts','debtPayments','goals','goalContributions','recurringOccurrences'])if(!Array.isArray(v[k]))throw Error('Missing cloud table: '+k);
 if(!v.settings||typeof v.settings!=='object')throw Error('Missing cloud preferences');
 if((v.transactions as unknown[]).length>2000)throw Error('Cloud sync snapshot exceeds first release transaction limit (2,000).');
}
async function currentPayload(db:SQLiteDatabase):Promise<CloudPayload>{
 const base=await readSnapshot(db),feature=await readFeatures(db);
 const recurringOccurrences=await db.getAllAsync<{template_id:string;due_date:string;transaction_id:string}>('SELECT template_id,due_date,transaction_id FROM recurring_occurrences ORDER BY template_id,due_date');
 const {receipts:_,...shareable}=feature; // Local file:// receipt paths and biometric data must never be uploaded.
 return {...base,...shareable,recurringOccurrences};
}
async function payloadHash(payload:CloudPayload){return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(payload));}
export async function cloudStatus(db:SQLiteDatabase,uid:string){
 const state=await pinnedOwner(db,uid);if(!cloudDb)throw Error('Firebase not configured');
 const remote=await getDoc(doc(cloudDb,'users',uid,'sync','main'));
 return {revision:remote.exists()?Number(remote.data().revision):0,lastSyncedRevision:state.revision,needsReview:remote.exists()&&Number(remote.data().revision)!==state.revision};
}
/** Safe upload: rejects remote revision mismatch; never overwrites another device blindly. */
export async function uploadCloud(db:SQLiteDatabase,uid:string){
 if(!cloudDb)throw Error('Firebase not configured');
 const state=await pinnedOwner(db,uid),payload=await currentPayload(db);
 const encoded=JSON.stringify(payload);
 if(encoded.length>760_000)throw Error('Cloud data too large for snapshot sync. Export an encrypted backup.');
 const ref=doc(cloudDb,'users',uid,'sync','main');
 const revision=await runTransaction(cloudDb,async t=>{
  const snap=await t.get(ref);
  const oldRevision=snap.exists()?Number(snap.data().revision):0;
  if(oldRevision!==state.revision)throw Error('Cloud changed on another device. Review and pull first. No data overwritten.');
  const next=oldRevision+1;
  const body={schema:1,revision:next,deviceId:'android',payload,updatedAt:serverTimestamp()};
  if(snap.exists())t.update(ref,body);else t.set(ref,body);
  return next;
 });
 await markState(db,uid,revision,await payloadHash(payload));
 return revision;
}
/** Download is refused if this device has local changes since the last successful sync. */
export async function downloadCloud(db:SQLiteDatabase,uid:string){
 if(!cloudDb)throw Error('Firebase not configured');
 const state=await pinnedOwner(db,uid);const local=await currentPayload(db);
 const currentHash=await payloadHash(local);
 if(state.local_hash!==currentHash){
  if(state.revision>0)throw Error('Local changes detected since last cloud sync. Upload changes or resolve conflict first.');
  if(local.transactions.length>0||local.debts.length>0||local.goals.length>0||local.recurring.length>0||local.wallets.some(w=>w.opening_mmk_minor!==0||w.opening_usd_minor!==0))throw Error('This device already has local finance records or wallet openings. Upload or back up first; cloud download cannot overwrite them.');
 }
 const snap=await getDoc(doc(cloudDb,'users',uid,'sync','main'));
 if(!snap.exists())throw Error('No cloud snapshot. Upload from original Android device first.');
 const remote=snap.data() as RemoteDoc;
 if(remote.schema!==1||!Number.isSafeInteger(remote.revision)||remote.revision<=0)throw Error('Unsupported cloud schema');
 validatePayload(remote.payload);
 const base:Snapshot={wallets:remote.payload.wallets,categories:remote.payload.categories,transactions:remote.payload.transactions,budgets:remote.payload.budgets,settings:remote.payload.settings};
 // Only preserve receipt paths pointing to still-existing local transactions; files are NOT cloud synced in v1.
 const existing=await readFeatures(db),txids=new Set(base.transactions.map(x=>x.id));
 const extras:FeatureSnapshot={recurring:remote.payload.recurring,categoryBudgets:remote.payload.categoryBudgets,debts:remote.payload.debts,debtPayments:remote.payload.debtPayments,goals:remote.payload.goals,goalContributions:remote.payload.goalContributions,receipts:existing.receipts.filter(x=>txids.has(x.transaction_id))};
 const backup={...base,format:'money-tracker-ts-backup' as const,version:2 as const,exported_at:new Date().toISOString()};
 await restoreBackup(db,backup,extras); // Existing validation checks IDs, wallets, categories and feature refs.
 for(const occurrence of remote.payload.recurringOccurrences){
  await db.runAsync('INSERT OR IGNORE INTO recurring_occurrences(template_id,due_date,transaction_id) VALUES (?,?,?)',occurrence.template_id,occurrence.due_date,occurrence.transaction_id);
 }
 const installed=await currentPayload(db);
 await markState(db,uid,remote.revision,await payloadHash(installed));
 return remote.revision;
}
