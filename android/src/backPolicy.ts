/** Pure Android Back-key rules, independently testable with Node. */
export type MainPage = 'home' | 'add' | 'history' | 'reports' | 'settings';
export type SessionScreen = 'loading' | 'register' | 'reveal' | 'login' | 'recovery' | 'open';

export function mainBackAction(page: MainPage): 'goHome' | 'confirmExit' {
  return page === 'home' ? 'confirmExit' : 'goHome';
}

export function sessionBackAction(screen: SessionScreen): 'goLogin' | 'confirmExit' | 'ignore' {
  if (screen === 'loading' || screen === 'open') return 'ignore';
  if (screen === 'recovery') return 'goLogin';
  return 'confirmExit';
}
