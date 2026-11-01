import {test,expect} from '@playwright/test';
import {seedCompletedComparison,moveToCourseDestination} from './helpers/course.js';

test.setTimeout(210000);
const comparisonIds=['compare-peony','compare-yuan','compare-inlay'];
const galleryIds=['pillow','stool','incense','maebyeong','ewer'];
const deskPosition={x:-4,z:-10.3,inside:true};

async function loadMuseum(page){
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:60000});
}
async function progress(page){
 return page.evaluate(async()=>{const {get}=await import('/src/storage.js');return await get('game-progress');});
}
async function seedStart(page,{position={x:-7,z:1.4,inside:true},entries={}}={}){
 await page.goto('/favicon.svg');
 await page.evaluate(async({position,entries})=>{
  const {put}=await import('/src/storage.js');const {COURSE_VERSION}=await import('/src/course.js');
  await put({id:'game-progress',profileReady:true,avatarName:'비교 탐험가',avatarColor:'#eccd79',avatarHair:'short',inside:true,exited:false,visited:[],making:[],comparisonVisited:[],comparisonCompleted:false,courseVersion:COURSE_VERSION,collectionVersion:'selected-celadon-v1',position});
  await put({id:'notebook',entries});
  await put({id:'comparison-draft',excellence:'',evidence:''});
 },{position,entries});
}
async function openComparison(page){
 await moveToCourseDestination(page,'comparison-desk');
 await page.keyboard.press('f');
 await expect(page.locator('#comparisonDialog')).toBeVisible();
}
async function expectGalleryLocked(page){
 await page.locator('#mapButton').click();
 await page.locator('[data-destination="pillow"]').click();
 await expect(page.locator('#mapDialog')).toBeVisible();
 await expect(page.locator('#gameToast')).toContainText('비교');
 await expect(page.locator('#observationDialog')).not.toBeVisible();
 await page.locator('#mapDialog [data-close]').click();
}

test('seeded comparison records still require three views, every note, a claim and evidence',async({page})=>{
 // This is a saved-record logic fixture. It does not substitute a model for,
 // or claim real observation of, the currently unavailable Japanese exhibit.
 await seedCompletedComparison(page,{position:deskPosition,progressOverrides:{comparisonCompleted:false,comparisonVisited:['compare-yuan','compare-inlay']}});
 await loadMuseum(page);
 await expectGalleryLocked(page);
 await openComparison(page);
 await expect(page.locator('#comparisonProgress')).toContainText('2/3');
 await page.locator('#finishComparison').click();
 await expect(page.locator('#comparisonDialog')).toBeVisible();
 await expect(page.locator('#gameToast')).toContainText('세 점을 모두');
 expect((await progress(page)).comparisonCompleted).toBe(false);

 await seedCompletedComparison(page,{position:deskPosition,entries:{'compare-peony':{features:''}},progressOverrides:{comparisonCompleted:false}});
 await loadMuseum(page);
 await openComparison(page);
 const peonyNote=page.locator('#comparisonRecords [data-comparison-note="compare-peony"]');
 await page.locator('#finishComparison').click();
 expect(await peonyNote.evaluate(input=>input.validity.valueMissing)).toBe(true);
 expect((await progress(page)).comparisonCompleted).toBe(false);
 await peonyNote.fill('입은 작고 어깨가 넓으며 모란무늬가 새겨져 있다는 비교 기록');
 await page.locator('#comparisonExcellence').fill('');
 await page.locator('#finishComparison').click();
 expect(await page.locator('#comparisonExcellence').evaluate(input=>input.validity.valueMissing)).toBe(true);
 await page.locator('#comparisonExcellence').fill('고려청자는 검고 흰 무늬의 대비가 눈에 띈다.');
 await page.locator('#comparisonEvidence').fill('');
 await page.locator('#finishComparison').click();
 expect(await page.locator('#comparisonEvidence').evaluate(input=>input.validity.valueMissing)).toBe(true);
 expect((await progress(page)).comparisonCompleted).toBe(false);
 await page.locator('#comparisonEvidence').fill('세 작품의 표면 기록을 비교하면 고려 매병에 학과 구름의 검고 흰 무늬가 있다.');
 await expect(page.locator('#comparisonStatus')).toContainText('저장했어요');
 const before=(await progress(page)).position;
 await page.locator('#finishComparison').click();
 await expect(page.locator('#comparisonDialog')).not.toBeVisible();
 await expect(page.locator('#makingProgress')).toHaveText('비교 ✓');
 // The continuation must initiate its own walk; a map teleport would conceal
 // a navigation route canceled while the comparison dialog closes.
 await expect.poll(async()=>{const p=(await progress(page)).position;return Math.hypot(p.x-before.x,p.z-before.z);},{timeout:20000}).toBeGreaterThan(.75);
 await expect(page.locator('#nearName')).toHaveText('청자 상감 모란·구름·학무늬 베개',{timeout:30000});
 await openComparison(page);
 await expect(peonyNote).toHaveValue('입은 작고 어깨가 넓으며 모란무늬가 새겨져 있다는 비교 기록');
 await page.locator('#comparisonEvidence').fill('');
 await expect(page.locator('#comparisonStatus')).toContainText('저장했어요');
 await expect(page.locator('#makingProgress')).not.toHaveClass(/done/);
 await page.locator('#comparisonDialog [data-close]').click();
 await expectGalleryLocked(page);
});

