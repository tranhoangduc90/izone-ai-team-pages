export const TASK1_UI_SLUGS=Object.freeze(['pie-app-users-by-age','australian-destinations-1999-2009','australian-physical-activity-2010','new-zealand-employment-1993-2003','average-earnings-by-sector-2000-2010','mobile-phone-market-share-1994-2004']);
export function task1UiRoute(search,pathname){
 const slug=new URLSearchParams(search).get('task');
 return TASK1_UI_SLUGS.includes(slug)?{slug,role:pathname.endsWith('/teacher.html')?'teacher':'student'}:null;
}
