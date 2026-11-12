import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,BackHandler,Image,KeyboardAvoidingView,Platform,ScrollView,StatusBar,Switch,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {createAccount,getAccount,login,recoverAccount,changePassword,regenerateRecoveryKey,updateProfile,setBiometric,biometricLogin,chooseAvatar} from './account';
import type {Account} from './account';
import Tracker from './Tracker';
import {normalizeUsername} from './authPolicy';
import {sessionBackAction} from './backPolicy';
import {confirmExit} from './exitDialog';

const color={bg:'#0b1421',card:'#111e2d',input:'#1b2d40',border:'#294156',accent:'#22c55e',muted:'#9baec4'};
type Screen='loading'|'register'|'reveal'|'login'|'recovery'|'open';
function Txt({children,size=14,muted=false,bold=false}:{children:React.ReactNode;size?:number;muted?:boolean;bold?:boolean}){return <Text style={{color:muted?color.muted:'#f7fafc',fontSize:size,lineHeight:Math.ceil(size*1.8),fontWeight:bold?'700':'400',textAlign:'center'}}>{children}</Text>;}
function Input({value,onChange,placeholder,secret=false}:{value:string;onChange:(v:string)=>void;placeholder:string;secret?:boolean}){return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#8ea6bb" secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} style={{height:52,color:'#fff',fontSize:15,borderRadius:12,backgroundColor:color.input,borderColor:color.border,borderWidth:1,paddingHorizontal:14,marginBottom:11}}/>;}
function Btn({label,action,secondary=false,disabled=false}:{label:string;action:()=>void;secondary?:boolean;disabled?:boolean}){return <TouchableOpacity disabled={disabled} accessibilityRole="button" onPress={action} style={{backgroundColor:secondary?color.input:color.accent,borderRadius:13,minHeight:48,padding:12,alignItems:'center',justifyContent:'center',marginTop:6,opacity:disabled?.5:1}}><Text style={{fontSize:14,color:secondary?'#fff':'#052112',fontWeight:'800'}}>{label}</Text></TouchableOpacity>;}

export default function SecureSession(){
  const [screen,setScreen]=useState<Screen>('loading');
  const [account,setAccount]=useState<Account|null>(null);
  const [username,setUsername]=useState('');const [name,setName]=useState('');
  const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
  const [key,setKey]=useState('');const [recoveryKey,setRecoveryKey]=useState('');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const lastTouch=useRef(Date.now());const lastBackground=useRef(0);const locked=useRef(true);
  const lock=()=>{locked.current=true;setPassword('');setConfirm('');setKey('');setRecoveryKey('');setError('');setScreen('login');};
  const enter=(a:Account)=>{setAccount(a);setUsername(a.username);setPassword('');setKey('');locked.current=false;lastTouch.current=Date.now();setScreen('open');setError('');};
  useEffect(()=>{let mounted=true;void getAccount().then(a=>{if(!mounted)return;setAccount(a);if(a)setUsername(a.username);setScreen(a?'login':'register');}).catch(e=>{if(mounted){setError(String(e));setScreen('loading');}});return()=>{mounted=false;};},[]);
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active')lastBackground.current=Date.now();else if(!locked.current&&lastBackground.current&&Date.now()-lastBackground.current>=60000)lock();});const timer=setInterval(()=>{if(!locked.current&&Date.now()-lastTouch.current>=5*60*1000)lock();},15000);return()=>{sub.remove();clearInterval(timer);};},[]);
  useEffect(()=>{
    if(Platform.OS!=='android'||screen==='open')return;
    const listener=BackHandler.addEventListener('hardwareBackPress',()=>{
      const action=sessionBackAction(screen);
      if(action==='goLogin') {setScreen('login');setPassword('');setKey('');setError('');}
      else if(action==='confirmExit') confirmExit('my',screen==='reveal'
        ? 'Recovery Key ကို မသိမ်းရသေးလျှင် ပြန်ကြည့်၍ မရနိုင်ပါ။ အက်ပ်မှ ထွက်ရန် သေချာပါသလား?'
        : undefined);
      return true;
    });
    return ()=>listener.remove();
  },[screen]);
  const run=async(fn:()=>Promise<void>)=>{if(busy)return;setError('');setBusy(true);try{await fn();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
  const register=()=>void run(async()=>{if(password!==confirm)throw new Error('Passwords do not match.');const r=await createAccount(username,name,password);setAccount(r.account);setRecoveryKey(r.recoveryKey);setPassword('');setConfirm('');setScreen('reveal');});
  const doLogin=()=>void run(async()=>enter(await login(username,password)));
  const doRecover=()=>void run(async()=>{if(password!==confirm)throw new Error('Passwords do not match.');enter(await recoverAccount(key,password));Alert.alert('Password reset','Your recovery key was accepted. Fingerprint login must be enabled again.');});
  const doBio=()=>void run(async()=>enter(await biometricLogin()));
  const setProfile=async(displayName:string,photo:boolean)=>{const avatar=photo?await chooseAvatar():undefined;if(photo&&avatar===null)return;const next=await updateProfile(displayName,avatar);setAccount(next);};
  const doPassword=async(oldPass:string,newPass:string)=>{await changePassword(oldPass,newPass);setAccount(await getAccount());};
  const doRegenerate=async(pass:string)=>regenerateRecoveryKey(pass);
  const doBioToggle=async(enabled:boolean)=>{const a=await setBiometric(enabled);setAccount(a);};
  if(screen==='open'&&account)return <View onStartShouldSetResponderCapture={()=>{lastTouch.current=Date.now();return false;}} style={{flex:1}}><Tracker account={account} onLock={lock} onUpdateProfile={setProfile} onChangePassword={doPassword} onRegenerateRecovery={doRegenerate} onBiometric={doBioToggle}/></View>;
  return <View style={{flex:1,backgroundColor:color.bg,paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||0):28}}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1,justifyContent:'center',paddingHorizontal:24,paddingVertical:32}}>
      <Image source={require('../assets/icon.png')} style={{width:80,height:80,alignSelf:'center',borderRadius:18,marginBottom:12}}/>
      <Txt size={24} bold>Money Tracker</Txt><Txt muted>ငွေစာရင်း မှတ်တမ်း</Txt>
      <View style={{backgroundColor:color.card,borderColor:color.border,borderWidth:1,borderRadius:24,padding:20,marginTop:28}}>
        {screen==='loading'?<ActivityIndicator color={color.accent} size="large"/>:<>
          <Txt size={18} bold>{screen==='register'?'Create local account':screen==='reveal'?'Save your recovery key':screen==='recovery'?'Recover your account':'Welcome back'}</Txt>
          <View style={{height:16}}/>
          {screen==='register'&&<><Input value={name} onChange={setName} placeholder="Profile name"/><Input value={username} onChange={v=>setUsername(normalizeUsername(v))} placeholder="Username (letters/numbers)"/><Input value={password} onChange={setPassword} placeholder="Password (10+ letters/numbers)" secret/><Input value={confirm} onChange={setConfirm} placeholder="Confirm password" secret/><Btn label="Create Account" disabled={busy} action={register}/><Txt muted>Local-only profile. No server, email, or cloud recovery.</Txt></>}
          {screen==='reveal'&&<><Txt muted>Keep this recovery key OFF your phone in a safe place. It appears only once and can reset your password.</Txt><View style={{padding:14,marginVertical:15,backgroundColor:color.input,borderRadius:12}}><Text selectable style={{fontSize:18,lineHeight:29,textAlign:'center',color:color.accent,fontWeight:'800'}}>{recoveryKey}</Text></View><Btn disabled={busy} label="I saved the recovery key — Open App" action={()=>{if(account)enter(account);}}/></>}
          {screen==='login'&&<><Txt muted>{account?.displayName||'Login to your account'}</Txt><Input value={username} onChange={setUsername} placeholder="Username"/><Input value={password} onChange={setPassword} placeholder="Password" secret/><Btn label="Log In" disabled={busy} action={doLogin}/>{account?.biometricEnabled&&<Btn secondary disabled={busy} label="Fingerprint / Face Unlock" action={doBio}/>}<Btn secondary label="Forgot Password? Use Recovery Key" action={()=>{setError('');setPassword('');setScreen('recovery');}}/></>}
          {screen==='recovery'&&<><Txt muted>Enter your 160-bit recovery key and a new password.</Txt><Input value={key} onChange={setKey} placeholder="MTK-XXXX-..."/><Input value={password} onChange={setPassword} placeholder="New password (10+ chars)" secret/><Input value={confirm} onChange={setConfirm} placeholder="Confirm new password" secret/><Btn disabled={busy} label="Reset Password" action={doRecover}/><Btn secondary label="Back to Login" action={()=>{setScreen('login');setError('');}}/></>}
          {!!error&&<Text selectable style={{color:'#fb7185',fontSize:12,lineHeight:22,marginTop:12}}>{error}</Text>}
        </>}
      </View>
    </ScrollView>
  </View>;
}
