import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type {Snapshot,Transaction,Currency} from './types';
import {formatMoney,totals,categoryTotals} from './core';
const safe=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function reportHtml(snapshot:Snapshot,items:Transaction[],currency:Currency,from:string,to:string):string{
 const only=items.filter(t=>t.currency===currency);
 const sums=totals(only),cats=categoryTotals(only);
 const rows=only.map(t=>`<tr><td>${safe(t.date)}</td><td>${safe(t.description)}</td><td>${safe(t.type)}</td><td>${safe(snapshot.wallets.find(w=>w.code===t.wallet_code)?.name||t.wallet_code)}</td><td style="text-align:right">${safe(formatMoney(t.amount_minor,currency))}</td></tr>`).join('');
 const categories=cats.map(c=>`<tr><td>${safe(snapshot.categories.find(x=>x.code===c.category)?.name_en||c.category)}</td><td style="text-align:right">${safe(formatMoney(c.amount_minor,currency))}</td></tr>`).join('');
 return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{margin:18mm}body{font-family:Arial,sans-serif;color:#142036;font-size:11px}h1{color:#036c50}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left;word-break:break-word}th{background:#edf6f1}.summary{display:flex;gap:18px;padding:12px;background:#f4f9f6}.disclaimer{color:#64748b}</style></head><body><h1>Money Tracker — Financial Statement</h1><p>${safe(from)} to ${safe(to)} · ${currency}</p><p><b>Income:</b> ${safe(formatMoney(sums.income,currency))} &nbsp; <b>Expenses:</b> ${safe(formatMoney(sums.expense,currency))} &nbsp; <b>Net:</b> ${sums.net<0?'-':''}${safe(formatMoney(sums.net,currency))}</p><h2>Expenses by category</h2><table><tr><th>Category</th><th>Amount</th></tr>${categories}</table><h2>Transactions (${only.length})</h2><table><tr><th>Date</th><th>Description</th><th>Type</th><th>Wallet</th><th>Amount</th></tr>${rows}</table><p class="disclaimer">Exported from your device. This report does not include credentials or account recovery keys.</p></body></html>`;
}
export async function exportPdf(snapshot:Snapshot,items:Transaction[],currency:Currency,from:string,to:string){
 const {uri}=await Print.printToFileAsync({html:reportHtml(snapshot,items,currency,from,to)});
 await Sharing.shareAsync(uri,{mimeType:'application/pdf',UTI:'.pdf',dialogTitle:'Save Money Tracker PDF report'});
}
