/** Paginate records after currency/search/filter/sort selection; export uses unpaged data. */
export const HISTORY_PAGE_SIZE=20;
export function paginateHistory<T>(rows:readonly T[],requestedPage:number) {
  const total=rows.length;
  const pageCount=Math.max(1,Math.ceil(total/HISTORY_PAGE_SIZE));
  const requested=Number.isFinite(requestedPage)?Math.floor(requestedPage):1;
  const page=Math.max(1,Math.min(pageCount,requested));
  const offset=(page-1)*HISTORY_PAGE_SIZE;
  return {items:rows.slice(offset,offset+HISTORY_PAGE_SIZE),page,pageCount,total,start:total?offset+1:0,end:Math.min(total,offset+HISTORY_PAGE_SIZE)};
}
