import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {seedCompletedComparison,waitForMapSettled,moveToCourseDestination as destination} from './helpers/course.js';

test.setTimeout(300000);
const comparisonNames={
 'compare-peony':'청자 음인각 모란무늬 매병',
 'compare-yuan':'원나라 시대 청자 병',
 'compare-inlay':'청자 상감 운학문 매병'
};
const comparisonFeatures={
 'compare-peony':'모란무늬가 표면에 파여 있고 작은 입과 넓은 어깨가 보인다.',
 'compare-yuan':'몸통에 세로로 도드라진 줄과 동물 모양 손잡이, 고리가 보인다.',
 'compare-inlay':'학과 구름 무늬가 검고 흰 색으로 표현되어 있고 어깨가 둥글다.'
};
const galleryNames={
 maebyeong:'청자 상감 운학문 매병',ewer:'청자 어룡형 주전자',
 pillow:'청자 상감 모란·구름·학무늬 베개',stool:'청자 투각 의자',incense:'청자 투각 칠보문 뚜껑 향로'
};
const galleryFeatures={
 maebyeong:'작은 입과 넓은 어깨 아래로 학과 구름의 검고 흰 무늬가 반복된다.',
 ewer:'용을 닮은 머리와 물고기를 닮은 몸통, 손잡이가 함께 보인다.',
 pillow:'가운데가 들어간 윗면과 각 면의 꽃과 학 무늬를 비교했다.',
 stool:'겹친 고리 사이가 실제로 뚫려 있고 위쪽과 굽의 구멍도 보인다.',
 incense:'향로 뚜껑의 동그란 무늬가 서로 이어지며 여러 구멍이 뚫려 있다.'
};
const excellence='고려청자는 그릇의 곡선과 정교한 상감 무늬를 함께 표현한 점이 뛰어나다.';
const evidence='다른 두 병과 비교했을 때 고려 매병의 학과 구름이 검고 흰 색으로 구별되고 둥근 어깨를 따라 반복되어 보였다.';

// Detached/shared reports must carry the actual source attribution, not merely
// a link in the page that displayed the model. Keep expectations independent
// of the application's credit-generation function.
const expectedYuanCredit={
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
};
function expectCourseRecord(course,base){
 expect(course).toMatchObject(base);
 expect(course.sourceCredits).toEqual([expectedYuanCredit]);
}

async function enter(page){
 await page.goto('/');
 await expect(page.locator('#profileDialog')).toBeVisible();
 await page.locator('#profileNickname').fill('연꽃탐험가');
 await page.locator('#profileEnter').click();
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await destination(page,'entrance','박물관 입장');
 await page.locator('#interactButton').click();
 await page.locator('#enterGame').click();
 await expect(page.locator('#locationName')).toContainText('비교와 탐구');
}
async function openObservation(page,id,name){
 await destination(page,id,name);
 await page.locator('#interactButton').click();
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#objectName')).toHaveText(name);
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:45000});
 await expect(page.locator('#objectCanvas canvas')).toHaveCount(1);
 await expect(page.locator('#objectCanvas iframe')).toHaveCount(0);
}
const closeObservation=page=>page.locator('#observationDialog [data-close]').first().click();
const reports=page=>page.evaluate(async()=>{const {all}=await import('/src/storage.js');return (await all()).filter(r=>r.type==='report');});

