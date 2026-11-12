import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
test('all three pairing paths validate session or code',()=>{
 for(const x of ['startPair','pollPair','approvePair','completePair'])assert.match(src,new RegExp(`export const ${x}=`));
 assert.match(src,/MAX_AGE_MS=120_000/);assert.match(src,/timingSafeEqual/);
});
test('custom token returned only by complete',()=>{
 const prefix=src.slice(0,src.indexOf('export const completePair='));assert.doesNotMatch(prefix,/createCustomToken/);
 assert.match(src,/createCustomToken\(uid/);
});
test('phone verification and one-time use enforced',()=>{assert.match(src,/email_verified!==true/);assert.match(src,/status:'used'/);assert.match(src,/runTransaction/);});
