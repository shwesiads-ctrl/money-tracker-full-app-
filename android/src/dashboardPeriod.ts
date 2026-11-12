import type {Language,Transaction} from './types';
import {analyticsRange} from './analytics';
import type {AnalyticsPeriod} from './analytics';
import {totals} from './core';

export type DashboardPeriod=Exclude<AnalyticsPeriod,'custom'>;
export function dashboardSummary(items:Transaction[],period:DashboardPeriod,today:string){
 const {from,to}=analyticsRange(period,today);
 return totals(items.filter(t=>t.date>=from&&t.date<=to));
}
export function dashboardPeriodLabel(period:DashboardPeriod,lang:Language){
 const names=lang==='my'?{day:'ယနေ့',week:'ယခုအပတ်',month:'ယခုလ',year:'ယခုနှစ်'}:{day:'Today',week:'This Week',month:'This Month',year:'This Year'};
 const prefix=names[period];
 return lang==='my'?{income:prefix+' ဝင်ငွေ',expense:prefix+' ထွက်ငွေ'}:{income:prefix+' Income',expense:prefix+' Expenses'};
}
