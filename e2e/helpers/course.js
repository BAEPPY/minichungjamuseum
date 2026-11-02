import {expect} from '@playwright/test';

/** Isolate a later viewer/report test from the already-tested comparison UI.
 * These are explicit stored-progress fixtures, not proof of the real 3-vase
 * journey and not substitute models for the Japanese comparison exhibit. */
export async function seedCompletedComparison(page,{position,destination,avatarName='청자 탐험가',galleryReady=false,visited,entries={},progressOverrides={}}={}){
 await page.goto('/favicon.svg');
 await page.evaluate(async options=>{
  const {put,get}=await import('/src/storage.js');
  const {COURSE_VERSION}=await import('/src/course.js');
  const {comparisonIds}=await import('/src/comparison-artifacts.js');
  const {artifacts}=await import('/src/artifacts.js');
  const {MAP_LAYOUT,mapDestination}=await import('/src/map-layout.js');
  const target=options.destination&&mapDestination(options.destination);
  const start=target?{x:target.position[0],z:target.position[1]+1.8,inside:target.inside}:options.position||MAP_LAYOUT.spawns.study;
  const notebook=await get('notebook')||{id:'notebook',entries:{}};
  notebook.entries||={};
  for(const id of comparisonIds)notebook.entries[id]={photos:[],features:'격리된 뷰어 검사를 위한 기존 비교 관찰 기록',...notebook.entries[id]};
  if(options.galleryReady)for(const artifact of artifacts)notebook.entries[artifact.id]={photos:[],features:'격리된 보고서 검사를 위한 기존 청자 특징 기록',...notebook.entries[artifact.id]};
  for(const [id,record] of Object.entries(options.entries))notebook.entries[id]={...notebook.entries[id],...record};
  await put(notebook);
  const savedComparison=await get('comparison-draft');
  await put({id:'comparison-draft',excellence:'격리 검사를 위한 기존 고려청자 비교 생각',evidence:'격리 검사를 위한 기존 관찰 근거',...savedComparison});
  await put({id:'game-progress',making:[],inside:true,exited:false,profileReady:true,avatarHair:'short',avatarName:options.avatarName,avatarColor:'#eccd79',collectionVersion:'selected-celadon-v1',courseVersion:COURSE_VERSION,mapVersion:MAP_LAYOUT.version,comparisonVisited:[...comparisonIds],comparisonCompleted:true,visited:options.visited??(options.galleryReady?artifacts.map(a=>a.id):[]),position:start,...options.progressOverrides});
 },{position,destination,avatarName,galleryReady,visited,entries,progressOverrides});
}

export async function moveToCourseDestination(page,id,name){
 await page.locator('#mapButton').click();
 await page.locator(`[data-destination="${id}"]`).click();
 await expect(page.locator('#mapDialog')).not.toBeVisible();
 if(name)await expect(page.locator('#nearName')).toHaveText(name,{timeout:20000});
 await expect(page.locator('#interactButton')).toBeVisible();
}

/** Reporting is allowed only at the final desk; viewer tests explicitly travel there. */
export async function openReportAtDesk(page){
 await page.locator('#chooseForReport').click();
 await expect(page.locator('#observationDialog')).not.toBeVisible();
 await expect(page.locator('#reportDialog')).not.toBeVisible();
 await moveToCourseDestination(page,'desk','관람 보고서 작성');
 await page.locator('#interactButton').click();
 await expect(page.locator('#reportDialog')).toBeVisible();
}

/** Require a stable, fully prepared viewport before sampling steady frame time. */
export async function waitForMapSettled(page){
 await page.locator('#gameWorld > canvas').evaluate(canvas=>new Promise((resolve,reject)=>{
  const start=performance.now();let stableSince=0,previous='';
  const poll=()=>{const s=canvas.getWorldDiagnostics().map3d,now=performance.now(),signature=[s.visibleCount,s.requestedPaths.length,s.snapshots].join(':');const settled=s.visibleCount>0&&s.loadingModels===0&&(s.compilingModels??0)===0&&s.snapshots>=s.visibleCount&&s.renderCount>5;
   if(settled&&signature===previous){stableSince||=now;if(now-stableSince>1500){resolve();return;}}else stableSince=0;
   previous=signature;if(now-start>45000){reject(Error('Map did not settle before warm sample'));return;}setTimeout(poll,100);};poll();
 }));
}
