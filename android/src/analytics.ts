import type {Transaction} from './types';
export type AnalyticsPeriod='day'|'week'|'month'|'year'|'custom';
export type DateRange={from:string;to:string};
const iso=(d:Date)=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
const parse=(v:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('Invalid ISO date');
 const d=new Date(v+'T00:00:00Z');if(!Number.isFinite(d.getTime())||iso(d)!==v)throw Error('Invalid calendar date');
 return d;
};
const add=(date:string,days:number)=>{const d=parse(date);d.setUTCDate(d.getUTCDate()+days);return iso(d);};
export function analyticsRange(period:Exclude<AnalyticsPeriod,'custom'>,anchor:string):DateRange{
 const d=parse(anchor);
 if(period==='day')return {from:anchor,to:anchor};
 if(period==='week'){
  const start=add(anchor,-((d.getUTCDay()+6)%7));return {from:start,to:add(start,6)};
 }
 const year=d.getUTCFullYear(),month=d.getUTCMonth();
 if(period==='month')return {from:iso(new Date(Date.UTC(year,month,1))),to:iso(new Date(Date.UTC(year,month+1,0)))};
 return {from:`${year}-01-01`,to:`${year}-12-31`};
}
export function shiftAnalyticsAnchor(period:Exclude<AnalyticsPeriod,'custom'>,anchor:string,direction:-1|1):string{
 if(period==='day')return add(anchor,direction);
 if(period==='week')return add(anchor,direction*7);
 const d=parse(anchor),n=period==='month'?new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+direction,1)):new Date(Date.UTC(d.getUTCFullYear()+direction,0,1));
 return iso(n);
}
export type TrendBucket={key:string;label:string;income:number;expense:number};
/** Income and expenses only. Transfers are intentionally excluded. All values in minor units. */
export function analyticsBuckets(transactions:Transaction[],period:Exclude<AnalyticsPeriod,'custom'>,anchor:string):TrendBucket[]{
 const {from,to}=analyticsRange(period,anchor);
 const buckets:TrendBucket[]=[];
 if(period==='day')buckets.push({key:from,label:from.slice(5),income:0,expense:0});
 else if(period==='week')for(let i=0;i<7;i++){const date=add(from,i);buckets.push({key:date,label:date.slice(5),income:0,expense:0});}
 else if(period==='year')for(let m=1;m<=12;m++)buckets.push({key:`${from.slice(0,4)}-${String(m).padStart(2,'0')}`,label:String(m).padStart(2,'0'),income:0,expense:0});
 else {let date=from;let i=1;while(date<=to){buckets.push({key:date,label:`W${i++}`,income:0,expense:0});date=add(date,7);} }
 const byKey=new Map(buckets.map(b=>[b.key,b]));
 for(const t of transactions){
  if(t.date<from||t.date>to||t.type==='transfer')continue;
  const key=period==='year'?t.date.slice(0,7):period==='month'?buckets[Math.floor((parse(t.date).getTime()-parse(from).getTime())/(7*86400000))]?.key:t.date;
  const b=key?byKey.get(key):undefined;
  if(b){if(t.type==='income')b.income+=t.amount_minor;else if(t.type==='expense')b.expense+=t.amount_minor;}
 }
 return buckets;
}
