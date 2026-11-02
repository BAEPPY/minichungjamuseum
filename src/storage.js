import {reportSummary,thumbnailFitsReport,REPORT_THUMBNAIL_LIMIT} from './report-summary.js';
let dbPromise;
function db(){return dbPromise??=new Promise((resolve,reject)=>{
 const r=indexedDB.open('celadon-museum',2);let blocked=false;
 r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('records'))d.createObjectStore('records',{keyPath:'id'});if(!d.objectStoreNames.contains('report-index')){const index=d.createObjectStore('report-index',{keyPath:'id'});const cursor=r.transaction.objectStore('records').openCursor();cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;if(row.value?.type==='report')index.put(reportSummary(row.value));row.continue();};}};
 r.onblocked=()=>{blocked=true;dbPromise=null;reject(Error('다른 탭에 열린 이전 박물관을 닫고 새로고침해 주세요.'));};
 r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>{r.result.close();dbPromise=null;};resolve(r.result);};
 r.onerror=()=>{dbPromise=null;reject(r.error);};
});}
export async function put(record){const d=await db();return new Promise((resolve,reject)=>{const isReport=record?.type==='report',t=d.transaction(isReport?['records','report-index']:['records'],'readwrite');t.objectStore('records').put(record);if(isReport)t.objectStore('report-index').put(reportSummary(record));t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
export async function all(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('records').objectStore('records').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function get(id){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('records').objectStore('records').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function remove(id){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(['records','report-index'],'readwrite');t.objectStore('records').delete(id);t.objectStore('report-index').delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
export async function localReportSummaries(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('report-index').objectStore('report-index').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));r.onerror=()=>reject(r.error);});}
export async function prepareReport(report){
 if(thumbnailFitsReport(report,report.thumbnail))return report;
 const prepared={...report};delete prepared.thumbnail;
 const source=report.photos?.[0];if(typeof source!=='string'||!source.startsWith('data:image/jpeg;base64,'))return prepared;
 try{
  const image=new Image();image.src=source;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=192;canvas.height=144;const context=canvas.getContext('2d');
  context.fillStyle='#eef0e7';context.fillRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;context.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  for(const quality of [.62,.45,.3]){const thumbnail=canvas.toDataURL('image/jpeg',quality);if(thumbnail.length<=REPORT_THUMBNAIL_LIMIT&&thumbnailFitsReport(prepared,thumbnail)){prepared.thumbnail=thumbnail;break;}}
 }catch{}
 return prepared;
}
export async function shareStatus(){try{const r=await fetch('/api/reports?status=1');if(!r.ok)return false;return (await r.json()).enabled===true;}catch{return false;}}
export async function sharedRequest(code,method='GET',report,cursor){const r=await fetch('/api/reports'+(cursor!==undefined?'?cursor='+cursor:''),{method,headers:{'Content-Type':'application/json','X-Class-Code':code},...(report?{body:JSON.stringify(report)}:{})});const body=await r.json();if(!r.ok)throw Error(body.error||'전시실에 연결하지 못했어요.');return body;}
async function sharedRead(code,query){const r=await fetch('/api/reports?'+new URLSearchParams(query),{headers:{'X-Class-Code':code}});const body=await r.json();if(!r.ok)throw Error(body.error||'전시실에 연결하지 못했어요.');return body;}
export function sharedSummaries(code,cursor=0){return sharedRead(code,{view:'summary',cursor:String(cursor)});}
export function sharedReport(code,id){return sharedRead(code,{id});}
