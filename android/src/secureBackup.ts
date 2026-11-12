/** Password-authenticated and encrypted v2.5 archive. Secrets are never persisted. */
import * as Crypto from 'expo-crypto';
import {File,Directory,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {pbkdf2Async} from '@noble/hashes/pbkdf2';
import {sha256} from '@noble/hashes/sha256';
import {utf8ToBytes,bytesToUtf8} from '@noble/hashes/utils';
import {xchacha20poly1305} from '@noble/ciphers/chacha';
import type {SQLiteDatabase} from 'expo-sqlite';
import {makeBackup,parseBackup} from './core';
import {restoreBackup,readSnapshot} from './database';
import {readFeatures,validateFeatureBackup} from './featureDb';
import type {FeatureSnapshot} from './featureDb';
import type {Snapshot} from './types';
const KDF_ROUNDS=210000;
const ENC_FORMAT='money-tracker-encrypted-v1';
const MAX_ARCHIVE=32*1024*1024;
const hex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
function unhex(s:string):Uint8Array {if(!/^(?:[a-f0-9]{2})*$/i.test(s))throw new Error('Invalid encrypted data');return Uint8Array.from(s.match(/.{2}/g)||[],p=>parseInt(p,16));}
function checkPassword(p:string){if(p.length<12||p.length>160)throw new Error('Backup password must be 12–160 characters');}
async function derived(password:string,salt:Uint8Array){return pbkdf2Async(sha256,utf8ToBytes(password),salt,{c:KDF_ROUNDS,dkLen:32,asyncTick:25});}
export async function sealString(plain:string,password:string,salt?:Uint8Array,nonce?:Uint8Array){
 checkPassword(password);
 const s=salt||await Crypto.getRandomBytesAsync(16),n=nonce||await Crypto.getRandomBytesAsync(24);
 if(s.length!==16||n.length!==24)throw new Error('Invalid nonce or salt');
 const key=await derived(password,s);
 const payload=xchacha20poly1305(key,n).encrypt(utf8ToBytes(plain));
 key.fill(0);
 return JSON.stringify({format:ENC_FORMAT,version:1,kdf:'PBKDF2-HMAC-SHA256',rounds:KDF_ROUNDS,cipher:'XChaCha20-Poly1305',salt:hex(s),nonce:hex(n),ciphertext:hex(payload)});
}
export async function openString(encrypted:string,password:string):Promise<string>{
 checkPassword(password);
 let e:Record<string,unknown>;
 try {e=JSON.parse(encrypted) as Record<string,unknown>;}catch{throw new Error('Not an encrypted Money Tracker backup');}
 if(e.format!==ENC_FORMAT||e.version!==1||e.kdf!=='PBKDF2-HMAC-SHA256'||e.cipher!=='XChaCha20-Poly1305'||e.rounds!==KDF_ROUNDS||typeof e.salt!=='string'||typeof e.nonce!=='string'||typeof e.ciphertext!=='string')throw new Error('Unsupported backup format');
 if(e.salt.length!==32||e.nonce.length!==48||e.ciphertext.length>MAX_ARCHIVE*2)throw new Error('Invalid or oversized backup');
 const key=await derived(password,unhex(e.salt)),nonce=unhex(e.nonce);
 try{return bytesToUtf8(xchacha20poly1305(key,nonce).decrypt(unhex(e.ciphertext)));}
 catch{throw new Error('Incorrect password or backup file was modified');}
 finally{key.fill(0);}
}
type AttachmentData={transaction_id:string;mime:'image/jpeg'|'image/png';base64:string};
type Archive={base:ReturnType<typeof makeBackup>;features:FeatureSnapshot;photos:AttachmentData[]};
export async function encryptedExport(db:SQLiteDatabase,password:string):Promise<void>{
 checkPassword(password);
 const base=makeBackup(await readSnapshot(db));
 const features=await readFeatures(db);
 const photos:AttachmentData[]=[];
 let accumulated=0;
 for(const r of features.receipts){
  const f=new File(r.file_uri);
  if(!f.exists)throw new Error('Receipt file missing. Remove broken receipt before backup.');
  if(f.size>2*1024*1024)throw new Error('Receipt is too large for backup');
  const data=await f.base64();accumulated+=data.length;
  if(accumulated>12*1024*1024)throw new Error('Photos exceed 12 MB. Reduce receipt count before backup.');
  photos.push({transaction_id:r.transaction_id,mime:r.file_mime as 'image/jpeg'|'image/png',base64:data});
 }
 // File URIs are device-specific; do not expose them in a portable archive.
 const cleaned:FeatureSnapshot={...features,receipts:[]};
 const raw=JSON.stringify({base,features:cleaned,photos} satisfies Archive);
 if(raw.length>MAX_ARCHIVE/2)throw new Error('Backup data too large');
 const ciphertext=await sealString(raw,password);
 const file=new File(Paths.cache,`MoneyTracker_v25_${new Date().toISOString().slice(0,10)}.mtk`);
 if(file.exists)file.delete();file.create();await file.write(ciphertext);
 if(!await Sharing.isAvailableAsync())throw new Error('Sharing is not supported');
 await Sharing.shareAsync(file.uri,{mimeType:'application/octet-stream',dialogTitle:'Save encrypted Money Tracker backup'});
}
export async function encryptedRestore(db:SQLiteDatabase,password:string):Promise<void>{
 checkPassword(password);
 const picked=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true,multiple:false});
 if(picked.canceled||!picked.assets[0])return;
 const asset=picked.assets[0];if(asset.size && asset.size>MAX_ARCHIVE)throw new Error('Backup file exceeds 32 MB');
 const raw=await new File(asset.uri).text();if(raw.length>MAX_ARCHIVE)throw new Error('Oversized backup');
 const plain=await openString(raw,password);
 let archive:Archive;
 try{archive=JSON.parse(plain) as Archive;}catch{throw new Error('Decrypted backup is invalid');}
 const base=parseBackup(archive.base);
 const extras=validateFeatureBackup(archive.features,base);
 if(!Array.isArray(archive.photos)||archive.photos.length>150)throw new Error('Invalid backup photos');
 // Stage files before the SQL transaction; a SQL failure does not erase existing ledger.
 const folder=new Directory(Paths.document,'receipts');folder.create({idempotent:true,intermediates:true});
 const created:File[]=[];
 const receipts:FeatureSnapshot['receipts']=[];
 try{
  for(const item of archive.photos){
   if(typeof item.transaction_id!=='string'||!base.transactions.some(t=>t.id===item.transaction_id)||!['image/jpeg','image/png'].includes(item.mime)||typeof item.base64!=='string'||item.base64.length>3_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(item.base64))throw new Error('Invalid receipt attachment');
   const file=new File(folder,`restore_${Date.now()}_${item.transaction_id.replace(/[^a-zA-Z0-9_-]/g,'')}.${item.mime==='image/png'?'png':'jpg'}`);
   file.create();file.writeSync(item.base64,{encoding:'base64'});created.push(file);
   receipts.push({transaction_id:item.transaction_id,file_mime:item.mime,file_uri:file.uri});
  }
  await restoreBackup(db,base,{...extras,receipts});
 }catch(e){for(const f of created)try{if(f.exists)f.delete();}catch{}throw e;}
}
