import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
test('desktop project contains QR desktop secret not in QR URI',()=>{
 const source=fs.readFileSync(new URL('../src/cloud.ts',import.meta.url),'utf8');
 assert.match(source,/newSecret\(\)/);assert.match(source,/crypto\.getRandomValues/);
 const qr=source.slice(source.indexOf('export function pairQr'),source.indexOf('export async function checkPair'));
 assert.doesNotMatch(qr,/session\.secret/);
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
