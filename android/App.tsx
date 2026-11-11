import React, { Suspense } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { initDatabase } from './src/database';
import SecureSession from './src/SecureSession';

export default function App() {
  return <Suspense fallback={<View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#071621',gap:18}}><Image source={require('./assets/splash-icon.png')} style={{width:136,height:136}} resizeMode="contain"/><Text style={{fontSize:24,fontWeight:'800',color:'#ffffff'}}>Money Tracker</Text><Text style={{fontSize:15,color:'#8bdaae'}}>ငွေစာရင်း မှတ်တမ်း</Text><ActivityIndicator size="large" color="#22c55e" /></View>}>
    <SQLiteProvider databaseName="money-tracker-ts.db" onInit={initDatabase} useSuspense>
      <SecureSession />
    </SQLiteProvider>
  </Suspense>;
}
