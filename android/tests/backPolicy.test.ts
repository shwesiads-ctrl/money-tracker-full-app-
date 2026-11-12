import {mainBackAction,sessionBackAction} from '../src/backPolicy';
let count=0;
function equal(a:unknown,b:unknown,label:string){if(a!==b)throw new Error(`${label}: ${a} !== ${b}`);count++;console.log('PASS',label);}
for(const tab of ['home','add','history','reports','settings','features'] as const){equal(mainBackAction(tab),'confirmExit',`${tab} back requires exit confirmation`);}
equal(sessionBackAction('recovery'),'goLogin','Recovery back returns to login');
for(const tab of ['register','reveal','login'] as const){equal(sessionBackAction(tab),'confirmExit',`${tab} requires exit confirmation`);}
equal(sessionBackAction('loading'),'ignore','Loading does not exit');
equal(sessionBackAction('open'),'ignore','Root does not steal Tracker back handler');
console.log(`${count} back navigation policy tests passed`);