test('a pending comparison source cannot be captured or counted and there is no video lesson',async({page})=>{
 await seedStart(page);
 await loadMuseum(page);
 // Explicitly simulate a missing source so the guard remains covered after
 // the real Japanese file is eventually supplied. No fake 3D model is used.
 await page.evaluate(async()=>{
  const {comparisonArtifacts}=await import('/src/comparison-artifacts.js');
  const artifact=comparisonArtifacts.find(a=>a.id==='compare-peony');
  artifact.nativePending=true;delete artifact.model;
 });
 await expect(page.locator('video,iframe')).toHaveCount(0);
 await expect(page.locator('#videoDialog,#videoHost,[data-destination="video"]')).toHaveCount(0);
 await moveToCourseDestination(page,'compare-peony');
 await page.keyboard.press('f');
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#objectKind')).toContainText('준비 중');
 await expect(page.locator('#takePhoto')).toBeDisabled();
 await expect(page.locator('#chooseForReport')).toBeDisabled();
 await expect(page.locator('#objectCanvas canvas,#objectCanvas iframe')).toHaveCount(0);
 expect((await progress(page)).comparisonVisited).not.toContain('compare-peony');
 await page.locator('#observationDialog [data-close]').first().click();
 await openComparison(page);
 for(const id of comparisonIds)await page.locator(`#comparisonRecords [data-comparison-note="${id}"]`).fill('기록을 써도 준비 중인 자료를 관찰했다고 처리하면 안 된다.');
 await page.locator('#comparisonExcellence').fill('생각만 적은 상태');
 await page.locator('#comparisonEvidence').fill('아직 실제 관찰을 마치지 않은 상태');
 await page.locator('#finishComparison').click();
 await expect(page.locator('#comparisonDialog')).toBeVisible();
 await expect(page.locator('#gameToast')).toContainText('세 점을 모두');
 expect((await progress(page)).comparisonCompleted).toBe(false);
 await page.locator('#comparisonDialog [data-close]').click();
 await expectGalleryLocked(page);
});

