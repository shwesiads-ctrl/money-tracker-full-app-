import {initializeApp,getApps,getApp} from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getFirestore} from 'firebase/firestore';
import {getFunctions} from 'firebase/functions';
import {cloudConfig} from './cloudConfig';
/** Metro's React Native runtime may expose getReactNativePersistence even when
 * the firebase/auth web declaration omits it. Fall back to memory persistence.
 */
const persistenceFactory=(FirebaseAuth as unknown as {
  getReactNativePersistence?: (storage:typeof AsyncStorage)=>typeof FirebaseAuth.inMemoryPersistence
}).getReactNativePersistence;
export const cloudEnabled=Boolean(cloudConfig.apiKey&&cloudConfig.projectId&&cloudConfig.appId&&cloudConfig.authDomain);
const app=cloudEnabled?(getApps().length?getApp():initializeApp({apiKey:cloudConfig.apiKey,authDomain:cloudConfig.authDomain,projectId:cloudConfig.projectId,appId:cloudConfig.appId})):undefined;
export const cloudAuth=app?(()=>{try{return FirebaseAuth.initializeAuth(app,{persistence:persistenceFactory?persistenceFactory(AsyncStorage):FirebaseAuth.inMemoryPersistence});}catch{return FirebaseAuth.getAuth(app);}})():undefined;
export const cloudDb=app?getFirestore(app):undefined;
export const cloudFunctions=app?getFunctions(app,cloudConfig.functionsRegion):undefined;
