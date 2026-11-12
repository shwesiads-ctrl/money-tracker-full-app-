import {initializeApp,getApps,getApp} from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getFirestore} from 'firebase/firestore';
import {cloudConfig} from './cloudConfig';
/** The React Native getReactNativePersistence export exists at runtime in Metro
 * but firebase/auth's browser TypeScript declaration sometimes omits it.
 * If absent, use explicit memory persistence instead of failing at import time.
 */
const persistenceFactory=(FirebaseAuth as unknown as {
  getReactNativePersistence?: (storage:typeof AsyncStorage)=>typeof FirebaseAuth.inMemoryPersistence
}).getReactNativePersistence;
export const cloudEnabled=Boolean(cloudConfig.apiKey&&cloudConfig.projectId&&cloudConfig.appId&&cloudConfig.authDomain);
const app=cloudEnabled?(getApps().length?getApp():initializeApp({apiKey:cloudConfig.apiKey,authDomain:cloudConfig.authDomain,projectId:cloudConfig.projectId,appId:cloudConfig.appId})):undefined;
export const cloudAuth=app?(()=>{try{return FirebaseAuth.initializeAuth(app,{persistence:persistenceFactory?persistenceFactory(AsyncStorage):FirebaseAuth.inMemoryPersistence});}catch{return FirebaseAuth.getAuth(app);}})():undefined;
export const cloudDb=app?getFirestore(app):undefined;