test('a failed real comparison model stays unvisited, then a successful retry preserves photos and notes',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/models/yuan-celadon-vase.glb',route=>route.abort('failed'));
 await seedStart(page,{position:{x:-4,z:-3.2,inside:true}});
 await loadMuseum(page);
 await moveToCourseDestination(page,'compare-yuan');
 await page.keyboard.press('f');
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#gameToast')).toContainText('관찰 자료를 열지 못했어요.');
 await expect(page.locator('#takePhoto')).toBeDisabled();
 expect((await progress(page)).comparisonVisited).not.toContain('compare-yuan');
 await page.locator('#observationDialog [data-close]').first().click();
 // Reopen immediately: a queued close event must not destroy the new viewer.
 await page.unroute('**/models/yuan-celadon-vase.glb');
 await page.keyboard.press('f');
 if(!await page.locator('#observationDialog').evaluate(dialog=>dialog.open))console.log('Yuan retry focus diagnostic',await page.evaluate(()=>({activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id,near:document.querySelector('#nearName')?.textContent,openDialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>dialog.id)})));
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#objectName')).toContainText('원나라');
 await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:60000});
 await expect(page.locator('#objectName')).toContainText('원나라');
 await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
 await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
 await expect(page.locator('#objectLicense')).toHaveAttribute('href','https://creativecommons.org/licenses/by-nc-sa/4.0/');
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 const photo=await page.locator('#photoTray img').getAttribute('src');
 expect(photo).toMatch(/^data:image\/jpeg;base64,/);
 const note='중국 원나라 병의 세로로 도드라진 몸통과 고리를 직접 보았다.';
 await page.locator('#observationNote').fill(note);
 await expect(page.locator('#noteStatus')).toContainText('저장했어요');
 await page.screenshot({path:'/workspace/game-comparison-yuan.png'});
 await page.locator('#chooseForReport').click();
 await expect(page.locator('#comparisonDialog')).toBeVisible();
 await expect(page.locator('#comparisonRecords [data-comparison-note="compare-yuan"]')).toHaveValue(note);
 await expect(page.locator('#comparisonRecords img')).toHaveCount(1);
 await page.locator('#comparisonExcellence').fill('서로 다른 장식 방법을 비교할 수 있다.');
 await page.locator('#comparisonEvidence').fill('원나라 병에는 손잡이와 고리가 보였다.');
 await expect(page.locator('#comparisonStatus')).toContainText('저장했어요');
 await page.reload();
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:60000});
 await openComparison(page);
 await expect(page.locator('#comparisonRecords [data-comparison-note="compare-yuan"]')).toHaveValue(note);
 await expect(page.locator('#comparisonRecords img')).toHaveCount(1);
 expect(await page.locator('#comparisonRecords img').getAttribute('src')).toBe(photo);
 await expect(page.locator('#comparisonExcellence')).toHaveValue('서로 다른 장식 방법을 비교할 수 있다.');
 await expect(page.locator('#comparisonEvidence')).toHaveValue('원나라 병에는 손잡이와 고리가 보였다.');
 expect((await progress(page)).comparisonVisited).toEqual(['compare-yuan']);
 expect((await progress(page)).visited).toEqual([]);
 expect((await progress(page)).comparisonCompleted).toBe(false);
 await page.locator('#comparisonDialog [data-close]').click();
 await expectGalleryLocked(page);
 expect(errors).toEqual([]);
});

test('legacy video completion cannot unlock the new course and earlier records remain intact',async({page})=>{
 await page.goto('/favicon.svg');
 const legacy=await page.evaluate(async()=>{
  const {put}=await import('/src/storage.js');
  const canvas=new OffscreenCanvas(16,16);const ctx=canvas.getContext('2d');ctx.fillStyle='#91a48e';ctx.fillRect(0,0,16,16);
  const bytes=new Uint8Array(await(await canvas.convertToBlob({type:'image/jpeg'})).arrayBuffer());
  const photo='data:image/jpeg;base64,'+btoa(String.fromCharCode(...bytes));
  const report={id:crypto.randomUUID(),type:'report',artifactId:'maebyeong',name:'이전 탐험가',title:'보존할 이전 보고서',use:'이전 쓰임 기록',features:'이전 매병 관찰 메모',excellence:'이전 우수성 기록',life:'이전 생활 기록',photos:[photo],createdAt:'2026-01-01T00:00:00.000Z'};
  await put(report);await put({id:'ready-report',published:false,report});
  await put({id:'notebook',entries:{maebyeong:{features:report.features,photos:[photo]}}});
  await put({id:'game-progress',inside:true,exited:false,profileReady:true,avatarName:'이전 탐험가',avatarColor:'#eccd79',avatarHair:'short',collectionVersion:'selected-celadon-v1',courseVersion:'old-video-course',videoCompleted:true,videoId:'YM7FhGcR_5E',making:[0,1,2,3,4,5],visited:['pillow','stool','incense','maebyeong','ewer'],position:{x:8,z:2.8,inside:true}});
  return {id:report.id,photo};
 });
 await loadMuseum(page);
 await expect(page.locator('#makingProgress')).toHaveText('비교 0/3');
 await expect(page.locator('#reportProgress')).not.toHaveClass(/done/);
 await expect(page.locator('video,#videoDialog')).toHaveCount(0);
 await expect.poll(async()=>(await progress(page)).position).toMatchObject({x:-7,z:1.4,inside:true});
 expect((await progress(page)).comparisonVisited).toEqual([]);
 expect((await progress(page)).comparisonCompleted).toBe(false);
 expect((await progress(page)).visited).toEqual(galleryIds);
 await expectGalleryLocked(page);
 await page.locator('#notebookButton').click();
 await expect(page.locator('#notebookEntries')).toContainText('이전 매병 관찰 메모');
 await expect(page.locator('#notebookEntries img')).toHaveAttribute('src',legacy.photo);
 await page.locator('#notebookDialog [data-close]').click();
 await moveToCourseDestination(page,'exit');await page.keyboard.press('f');
 await expect(page.locator('#exitGame')).toBeDisabled();
 const retained=await page.evaluate(async id=>{const {get}=await import('/src/storage.js');return await get(id);},legacy.id);
 expect(retained.title).toBe('보존할 이전 보고서');expect(retained.photos).toEqual([legacy.photo]);

 // A learner who had already left/published in the previous course must be
 // guided back to the entrance, not trapped in the old publication loop.
 await page.goto('/favicon.svg');
 await page.evaluate(async id=>{
  const {get,put}=await import('/src/storage.js');
  const state=await get('game-progress');
  await put({...state,courseVersion:'old-video-course',inside:false,exited:true,position:{x:10,z:19,inside:false}});
  const report=await get(id);
  await put({id:'ready-report',published:true,report});
 },legacy.id);
 await loadMuseum(page);
 await expect(page.locator('#missionTitle')).toContainText('입구');
 expect(await progress(page)).toMatchObject({inside:false,exited:true,position:{x:10,z:19,inside:false}});
 await page.locator('#guideButton').click();
 // Observe its actual walk before using any map destination.
 await expect(page.locator('#nearName')).toHaveText('박물관 입장',{timeout:45000});
 const outsideRetained=await page.evaluate(async id=>{
  const {get}=await import('/src/storage.js');
  return {report:await get(id),notebook:await get('notebook')};
 },legacy.id);
 expect(outsideRetained.report.title).toBe('보존할 이전 보고서');
 expect(outsideRetained.report.photos).toEqual([legacy.photo]);
 expect(outsideRetained.notebook.entries.maebyeong.features).toBe('이전 매병 관찰 메모');
 expect(outsideRetained.notebook.entries.maebyeong.photos).toEqual([legacy.photo]);
});

