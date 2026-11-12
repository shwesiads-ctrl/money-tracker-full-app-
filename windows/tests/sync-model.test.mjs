import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Spark QR pairing is owner-authenticated and has no desktop auth token',()=>{
 const source=fs.readFileSync(new URL('../src/cloud.ts',import.meta.url),'utf8');
 assert.match(source,/auth.currentUser/);
 assert.match(source,/crypto.getRandomValues/);
 assert.match(source,/getDoc/);assert.match(source,/setDoc/);
 assert.doesNotMatch(source,/signInWithCustomToken|httpsCallable|createCustomToken/);
 const qr=source.slice(source.indexOf('export function pairQr'),source.indexOf('export async function checkPair'));
 assert.match(qr,/session.uid/);assert.doesNotMatch(qr,/idToken|refreshToken|password|secretHash/);
});
test('Firebase credentials are not hardcoded',()=>{
 const source=fs.readFileSync(new URL('../src/firebase.ts',import.meta.url),'utf8');
 assert.match(source,/import\.meta\.env\.VITE_FIREBASE_API_KEY/);
 assert.doesNotMatch(source,/AIza[0-9A-Za-z_-]{30,}/);
});
test('sync enforces revision compare-and-set',()=>{
 const source=fs.readFileSync(new URL('../src/cloud.ts',import.meta.url),'utf8');
 assert.match(source,/runTransaction/);assert.match(source,/revision:record\.revision\+1/);
});

test('Firestore JSON rules block cross-account reads and stale pairing approval',()=>{
 const rules=fs.readFileSync(new URL('../../firebase/firestore.rules',import.meta.url),'utf8');
 assert.match(rules,/request.auth.uid == uid/);
 assert.match(rules,/email_verified == true/);
 assert.match(rules,/resource.data.expiresAt > request.time/);
 assert.match(rules,/affectedKeys\(\).hasOnly/);
 assert.doesNotMatch(fs.readFileSync(new URL('../../firebase/firebase.json',import.meta.url),'utf8'),/"functions"/);
});
