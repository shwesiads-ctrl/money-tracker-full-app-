import { assertTransaction, categoryTotals, dailyTotals, filterTransactions, formatMoney, fromMinor, isValidDate, makeBackup, makeCsv, parseBackup, toMinor, totals, walletBalance } from '../src/core';
import type { Snapshot, Transaction } from '../src/types';

const eq = (actual: unknown, expected: unknown, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const throws = (fn: () => unknown, label: string) => { let caught = false; try { fn(); } catch { caught = true; } if (!caught) throw new Error(`${label}: expected rejection`); };
const sample: Snapshot = {
  wallets: [
    { code: 'Cash', name: 'Cash', sort_order: 0, active: 1, opening_mmk_minor: 10000, opening_usd_minor: 0 },
    { code: 'KBZPay', name: 'KBZPay', sort_order: 1, active: 1, opening_mmk_minor: 0, opening_usd_minor: 1000 },
  ],
  categories: [
    { code: 'Food', name_en: 'Food', name_my: 'အစားအစာ', kind: 'expense', active: 1, sort_order: 0 },
    { code: 'Salary', name_en: 'Salary', name_my: 'လစာ', kind: 'income', active: 1, sort_order: 1 },
  ],
  transactions: [
    { id: 'tx_1', date: '2026-11-01', type: 'income', currency: 'MMK', amount_minor: 5000, description: 'Salary', wallet_code: 'Cash', to_wallet_code: null, category_code: 'Salary', created_at: '2026-11-01T00:00:00.000Z' },
    { id: 'tx_2', date: '2026-11-02', type: 'expense', currency: 'MMK', amount_minor: 1200, description: '=bad Excel formula', wallet_code: 'Cash', to_wallet_code: null, category_code: 'Food', created_at: '2026-11-02T00:00:00.000Z' },
    { id: 'tx_3', date: '2026-11-03', type: 'transfer', currency: 'MMK', amount_minor: 2500, description: 'Move to KBZPay', wallet_code: 'Cash', to_wallet_code: 'KBZPay', category_code: null, created_at: '2026-11-03T00:00:00.000Z' },
    { id: 'tx_4', date: '2026-11-03', type: 'expense', currency: 'USD', amount_minor: 120, description: 'Tea', wallet_code: 'KBZPay', to_wallet_code: null, category_code: 'Food', created_at: '2026-11-03T00:00:00.000Z' },
  ],
  budgets: [{currency:'MMK',amount_minor:300000},{currency:'USD',amount_minor:50000}],
  settings: {language:'my',currency:'MMK',dark_mode:false,show_wallets:true},
};
let passed = 0;
function test(name: string, fn: () => void) {fn();passed++;console.log(`PASS ${name}`);}
test('money minor units and formatting',()=>{eq(toMinor('12.30','USD'),1230,'USD minor');eq(fromMinor(1230,'USD'),'12.30','USD format');eq(toMinor('100','MMK'),100,'Kyat');eq(formatMoney(12300,'MMK'),'12,300 Ks','money label');});
test('reject invalid and fractional Kyat amounts',()=>{throws(()=>toMinor('-1','USD'),'negative');throws(()=>toMinor('3.2','MMK'),'fractional');throws(()=>toMinor('1.234','USD'),'precision');throws(()=>toMinor('NaN','MMK'),'nan');});
test('date validation',()=>{eq(isValidDate('2026-02-28'),true,'valid');eq(isValidDate('2026-02-30'),false,'invalid');eq(isValidDate('2024-02-29'),true,'leap');});
test('transfer balance correctly excludes income and expense',()=>{eq(walletBalance(sample,'Cash','MMK'),11300,'cash');eq(walletBalance(sample,'KBZPay','MMK'),2500,'KBZPay');eq(walletBalance(sample,'KBZPay','USD'),880,'USD');eq(totals(sample.transactions),{income:5000,expense:1320,net:3680},'totals (multi-currency must be filtered by caller)');});
test('filter reports by currency and date',()=>{const filtered=filterTransactions(sample.transactions,{currency:'MMK',from:'2026-11-02',to:'2026-11-03'});eq(filtered.length,2,'filtered count');eq(totals(filtered),{income:0,expense:1200,net:-1200},'filtered totals');eq(categoryTotals(filtered),[{category:'Food',amount_minor:1200}],'categories');eq(dailyTotals(filtered),[{date:'2026-11-02',amount_minor:1200}],'daily');});
test('reject illegal transaction type combinations',()=>{const t=sample.transactions[2]!;throws(()=>assertTransaction({...t,to_wallet_code:null},sample.wallets,sample.categories),'bad transfer');throws(()=>assertTransaction({...sample.transactions[1]!,category_code:'Salary'},sample.wallets,sample.categories),'wrong category');});
test('CSV formula injection protected',()=>{const csv=makeCsv(sample.transactions,sample,'MMK');if(!csv.includes("'=bad Excel formula"))throw new Error('CSV dangerous formula not escaped');});
test('backup v2 roundtrip',()=>{const back=makeBackup(sample);eq(parseBackup(back).transactions.length,4,'count');eq(back.format,'money-tracker-ts-backup','format');});
test('reject malformed backup and broken wallet refs',()=>{const b=makeBackup(sample);b.transactions[0]!.wallet_code='Nonexistent';throws(()=>parseBackup(b),'broken refs');throws(()=>parseBackup({format:'unknown'}),'bad type');});
test('legacy PHP backup import',()=>{const old={format:'money-tracker-backup',version:1, wallets:[{code:'Cash',name:'Cash',opening_mmk:'2000.00',opening_usd:'1.50',active:'1',sort_order:0}],categories:[{code:'Food',name_en:'Food',name_my:'စား',kind:'expense',active:'1',sort_order:0}],transactions:[{date:'2026-11-10',type:'expense',amount:'1250.00',currency:'MMK',description:'Tea',wallet_code:'Cash',category_code:'Food'}],budgets:[{currency:'MMK',amount:'300000.00'}],settings:{language:'my',currency:'MMK',dark_mode:'0',show_wallets:'1'}};const b=parseBackup(old);eq(b.transactions[0]!.amount_minor,1250,'legacy amount');eq(b.wallets[0]!.opening_usd_minor,150,'legacy usd opening');eq(b.settings.dark_mode,false,'legacy bool');});
console.log(`${passed} core tests passed`);
