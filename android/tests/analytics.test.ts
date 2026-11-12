import {analyticsRange,shiftAnalyticsAnchor,analyticsBuckets} from '../src/analytics';
import type {Transaction} from '../src/types';
let passed=0;function eq<T>(a:T,b:T,label:string){if(a!==b)throw Error(`${label}: ${a} !== ${b}`);passed++;}
eq(analyticsRange('day','2026-11-12').from,'2026-11-12','day from');
eq(analyticsRange('day','2026-11-12').to,'2026-11-12','day to');
eq(analyticsRange('week','2026-11-12').from,'2026-11-09','week Monday');
eq(analyticsRange('week','2026-11-12').to,'2026-11-15','week Sunday');
eq(analyticsRange('week','2026-11-15').from,'2026-11-09','Sunday belongs to same week');
eq(analyticsRange('month','2024-02-20').to,'2024-02-29','leap February');
eq(analyticsRange('month','2026-02-05').to,'2026-02-28','nonleap February');
eq(analyticsRange('year','2026-03-05').to,'2026-12-31','year end');
eq(shiftAnalyticsAnchor('month','2026-01-31',-1),'2025-12-01','month shift no overflow');
eq(shiftAnalyticsAnchor('year','2026-01-31',1),'2027-01-01','year shift');
eq(shiftAnalyticsAnchor('week','2026-11-12',1),'2026-11-19','week shift');
let bad=false;try{analyticsRange('day','2026-02-30');}catch{bad=true;}eq(bad,true,'reject impossible date');
const sample:Transaction[]=[
 {id:'i',date:'2026-11-12',type:'income',currency:'MMK',amount_minor:1000,description:'Salary',wallet_code:'Cash',to_wallet_code:null,category_code:'Pay',created_at:'2026-11-12'},
 {id:'e',date:'2026-11-12',type:'expense',currency:'MMK',amount_minor:200,description:'Tea',wallet_code:'Cash',to_wallet_code:null,category_code:'Food',created_at:'2026-11-12'},
 {id:'t',date:'2026-11-12',type:'transfer',currency:'MMK',amount_minor:6000,description:'Internal',wallet_code:'Cash',to_wallet_code:'Bank',category_code:null,created_at:'2026-11-12'},
 {id:'o',date:'2026-10-03',type:'expense',currency:'MMK',amount_minor:999,description:'Old',wallet_code:'Cash',to_wallet_code:null,category_code:'Food',created_at:'2026-10-03'}
];
const daily=analyticsBuckets(sample,'day','2026-11-12');eq(daily.length,1,'day one group');eq(daily[0]!.income,1000,'day income');eq(daily[0]!.expense,200,'day expense excludes transfer');
const week=analyticsBuckets(sample,'week','2026-11-12');eq(week.length,7,'week seven days');eq(week[3]!.expense,200,'Thursday expense');
const month=analyticsBuckets(sample,'month','2026-11-12');eq(month.length,5,'November weeks');eq(month[1]!.income,1000,'week 2 income');
const year=analyticsBuckets(sample,'year','2026-11-12');eq(year.length,12,'year twelve months');eq(year[10]!.expense,200,'November expense');eq(year[9]!.expense,999,'October expense');
console.log(`${passed} analytics tests passed`);