test('editing comparison evidence invalidates an unpublished final report and gates the gallery again',async({page})=>{
 // An explicit completed-record fixture isolates revision handling. The real
 // three-vase observation journey is verified separately with actual assets.
 await seedCompletedComparison(page,{position:{x:0,z:-10.3,inside:true},galleryReady:true});
 await page.evaluate(async()=>{
  const {get,put}=await import('/src/storage.js');const {courseRecord}=await import('/src/course.js');
  const notes=(await get('notebook')).entries,comparison=await get('comparison-draft');
  const canvas=new OffscreenCanvas(16,16);canvas.getContext('2d').fillRect(0,0,16,16);
  const bytes=new Uint8Array(await(await canvas.convertToBlob({type:'image/jpeg'})).arrayBuffer()),photo='data:image/jpeg;base64,'+btoa(String.fromCharCode(...bytes));
  notes.incense.photos=[photo];await put({id:'notebook',entries:notes});
  await put({id:'ready-report',published:false,report:{id:crypto.randomUUID(),type:'report',artifactId:'incense',name:'기록 수정 탐험가',title:'수정 전 통합 보고서',photos:[photo],course:courseRecord(notes,comparison),use:'향을 피운다.',features:'다섯 청자의 특징',excellence:comparison.excellence,life:comparison.evidence,createdAt:'2026-01-01T00:00:00.000Z'}});
 });
 await loadMuseum(page);
 await expect(page.locator('#reportProgress')).toHaveClass(/done/);
 await moveToCourseDestination(page,'desk');await page.keyboard.press('f');
 await expect(page.locator('#reportDialog')).toBeVisible();
 await page.locator('#reportDialog [data-comparison-field="evidence"]').fill('');
 // Initial real-model thumbnails may still be rendering on software GPUs.
 await expect(page.locator('#draftStatus')).toContainText('임시 저장됨',{timeout:30000});
 await expect.poll(()=>page.evaluate(async()=>{const {get}=await import('/src/storage.js');return Boolean(await get('ready-report'));})).toBe(false);
 await expect(page.locator('#reportProgress')).not.toHaveClass(/done/);
 expect((await progress(page)).comparisonCompleted).toBe(false);
 await page.locator('#reportDialog [data-close]').click();
 await expectGalleryLocked(page);
 await page.reload();await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:60000});
 await expect(page.locator('#makingProgress')).not.toHaveClass(/done/);
 await expectGalleryLocked(page);
});
