import React,{useEffect,useRef,useState} from 'react';
import {Alert,ActivityIndicator,ScrollView,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {CameraView,useCameraPermissions,type BarcodeScanningResult} from 'expo-camera';
import {useSQLiteContext} from 'expo-sqlite';
import {onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendEmailVerification,type User} from 'firebase/auth';
import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {cloudEnabled,cloudAuth,cloudDb} from './cloudClient';
import {cloudStatus,downloadCloud,uploadCloud} from './cloudSync';

type PairInfo={sessionId:string;code:string;uid:string};
const inputStyle={color:'#edf7ff',backgroundColor:'#172f42',borderRadius:12,padding:12,marginTop:9,borderWidth:1,borderColor:'#335066'} as const;
const buttonStyle={backgroundColor:'#14513d',padding:13,borderRadius:12,alignItems:'center' as const,marginTop:11};
const text={color:'#ecf5ff',fontSize:13,lineHeight:23} as const;
const small={color:'#9fbaca',fontSize:11,lineHeight:21} as const;
const btn=(name:string,onPress:()=>void,disabled=false)=><TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[buttonStyle,disabled&&{opacity:.5}]}><Text style={{color:'#7ff5ae',fontWeight:'700'}}>{name}</Text></TouchableOpacity>;
export function parseMoneyTrackerPair(raw:string):PairInfo{
 const url=new URL(raw);
 if(url.protocol!=='moneytracker:'||url.hostname!=='pair')throw Error('This is not a Money Tracker pairing QR.');
 const sessionId=url.searchParams.get('session')||'',code=url.searchParams.get('code')||'',uid=url.searchParams.get('uid')||'';
 if(!/^[A-Za-z0-9_-]{25,72}$/.test(sessionId)||!/^\d{6}$/.test(code)||!/^[A-Za-z0-9_-]{10,128}$/.test(uid))throw Error('Invalid QR session, code or account.');
 return {sessionId,code,uid};
}
export default function CloudSyncPanel({onChanged}:{onChanged:()=>Promise<void>|void}){
 const db=useSQLiteContext();const [user,setUser]=useState<User|null>(cloudAuth?.currentUser||null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[scanner,setScanner]=useState(false),[pair,setPair]=useState<PairInfo|null>(null);
 const [permission,requestPermission]=useCameraPermissions();const scanned=useRef(false);
 useEffect(()=>cloudAuth?onAuthStateChanged(cloudAuth,u=>setUser(u)):undefined,[]);
 async function action(fn:()=>Promise<unknown>){setBusy(true);setNotice('');try{await fn();}catch(e){setNotice(String(e));Alert.alert('Cloud Sync',String(e));}finally{setBusy(false);}}
 const configured=cloudEnabled&&Boolean(cloudAuth)&&Boolean(cloudDb);
 const verified=Boolean(user?.emailVerified);
 const signup=()=>void action(async()=>{
  if(!cloudAuth)throw Error('Missing Firebase config');if(password.length<10)throw Error('Cloud password must be at least 10 characters');
  const c=await createUserWithEmailAndPassword(cloudAuth,email.trim(),password);await sendEmailVerification(c.user);setNotice('Verification email sent. Open it, then tap Refresh Verification.');setPassword('');
 });
 const login=()=>void action(async()=>{if(!cloudAuth)throw Error('Firebase not ready');await signInWithEmailAndPassword(cloudAuth,email.trim(),password);setPassword('');setNotice('Signed in to Firebase Cloud.');});
 const refreshVerified=()=>void action(async()=>{if(!cloudAuth?.currentUser)throw Error('Sign in first');await cloudAuth.currentUser.reload();await cloudAuth.currentUser.getIdToken(true);setUser(cloudAuth.currentUser);setNotice(cloudAuth.currentUser.emailVerified?'Email verified. Cloud sync is unlocked.':'Email not verified yet.');});
 const scan=(result:BarcodeScanningResult)=>{
  if(scanned.current)return;scanned.current=true;
  try{const parsed=parseMoneyTrackerPair(result.data);setScanner(false);setPair(parsed);}catch(e){scanned.current=false;Alert.alert('QR Code',String(e));}
 };
 const approve=()=>void action(async()=>{
  if(!cloudDb||!pair||!user||!verified)throw Error('Verify your Firebase account first');
  if(user.uid!==pair.uid)throw Error('Windows and Android must be signed in to the SAME Firebase account.');
  const target=doc(cloudDb,'users',user.uid,'pairs',pair.sessionId);
  await runTransaction(cloudDb,async transaction=>{
    const snap=await transaction.get(target);
    if(!snap.exists())throw Error('QR request missing or already used. Generate another QR on Windows.');
    const data=snap.data();
    if(data.schema!==1||data.status!=='pending'||data.code!==pair.code)throw Error('QR code mismatch or already approved.');
    if(typeof data.expiresAt?.toMillis!=='function'||data.expiresAt.toMillis()<=Date.now())throw Error('QR expired. Generate another.');
    transaction.update(target,{status:'approved',approvedAt:serverTimestamp()});
  });
  setPair(null);setNotice('Windows device approved. Windows account was signed in with Firebase Email/Password.');
 });
 const syncUp=()=>void action(async()=>{
  if(!user||!verified)throw Error('Verify Firebase email before using sync.');
  const rev=await uploadCloud(db,user.uid);setNotice(`Uploaded all supported finance tables to Cloud Revision ${rev}. Receipt photos are not uploaded.`);
 });
 const syncDown=()=>Alert.alert('Download Cloud to Phone?','Cloud data can replace finance records on this device. Export an encrypted backup first. Download is blocked if unsynced changes are detected.',[
  {text:'Cancel',style:'cancel'},
  {text:'Download',style:'destructive',onPress:()=>void action(async()=>{
   if(!user||!verified)throw Error('Cloud verification required');
   const rev=await downloadCloud(db,user.uid);await onChanged();setNotice(`Downloaded Cloud Revision ${rev}.`);
  })},
 ]);
 return <View style={{borderRadius:20,borderColor:'#2a4a58',borderWidth:1,backgroundColor:'#102234',padding:16,marginBottom:14}}>
  <Text style={{...text,fontWeight:'800',fontSize:17,marginBottom:8}}>☁ Firebase Spark JSON Sync / Device QR</Text>
  {!configured?<Text style={{...small,color:'#ffd5a0'}}>Firebase မချိတ်ဆက်ရသေးပါ။ android/src/cloudConfig.ts မှာ Firebase Web Config ဖြည့်ပြီး APK ပြန် Build လုပ်ပါ။ Local Finance App ကို ဆက်သုံးလို့ရပါတယ်။</Text>:<>
    {!user?<><Text style={small}>Existing Money Tracker local PIN/Password stays on this phone. Cloud needs a separate verified Firebase Email account.</Text>
      <TextInput style={inputStyle} placeholderTextColor="#93aabd" value={email} onChangeText={setEmail} placeholder="Cloud Email" autoCapitalize="none" keyboardType="email-address"/>
      <TextInput style={inputStyle} placeholderTextColor="#93aabd" value={password} onChangeText={setPassword} placeholder="Cloud Password" secureTextEntry autoCapitalize="none"/>
      {btn('Login to Firebase Cloud',login,busy)}{btn('Create Cloud Account',signup,busy)}
    </>:<><Text style={small}>Firebase: {user.email}</Text>
      {!verified?<><Text style={{...small,color:'#ffb672'}}>Cloud Email verification required before QR approval and Firestore sync.</Text>
        {btn('Refresh Email Verification',refreshVerified,busy)}{btn('Resend Verification Email',()=>void action(async()=>{if(user)await sendEmailVerification(user);}),busy)}</>:<>
        {btn('Scan Windows Device QR',async()=>{if(!permission?.granted){const res=await requestPermission();if(!res.granted){Alert.alert('Camera','Allow camera permission for scanning the Windows QR.');return;}}scanned.current=false;setScanner(true);},busy)}
        {btn('Upload Android → Firebase',syncUp,busy)}{btn('Download Firebase → Android',syncDown,busy)}
        {btn('Check Cloud Revision',()=>void action(async()=>{const status=await cloudStatus(db,user.uid);setNotice(`Cloud Revision: ${status.revision}; Last uploaded/downloaded: ${status.lastSyncedRevision}. ${status.needsReview?'Other device has new changes.':'Up to date.'}`);}),busy)}
      </>}
      {btn('Sign out Firebase Cloud',()=>void action(async()=>{if(cloudAuth)await signOut(cloudAuth);}),busy)}
    </>}
    {scanner&&<View style={{marginTop:15,height:270,borderRadius:14,overflow:'hidden'}}><CameraView style={{flex:1}} facing="back" barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={scan}/><TouchableOpacity onPress={()=>setScanner(false)} style={{backgroundColor:'#143c3b',padding:10,alignItems:'center'}}><Text style={text}>Cancel Scan</Text></TouchableOpacity></View>}
    {pair&&<View style={{marginTop:14,padding:13,backgroundColor:'#19394b',borderRadius:13}}><Text style={text}>Windows QR Code: <Text style={{color:'#70f7ab',fontSize:23,fontWeight:'800'}}>{pair.code}</Text></Text><Text style={small}>Compare the six digits with Windows. Both devices must use the SAME verified Firebase account. Approval opens the Windows dashboard, but does not replace Firebase password authentication.</Text>
      {btn('Approve Windows Device',approve,busy)}{btn('Cancel',()=>setPair(null))}
    </View>}
    {busy&&<ActivityIndicator style={{marginTop:10}} color="#38e690"/>}
    {!!notice&&<Text style={{...small,marginTop:12,color:'#b8e2da'}}>{notice}</Text>}
    <Text style={{...small,marginTop:14}}>Sync v1: safe revision check; rejected conflicts must be resolved manually. Receipt image files, local recovery keys and biometric data stay on-device. Cloud data is protected by owner-only Firebase Rules but not end-to-end encrypted.</Text>
  </>}
 </View>;
}
