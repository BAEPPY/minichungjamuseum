import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {MAP_LAYOUT} from '../src/map-layout.js';
import {seedCompletedComparison,waitForMapSettled,moveToCourseDestination} from './helpers/course.js';

test.setTimeout(210000);
const worldCanvas=page=>page.locator('#gameWorld > canvas');
const diagnostics=page=>worldCanvas(page).evaluate(canvas=>canvas.getWorldDiagnostics());
const load=async page=>{await page.goto('/');await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:60000});};

// These timing samples describe this Chromium software-GPU test environment,
// not a guarantee about thirty physical devices or a real school network.
async function frameSample(page){
 return page.evaluate(()=>new Promise(resolve=>{
  const times=[];let previous=performance.now(),started=previous;
  const sample=now=>{times.push(now-previous);previous=now;if(now-started<4000){requestAnimationFrame(sample);return;}const sorted=[...times].sort((a,b)=>a-b);resolve({count:times.length,durationMs:now-started,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maximumMs:sorted.at(-1)});};
  requestAnimationFrame(sample);
 }));
}

// Deliberately explicit synthetic school report records; these are not claims
// of actual learners, collected student data or original artifact photographs.
async function fixtureDocument(page){
 await page.route('**/map-test-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('/map-test-fixture.html');
}
async function reportFixtures(page,count){
 await fixtureDocument(page);
 return page.evaluate(async count=>{
  const {prepareReport}=await import('/src/storage.js');
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=96;
  const context=canvas.getContext('2d');context.fillStyle='#729381';context.fillRect(0,0,128,96);context.fillStyle='#f0e6c7';context.font='16px sans-serif';context.fillText('TEST IMAGE',12,52);
  const photo=canvas.toDataURL('image/jpeg',.8),records=[];
  for(let i=0;i<count;i++)records.push(await prepareReport({id:crypto.randomUUID(),type:'report',artifactId:'incense',name:`시험 탐험가 ${i+1}`,title:`학급 시험 보고서 ${String(i+1).padStart(2,'0')}`,use:'향을 피운다.',features:`시험 기록 ${i+1}: 투각 무늬 사이에 구멍이 있다.`,excellence:'구멍과 문양이 반복된다.',life:'관찰한 문양을 근거로 설명했다.',photos:[photo],createdAt:new Date(Date.UTC(2026,0,1,0,0,count-i)).toISOString()}));
  return records;
 },count);
}

test('the live map loads only bounded lightweight 3D and pauses its shared renderer',async({page})=>{
 const errors=[],modelRequests=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.endsWith('.glb'))modelRequests.push(path);});
 await page.setViewportSize({width:1440,height:960});
 await seedCompletedComparison(page,{destination:'compare-peony',avatarName:'지도 성능 검사'});
 await load(page);
 await expect.poll(async()=>(await diagnostics(page)).map3d.renderCount,{timeout:60000}).toBeGreaterThan(5);
 const cold=await diagnostics(page);
 await waitForMapSettled(page);
 const initial=await diagnostics(page);
 expect(initial.map3d.contexts).toBe(1);expect(initial.map3d.loadedModels).toBeLessThanOrEqual(4);expect(initial.map3d.loadingModels).toBeLessThanOrEqual(1);
 expect(modelRequests.length).toBeGreaterThan(0);expect(modelRequests.every(path=>path.startsWith('/models/map/'))).toBe(true);
 expect(initial.map3d.failedPaths).toEqual([]);expect(initial.map3d.loadingModels).toBe(0);expect(initial.map3d.compilingModels??0).toBe(0);expect(initial.map3d.snapshots).toBeGreaterThanOrEqual(initial.map3d.visibleCount);
 const before=initial.map3d.renderCount;
 await expect.poll(async()=>(await diagnostics(page)).map3d.renderCount).toBeGreaterThan(before+5);
 const timing=await frameSample(page);expect(timing.count).toBeGreaterThan(12);
 await page.screenshot({path:'/workspace/game-linear-comparison-map.png'});
 await page.locator('#mapButton').click();
 await expect(page.locator('#mapDialog')).toBeVisible();
 await expect.poll(async()=>(await diagnostics(page)).map3d.paused).toBe(true);
 const pausedCount=(await diagnostics(page)).map3d.renderCount;
 await page.waitForTimeout(350);
 expect((await diagnostics(page)).map3d.renderCount).toBe(pausedCount);
 await page.locator('#mapDialog [data-close]').click();
 await expect.poll(async()=>(await diagnostics(page)).map3d.renderCount).toBeGreaterThan(pausedCount);
 // Simulate the page-visibility notification explicitly; no physical-device
 // background performance claim is inferred from this controlled event.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(120);
 const hiddenCount=(await diagnostics(page)).map3d.renderCount;
 await page.waitForTimeout(350);expect((await diagnostics(page)).map3d.renderCount).toBe(hiddenCount);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(async()=>(await diagnostics(page)).map3d.renderCount).toBeGreaterThan(hiddenCount);
 // Follow the actual navigation route once, without a map teleport.
 await page.locator('#guideButton').click();
 await expect(page.locator('#nearName')).toHaveText('청자 상감 모란·구름·학무늬 베개',{timeout:30000});
 await moveToCourseDestination(page,'ewer','청자 어룡형 주전자');
 await expect.poll(async()=>(await diagnostics(page)).map3d.activeId).toBe('ewer');
 await expect.poll(async()=>(await diagnostics(page)).map3d.requestedPaths.includes('/models/map/celadon-ewer.glb'),{timeout:30000}).toBe(true);
 const end=await diagnostics(page);
 expect(end.map3d.contexts).toBe(1);expect(end.map3d.loadedModels).toBeLessThanOrEqual(4);expect(end.map3d.loadingModels).toBeLessThanOrEqual(1);
 expect(modelRequests.every(path=>path.startsWith('/models/map/'))).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:'/workspace/game-linear-five-map.png'});
 await writeFile('/workspace/game-map-performance.json',JSON.stringify({environment:'Chromium + SwiftShader in cloud executor; one browser',timing,cold,initial,final:end,modelRequests,pageErrors:errors},null,2));
});

