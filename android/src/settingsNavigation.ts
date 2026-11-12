export type SettingsSection='appearance'|'profile'|'wallets'|'categories'|'budget'|'reminders'|'backup'|'cloud'|'about';
/** Main tabs request exit confirmation. Nested settings pages return to the Settings menu. */
export function backDestination(page:string,section:SettingsSection|null):'settingsMenu'|'confirmExit'{
 return page==='settings'&&section!==null?'settingsMenu':'confirmExit';
}
