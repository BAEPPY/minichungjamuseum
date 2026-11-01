import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{validateReport} from '../api/reports.js';
const valid={id:'a3a3a3a3-3333-4444-8888-555555555555',artifactId:'incense',name:'탐험가',title:'연꽃을 닮은 향로',use:'향을 피운다',features:'뚜껑에 구멍이 있다',excellence:'구멍이 정교하게 이어진다',life:'향을 피웠을 것 같다',photos:['data:image/jpeg;base64,/9j/2Q==']};
test('shared reports reject remote URLs, HTML images and oversized photos',()=>{for(const photo of ['https://example.com/a.jpg','data:image/svg+xml;base64,PHN2Zz4=',`data:image/jpeg;base64,${'A'.repeat(220001)}`])assert.throws(()=>validateReport({...valid,photos:[photo]}));});
test('shared reports require evidence, known artifact and bounded strings',()=>{for(const change of [{features:' '},{artifactId:'unknown'},{name:'a'.repeat(25)},{photos:[]},{id:'../other-room'}])assert.throws(()=>validateReport({...valid,...change}));});
test('server controls timestamps and discards client extras',()=>{const report=validateReport({...valid,createdAt:'1900',admin:true});assert.equal(report.type,'report');assert.equal(report.admin,undefined);assert.notEqual(report.createdAt,'1900');});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(body){this.body=body;return this;}};}
test('storage missing is explicit and does not pretend report was shared',async()=>{const previous=process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_URL;try{let res=response();await handler({method:'GET',query:{status:'1'},headers:{}},res);assert.deepEqual(res.body,{enabled:false});res=response();await handler({method:'POST',query:{},headers:{}},res);assert.equal(res.code,503);}finally{if(previous)process.env.UPSTASH_REDIS_REST_URL=previous;}});
