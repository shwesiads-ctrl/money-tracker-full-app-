/** Pure auth validation shared by UI and tests. No secrets are persisted here. */
export function normalizeUsername(raw:string):string{return raw.trim().toLowerCase();}
export function validateRegistration(username:string,displayName:string,password:string):string|null{
  if (!/^[a-z0-9_.-]{3,32}$/.test(normalizeUsername(username)))return 'Username must be 3–32 letters, digits, underscore, dash or period.';
  if (displayName.trim().length<2||displayName.trim().length>60)return 'Display name must be 2–60 characters.';
  if (password.length<10||password.length>128)return 'Password must be 10–128 characters.';
  if (!/[a-zA-Z]/.test(password)||!/[0-9]/.test(password))return 'Use at least one letter and one number in your password.';
  return null;
}
export function normalizeRecoveryKey(input:string):string{return input.toUpperCase().replace(/[^A-Z2-7]/g,'').replace(/^MTK/,'');}
export function isRecoveryKeyShape(input:string):boolean{return /^[A-Z2-7]{32}$/.test(normalizeRecoveryKey(input));}
export function lockoutDuration(failures:number):number{return failures<5?0:Math.min(30*60*1000,30000*2**Math.min(6,failures-5));}
export function equalHex(a:string,b:string):boolean{
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
