import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Image,Switch,Text,TextInput,TouchableOpacity,View} from 'react-native';
import type {Account} from './account';

type Props={account:Account;language:'my'|'en';onLock:()=>void;onUpdateProfile:(name:string,photo:boolean)=>Promise<void>;onChangePassword:(oldPassword:string,newPassword:string)=>Promise<void>;onRegenerateRecovery:(password:string)=>Promise<string>;onBiometric:(enabled:boolean)=>Promise<void>};
const colors={surface:'#1b2d40',border:'#294156',text:'#f8fafc',muted:'#a9bdcc',accent:'#4ade80'};
function Entry({value,onChange,placeholder,secret=false}:{value:string;onChange:(s:string)=>void;placeholder:string;secret?:boolean}){return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} secureTextEntry={secret} autoCapitalize="none" placeholderTextColor={colors.muted} style={{backgroundColor:colors.surface,borderRadius:12,borderWidth:1,borderColor:colors.border,paddingHorizontal:12,minHeight:47,color:colors.text,marginTop:8,fontSize:14}}/>;}
function Button({title,onPress,secondary=false}:{title:string;onPress:()=>void;secondary?:boolean}){return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={{marginTop:10,padding:13,borderRadius:12,backgroundColor:secondary?colors.surface:'#15803d',alignItems:'center'}}><Text style={{fontSize:13,color:'#fff',fontWeight:'700'}}>{title}</Text></TouchableOpacity>;}
export default function ProfileSettings({account,language,onLock,onUpdateProfile,onChangePassword,onRegenerateRecovery,onBiometric}:Props){
  const my=language==='my';
  const [display,setDisplay]=useState(account.displayName),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[recoveryPass,setRecoveryPass]=useState(''),[recovery,setRecovery]=useState<string|null>(null),[working,setWorking]=useState(false);
  useEffect(()=>{setDisplay(account.displayName);},[account.displayName]);
  const task=async(fn:()=>Promise<void>)=>{if(working)return;setWorking(true);try{await fn();}catch(e){Alert.alert('Security',e instanceof Error?e.message:String(e));}finally{setWorking(false);}};
  const cap=(label:string)=> <Text style={{fontSize:13,fontWeight:'700',color:colors.text,lineHeight:26,marginTop:12}}>{label}</Text>;
  return <View style={{padding:15,backgroundColor:'#111e2d',borderRadius:23,borderColor:colors.border,borderWidth:1,marginBottom:14}}>
    <Text style={{fontWeight:'800',color:colors.text,fontSize:17,lineHeight:33}}>{my?'ကိုယ်ရေးအချက်အလက်နှင့် လုံခြုံရေး':'Profile & Security'}</Text>
    <View style={{flexDirection:'row',alignItems:'center',gap:14,marginTop:10,marginBottom:8}}>
      {account.avatarUri?<Image source={{uri:account.avatarUri}} style={{width:66,height:66,borderRadius:33}}/>:<View style={{width:66,height:66,borderRadius:33,backgroundColor:'#165c41',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:27,fontWeight:'800',color:'#fff'}}>{account.displayName.slice(0,1).toUpperCase()}</Text></View>}
      <View style={{flex:1}}><Text style={{color:'#fff',fontWeight:'700',fontSize:16}}>{account.displayName}</Text><Text style={{color:colors.muted,fontSize:12}}>@{account.username}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>void task(()=>onUpdateProfile(display,true))}><Text style={{color:colors.accent,fontSize:12,fontWeight:'700',marginTop:4}}>{my?'ပရိုဖိုင်ပုံ ရွေးရန်':'Choose profile picture'}</Text></TouchableOpacity></View>
    </View>
    {cap(my?'အမည် ပြောင်းရန်':'Display name')}
    <Entry value={display} onChange={setDisplay} placeholder="Display name"/>
    <Button title={my?'ပရိုဖိုင် သိမ်းမည်':'Save Profile'} onPress={()=>void task(async()=>{await onUpdateProfile(display,false);Alert.alert('Saved','Profile updated.');})}/>
    <View style={{height:1,backgroundColor:colors.border,marginTop:21,marginBottom:7}}/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}><View style={{flex:1}}>{cap(my?'Fingerprint / Face Login':'Biometric Login')}<Text style={{color:colors.muted,fontSize:11,lineHeight:19}}>{my?'ဖုန်း၏ biometric ဖြင့် ဝင်မည်':'Unlock using enrolled device biometrics'}</Text></View><Switch value={account.biometricEnabled} disabled={working} trackColor={{false:'#394b5c',true:'#0f8757'}} onValueChange={enabled=>void task(()=>onBiometric(enabled))}/></View>
    <Text style={{color:colors.muted,fontSize:11,lineHeight:20,marginTop:9}}>{my?'သတိ: Fingerprint မအောင်မြင်ရင် Password ဖြင့် ဝင်နိုင်ပါတယ်။':'Password fallback remains available if biometrics fail.'}</Text>
    <View style={{height:1,backgroundColor:colors.border,marginTop:16}}/>
    {cap(my?'စကားဝှက် ပြောင်းရန်':'Change password')}
    <Entry value={current} onChange={setCurrent} placeholder="Current password" secret/>
    <Entry value={next} onChange={setNext} placeholder="New password (10+ chars)" secret/>
    <Entry value={confirm} onChange={setConfirm} placeholder="Confirm new password" secret/>
    <Button title={my?'စကားဝှက် ပြောင်းမည်':'Update Password'} onPress={()=>void task(async()=>{if(next!==confirm)throw new Error('Passwords do not match.');await onChangePassword(current,next);setCurrent('');setNext('');setConfirm('');Alert.alert('Success','Password updated. Please re-enable fingerprint login if needed.');})}/>
    <View style={{height:1,backgroundColor:colors.border,marginTop:18}}/>
    {cap(my?'Recovery Key အသစ်ထုတ်ရန်':'Regenerate Recovery Key')}
    <Text style={{color:colors.muted,fontSize:11,lineHeight:20}}>Generating a new recovery key invalidates the old one. Store the new key securely and never share it.</Text>
    <Entry value={recoveryPass} onChange={setRecoveryPass} placeholder="Confirm your current password" secret/>
    <Button secondary title="Generate New Recovery Key" onPress={()=>void task(async()=>{const code=await onRegenerateRecovery(recoveryPass);setRecovery(code);setRecoveryPass('');})}/>
    {recovery&&<View style={{marginTop:12,padding:12,backgroundColor:colors.surface,borderRadius:12}}><Text selectable style={{color:colors.accent,textAlign:'center',lineHeight:28,fontSize:16,fontWeight:'800'}}>{recovery}</Text><Button secondary title="I saved it — Hide Key" onPress={()=>setRecovery(null)}/></View>}
    <View style={{height:1,backgroundColor:colors.border,marginTop:18}}/>
    <Button secondary title={my?'အကောင့်မှ ထွက်မည် (Lock)':'Log Out / Lock'} onPress={onLock}/>
    <Text style={{color:colors.muted,fontSize:11,lineHeight:20,marginTop:13,textAlign:'center'}}>Offline single-device account. App sign-in does not encrypt SQLite files. Backup your financial data separately.</Text>
    {working&&<ActivityIndicator style={{marginTop:12}} color={colors.accent}/>} 
  </View>;
}