test('full-screen world: compare three actual vases, record five celadons, publish one combined report',async({page})=>{
 // Require the documented original photographs or a native model for every work.
 await page.goto('/favicon.svg');
 const sourcesReady=await page.evaluate(async()=>{const {comparisonArtifacts}=await import('/src/comparison-artifacts.js');return comparisonArtifacts.every(a=>!a.nativePending&&Boolean(a.model||a.photoView));});
 expect(sourcesReady,'Every comparison exhibit must have its documented original photos or native model.').toBe(true);
 const errors=[],museumRequests=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{const url=new URL(request.url());if(url.hostname==='museum.go.kr'||url.hostname.endsWith('.museum.go.kr'))museumRequests.push(request.url());});
 await enter(page);
 // Separate cold shader/model preparation from a settled map timing sample.
 await waitForMapSettled(page);
 const warmMap=await page.locator('#gameWorld > canvas').evaluate(canvas=>new Promise(resolve=>{
  const before=canvas.getWorldDiagnostics(),intervals=[];let previous=performance.now(),start=previous;
  function sample(now){intervals.push(now-previous);previous=now;if(now-start<4000){requestAnimationFrame(sample);return;}const sorted=[...intervals].sort((a,b)=>a-b);resolve({environment:'Chromium SwiftShader, one browser; visible map models loaded',before,after:canvas.getWorldDiagnostics(),frames:intervals.length,durationMs:now-start,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1)});}requestAnimationFrame(sample);
 }));
 await writeFile('/workspace/game-map-warm-performance.json',JSON.stringify(warmMap,null,2));
 await page.screenshot({path:'/workspace/game-course-entrance-map.png'});
 await expect(page.locator('video,iframe')).toHaveCount(0);
 await expect(page.locator('#videoDialog,[data-destination="video"]')).toHaveCount(0);
 // Seeing a later gallery object cannot bypass the comparison worksheet.
 await page.locator('#mapButton').click();
 await page.locator('[data-destination="maebyeong"]').click();
 await expect(page.locator('#mapDialog')).toBeVisible();
 await expect(page.locator('#gameToast')).toContainText('비교 기록');
 await page.locator('#mapDialog [data-close]').click();

 for(const [id,name] of Object.entries(comparisonNames)){
  await openObservation(page,id,name);
  if(id==='compare-peony'){
   const hybrid=page.locator('#objectCanvas .pillow-viewer');
   await expect(hybrid).toHaveAttribute('data-mode','model');
   await expect(hybrid).toHaveAttribute('data-state','ready');
   await expect(page.locator('#modelSource')).toContainText('사진 기반 3D 재현');
   await page.locator('[data-pillow-mode="photos"]').click();
   await expect(hybrid).toHaveAttribute('data-mode','photos');
   await expect(hybrid).toHaveAttribute('data-state','ready',{timeout:30000});
   await expect(page.locator('#modelSource')).toContainText('원본 다각도 사진 54장');
   const canvas=page.locator('#objectCanvas canvas');
   await expect(canvas).toHaveAttribute('data-frame','2_4.jpg');
   await canvas.focus();await page.keyboard.press('ArrowRight');
   await expect(canvas).toHaveAttribute('data-frame','2_5.jpg');
   await page.keyboard.press('+');
   expect(Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(1);
  }
  await page.locator('#observationNote').fill(comparisonFeatures[id]);
  await page.locator('#takePhoto').click();
  await expect(page.locator('#photoTray img')).toHaveCount(1);
  await expect(page.locator('#noteStatus')).toContainText('저장했어요');
  if(id==='compare-yuan')await expect(page.locator('#objectLicense')).toHaveAttribute('href','https://creativecommons.org/licenses/by-nc-sa/4.0/');
  await closeObservation(page);
 }
 const afterComparisonViews=await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return await get('game-progress');});
 expect(new Set(afterComparisonViews.comparisonVisited)).toEqual(new Set(Object.keys(comparisonNames)));
 expect(afterComparisonViews.visited).toEqual([]);
 await destination(page,'comparison-desk','세 점 비교 기록');
 await page.locator('#interactButton').click();
 await expect(page.locator('#comparisonDialog')).toBeVisible();
 for(const [id,note] of Object.entries(comparisonFeatures))await expect(page.locator(`#comparisonDialog [data-comparison-note="${id}"]`)).toHaveValue(note);
 await page.locator('#comparisonExcellence').fill(excellence);
 await page.locator('#comparisonEvidence').fill(evidence);
 await page.screenshot({path:'/workspace/game-comparison.png'});
 await page.locator('#finishComparison').click();
 await expect(page.locator('#comparisonDialog')).not.toBeVisible();
 await expect(page.locator('#makingProgress')).toHaveText('비교 ✓');

 let galleryPhoto;
 for(const [index,[id,name]] of Object.entries(galleryNames).entries()){
  await openObservation(page,id,name);
  await page.locator('#observationNote').fill(galleryFeatures[id]);
  await expect(page.locator('#noteStatus')).toContainText('저장했어요');
  if(id==='incense'){
   await expect(page.locator('#modelSource')).toContainText('실제 스캔 형상');
   await page.locator('#referenceColor').uncheck();
   await expect(page.locator('#modelSource')).toContainText('원본 색상');
   await page.locator('#referenceColor').check();
   await page.locator('#takePhoto').click();
   await expect(page.locator('#photoTray img')).toHaveCount(1);
   galleryPhoto=await page.locator('#photoTray img').getAttribute('src');
   await page.locator('#chooseForReport').click();
  }else if(index===0){
   await page.locator('#chooseForReport').click();
   await expect(page.locator('#reportDialog')).not.toBeVisible();
   await expect(page.locator('#gameToast')).toContainText('나머지 청자');
  }else await closeObservation(page);
 }
 // The final worksheet belongs only at the desk, even after all five notes.
 await expect(page.locator('#reportDialog')).not.toBeVisible();
 await destination(page,'desk','관람 보고서 작성');
 await page.locator('#interactButton').click();
 await expect(page.locator('#reportDialog')).toBeVisible();
 await expect(page.locator('#visitProgress')).toHaveText('청자 5/5 · 기록 5/5');
 const deskPosition=await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return (await get('game-progress')).position;});
 await page.locator('#reportDialog [data-comparison-field="evidence"]').fill('');
 await expect(page.locator('#makingProgress')).not.toHaveClass(/done/);
 await page.locator('#reportGalleryRecords [data-observe-again="incense"]').click();
 await expect(page.locator('#observationDialog')).toBeVisible();
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:45000});
 await expect(page.locator('#objectName')).toHaveText(galleryNames.incense);
 await expect(page.locator('#observationNote')).toHaveValue(galleryFeatures.incense);
 await expect(page.locator('#chooseForReport')).toHaveText(/보고서로 돌아가기/);
 await page.locator('#chooseForReport').click();
 await expect(page.locator('#reportDialog')).toBeVisible();
 expect(await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return (await get('game-progress')).position;})).toEqual(deskPosition);
 await expect(page.locator('#reportDialog [data-comparison-field="evidence"]')).toHaveValue('');
 await page.locator('#reportDialog [data-comparison-field="evidence"]').fill(evidence);
 await expect(page.locator('#makingProgress')).toHaveClass(/done/);
 for(const [id,note] of Object.entries(galleryFeatures))await expect(page.locator(`#reportGalleryRecords [data-gallery-note="${id}"]`)).toHaveValue(note);
 await expect(page.locator('#reportDialog [data-comparison-field="excellence"]')).toHaveValue(excellence);
 await expect(page.locator('#reportDialog [data-comparison-field="evidence"]')).toHaveValue(evidence);
 await expect(page.locator('#reportPhotoChoices [data-report-photo]')).toHaveCount(4);
 await expect(page.locator('#reportPhotos img')).toHaveCount(3);
 const choices=await page.locator('[data-report-photo]').evaluateAll(buttons=>buttons.map(button=>({index:button.dataset.reportPhoto,photo:button.querySelector('img').getAttribute('src')})));
 const galleryChoice=choices.find(choice=>choice.photo===galleryPhoto);
 expect(galleryChoice).toBeTruthy();
 await page.locator(`[data-report-photo="${galleryChoice.index}"]`).click();
 await expect(page.locator('#gameToast')).toContainText('최대 3장');
 await expect(page.locator('#reportPhotos img')).toHaveCount(3);
 await page.locator('[data-report-photo="0"]').click();
 await page.locator(`[data-report-photo="${galleryChoice.index}"]`).click();
 expect(await page.locator('#reportPhotos img').evaluateAll(images=>images.map(image=>image.getAttribute('src')))).toContain(galleryPhoto);
 await page.locator('#reportForm [name="name"]').fill('연꽃 탐험가');
 const title='세 나라 비교에서 찾은 고려의 아름다움';
 await page.locator('#reportForm [name="title"]').fill(title);
 await page.locator('#reportForm [name="review"]').check();
 await page.screenshot({path:'/workspace/game-course-report.png'});
 await page.locator('#reportForm [type="submit"]').click();
 await expect(page.locator('#reportDialog')).not.toBeVisible();
 expect(await reports(page)).toHaveLength(0);
 const ready=await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return await get('ready-report');});
 const expectedCourse={comparison:{observations:comparisonFeatures,excellence,evidence},features:galleryFeatures};
 expectCourseRecord(ready.report.course,expectedCourse);
 expect(ready.report.photos).toHaveLength(3);
 expect(ready.published).toBe(false);

 await destination(page,'exit','관람을 마치고 전시실로');
 await page.locator('#interactButton').click();
 await expect(page.locator('#exitGame')).toBeEnabled();
 await page.locator('#exitGame').click();
 await expect(page.locator('#locationName')).toContainText('발견 전시실');
 await expect(page.locator('#nearName')).toHaveText('내 보고서 전시하기');
 await page.locator('#interactButton').click();
 await expect(page.locator('#publishReady')).toBeEnabled();
 await page.locator('#publishReady').click();
 await expect(page.locator('#exhibitProgress')).toHaveClass(/done/);
 const published=await reports(page);
 expect(published).toHaveLength(1);
 expect(published[0].course).toEqual(ready.report.course);
 expectCourseRecord(published[0].course,expectedCourse);
 await page.locator('#guideButton').click();
 await expect(page.locator('#nearName')).toHaveText(title,{timeout:20000});
 await page.screenshot({path:'/workspace/game-exhibition.png'});
 await page.locator('#interactButton').click();
 for(const value of [...Object.values(comparisonFeatures),...Object.values(galleryFeatures),excellence,evidence])await expect(page.locator('#readContent')).toContainText(value);
 await expect(page.locator('#readContent a[href="https://creativecommons.org/licenses/by-nc-sa/4.0/"]')).toHaveCount(1);
 await page.screenshot({path:'/workspace/game-shared-report.png'});
 expect(museumRequests).toEqual([]);
 expect(errors).toEqual([]);
});

