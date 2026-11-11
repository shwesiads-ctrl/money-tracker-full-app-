import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { initDatabase } from './src/database';
import Tracker from './src/Tracker';

export default function App() {
  return <Suspense fallback={<View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f8fafc'}}><ActivityIndicator size="large" color="#059669" /></View>}>
    <SQLiteProvider databaseName="money-tracker-ts.db" onInit={initDatabase} useSuspense>
      <Tracker />
    </SQLiteProvider>
  </Suspense>;
}
