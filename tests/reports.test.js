import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{validateReport} from '../api/reports.js';
const valid={id:'a3a3a3a3-3333-4444-8888-555555555555',artifactId:'incense',name:'탐험가',title:'연꽃을 닮은 향로',use:'향을 피운다',features:'뚜껑에 구멍이 있다',excellence:'구멍이 정교하게 이어진다',life:'향을 피웠을 것 같다',photos:['data:image/jpeg;base64,/9j/2Q==']};
test('shared reports reject remote URLs, HTML images and oversized photos',()=>{for(const photo of ['https://example.com/a.jpg','data:image/svg+xml;base64,PHN2Zz4=',`data:image/jpeg;base64,${'A'.repeat(220001)}`])assert.throws(()=>validateReport({...valid,photos:[photo]}));});
test('shared reports require evidence, known artifact and bounded strings',()=>{for(const change of [{features:' '},{artifactId:'unknown'},{name:'a'.repeat(25)},{photos:[]},{id:'../other-room'}])assert.throws(()=>validateReport({...valid,...change}));});
test('server controls timestamps and discards client extras',()=>{const report=validateReport({...valid,createdAt:'1900',admin:true});assert.equal(report.type,'report');assert.equal(report.admin,undefined);assert.notEqual(report.createdAt,'1900');});
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
