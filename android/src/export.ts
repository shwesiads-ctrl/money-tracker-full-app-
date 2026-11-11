import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { makeBackup, makeCsv, parseBackup } from './core';
import type { Currency, Snapshot, Transaction } from './types';

async function shareFile(name: string, contents: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device');
  await Sharing.shareAsync(file.uri,{dialogTitle:name,mimeType,UTI:mimeType==='text/csv'?'public.comma-separated-values-text':'public.json'});
}
const stamp = () => new Date().toISOString().slice(0,19).replace(/[-:T]/g,'');
export async function exportBackup(s: Snapshot) {
  const out=makeBackup(s);
  await shareFile(`MoneyTracker_backup_${stamp()}.json`,JSON.stringify(out,null,2),'application/json');
}
export async function exportCsv(s: Snapshot, items: Transaction[], currency: Currency) {
  await shareFile(`MoneyTracker_report_${currency}_${stamp()}.csv`,makeCsv(items,s,currency),'text/csv');
}
export async function selectBackup(): Promise<unknown | null> {
  const picker=await DocumentPicker.getDocumentAsync({type:'application/json',copyToCacheDirectory:true,multiple:false});
  if(picker.canceled || picker.assets.length===0)return null;
  const asset=picker.assets[0];
  if(!asset) return null;
  if(asset.size && asset.size>10*1024*1024)throw new Error('Backup exceeds 10 MB');
  const file=new File(asset.uri);
  const text=await file.text();
  if(text.length>10*1024*1024)throw new Error('Backup exceeds 10 MB');
  const value=JSON.parse(text) as unknown;
  parseBackup(value); // dry-run strict validation
  return value;
}
