import {backDestination} from '../src/settingsNavigation';
let passed=0;function eq(a:unknown,b:unknown,label:string){if(a!==b)throw Error(label);passed++;}
for(const page of ['home','history','add','reports','features'])eq(backDestination(page,null),'confirmExit',`${page} exits`);
for(const section of ['profile','appearance','wallets','categories','budget','reminders','backup','cloud','about'] as const)eq(backDestination('settings',section),'settingsMenu',`${section} back to settings`);
eq(backDestination('settings',null),'confirmExit','settings index exit');
console.log(`${passed} settings navigation tests passed`);