test('thirty shared reports occupy distinct stands and fetch details only when selected',async({page})=>{
 const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:960});
 await seedCompletedComparison(page,{position:MAP_LAYOUT.spawns.exhibition,galleryReady:true,avatarName:'전시실 검사',progressOverrides:{inside:false,exited:true}});
 const full=await reportFixtures(page,30),summaries=full.map(({id,artifactId,name,title,features,thumbnail,createdAt})=>({id,type:'report-summary',artifactId,name,title,features,thumbnail,createdAt}));
 expect(summaries.every(record=>!('photos'in record)&&!('course'in record))).toBe(true);
 await page.evaluate(async report=>{
  const {get,put}=await import('/src/storage.js'),{courseRecord}=await import('/src/course.js');
  const course=courseRecord((await get('notebook')).entries,await get('comparison-draft'));
  await put({id:'ready-report',published:true,report:{...report,artifactId:'ewer',course}});
  await put({id:'draft',artifactId:'ewer',name:report.name,title:report.title,photos:report.photos});
 },full[0]);
 await page.evaluate(()=>localStorage.setItem('classCode','test-class-gallery-30'));
 await page.route('**/api/reports*',async route=>{
  const url=new URL(route.request().url());requests.push({method:route.request().method(),query:url.search});
  if(url.searchParams.get('status')==='1')return route.fulfill({json:{enabled:true}});
  expect(route.request().headers()['x-class-code']).toBe('test-class-gallery-30');
  if(url.searchParams.get('view')==='summary')return route.fulfill({json:{reports:summaries,nextCursor:null}});
  const id=url.searchParams.get('id');if(id)return route.fulfill({json:{report:full.find(record=>record.id===id)}});
  throw Error(`Unexpected full-list request ${url.search}`);
 });
 await load(page);
 await expect(worldCanvas(page)).toHaveAttribute('data-report-count','30');
 const before=await diagnostics(page),stands=before.hotspots.filter(item=>item.type==='report');
 expect(stands).toHaveLength(30);expect(new Set(stands.map(item=>item.position.join(','))).size).toBe(30);
 for(let i=0;i<stands.length;i++)for(let j=i+1;j<stands.length;j++){
  const [x,z]=stands[i].position,[ox,oz]=stands[j].position;
  // At scale1 every pair leaves either horizontal or vertical frame clearance.
  const dx=Math.abs((x-z-ox+oz)*32),dy=Math.abs((x+z-ox-oz)*16);
  expect(dx>=125||dy>=170,`Report stands ${i} and ${j} overlap`).toBe(true);
 }
 expect(before.visibleReports).toBeLessThan(30);
 expect(requests.filter(request=>new URLSearchParams(request.query).has('id'))).toHaveLength(0);
 await page.screenshot({path:'/workspace/game-thirty-report-hall.png'});
 await page.locator('#mapButton').click();
 await expect(page.locator('#mapReportList [data-report-destination]')).toHaveCount(30);
 await page.locator(`[data-report-destination="${full[29].id}"]`).click();
 await expect(page.locator('#mapDialog')).not.toBeVisible();
 await expect(page.locator('#nearName')).toHaveText(full[29].title);
 await page.locator('#interactButton').click();
 await expect(page.locator('#readDialog')).toBeVisible();
 await expect(page.locator('#readContent')).toContainText(full[29].title);
 await expect(page.locator('#readContent')).toContainText(full[29].features);
 await expect(page.locator('#readContent .read-photos img')).toHaveCount(1);
 expect(requests.filter(request=>new URLSearchParams(request.query).has('id'))).toEqual([{method:'GET',query:'?id='+full[29].id}]);
 await page.screenshot({path:'/workspace/game-thirty-report-selected.png'});
 await page.locator('#readDialog [data-close]').click();
 const timing=await frameSample(page),after=await diagnostics(page);
 expect(timing.count).toBeGreaterThan(12);expect(after.visibleReports).toBeLessThan(30);
 const readyBefore=await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return await get('ready-report');});
 await moveToCourseDestination(page,'revisit-incense','청자 투각 칠보문 뚜껑 향로');
 await page.locator('#interactButton').click();
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:45000});
 await expect(page.locator('#objectName')).toHaveText('청자 투각 칠보문 뚜껑 향로');
 await expect(page.locator('#chooseForReport')).toHaveText(/전시실로 돌아가기/);
 await page.locator('#chooseForReport').click();
 await expect(page.locator('#observationDialog')).not.toBeVisible();
 await expect(page.locator('#reportDialog')).not.toBeVisible();
 expect(await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return await get('ready-report');})).toEqual(readyBefore);
 expect(await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return (await get('draft')).artifactId;})).toBe('ewer');
 await expect(worldCanvas(page)).toHaveAttribute('data-report-count','30');
 expect(errors).toEqual([]);
 await writeFile('/workspace/game-thirty-report-diagnostics.json',JSON.stringify({fixture:'30 synthetic report summaries, API detail fixture; not live class load test',summaryBytes:Buffer.byteLength(JSON.stringify({reports:summaries,nextCursor:null})),timing,world:after,requests,pageErrors:errors},null,2));
});

