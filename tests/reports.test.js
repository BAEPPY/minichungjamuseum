import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{validateReport} from '../api/reports.js';
const valid={id:'a3a3a3a3-3333-4444-8888-555555555555',artifactId:'incense',name:'탐험가',title:'연꽃을 닮은 향로',use:'향을 피운다',features:'뚜껑에 구멍이 있다',excellence:'구멍이 정교하게 이어진다',life:'향을 피웠을 것 같다',photos:['data:image/jpeg;base64,/9j/2Q==']};
const course={comparison:{observations:{'compare-peony':'파서 나타낸 꽃무늬','compare-yuan':'고리 달린 동물 손잡이','compare-inlay':'검고 흰 학과 구름'},excellence:'상감으로 서로 다른 색의 무늬를 나타냈다',evidence:'학과 구름에 검은색과 흰색의 차이가 보인다'},features:{pillow:'가운데가 오목하다',stool:'고리 사이가 뚫려 있다',incense:'뚜껑에 구멍이 있다',maebyeong:'어깨가 넓고 입이 작다',ewer:'물고기 몸통과 용의 머리가 있다'}};
const sourceCredits=[{
 id:'agh-yuan-vase',
 title:'기본 비교 자료: 원나라 시대 청자 병 · Vase (Yuan Dynasty, 1271–1368)',
 artist:'Unidentified, Chinese',
 collection:'Art Gallery of Hamilton (AGH)',
 accession:'1976.19.M',
 gift:'Gift of Herman H. Levy, 1976',
 digitization:'Serena Zena Mak Walk, 2023 · Sari-Sari Xchange: Building Asian Diasporic Community Through Emergent Media',
 sourceUrl:'https://sketchfab.com/3d-models/vase-yuan-dynasty-1271-1368-a50b38792b264f18af523dc935dae606',
 license:'CC BY-NC-SA 4.0',
 licenseUrl:'https://creativecommons.org/licenses/by-nc-sa/4.0/',
 modifications:'웹용으로 원본 8K 사진 질감을 4K JPEG(품질 90, 4:4:4)로 축소했습니다. 형상·UV·원본 KHR_materials_unlit 재질은 변경하지 않았습니다.'
}];
const creditedCourse={...course,sourceCredits};
test('shared reports reject remote URLs, HTML images and oversized photos',()=>{for(const photo of ['https://example.com/a.jpg','data:image/svg+xml;base64,PHN2Zz4=',`data:image/jpeg;base64,${'A'.repeat(220001)}`])assert.throws(()=>validateReport({...valid,photos:[photo]}));});
test('shared reports require evidence, known artifact and bounded strings',()=>{for(const change of [{features:' '},{artifactId:'unknown'},{name:'a'.repeat(25)},{photos:[]},{id:'../other-room'}])assert.throws(()=>validateReport({...valid,...change}));});
test('server controls timestamps and discards client extras',()=>{const report=validateReport({...valid,createdAt:'1900',admin:true});assert.equal(report.type,'report');assert.equal(report.admin,undefined);assert.notEqual(report.createdAt,'1900');});
test('course reports retain all three comparisons and five features while legacy reports remain valid',()=>{
 const report=validateReport({...valid,course});
 assert.deepEqual(report.course,creditedCourse);
 assert.notEqual(report.course,course,'canonical data does not retain the client object');
 assert.equal(validateReport(valid).course,undefined);
 const canonical=validateReport({...valid,course:{...course,photos:['https://example.test/extra.jpg'],comparison:{...course.comparison,admin:true,observations:{...course.comparison.observations,unknown:'extra'}},features:{...course.features,bowl:'old gallery item'}}});
 assert.deepEqual(canonical.course,creditedCourse,'unsupported fields are discarded from the stored course');
});
test('canonical course credits replace forged client links and stay detached from client objects',()=>{
 const forged={...course,sourceCredits:[{id:'agh-yuan-vase',sourceUrl:'javascript:alert(1)',licenseUrl:'https://example.test/fake',modifications:'unchanged'}]};
 const report=validateReport({...valid,course:forged});
 assert.deepEqual(report.course.sourceCredits,sourceCredits);
 assert.equal(report.course.sourceCredits[0].collection,'Art Gallery of Hamilton (AGH)');
 assert.equal(report.course.sourceCredits[0].license,'CC BY-NC-SA 4.0');
 assert.equal(report.course.sourceCredits[0].licenseUrl,'https://creativecommons.org/licenses/by-nc-sa/4.0/');
 assert.match(report.course.sourceCredits[0].modifications,/8K.*4K JPEG/);
 report.course.sourceCredits[0].sourceUrl='https://example.test/changed';
 assert.deepEqual(validateReport({...valid,course}).course.sourceCredits,sourceCredits);
 assert.equal(forged.sourceCredits[0].sourceUrl,'javascript:alert(1)');
});
test('course reports require complete bounded plain-text observations, claims and evidence',()=>{
 const changes=[null,[],{...course,comparison:[]},{...course,features:[]},
  {...course,comparison:{...course.comparison,observations:{...course.comparison.observations,'compare-yuan':''}}},
  {...course,comparison:{...course.comparison,evidence:' '}},
  {...course,comparison:{...course.comparison,excellence:'가'.repeat(1201)}},
  {...course,features:{...course.features,stool:{text:'고리'}}},
  {...course,features:{...course.features,pillow:'<img src=x onerror=alert(1)>'}}
 ];
 for(const change of changes)assert.throws(()=>validateReport({...valid,course:change}));
 const trimmed=validateReport({...valid,course:{...course,comparison:{...course.comparison,evidence:'  관찰한 근거  '}}});
 assert.equal(trimmed.course.comparison.evidence,'관찰한 근거');
});
test('the existing total report size budget includes the new course text',()=>{
 const fullText='가'.repeat(1200);
 const full={comparison:{observations:Object.fromEntries(Object.keys(course.comparison.observations).map(id=>[id,fullText])),excellence:fullText,evidence:fullText},features:Object.fromEntries(Object.keys(course.features).map(id=>[id,fullText]))};
 const photo='data:image/jpeg;base64,'+'A'.repeat(178000);
 assert.doesNotThrow(()=>validateReport({...valid,photos:[photo,photo],course:full}));
 assert.throws(()=>validateReport({...valid,photos:[photo,photo,photo],course:full}),/용량/);
});
test('canonical attribution is included in the stored report size budget',()=>{
 const prefix='data:image/jpeg;base64,';
 const overhead=Buffer.byteLength(JSON.stringify({...valid,photos:[prefix,prefix,prefix],course}));
 const payloadLength=Math.floor((550000-overhead-8)/12)*4;
 const photos=Array(3).fill(prefix+'A'.repeat(payloadLength));
 const uncreditedBytes=Buffer.byteLength(JSON.stringify({...valid,photos,course}));
 assert.ok(uncreditedBytes<=550000&&uncreditedBytes>549900);
 assert.throws(()=>validateReport({...valid,photos,course}),/용량/,'required credits cannot be appended after the size check');
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(body){this.body=body;return this;}};}
const redisEnvKeys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'];
async function withRedisEnvironment(values,run){
 const previous=Object.fromEntries(redisEnvKeys.map(key=>[key,process.env[key]]));
 for(const key of redisEnvKeys){delete process.env[key];if(values[key]!==undefined)process.env[key]=values[key];}
 try{return await run();}
 finally{for(const key of redisEnvKeys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
}
function statusRequest(){return {method:'GET',query:{status:'1'},headers:{}};}
function reportsRequest(){return {method:'GET',query:{},headers:{'x-class-code':'test-class-2026'}};}
async function expectConfiguredRead(t,env,expectedUrl,expectedToken){
 await withRedisEnvironment(env,async()=>{
  const requests=[];
  const stored={...valid,createdAt:'2026-11-01T00:00:00.000Z',type:'report'};
  const fetchMock=t.mock.method(globalThis,'fetch',async(url,options)=>{
   const command=JSON.parse(options.body);
   requests.push({url,options,command});
   const result=command[0]==='LRANGE'?[valid.id]:command[0]==='MGET'?[JSON.stringify(stored)]:null;
   return {ok:true,json:async()=>({result})};
  });
  let res=response();
  await handler(statusRequest(),res);
  assert.equal(res.code,200);
  assert.deepEqual(res.body,{enabled:true});
  assert.equal(fetchMock.mock.callCount(),0,'status reports configuration without connecting to Redis');
  res=response();
  await handler(reportsRequest(),res);
  assert.equal(res.code,200);
  assert.deepEqual(res.body,{reports:[stored],nextCursor:null});
  assert.equal(requests.length,2);
  assert.deepEqual(requests.map(req=>req.command[0]),['LRANGE','MGET']);
  for(const req of requests){
   assert.equal(req.url,expectedUrl);
   assert.equal(req.options.method,'POST');
   assert.equal(req.options.headers.Authorization,`Bearer ${expectedToken}`);
  }
 });
}
test('storage missing is explicit and does not pretend report was shared',async()=>{
 await withRedisEnvironment({},async()=>{
  let res=response();await handler(statusRequest(),res);
  assert.equal(res.code,200);assert.deepEqual(res.body,{enabled:false});
  res=response();await handler({method:'POST',query:{},headers:{}},res);assert.equal(res.code,503);
 });
});
test('KV-only configuration enables sharing and handler GET uses its REST URL and token',async t=>{
 await expectConfiguredRead(t,{KV_REST_API_URL:'https://kv.example.test',KV_REST_API_TOKEN:'kv-test-token'},'https://kv.example.test','kv-test-token');
});
test('complete explicit Upstash pair takes precedence over a complete KV pair',async t=>{
 await expectConfiguredRead(t,{
  UPSTASH_REDIS_REST_URL:'https://upstash.example.test',UPSTASH_REDIS_REST_TOKEN:'upstash-test-token',
  KV_REST_API_URL:'https://kv.example.test',KV_REST_API_TOKEN:'kv-test-token'
 },'https://upstash.example.test','upstash-test-token');
});
test('partial Upstash configuration falls back to a complete KV pair',async t=>{
 const partials=[
  {name:'Upstash URL without token',values:{UPSTASH_REDIS_REST_URL:'https://partial-upstash.example.test'}},
  {name:'Upstash token without URL',values:{UPSTASH_REDIS_REST_TOKEN:'partial-upstash-token'}}
 ];
 for(const {name,values}of partials)await t.test(name,async sub=>{
  await expectConfiguredRead(sub,{...values,KV_REST_API_URL:'https://kv.example.test',KV_REST_API_TOKEN:'kv-test-token'},'https://kv.example.test','kv-test-token');
 });
});
test('incomplete pairs are never mixed and report sharing disabled without a fetch',async t=>{
 const incomplete=[
  {name:'Upstash URL plus KV token',values:{UPSTASH_REDIS_REST_URL:'https://upstash.example.test',KV_REST_API_TOKEN:'kv-test-token'}},
  {name:'KV URL plus Upstash token',values:{KV_REST_API_URL:'https://kv.example.test',UPSTASH_REDIS_REST_TOKEN:'upstash-test-token'}},
  {name:'Upstash URL only',values:{UPSTASH_REDIS_REST_URL:'https://upstash.example.test'}},
  {name:'KV token only',values:{KV_REST_API_TOKEN:'kv-test-token'}}
 ];
 for(const {name,values}of incomplete)await t.test(name,async sub=>{
  await withRedisEnvironment(values,async()=>{
   const fetchMock=sub.mock.method(globalThis,'fetch',async()=>{throw Error('No Redis request should be made for incomplete pairs');});
   let res=response();await handler(statusRequest(),res);
   assert.equal(res.code,200);assert.deepEqual(res.body,{enabled:false});
   res=response();await handler(reportsRequest(),res);
   assert.equal(res.code,503);
   assert.equal(fetchMock.mock.callCount(),0);
  });
 });
});
test('a course report survives the shared POST, Redis record and GET response',async t=>{
 await withRedisEnvironment({KV_REST_API_URL:'https://kv.example.test',KV_REST_API_TOKEN:'kv-test-token'},async()=>{
  const records=new Map(),index=[];
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
   const [command,...args]=JSON.parse(options.body);let result=null;
   if(command==='INCR')result=1;
   if(command==='SET'){records.set(args[0],args[1]);result='OK';}
   if(command==='LPUSH'){index.unshift(args[1]);result=index.length;}
   if(command==='LRANGE')result=index.slice(Number(args[1]),Number(args[2])+1);
   if(command==='MGET')result=args.map(key=>records.get(key)||null);
   return {ok:true,json:async()=>({result})};
  });
  let res=response();
  await handler({method:'POST',query:{},headers:{'x-class-code':'test-class-2026','content-type':'application/json'},body:{...valid,course}},res);
  assert.equal(res.code,201);
  assert.deepEqual(JSON.parse([...records.values()][0]).course,creditedCourse);
  res=response();await handler(reportsRequest(),res);
  assert.equal(res.code,200);
  assert.equal(res.body.reports.length,1);
  assert.deepEqual(res.body.reports[0].course,creditedCourse);
 });
});
test('GET enriches old or poisoned course credits without changing report identity, answers or legacy records',async t=>{
 await withRedisEnvironment({KV_REST_API_URL:'https://kv.example.test',KV_REST_API_TOKEN:'kv-test-token'},async()=>{
  const timestamp='2026-11-01T00:00:00.000Z';
  const stored=[
   {...valid,id:'a3a3a3a3-3333-4444-8888-111111111111',createdAt:timestamp,type:'report',course},
   {...valid,id:'a3a3a3a3-3333-4444-8888-222222222222',createdAt:timestamp,type:'report',course:{...course,sourceCredits:[{sourceUrl:'javascript:alert(1)',license:'not the real license'}]}},
   {...valid,id:'a3a3a3a3-3333-4444-8888-333333333333',createdAt:timestamp,type:'report'}
  ];
  const original=structuredClone(stored);
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
   const [command]=JSON.parse(options.body);
   const result=command==='LRANGE'?stored.map(report=>report.id):stored.map(report=>JSON.stringify(report));
   return {ok:true,json:async()=>({result})};
  });
  const res=response();await handler(reportsRequest(),res);
  assert.equal(res.code,200);
  assert.equal(res.body.reports.length,3);
  for(let i=0;i<2;i++){
   const report=res.body.reports[i];
   assert.deepEqual(report,{...stored[i],course:creditedCourse});
   assert.equal(report.id,stored[i].id);
   assert.equal(report.createdAt,timestamp);
   assert.deepEqual(report.course.comparison,course.comparison);
   assert.deepEqual(report.course.features,course.features);
  }
  assert.deepEqual(res.body.reports[2],stored[2]);
  assert.equal(res.body.reports[2].course,undefined);
  assert.deepEqual(stored,original,'GET enrichment does not mutate the original records');
 });
});
