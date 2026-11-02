// Gallery cards never carry the full report's photos or comparison answers.
export const REPORT_THUMBNAIL_LIMIT=16000;
export const SUMMARY_PAGE_SIZE=30;
export function validThumbnail(value){return typeof value==='string'&&value.length<=REPORT_THUMBNAIL_LIMIT&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);}
// Leave room for canonical server fields; a decorative gallery preview must
// never force a pupil to remove the full-sized observation evidence.
export function thumbnailFitsReport(report,thumbnail){return validThumbnail(thumbnail)&&new TextEncoder().encode(JSON.stringify({...report,thumbnail})).length<=545000;}
export function reportSummary(report){
 const text=(key,max)=>String(report?.[key]??'').slice(0,max);
 return {id:text('id',36),type:'report-summary',artifactId:text('artifactId',40),name:text('name',24),title:text('title',80),features:text('features',160),createdAt:text('createdAt',32),...(validThumbnail(report?.thumbnail)?{thumbnail:report.thumbnail}:{})};
}