test('world movement, location and notes restore after reload with a completed-comparison fixture',async({page})=>{
 // The comparison phase is a stored-progress fixture only for this isolated
 // persistence test. The complete real-data course is exercised above.
 await seedCompletedComparison(page,{destination:'incense',avatarName:'기록 탐험가'});
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText(galleryNames.incense);
 await page.locator('#interactButton').click();
 await expect(page.locator('#takePhoto')).toBeEnabled({timeout:45000});
 await page.locator('#takePhoto').click();
 await page.locator('#observationNote').fill('구멍이 이어진 향로');
 await expect(page.locator('#noteStatus')).toContainText('저장했어요');
 await closeObservation(page);
 await page.reload();
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText(galleryNames.incense);
 await expect(page.locator('#makingProgress')).toHaveText('비교 ✓');
 await page.locator('#interactButton').click();
 await expect(page.locator('#observationNote')).toHaveValue('구멍이 이어진 향로');
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 await closeObservation(page);
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(700);await page.keyboard.up('ArrowDown');
 expect(await page.evaluate(()=>document.documentElement.scrollHeight===innerHeight)).toBeTruthy();
 await page.screenshot({path:'/workspace/game-collection.png'});
});

test('mobile game fills the viewport and supports touch interaction with comparison exhibits',async({page})=>{
 test.setTimeout(150000);
 await page.setViewportSize({width:390,height:844});
 await enter(page);
 await expect(page.locator('.touch-pad')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight)).toBeTruthy();
 await expect(page.locator('video,iframe')).toHaveCount(0);
 await page.screenshot({path:'/workspace/game-mobile.png'});
 await openObservation(page,'compare-yuan',comparisonNames['compare-yuan']);
 await page.locator('#observationNote').fill('몸통의 세로 줄과 고리가 보인다.');
 await page.locator('#takePhoto').click();
 await expect(page.locator('#photoTray img')).toHaveCount(1);
 await expect(page.locator('#noteStatus')).toContainText('저장했어요');
 await page.screenshot({path:'/workspace/game-mobile-comparison.png'});
});

