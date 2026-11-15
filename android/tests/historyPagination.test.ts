import {HISTORY_PAGE_SIZE,paginateHistory} from '../src/historyPagination';
let passed=0;
function eq<T>(actual:T,expected:T,subject:string){if(actual!==expected)throw Error(subject+': expected '+String(expected)+', got '+String(actual));passed++;}
const records=Array.from({length:53},(_,i)=>'tx-'+(i+1));
const p1=paginateHistory(records,1),p2=paginateHistory(records,2),p3=paginateHistory(records,3);
eq(HISTORY_PAGE_SIZE,20,'size');eq(p1.items.length,20,'first count');eq(p1.items[0],'tx-1','first start');eq(p1.items[19],'tx-20','first end');
eq(p2.items.length,20,'second count');eq(p2.items[0],'tx-21','second start');eq(p2.items[19],'tx-40','second end');
eq(p3.items.length,13,'third count');eq(p3.items[0],'tx-41','third start');eq(p3.items[12],'tx-53','third end');
eq(p3.pageCount,3,'page count');eq(p3.start,41,'range start');eq(p3.end,53,'range end');
eq(paginateHistory(records,999).page,3,'last page clamp');eq(paginateHistory(records,0).page,1,'first page clamp');eq(paginateHistory(records,NaN).page,1,'NaN page');
eq(paginateHistory(records.slice(0,20),1).pageCount,1,'exact page');eq(paginateHistory(records.slice(0,21),2).items.length,1,'21st record');
eq(paginateHistory([],1).pageCount,1,'empty page count');eq(paginateHistory([],1).start,0,'empty start');eq(paginateHistory([],1).end,0,'empty end');
const filtered=records.filter((_,i)=>i%3===0);eq(paginateHistory(filtered,1).items.length,18,'filter length');eq(paginateHistory(filtered,1).items[1],'tx-4','filter order');
console.log(passed+' pagination tests passed');
