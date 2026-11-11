/** Pure validation functions shared by runtime and offline tests. */
export type ReminderFrequency = 'daily' | 'monthly' | 'once';
export type ReminderPrefs = {
  dailyEnabled: boolean;
  dailyTime: string;
  monthlyEnabled: boolean;
  monthlyTime: string;
};
export interface SavedReminder {
  id: string;
  title: string;
  dueLocal: string; // device-local YYYY-MM-DDTHH:mm (not UTC)
  createdAt: string;
}
export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  dailyEnabled: false, dailyTime: '20:00', monthlyEnabled: false, monthlyTime: '09:00',
};
export function validateTime(text: string): { hour: number; minute: number } {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error('Use a valid 24-hour time (HH:mm), e.g. 20:00.');
  const [hour,minute] = text.split(':').map(Number);
  return {hour:hour!,minute:minute!};
}
export function localDueAt(dateText: string, timeText: string, now = new Date()): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error('Date must be YYYY-MM-DD.');
  const [year,month,day] = dateText.split('-').map(Number);
  const {hour,minute} = validateTime(timeText);
  const date = new Date(year!,month!-1,day!,hour,minute,0,0);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year || date.getMonth()+1 !== month || date.getDate() !== day) throw new Error('Invalid calendar date.');
  if (date.getTime() < now.getTime()+60*1000) throw new Error('Reminder must be at least one minute in the future.');
  if (date.getTime() > now.getTime()+366*2*24*3600*1000) throw new Error('Reminder date is too far away (max 2 years).');
  return date;
}
export function validateReminderTitle(s: string): string {
  const title=s.trim();
  if (title.length < 2 || title.length>100) throw new Error('Reminder title must be 2–100 characters.');
  if (/[\u0000-\u001F\u007F]/.test(title)) throw new Error('Reminder title contains an invalid character.');
  return title;
}
export const isUpcoming = (r: SavedReminder, now=new Date()): boolean => {
  const [date,time] = r.dueLocal.split('T');
  if (!date || !time) return false;
  try { return localDueAt(date,time,new Date(now.getTime()-60*1000)).getTime() > now.getTime(); }
  catch { return false; }
};
