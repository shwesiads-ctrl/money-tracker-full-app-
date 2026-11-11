/** Local single-device identity, stored in Android Keystore-backed SecureStore.
 * It is not a cloud account and it does not encrypt the existing SQLite DB.
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import {File,Paths} from 'expo-file-system';
import {pbkdf2Async} from '@noble/hashes/pbkdf2';
import {sha256} from '@noble/hashes/sha256';
import {utf8ToBytes} from '@noble/hashes/utils';
import {equalHex,isRecoveryKeyShape,lockoutDuration,normalizeRecoveryKey,normalizeUsername,validateRegistration} from './authPolicy';

const ACCOUNT_KEY='mt.account.v2';
const BIO_KEY='mt.biometric.v2';
const ROUNDS=120000;
const ABC='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type Account={username:string;displayName:string;avatarUri:string|null;biometricEnabled:boolean};
type Stored=Account & {passwordSalt:string;passwordHash:string;recoverySalt:string;recoveryHash:string;biometricHash:string|null;failedCount:number;lockedUntil:number};
function hex(bytes:Uint8Array):string{return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
function unhex(value:string):Uint8Array{const a=new Uint8Array(value.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(value.slice(i*2,i*2+2),16);return a;}
async function kdf(plain:string,salt:string):Promise<string>{return hex(await pbkdf2Async(sha256,utf8ToBytes(plain),unhex(salt),{c:ROUNDS,dkLen:32,asyncTick:10}));}
async function verifier(plain:string):Promise<{salt:string;hash:string}>{const salt=hex(await Crypto.getRandomBytesAsync(16));return {salt,hash:await kdf(plain,salt)};}
async function load():Promise<Stored|null>{const raw=await SecureStore.getItemAsync(ACCOUNT_KEY);if(!raw)return null;const value=JSON.parse(raw) as Stored;if(!value.username||!value.passwordSalt||!value.recoveryHash)throw new Error('Local security record is damaged. Do not clear app storage; restore from a trusted backup with assistance.');return value;}
async function save(a:Stored):Promise<void>{await SecureStore.setItemAsync(ACCOUNT_KEY,JSON.stringify(a),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
function publicAccount(a:Stored):Account{return {username:a.username,displayName:a.displayName,avatarUri:a.avatarUri||null,biometricEnabled:!!a.biometricEnabled};}
export async function getAccount():Promise<Account|null>{const a=await load();return a?publicAccount(a):null;}
function makeRecoveryKey(bytes:Uint8Array):string{
  let bits=0,buffer=0,out='';for(const byte of bytes){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=ABC[(buffer>>bits)&31];}}if(bits>0)out+=ABC[(buffer<<(5-bits))&31];
  return 'MTK-'+(out.match(/.{1,4}/g)||[]).join('-');
}
export async function createAccount(username:string,displayName:string,password:string):Promise<{account:Account;recoveryKey:string}>{
  const err=validateRegistration(username,displayName,password);if(err)throw new Error(err);
  if(await load())throw new Error('An account already exists on this device.');
  const key=makeRecoveryKey(await Crypto.getRandomBytesAsync(20));
  const pass=await verifier(password),rec=await verifier(normalizeRecoveryKey(key));
  const account:Stored={username:normalizeUsername(username),displayName:displayName.trim(),avatarUri:null,biometricEnabled:false,passwordSalt:pass.salt,passwordHash:pass.hash,recoverySalt:rec.salt,recoveryHash:rec.hash,biometricHash:null,failedCount:0,lockedUntil:0};
  await save(account);return {account:publicAccount(account),recoveryKey:key};
}
function delayError(a:Stored):string|null{return a.lockedUntil>Date.now()?`Too many attempts. Try again in ${Math.ceil((a.lockedUntil-Date.now())/1000)} seconds.`:null;}
async function failed(a:Stored):Promise<never>{a.failedCount+=1;a.lockedUntil=Date.now()+lockoutDuration(a.failedCount);await save(a);throw new Error('Incorrect credentials. '+(delayError(a)||''));}
export async function login(username:string,password:string):Promise<Account>{
  const a=await load();if(!a)throw new Error('Set up an account first.');
  const blocked=delayError(a);if(blocked)throw new Error(blocked);
  // Username mismatch still consumes a normal attempt, but password KDF always runs.
  const candidate=await kdf(password,a.passwordSalt);
  if(normalizeUsername(username)!==a.username||!equalHex(candidate,a.passwordHash))return failed(a);
  a.failedCount=0;a.lockedUntil=0;await save(a);return publicAccount(a);
}
export async function recoverAccount(key:string,newPassword:string):Promise<Account>{
  const a=await load();if(!a)throw new Error('No local account exists.');
  const err=validateRegistration(a.username,a.displayName,newPassword);if(err)throw new Error(err);
  const blocked=delayError(a);if(blocked)throw new Error(blocked);
  if(!isRecoveryKeyShape(key))return failed(a);
  const candidate=await kdf(normalizeRecoveryKey(key),a.recoverySalt);
  if(!equalHex(candidate,a.recoveryHash))return failed(a);
  const pass=await verifier(newPassword);a.passwordHash=pass.hash;a.passwordSalt=pass.salt;
  a.failedCount=0;a.lockedUntil=0;
  await disableBiometricInternal(a);await save(a);return publicAccount(a);
}
export async function changePassword(current:string,next:string):Promise<void>{
  const a=await load();if(!a)throw new Error('No account');
  const err=validateRegistration(a.username,a.displayName,next);if(err)throw new Error(err);
  const test=await kdf(current,a.passwordSalt);if(!equalHex(test,a.passwordHash))throw new Error('Current password incorrect.');
  const pass=await verifier(next);a.passwordHash=pass.hash;a.passwordSalt=pass.salt;
  await disableBiometricInternal(a);await save(a);
}
export async function regenerateRecoveryKey(password:string):Promise<string>{
  const a=await load();if(!a)throw new Error('No account');
  const candidate=await kdf(password,a.passwordSalt);if(!equalHex(candidate,a.passwordHash))throw new Error('Password incorrect.');
  const key=makeRecoveryKey(await Crypto.getRandomBytesAsync(20));const rec=await verifier(normalizeRecoveryKey(key));
  a.recoverySalt=rec.salt;a.recoveryHash=rec.hash;await save(a);return key;
}
export async function updateProfile(displayName:string,avatarUri?:string|null):Promise<Account>{
  const a=await load();if(!a)throw new Error('No account');
  if(displayName.trim().length<2||displayName.trim().length>60)throw new Error('Name must be 2–60 characters.');
  a.displayName=displayName.trim();if(avatarUri!==undefined)a.avatarUri=avatarUri;await save(a);return publicAccount(a);
}
export async function chooseAvatar():Promise<string|null>{
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.75});
  if(result.canceled||!result.assets[0]?.uri)return null;
  const picked=new File(result.assets[0].uri);
  if(picked.size>6*1024*1024)throw new Error('Please choose a photo under 6 MB.');
  const target=new File(Paths.document,`money-tracker-avatar-${Crypto.randomUUID()}.jpg`);
  picked.copy(target);return target.uri;
}
async function disableBiometricInternal(a:Stored):Promise<void>{a.biometricEnabled=false;a.biometricHash=null;try{await SecureStore.deleteItemAsync(BIO_KEY);}catch{ /* invalidated key may be unavailable */ }}
export async function setBiometric(enabled:boolean):Promise<Account>{
  const a=await load();if(!a)throw new Error('No account');
  if(!enabled){await disableBiometricInternal(a);await save(a);return publicAccount(a);}
  if(!(await LocalAuthentication.hasHardwareAsync())||!(await LocalAuthentication.isEnrolledAsync()))throw new Error('Set up fingerprint or face unlock in Android Settings first.');
  const consent=await LocalAuthentication.authenticateAsync({promptMessage:'Enable Money Tracker biometric login',disableDeviceFallback:true});
  if(!consent.success)throw new Error('Biometric authentication not completed.');
  const secret=hex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(BIO_KEY,secret,{requireAuthentication:true,authenticationPrompt:'Unlock Money Tracker'});
  a.biometricHash=hex(sha256(utf8ToBytes(secret)));a.biometricEnabled=true;await save(a);return publicAccount(a);
}
export async function biometricLogin():Promise<Account>{
  const a=await load();if(!a||!a.biometricEnabled||!a.biometricHash)throw new Error('Biometric login not enabled.');
  if(!(await LocalAuthentication.isEnrolledAsync()))throw new Error('No fingerprint/face enrolled. Log in using your password.');
  const token=await SecureStore.getItemAsync(BIO_KEY,{requireAuthentication:true,authenticationPrompt:'Unlock Money Tracker'});
  if(!token||!equalHex(hex(sha256(utf8ToBytes(token))),a.biometricHash))throw new Error('Biometric token is missing or invalid. Use password login.');
  return publicAccount(a);
}
