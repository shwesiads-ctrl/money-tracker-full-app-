import {normalizeUsername,validateRegistration,normalizeRecoveryKey,isRecoveryKeyShape,lockoutDuration,equalHex} from '../src/authPolicy';
let count=0;
function check(name:string,condition:boolean){if(!condition)throw new Error(`FAIL: ${name}`);count++;console.log('PASS',name);}
check('normalize username',normalizeUsername('  User_01  ')==='user_01');
check('accept strong password',validateRegistration('user01','Test User','SecurePass123')===null);
check('reject short username',validateRegistration('ab','Test User','SecurePass123')!==null);
check('reject short password',validateRegistration('user01','Test User','short1')!==null);
check('reject password without number',validateRegistration('user01','Test User','verylongpassword')!==null);
check('reject unsafe username',validateRegistration('unsafe@x','Test User','SecurePass123')!==null);
const key='MTK-'+Array(8).fill('ABCD').join('-');
check('recovery key format',isRecoveryKeyShape(key));
check('recovery key normalization',normalizeRecoveryKey(key)==='ABCD'.repeat(8));
check('recovery key invalid shape',!isRecoveryKeyShape('MTK-WRONG'));
check('no delay until fifth error',lockoutDuration(4)===0);
check('backoff and cap',lockoutDuration(5)===30000&&lockoutDuration(100)<=1800000);
check('constant time comparator results',equalHex('abcdef','abcdef')&&!equalHex('abcdef','abcdee'));
console.log(`${count} auth policy checks passed`);
