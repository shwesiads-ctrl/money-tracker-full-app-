import {initializeApp,type FirebaseApp} from 'firebase/app';
import {getAuth,browserSessionPersistence,setPersistence,type Auth} from 'firebase/auth';
import {getFirestore,type Firestore} from 'firebase/firestore';
const cfg={
 apiKey:import.meta.env.VITE_FIREBASE_API_KEY||'',
 authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN||'',
 projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID||'',
 appId:import.meta.env.VITE_FIREBASE_APP_ID||'',
};
export const firebaseConfigured=Object.values(cfg).every(Boolean);
let app:FirebaseApp|undefined;
export let auth:Auth|undefined,db:Firestore|undefined;
if(firebaseConfigured){
 app=initializeApp(cfg);
 auth=getAuth(app);
 // QR authentication is required again after closing the desktop session.
 void setPersistence(auth,browserSessionPersistence);
 db=getFirestore(app);
}