test('existing IndexedDB reports migrate to a compact gallery index without losing records',async({page})=>{
 await fixtureDocument(page);
 const migration=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;canvas.getContext('2d').fillRect(0,0,16,16);
  const report={id:crypto.randomUUID(),type:'report',artifactId:'incense',name:'이전 기록',title:'이전 보고서 보존',features:'이전에 쓴 특징',use:'향을 피운다',excellence:'투각 문양',life:'관찰 근거',photos:[canvas.toDataURL('image/jpeg')],createdAt:'2026-01-01T00:00:00.000Z'};
  const legacy=await new Promise((resolve,reject)=>{const request=indexedDB.open('celadon-museum',1);request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise((resolve,reject)=>{const transaction=legacy.transaction('records','readwrite');const store=transaction.objectStore('records');store.put(report);store.put({id:'notebook',entries:{incense:{features:'보존할 관찰 메모',photos:report.photos}}});store.put({id:'native-model-stool',type:'native-model',file:new Blob([new Uint8Array(512000)],{type:'model/gltf-binary'})});transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});
  legacy.close();
  const {localReportSummaries,get,put,remove}=await import('/src/storage.js');
  const summaries=await localReportSummaries(),retained=await get(report.id),notebook=await get('notebook'),model=await get('native-model-stool');
  await put({...retained,title:'바뀐 보고서 제목'});
  const updated=await localReportSummaries();
  await remove(report.id);const removed=await localReportSummaries();
  const version=await new Promise((resolve,reject)=>{const request=indexedDB.open('celadon-museum');request.onsuccess=()=>{resolve(request.result.version);request.result.close();};request.onerror=()=>reject(request.error);});
  return {report,summaries,retained,notebook,modelBytes:model.file.size,updated,removed,version};
 });
 expect(migration.version).toBe(2);expect(migration.summaries).toHaveLength(1);
 expect(migration.summaries[0]).toMatchObject({id:migration.report.id,type:'report-summary',title:'이전 보고서 보존'});
 expect(migration.summaries[0]).not.toHaveProperty('photos');expect(migration.summaries[0]).not.toHaveProperty('course');
 expect(migration.retained).toEqual(migration.report);expect(migration.notebook.entries.incense.features).toBe('보존할 관찰 메모');expect(migration.modelBytes).toBe(512000);
 expect(migration.updated[0].title).toBe('바뀐 보고서 제목');expect(migration.removed).toEqual([]);
});