test('STORED-RECORD plumbing fixture combines eight notes and toy JPEGs into one final report',async({page})=>{
 test.setTimeout(180000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // This is stored-record/report plumbing only. It does not exercise the real
 // three-vase journey or replace the unavailable Japanese model. The tiny
 // color JPEGs below are explicit image fixtures, not artifact photographs.
 const comparisonNotes={
  'compare-peony':'STORED-RECORD 시험 · 일본 비교 특징 기록',
  'compare-yuan':'STORED-RECORD 시험 · 중국 원나라 비교 특징 기록',
  'compare-inlay':'STORED-RECORD 시험 · 고려 상감 비교 특징 기록'
 };
 const galleryNotes=Object.fromEntries(Object.keys(galleryNames).map(id=>[id,`STORED-RECORD 시험 · ${id} 특징 기록`]));
 const thought='STORED-RECORD 시험 · 고려청자의 우수한 점을 정리한 생각';
 const reason='STORED-RECORD 시험 · 세 점의 기록을 비교하여 정리한 근거';
 const title='저장 기록으로 정리한 단 하나의 보고서';
 const entries=Object.fromEntries(Object.entries({...comparisonNotes,...galleryNotes}).map(([id,features])=>[id,{features}]));
 await seedCompletedComparison(page,{destination:'desk',avatarName:'기록 시험 탐험가',galleryReady:true,entries});
 const toyPhotos=await page.evaluate(async({thought,reason,title})=>{
  const {get,put}=await import('/src/storage.js');
  const colors=['#c34942','#436cb8','#4b8e65','#d2ad39'];
  const photos=colors.map(color=>{const canvas=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=12;canvas.height=12;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,12,12);return canvas.toDataURL('image/jpeg',.8);});
  const notebook=await get('notebook');
  for(const [index,id] of ['compare-peony','compare-yuan','compare-inlay','incense'].entries())notebook.entries[id].photos=[photos[index]];
  await put(notebook);
  await put({id:'comparison-draft',excellence:thought,evidence:reason});
  await put({id:'draft',artifactId:'incense',name:'기록 시험 탐험가',title,photos:photos.slice(0,3)});
  return photos;
 },{thought,reason,title});
 expect(new Set(toyPhotos).size).toBe(4);
 await page.goto('/');
 await expect(page.locator('#gameLoading')).toHaveCount(0,{timeout:45000});
 await expect(page.locator('#nearName')).toHaveText('관람 보고서 작성');
 await expect(page.locator('video,iframe')).toHaveCount(0);
 await page.locator('#interactButton').click();
 await expect(page.locator('#reportDialog')).toBeVisible();
 await expect(page.locator('#reportComparisonRecords [data-comparison-note]')).toHaveCount(3);
 for(const [id,text] of Object.entries(comparisonNotes))await expect(page.locator(`#reportComparisonRecords [data-comparison-note="${id}"]`)).toHaveValue(text);
 await expect(page.locator('#reportGalleryRecords [data-gallery-note]')).toHaveCount(5);
 for(const [id,text] of Object.entries(galleryNotes))await expect(page.locator(`#reportGalleryRecords [data-gallery-note="${id}"]`)).toHaveValue(text);
 await expect(page.locator('#reportDialog [data-comparison-field="excellence"]')).toHaveValue(thought);
 await expect(page.locator('#reportDialog [data-comparison-field="evidence"]')).toHaveValue(reason);
 await expect(page.locator('#reportForm [name="title"]')).toHaveValue(title);
 await expect(page.locator('#reportPhotoChoices [data-report-photo]')).toHaveCount(4);
 await expect(page.locator('#reportPhotos img')).toHaveCount(3);
 await page.locator('[data-report-photo="3"]').click();
 await expect(page.locator('#gameToast')).toContainText('최대 3장');
 await expect(page.locator('[data-report-photo="3"]')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('#reportPhotos img')).toHaveCount(3);
 await page.locator('[data-report-photo="0"]').click();
 await page.locator('[data-report-photo="3"]').click();
 const selectedPhotos=toyPhotos.slice(1);
 expect(await page.locator('#reportPhotos img').evaluateAll(images=>images.map(image=>image.getAttribute('src')))).toEqual(selectedPhotos);
 await expect(page.locator('#reportPhotoChoices [aria-pressed="true"]')).toHaveCount(3);
 await expect(page.locator('#draftStatus')).toContainText('임시 저장됨');
 await page.locator('#reportForm [name="review"]').check();
 await page.screenshot({path:'/workspace/game-stored-course-report-fixture.png'});
 await page.locator('#reportForm [type="submit"]').click();
 await expect(page.locator('#reportDialog')).not.toBeVisible();
 const ready=await page.evaluate(async()=>{const {get}=await import('/src/storage.js');return await get('ready-report');});
 const expectedCourse={comparison:{observations:comparisonNotes,excellence:thought,evidence:reason},features:galleryNotes};
 expectCourseRecord(ready.report.course,expectedCourse);
 expect(ready.report.photos).toEqual(selectedPhotos);
 expect(ready.published).toBe(false);
 expect(await reports(page)).toHaveLength(0);

 await destination(page,'exit','관람을 마치고 전시실로');
 await page.locator('#interactButton').click();
 await expect(page.locator('#exitGame')).toBeEnabled();
 await page.locator('#exitGame').click();
 await expect(page.locator('#locationName')).toContainText('발견 전시실');
 await expect(page.locator('#nearName')).toHaveText('내 보고서 전시하기');
 await page.locator('#interactButton').click();
 await expect(page.locator('#publishReady')).toBeEnabled();
 await page.locator('#publishReady').click();
 await expect(page.locator('#exhibitProgress')).toHaveClass(/done/);
 const published=await reports(page);
 expect(published).toHaveLength(1);
 expectCourseRecord(published[0].course,expectedCourse);
 expect(published[0].photos).toEqual(selectedPhotos);
 await page.locator('#guideButton').click();
 await expect(page.locator('#nearName')).toHaveText(title,{timeout:20000});
 await page.locator('#interactButton').click();
 for(const text of [...Object.values(comparisonNotes),...Object.values(galleryNotes),thought,reason])await expect(page.locator('#readContent')).toContainText(text);
 expect(await page.locator('#readContent .read-photos img').evaluateAll(images=>images.map(image=>image.getAttribute('src')))).toEqual(selectedPhotos);
 await expect(page.locator('#readContent a[href="https://creativecommons.org/licenses/by-nc-sa/4.0/"]')).toHaveCount(1);
 // A downloaded JSON report must remain attributable when separated from the
 // site, including the collection/accession, scan authors and modification note.
 await page.locator('#readDialog [data-close]').click();
 await page.locator('#settingsButton').click();
 const downloadPromise=page.waitForEvent('download');
 await page.locator('#exportReports').click();
 const download=await downloadPromise;
 expect(await download.failure()).toBeNull();
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(exported).toHaveLength(1);
 expect(exported[0].type).toBe('report');
 expect(exported[0].id).toBe(published[0].id);
 expectCourseRecord(exported[0].course,expectedCourse);
 expect(exported[0].photos).toEqual(selectedPhotos);
 expect(errors).toEqual([]);
});
