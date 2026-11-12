import {widgetDisplayModel} from '../src/widgetModel';
import type {Snapshot} from '../src/types';
let passed=0;
function ok(name:string,value:boolean){if(!value)throw Error('FAIL: '+name);passed++;}
const base:Snapshot={
 wallets:[{code:'Cash',name:'Cash',active:1,sort_order:0,opening_mmk_minor:10000,opening_usd_minor:1250}],
 categories:[],budgets:[],
 transactions:[
 {id:'1',date:'2026-11-02',type:'income',currency:'MMK',amount_minor:12000,description:'Salary',wallet_code:'Cash',to_wallet_code:null,category_code:null,created_at:'2026-11-02'},
 {id:'2',date:'2026-11-03',type:'expense',currency:'MMK',amount_minor:2000,description:'Food',wallet_code:'Cash',to_wallet_code:null,category_code:null,created_at:'2026-11-03'},
 {id:'3',date:'2026-10-01',type:'income',currency:'MMK',amount_minor:7000,description:'Past',wallet_code:'Cash',to_wallet_code:null,category_code:null,created_at:'2026-10-01'}
 ],
 settings:{language:'my',currency:'MMK',dark_mode:true,show_wallets:true,widget_show_balance:false}
};
const hidden=widgetDisplayModel(base,'MMK','2026-11');
ok('private flag',hidden.isPrivate);ok('hide balance',hidden.amount==='');ok('hide income',hidden.income==='');ok('hide expense',hidden.expense==='');
const active={...base,settings:{...base.settings,widget_show_balance:true}};
const shown=widgetDisplayModel(active,'MMK','2026-11');
ok('visible',!shown.isPrivate);ok('wallet balance',shown.amount==='27,000 Ks');
ok('current income',shown.income==='12,000 Ks');ok('current expense',shown.expense==='2,000 Ks');ok('currency',shown.currency==='MMK');
const usd=widgetDisplayModel(active,'USD','2026-11');
ok('usd balance',usd.amount==='$12.50');ok('usd income',usd.income==='$0.00');
const neg=widgetDisplayModel({...active,transactions:[{...base.transactions[1]!,amount_minor:100000}]},'MMK','2026-11');
ok('negative balance',neg.amount==='-90,000 Ks');
console.log(passed+' widget projection tests passed');
