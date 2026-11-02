import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import handler,{validateReport} from '../api/reports.js';
import {reportSummary,thumbnailFitsReport,REPORT_THUMBNAIL_LIMIT} from '../src/report-summary.js';

const room='classroom-30-students';
const id=index=>`a3a3a3a3-3333-4444-8888-${String(index).padStart(12,'0')}`;
const jpeg=length=>'data:image/jpeg;base64,'+'A'.repeat(length);
const report=index=>({id:id(index),artifactId:'incense',name:`탐험가 ${index}`,title:`발견 ${index}`,use:'향을 피운다',features:'뚜껑의 구멍과 이어진 무늬를 살펴보았다.',excellence:'문양이 정교하다.',life:'향을 피웠을 것 같다.',photos:[jpeg(160000),jpeg(160000),jpeg(160000)],thumbnail:jpeg(12000)});
const prefix=code=>'celadon:'+createHash('sha256').update(code).digest('hex');
const response=()=>({headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function call(method,query={},body,code=room){const res=response();await handler({method,query,headers:{'x-class-code':code,'content-type':'application/json'},body},res);return res;}

// Models Redis command semantics and transport overlap, not production latency.
// No credentials, network storage or real pupil reports are used by this test.
function backend(t){
 const records=new Map(),lists=new Map(),counts=new Map(),calls=[];let inflight=0,maxInflight=0;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{
  const command=JSON.parse(options.body);calls.push(command);inflight++;maxInflight=Math.max(maxInflight,inflight);
  await new Promise(resolve=>setImmediate(resolve));
  const [name,...args]=command;let result=null;
  if(name==='LRANGE')result=(lists.get(args[0])||[]).slice(Number(args[1]),Number(args[2])+1);
  else if(name==='MGET')result=args.map(key=>records.get(key)||null);
  else if(name==='GET')result=records.get(args[0])||null;
  else if(name==='EVAL'){
   const [script,count,...values]=args,keys=values.slice(0,count),argv=values.slice(count);
   if(script.includes("redis.call('INCR',KEYS[4])")){
    const [indexKey,reportKey,summaryKey,rateKey]=keys,[id,body,summary]=argv;
    const count=(counts.get(rateKey)||0)+1;counts.set(rateKey,count);
    if(count>60)result=-1;
    else if(records.has(reportKey))result=0;
    else{records.set(reportKey,body);records.set(summaryKey,summary);const list=lists.get(indexKey)||[];list.unshift(id);lists.set(indexKey,list.slice(0,200));result=1;}
   }else{
    result=[];for(let i=0;i<keys.length;i+=2){const cached=records.get(keys[i+1]),source=records.get(keys[i]);const value=cached||(source?JSON.stringify(reportSummary(JSON.parse(source))):null);if(value)records.set(keys[i+1],value);result.push(value);}
   }
  }else throw Error(`Unexpected Redis operation ${name}`);
  inflight--;return {ok:true,json:async()=>({result})};
 });
 return {records,lists,counts,calls,get maxInflight(){return maxInflight;}};
}
async function configured(run){
 const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'],previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 for(const key of keys)delete process.env[key];process.env.KV_REST_API_URL='https://redis.example.test';process.env.KV_REST_API_TOKEN='test-only';
 try{await run();}finally{for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
}

test('30 overlapping publications stay unique and gallery listing transfers compact summaries only',async t=>configured(async()=>{
 const db=backend(t),reports=Array.from({length:30},(_,index)=>report(index));
 const submitted=await Promise.all(reports.map(body=>call('POST',{},body)));
 assert.ok(submitted.every(res=>res.code===201));assert.equal(db.maxInflight,30);
 assert.equal(db.lists.get(prefix(room)+':index').length,30);
 assert.equal(db.calls.length,30,'one atomic Redis command per publication');
 const duplicates=await Promise.all(reports.map(body=>call('POST',{},body)));
 assert.ok(duplicates.every(res=>res.code===201));assert.equal(new Set(db.lists.get(prefix(room)+':index')).size,30);
 const start=db.calls.length,list=await call('GET',{view:'summary'});
 assert.equal(list.code,200);assert.equal(list.body.reports.length,30);assert.equal(list.body.nextCursor,null);
 assert.deepEqual(db.calls.slice(start).map(command=>command[0]),['LRANGE','MGET']);
 assert.ok(db.calls.at(-1).slice(1).every(key=>key.includes(':summary:')),'no original report/photo reads for modern gallery cards');
 for(const summary of list.body.reports){assert.equal(summary.type,'report-summary');assert.equal(summary.photos,undefined);assert.equal(summary.course,undefined);assert.ok(summary.thumbnail.length<=REPORT_THUMBNAIL_LIMIT);}
 const summaryBytes=Buffer.byteLength(JSON.stringify(list.body)),fullBytes=Buffer.byteLength(JSON.stringify(reports));
 assert.ok(summaryBytes<500000);assert.ok(summaryBytes<fullBytes*.03,`${summaryBytes} gallery bytes versus ${fullBytes} original report bytes`);
 const detail=await call('GET',{id:id(12)});assert.equal(detail.code,200);assert.deepEqual(detail.body.report.photos,reports[12].photos);assert.equal(detail.body.report.features,reports[12].features);
 assert.equal((await call('GET',{id:id(12)},undefined,'different-classroom')).code,404,'class codes isolate report detail');
 assert.equal((await call('POST',{},report(999))).code,429,'existing per-room publishing limit still applies');
}));

test('summary pagination preserves 31 separate places and legacy cards are cached without copying large photos',async t=>configured(async()=>{
 const db=backend(t),p=prefix(room),ids=[];
 for(let index=0;index<31;index++){const entry={...report(index),createdAt:'2026-11-01T00:00:00.000Z',type:'report'};delete entry.thumbnail;ids.push(entry.id);db.records.set(`${p}:report:${entry.id}`,JSON.stringify(entry));}
 db.lists.set(p+':index',ids);
 const first=await call('GET',{view:'summary'});assert.equal(first.body.reports.length,30);assert.equal(first.body.nextCursor,30);assert.ok(first.body.reports.every(summary=>!summary.thumbnail&&!summary.photos));
 assert.equal(db.calls.filter(command=>command[0]==='MGET'&&command.slice(1).some(key=>key.includes(':report:'))).length,0,'even legacy gallery reads do not transfer original photo records out of Redis');
 const second=await call('GET',{view:'summary',cursor:'30'});assert.deepEqual(second.body.reports.map(r=>r.id),[id(30)]);assert.equal(second.body.nextCursor,null);
 const start=db.calls.length,repeat=await call('GET',{view:'summary'});assert.deepEqual(repeat.body,first.body);assert.deepEqual(db.calls.slice(start).map(command=>command[0]),['LRANGE','MGET']);
 const detail=await call('GET',{id:id(0)});assert.equal(detail.body.report.photos.length,3,'legacy full record remains intact');
 assert.equal((await call('GET',{id:'../other-room'})).code,400);assert.equal((await call('GET',{view:'summary',cursor:'-1'})).code,400);
}));

test('thumbnail validation is bounded and gallery summaries cannot carry client extras or full evidence',()=>{
 for(const thumbnail of [jpeg(REPORT_THUMBNAIL_LIMIT), 'https://example.test/a.jpg', 'data:image/svg+xml;base64,AAAA', {image:'hidden'}])assert.throws(()=>validateReport({...report(1),thumbnail}));
 const validated=validateReport({...report(1),thumbnail:jpeg(2000)});assert.equal(validated.thumbnail,jpeg(2000));
 const summary=reportSummary({...validated,features:'가'.repeat(1000),admin:true});assert.equal(summary.features.length,160);assert.equal(summary.admin,undefined);assert.equal(summary.photos,undefined);assert.equal(summary.excellence,undefined);
 const nearLimit={...report(2),photos:[jpeg(182000),jpeg(182000),jpeg(182000)]};delete nearLimit.thumbnail;
 assert.doesNotThrow(()=>validateReport(nearLimit));assert.equal(thumbnailFitsReport(nearLimit,jpeg(12000)),false,'omit optional preview when original evidence already uses the report budget');
});
