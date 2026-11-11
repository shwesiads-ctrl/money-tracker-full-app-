import { localDueAt, validateTime, validateReminderTitle, DEFAULT_REMINDER_PREFS } from '../src/reminderPolicy';
let passed = 0;
function test(label:string, fn:()=>void) { try { fn(); passed++; console.log('PASS',label); } catch(e) { console.error('FAIL',label,e); throw e; } }
function fail(fn:()=>unknown){let caught=false;try{fn();}catch{caught=true;}if(!caught)throw new Error('Expected rejection');}
const now=new Date(2026,10,11,12,0,0);
test('valid daily notification time',()=>{const t=validateTime('20:45');if(t.hour!==20||t.minute!==45)throw new Error('invalid parsed time');});
test('midnight and final minute valid',()=>{validateTime('00:00');validateTime('23:59');});
test('reject malformed time',()=>{fail(()=>validateTime('9:30'));fail(()=>validateTime('99:99'));fail(()=>validateTime('24:00'));});
test('require non-empty reminder title',()=>{fail(()=>validateReminderTitle('a'));fail(()=>validateReminderTitle(' '));});
test('reject control characters',()=>{fail(()=>validateReminderTitle('test\ncomment'));});
test('trim title',()=>{if(validateReminderTitle('  Phone bill  ')!=='Phone bill')throw new Error('not trimmed');});
test('validate local future reminder',()=>{const d=localDueAt('2026-11-12','17:30',now);if(d.getDate()!==12||d.getHours()!==17)throw new Error('wrong date');});
test('reject past reminder',()=>fail(()=>localDueAt('2026-11-10','17:30',now)));
test('reject invalid calendar dates',()=>{fail(()=>localDueAt('2026-02-30','17:30',now));fail(()=>localDueAt('2026-13-01','17:30',now));});
test('reject too distant reminders',()=>fail(()=>localDueAt('2031-12-01','17:30',now)));
test('default notifications opted out',()=>{if(DEFAULT_REMINDER_PREFS.dailyEnabled||DEFAULT_REMINDER_PREFS.monthlyEnabled)throw new Error('must be off');});
console.log(`${passed} reminder policy tests passed`);
