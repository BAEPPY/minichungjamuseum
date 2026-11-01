import {createHash} from 'node:crypto';
import {courseSourceCredits,enrichReportSourceCredits} from '../src/course-sources.js';
const TTL=30*24*60*60;
const artifactIds=new Set(['maebyeong','ewer','incense','bowl','pillow','stool']);
const comparisonIds=['compare-peony','compare-yuan','compare-inlay'];
const featureIds=['pillow','stool','incense','maebyeong','ewer'];
function record(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function courseText(value){
 if(typeof value!=='string'||!value.trim()||value.length>1200||/<\/?[A-Za-z][^>]*>/.test(value))throw Error('비교 관찰 기록을 글로 채워 주세요. 각 항목은 1200자까지 쓸 수 있어요.');
 return value.trim();
}
function courseReport(value){
 if(!record(value)||!record(value.comparison)||!record(value.comparison.observations)||!record(value.features))throw Error('비교 관찰 보고서 형식을 확인해 주세요.');
 // Construct only the supported text fields. Client extras cannot add another
 // image payload, markup object or unbounded record to the stored report.
 return {
  comparison:{
   observations:Object.fromEntries(comparisonIds.map(id=>[id,courseText(value.comparison.observations[id])])),
   excellence:courseText(value.comparison.excellence),
   evidence:courseText(value.comparison.evidence)
  },
  features:Object.fromEntries(featureIds.map(id=>[id,courseText(value.features[id])])),
  sourceCredits:courseSourceCredits()
 };
}
export function validateReport(input){
 if(!input||typeof input!=='object')throw Error('올바른 보고서가 아니에요.');
 const report={};
 if(!/^[0-9a-f-]{36}$/i.test(input.id||''))throw Error('보고서 ID를 확인해 주세요.');
 report.id=input.id;
 if(!artifactIds.has(input.artifactId))throw Error('전시 유물을 확인해 주세요.');
 report.artifactId=input.artifactId;
 for(const [key,max]of Object.entries({name:24,title:80,use:1200,features:1200,excellence:1200,life:1200})){
  if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max)throw Error('보고서 내용을 확인해 주세요.');
  report[key]=input[key].trim();
 }
 if(!Array.isArray(input.photos)||input.photos.length<1||input.photos.length>3)throw Error('관찰 사진을 1~3장 넣어 주세요.');
 if(input.photos.some(p=>typeof p!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(p)||p.length>220000))throw Error('사진 용량이 너무 크거나 지원하지 않는 형식이에요.');
 report.photos=input.photos;
 if(input.course!==undefined)report.course=courseReport(input.course);
 if(Buffer.byteLength(JSON.stringify(report))>550000)throw Error('사진 용량이 너무 커요. 사진 수를 줄여 주세요.');
 report.createdAt=new Date().toISOString();report.type='report';return report;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','X-Class-Code');res.setHeader('X-Content-Type-Options','nosniff');
 // Vercel Marketplace may inject KV_* names. Select a complete pair so that
 // credentials from two separately configured databases are never combined.
 const upstash={url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN};
 const vercel={url:process.env.KV_REST_API_URL,token:process.env.KV_REST_API_TOKEN};
 const {url,token}=upstash.url&&upstash.token?upstash:vercel;
 if(req.method==='GET'&&req.query.status==='1')return res.status(200).json({enabled:Boolean(url&&token)});
 if(!url||!token)return res.status(503).json({error:'학급 공유 저장소가 아직 연결되지 않았어요.'});
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'지원하지 않는 요청이에요.'});}
 const code=req.headers['x-class-code'];
 if(typeof code!=='string'||!/^[A-Za-z0-9-]{12,48}$/.test(code))return res.status(400).json({error:'전시실 코드를 확인해 주세요.'});
 const room=createHash('sha256').update(code).digest('hex');const prefix=`celadon:${room}`;
 const redis=async(command)=>{const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('storage');const data=await response.json();if(data.error)throw Error('storage');return data.result;};
 try{
  if(req.method==='GET'){
   const cursor=Number(req.query.cursor||0);if(!Number.isInteger(cursor)||cursor<0||cursor>1000)return res.status(400).json({error:'잘못된 페이지 요청이에요.'});
   const ids=await redis(['LRANGE',`${prefix}:index`,cursor,cursor+5]);
   const records=ids.length?await redis(['MGET',...ids.map(id=>`${prefix}:report:${id}`)]):[];
   return res.status(200).json({reports:records.filter(Boolean).map(r=>enrichReportSourceCredits(JSON.parse(r))),nextCursor:ids.length===6?cursor+6:null});
  }
  if(!req.headers['content-type']?.startsWith('application/json'))return res.status(415).json({error:'JSON 요청이 필요해요.'});
  if(Number(req.headers['content-length']||0)>600000)return res.status(413).json({error:'사진 용량이 너무 커요.'});
  let report;try{report=validateReport(typeof req.body==='string'?JSON.parse(req.body):req.body);}catch(error){return res.status(400).json({error:error.message});}
  const limitKey=`${prefix}:rate:${Math.floor(Date.now()/60000)}`;const count=await redis(['INCR',limitKey]);if(count===1)await redis(['EXPIRE',limitKey,120]);if(count>60)return res.status(429).json({error:'전시가 잠시 붐비고 있어요. 1분 뒤 다시 시도해 주세요.'});
  const result=await redis(['SET',`${prefix}:report:${report.id}`,JSON.stringify(report),'EX',TTL,'NX']);
  if(result){await redis(['LPUSH',`${prefix}:index`,report.id]);await redis(['LTRIM',`${prefix}:index`,0,199]);await redis(['EXPIRE',`${prefix}:index`,TTL]);}
  return res.status(201).json({id:report.id});
 }catch{return res.status(502).json({error:'공유 전시실 연결에 실패했어요. 잠시 뒤 다시 시도해 주세요.'});}
}
