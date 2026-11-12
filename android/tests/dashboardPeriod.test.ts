import {dashboardSummary,dashboardPeriodLabel} from '../src/dashboardPeriod';
import type {Transaction} from '../src/types';
let pass=0;function eq<T>(x:T,y:T,msg:string){if(x!==y)throw Error(msg+': '+String(x)+' != '+String(y));pass++;}
const row=(id:string,date:string,type:'income'|'expense'|'transfer',amount_minor:number):Transaction=>({id,date,type,amount_minor,currency:'MMK',description:id,wallet_code:'Cash',to_wallet_code:type==='transfer'?'Bank':null,category_code:type==='transfer'?null:'Other',created_at:date});
const a=[row('today-i','2026-11-12','income',5500),row('today-e','2026-11-12','expense',1300),row('transfer','2026-11-12','transfer',9000),row('yesterday','2026-11-11','income',400),row('past-week','2026-11-03','expense',250),row('past-month','2026-10-05','income',700),row('past-year','2025-10-05','expense',900)];
const today='2026-11-12';
eq(dashboardSummary(a,'day',today).income,5500,'today income');eq(dashboardSummary(a,'day',today).expense,1300,'today expense');eq(dashboardSummary(a,'day',today).net,4200,'today net');
eq(dashboardSummary(a,'week',today).income,5900,'week income');eq(dashboardSummary(a,'week',today).expense,1300,'week expense');
eq(dashboardSummary(a,'month',today).income,5900,'month income');eq(dashboardSummary(a,'month',today).expense,1550,'month expense');
eq(dashboardSummary(a,'year',today).income,6600,'year income');eq(dashboardSummary(a,'year',today).expense,1550,'year expense');
eq(dashboardSummary(a,'day','2026-11-14').income,0,'empty date');eq(dashboardSummary(a,'day','2026-11-03').expense,250,'specific day');
eq(dashboardSummary(a,'week','2026-11-15').expense,1300,'Sunday');eq(dashboardSummary(a,'week','2026-11-16').expense,0,'following week');
eq(dashboardPeriodLabel('day','my').income,'ယနေ့ ဝင်ငွေ','Myanmar income');eq(dashboardPeriodLabel('day','my').expense,'ယနေ့ ထွက်ငွေ','Myanmar expense');
eq(dashboardPeriodLabel('week','my').income,'ယခုအပတ် ဝင်ငွေ','Myanmar week');eq(dashboardPeriodLabel('month','my').expense,'ယခုလ ထွက်ငွေ','Myanmar month');
eq(dashboardPeriodLabel('year','en').income,'This Year Income','English year');eq(dashboardPeriodLabel('day','en').expense,'Today Expenses','English today');
console.log(pass+' dashboard period tests passed');
